"""The moment engine: which reward to surface, to whom, and when.

For each reward the member can afford, the trained uplift model estimates the
chance they redeem if notified now and if not. A notification goes out only
when it would change behaviour (uplift above the threshold), and only within
the member's own limits: quiet hours, a daily cap, and feedback they've given.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

from .features import Moment, predict, vector
from .models import Candidate, MomentDecision, MomentRequest, MomentResponse, Scored

MODEL = json.loads((Path(__file__).parent / "model" / "uplift_model.json").read_text())
THRESHOLD = MODEL["threshold"]
NEAR_ENOUGH_M = 600
EXPIRY_MOMENT_DAYS = 14

CATEGORY_NOUN = {
    "coffee": "coffee",
    "food": "food",
    "groceries": "grocery",
    "books": "bookstore",
    "entertainment": "cinema",
    "shopping": "shopping",
    "transport": "travel",
    "wellness": "wellness",
}


def bucket(hour: int) -> str:
    if 5 <= hour < 11:
        return "morning"
    if 11 <= hour < 14:
        return "midday"
    if 14 <= hour < 17:
        return "afternoon"
    if 17 <= hour < 22:
        return "evening"
    return "late night"


def distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(a)))


def in_quiet_hours(hour: int, minute: int, start: str, end: str) -> bool:
    t = hour * 60 + minute
    s = int(start[:2]) * 60 + int(start[3:5])
    e = int(end[:2]) * 60 + int(end[3:5])
    return s <= t < e if s < e else (t >= s or t < e)


def money(n: float) -> str:
    return f"${n:,.2f}".replace(".00", "")


def _score(req: MomentRequest, c: Candidate):
    ctx, h = req.context, req.habits
    cat = c.category
    merchant, dist = None, None
    if c.merchants:
        if req.prefs.locationAllowed and ctx.lat is not None and ctx.lng is not None:
            merchant = min(c.merchants, key=lambda m: distance_m(ctx.lat, ctx.lng, m.lat, m.lng))
            dist = distance_m(ctx.lat, ctx.lng, merchant.lat, merchant.lng)
        else:
            merchant = c.merchants[0]
    open_now = merchant is None or (merchant.opens <= ctx.hour < merchant.closes)
    shares = h.hourShare.get(cat or "", [])
    hour_share = shares[ctx.hour] if len(shares) == 24 else 1 / 24
    typical = h.typicalSpend.get(cat or "", 0)
    extra = max(0.0, (c.minSpend or 0) - typical) if c.minSpend else 0.0
    bad = req.ratings.get(f"{cat}:{bucket(ctx.hour)}")
    m = Moment(
        distance_m=dist,
        hour_share=hour_share,
        visits_per_week=h.visitsPerWeek.get(cat or "", 0),
        days_to_expiry=c.daysToExpiry if c.expiringPoints > 0 else None,
        value=c.value,
        extra_spend=extra,
        velocity=h.spendVelocity.get(cat or "", 1.0),
        open_now=open_now,
        bad_ratings=bad.bad if bad else 0,
    )
    x = vector(m)
    p1 = predict(MODEL["treated"], x)
    p0 = predict(MODEL["control"], x)
    return {"c": c, "merchant": merchant, "dist": dist, "open": open_now, "hour_share": hour_share, "extra": extra, "x": x, "p1": p1, "p0": p0, "uplift": p1 - p0, "bad": m.bad_ratings, "velocity": m.velocity}


def evaluate(req: MomentRequest) -> MomentResponse:
    ctx = req.context
    pool = [c for c in req.candidates if c.available >= c.cost]
    scored = [_score(req, c) for c in pool]
    # In-store rewards only count as a "moment" when the member is close and the shop is open.
    def eligible(s):
        if not s["c"].merchants:
            # No shop to be near: only worth a moment when its points are about to expire.
            c = s["c"]
            return "online" in c.channels and c.expiringPoints > 0 and c.daysToExpiry is not None and c.daysToExpiry <= EXPIRY_MOMENT_DAYS
        if "in_store" in s["c"].channels and s["dist"] is not None:
            return s["dist"] <= NEAR_ENOUGH_M and s["open"]
        return "online" in s["c"].channels

    # Net value: a minimum spend above the member's usual order eats into what they really gain.
    ranked = sorted(scored, key=lambda s: s["uplift"] * max(0.0, s["c"].value - s["extra"]), reverse=True)
    considered = [
        Scored(
            optionId=s["c"].optionId,
            programId=s["c"].programId,
            merchantId=s["merchant"].id if s["merchant"] else None,
            merchantName=s["merchant"].name if s["merchant"] else None,
            distanceM=s["dist"],
            pIfNotified=round(s["p1"], 3),
            pIfNot=round(s["p0"], 3),
            uplift=round(s["uplift"], 3),
            expectedExtraValue=round(s["uplift"] * s["c"].value, 2),
        )
        for s in ranked[:6]
    ]
    b = bucket(ctx.hour)
    options = [s for s in ranked if eligible(s)]
    if not options:
        return MomentResponse(
            decision=MomentDecision(
                sent=False, optionId=None, programId=None, merchantId=None, title="Nothing to send right now",
                body="None of your rewards can be used nearby at the moment.", reasons=[],
                suppressedBecause="No affordable reward is close enough or open right now.",
                uplift=0, pIfNotified=0, pIfNot=0, distanceM=None, bucket=b, category=None,
            ),
            considered=considered, model=MODEL["version"], threshold=THRESHOLD,
        )

    top = options[0]
    c, merchant, dist = top["c"], top["merchant"], top["dist"]
    place = merchant.name.split(",")[0] if merchant else c.programName
    near_txt = f"You’re {dist} m from {place}" if dist is not None and dist <= NEAR_ENOUGH_M else f"Your {c.programName}"
    exp_txt = (
        f" that expires in {round(c.daysToExpiry)} {'day' if round(c.daysToExpiry) == 1 else 'days'}"
        if c.expiringPoints > 0 and c.daysToExpiry is not None and c.daysToExpiry <= 30
        else ""
    )
    lead = "and have" if near_txt.startswith("You’re") else "can get you"
    body = f"{near_txt} {lead} {c.title[0].lower() + c.title[1:]} worth {money(c.value)}{exp_txt}."
    title = c.title if place.lower() in c.title.lower() else f"{place}: {c.title}"

    reasons = []
    if dist is not None and dist <= NEAR_ENOUGH_M:
        reasons.append(f"You’re {dist} m away and it’s open.")
    if top["hour_share"] * 24 >= 1.5:
        reasons.append(f"You usually buy {CATEGORY_NOUN.get(c.category or '', 'here')} around this time.")
    if c.expiringPoints > 0 and c.daysToExpiry is not None and c.daysToExpiry <= 30:
        reasons.append(f"{c.expiringPoints:,.0f} {c.unit} expire in {round(c.daysToExpiry)} days.")
    if top["velocity"] >= 1.2:
        reasons.append("You’ve been spending here more often lately.")
    reasons.append(
        f"Model: {top['p1']:.0%} chance you’d use it with a reminder, {top['p0']:.0%} without (+{top['uplift'] * 100:.0f} points)."
    )

    suppressed = None
    if in_quiet_hours(ctx.hour, ctx.minute, req.prefs.quietHours.start, req.prefs.quietHours.end) and req.prefs.quietHours.enabled:
        suppressed = "It’s within your quiet hours, so this waits until morning."
    elif req.prefs.sentToday >= req.prefs.dailyLimit:
        suppressed = f"You’ve reached your limit of {req.prefs.dailyLimit} notifications today."
    elif top["uplift"] < THRESHOLD:
        if top["bad"]:
            suppressed = f"You rated {CATEGORY_NOUN.get(c.category or '', 'similar')} reminders in the {b} as Bad, so Perkly is holding back."
        elif top["p0"] >= 0.35:
            suppressed = "You’d likely use this anyway, so a reminder wouldn’t add anything."
        else:
            suppressed = "A reminder is unlikely to make a difference right now."

    return MomentResponse(
        decision=MomentDecision(
            sent=suppressed is None,
            optionId=c.optionId,
            programId=c.programId,
            merchantId=merchant.id if merchant else None,
            title=title,
            body=body,
            reasons=reasons,
            suppressedBecause=suppressed,
            uplift=round(top["uplift"], 3),
            pIfNotified=round(top["p1"], 3),
            pIfNot=round(top["p0"], 3),
            distanceM=dist,
            bucket=b,
            category=c.category,
        ),
        considered=considered,
        model=MODEL["version"],
        threshold=THRESHOLD,
    )
