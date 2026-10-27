"""Perkly's transparent recommendation scorer (v1).

This is a weighted rule set, not a trained model. Every point a reward gains or
loses comes from a named signal below, and the strongest signals are returned
as plain-language reasons. The function signature is the seam where a learned
ranking model can replace or blend with these rules later.

Signals (max contribution):
  category spend share   40   share of the user's permitted spending
  selected interest      15   categories picked in onboarding / profile
  favourite brand        18
  past use of the brand   8
  expiry urgency         14   ≤3 days 14, ≤7 days 9, ≤14 days 4
  estimated value        10   scaled to $50
  routine / time of day  10   weekday mornings, evenings
  nearby (permitted)     10   only when location is explicitly allowed
  better value in group   4
Penalties:
  minimum spend well above the user's usual spend   up to −18
  undisclosed fees                                 −2
  no interest, spend, or favourite in the category −12

Sponsorship never changes the score.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone

from .models import RankedReward, RewardIn, TimeContext, UserSummary, LocationContext

CATEGORY_PHRASE = {
    "coffee": ("Recommended because you frequently buy coffee.", "coffee"),
    "groceries": ("Relevant to your grocery spending.", "groceries"),
    "food": ("Matches how often you eat out.", "restaurants"),
    "travel": ("Relevant to your travel spending.", "travel"),
    "hotels": ("Relevant to your hotel stays.", "hotels"),
    "fashion": ("Matches your clothing purchases.", "clothing"),
    "watches": ("Matches your watch and jewelry purchases.", "watches and jewelry"),
    "beauty": ("Matches your beauty and fragrance purchases.", "beauty"),
    "tech": ("Matches your technology purchases.", "technology"),
    "entertainment": ("Matches your entertainment spending.", "entertainment"),
    "transport": ("Relevant to how often you ride.", "transportation"),
    "wellness": ("Matches your health and wellness spending.", "wellness"),
    "other": ("Matches your spending.", "other interests"),
}


def parse_dt(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def fmt_date(dt: datetime) -> str:
    return f"{dt.strftime('%b')} {dt.day}"


def money(n: float) -> str:
    return f"${n:,.2f}".replace(".00", "")


def _value_ratio(r: RewardIn) -> float | None:
    if r.valueEstimate.amount is None:
        return None
    required = r.minSpend or 1.0
    return r.valueEstimate.amount / max(required, 1.0)


def score_rewards(
    user: UserSummary,
    rewards: list[RewardIn],
    time: TimeContext,
    location: LocationContext | None,
) -> list[RankedReward]:
    now = parse_dt(time.now)
    personal = user.personalization
    spending = user.spending if (personal and user.spending) else None
    shares = spending.share if spending else {}
    max_share = max(shares.values(), default=0) or 1.0
    location_ok = bool(location and location.permitted)

    # Best value-for-required-spend within each category.
    best_in_group: dict[str, str] = {}
    groups: dict[str, list[RewardIn]] = defaultdict(list)
    for r in rewards:
        groups[r.category].append(r)
    for cat, items in groups.items():
        rated = [(ratio, r.id) for r in items if (ratio := _value_ratio(r)) is not None]
        if len(rated) >= 2:
            best_in_group[cat] = max(rated)[1]

    ranked: list[tuple[float, datetime, RankedReward]] = []
    for r in rewards:
        expires = parse_dt(r.expiresAt)
        if expires < now or parse_dt(r.validFrom) > now:
            continue

        reasons: list[tuple[float, str]] = []
        warnings: list[str] = []
        score = 0.0
        phrase, noun = CATEGORY_PHRASE.get(r.category, ("Matches your spending.", r.category))

        share = shares.get(r.category, 0.0)
        if personal and share > 0:
            pts = 40 * share / max_share
            score += pts
            if share / max_share >= 0.45:
                reasons.append((pts, phrase))

        interested = personal and r.category in user.categories
        if interested:
            score += 15
            reasons.append((15 if share == 0 else 6, f"You chose {noun} as an interest."))

        favourite = personal and r.brandId in user.favoriteBrands
        if favourite:
            score += 18
            reasons.append((18, f"{r.brandName} is one of your favorite brands."))

        uses = user.brandHistory.get(r.brandId, 0) if personal else 0
        if uses:
            score += min(8, 2 * uses)
            reasons.append((min(8, 2 * uses), f"You’ve used {r.brandName} rewards before."))

        days_left = (expires - now).total_seconds() / 86400
        if days_left <= 3:
            score += 14
            reasons.append((14.5, f"Expires soon: {fmt_date(expires)}."))
        elif days_left <= 7:
            score += 9
            reasons.append((9, f"Expires {fmt_date(expires)}."))
        elif days_left <= 14:
            score += 4

        if r.valueEstimate.amount:
            score += 10 * min(1.0, r.valueEstimate.amount / 50)

        is_weekday = time.weekday < 5
        if personal and "weekday_morning" in r.routine and is_weekday and 6 <= time.hour < 11 and (share > 0 or interested):
            score += 10
            reasons.append((11, "Fits your usual morning routine."))
        if personal and "evening" in r.routine and 16 <= time.hour < 22 and (share > 0 or interested):
            score += 6
            reasons.append((6, "Good for this evening."))

        if location_ok and r.nearby:
            score += 10
            reasons.append((12, f"A partner location is nearby ({r.nearby.label}, {r.nearby.distanceMeters} m)."))

        if best_in_group.get(r.category) == r.id:
            score += 4
            reasons.append((4, f"Better estimated value for the spend than the other {noun} offers."))

        typical = spending.typicalSpend.get(r.category) if spending else None
        if r.minSpend:
            if typical and r.minSpend > typical * 1.25:
                penalty = min(18.0, 18 * (r.minSpend - typical) / r.minSpend)
                score -= penalty
                warnings.append(
                    f"Needs a {money(r.minSpend)} minimum, more than your usual {money(typical)} {noun} spend."
                )
            elif not typical:
                warnings.append(f"Needs a minimum spend of {money(r.minSpend)}.")

        if r.youPay.feesUnknown:
            score -= 2
            warnings.append("Some fees or prices weren’t disclosed by the provider.")

        if personal and share == 0 and not interested and not favourite:
            score -= 12

        reasons.sort(key=lambda x: -x[0])
        texts = [t for _, t in reasons[:3]]
        if not texts and not personal:
            texts = ["Shown by expiry and estimated value because personalization is off."]

        item = RankedReward(
            offerId=r.id,
            score=round(max(0.0, min(100.0, score)), 1),
            reasons=texts,
            warnings=warnings,
        )
        ranked.append((item.score, expires, item))

    ranked.sort(key=lambda x: (-x[0], x[1]))
    return [item for _, _, item in ranked]
