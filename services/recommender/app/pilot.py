"""Perkly's Pilot: answers questions about using points well.

It combines the planner's ranked plans (passed in by the API), expiry dates, the
member's habits and the moment engine for "what should I do here and now". No
language model is connected; messages are matched to intents and every number
comes from the member's own linked programs.
"""

from __future__ import annotations

import re

from .engine import evaluate, money
from .models import Context, MomentRequest, PilotRequest, PilotResponse, ProgramIn, Table

FOLLOW_UPS = [
    "What’s the best use of my points?",
    "Which points expire soon?",
    "What should I use near me right now?",
    "Is the $15 coffee reward worth the minimum spend?",
]

TIME_WORDS = {"tonight": 19, "this evening": 19, "evening": 19, "tomorrow morning": 8, "morning": 8, "lunch": 12, "afternoon": 15}


def _program(text: str, programs: list[ProgramIn]) -> ProgramIn | None:
    for p in programs:
        words = [w.lower().strip("&,.") for w in p.name.split() if len(w) > 3 and w.lower() not in {"rewards", "points", "membership", "card"}]
        if any(w in text for w in words):
            return p
    return None


def _plan_rows(p: ProgramIn, n: int = 3) -> list[list[str]]:
    rows = []
    for i, pl in enumerate(p.plans[:n], start=1):
        note = pl.warnings[0] if pl.warnings else (pl.reasons[1] if len(pl.reasons) > 1 else "")
        rows.append([str(i), pl.label, f"{pl.pointsUsed:,.0f}", money(pl.totalValue), str(pl.visits), note])
    return rows


def answer(req: PilotRequest) -> PilotResponse:
    text = req.message.lower()
    progs = [p for p in req.programs if p.plans or p.expiries]
    notes: list[str] = []

    if not req.programs:
        return PilotResponse(
            reply="You haven’t linked any programs yet. Link one in Profile and I’ll show you what your points can buy.",
            cards=[], notes=notes, followUps=[],
        )

    # 1. Where am I / right now / tonight: run the moment engine.
    hour_override = next((h for w, h in TIME_WORDS.items() if w in text), None)
    if any(w in text for w in ["near", "right now", "around me", "here", "nearby"]) or hour_override is not None:
        ctx = req.context.model_copy(update={"hour": hour_override} if hour_override is not None else {})
        res = evaluate(MomentRequest(context=ctx, prefs=req.prefs.model_copy(update={"sentToday": 0}), habits=req.habits, ratings=req.ratings, candidates=req.candidates))
        d = res.decision
        when = "this evening" if hour_override == 19 else "then" if hour_override is not None else "right now"
        if d.optionId is None:
            reply = f"Nothing you can redeem is close by {when}. {d.suppressedBecause or ''}".strip()
            if not req.prefs.locationAllowed:
                reply += " Location is off, so I can’t tell what’s nearby. Turn it on in Profile, or try the simulated day on Home."
            return PilotResponse(reply=reply, cards=[], notes=notes, followUps=FOLLOW_UPS[:2])
        verdict = "I’d use this one." if d.uplift >= res.threshold else "This is your best option, though you’d probably use it anyway."
        reply = f"{d.body} {verdict}"
        notes.append(" ".join(d.reasons))
        if not req.prefs.locationAllowed:
            notes.append("Location is off, so distance isn’t used.")
        return PilotResponse(reply=reply, cards=[d.optionId], notes=notes, followUps=["What’s the best use of my points?", "Which points expire soon?"])

    # 2. Expiring points.
    if "expir" in text or "running out" in text or "lose" in text:
        rows = []
        for p in progs:
            for e in sorted(p.expiries, key=lambda e: e.days):
                if e.days <= 30:
                    best = p.plans[0].label if p.plans else "Not enough for a reward yet"
                    rows.append([p.name, f"{e.points:,.0f} {p.unit}", f"{round(e.days)} days", best])
        rows.sort(key=lambda r: int(r[2].split()[0]))
        if not rows:
            return PilotResponse(reply="Nothing expires in the next 30 days.", cards=[], notes=notes, followUps=FOLLOW_UPS[:1])
        reply = f"{len(rows)} batch{'es' if len(rows) != 1 else ''} of points expire within 30 days. Soonest first, with the best way to use each:"
        cards = [p.plans[0].optionIds[0] for p in progs if p.plans and any(e.days <= 30 for e in p.expiries)]
        return PilotResponse(reply=reply, cards=cards[:3], table=Table(columns=["Program", "Expiring", "In", "Best use"], rows=rows), notes=notes, followUps=["What should I use near me right now?"])

    # 3. Is a minimum spend worth it?
    if "worth" in text or "minimum" in text:
        p = _program(text, progs) or next((p for p in progs if any(pl.extraSpend > 0 for pl in p.plans)), None)
        if not p:
            return PilotResponse(reply="None of your rewards need a minimum spend you’d have to stretch for.", cards=[], notes=notes, followUps=FOLLOW_UPS[:2])
        with_min = next((pl for pl in p.plans if pl.extraSpend > 0), None)
        top = p.plans[0]
        if with_min is None:
            reply = f"Your {p.name} rewards all fit what you usually spend, so there’s no minimum to worry about."
        else:
            diff = with_min.totalValue - top.totalValue
            reply = (
                f"**{with_min.label}** gives {money(with_min.totalValue)}, but {with_min.warnings[0].lower() if with_min.warnings else 'it needs a minimum spend.'} "
                f"That means spending about {money(with_min.extraSpend)} more than usual"
                + (f" to get {money(diff)} more than **{top.label}**." if diff > 0 else ".")
                + " Only worth it if you were planning a bigger order anyway."
                if with_min is not top
                else f"**{with_min.label}** is still your best option even with the minimum spend."
            )
        return PilotResponse(reply=reply, cards=[o for pl in p.plans[:2] for o in pl.optionIds[:1]], table=Table(columns=["Rank", "Plan", "Points", "Value", "Visits", "Note"], rows=_plan_rows(p)), notes=["Ranked by value, minus extra spending a minimum forces and a small cost per visit."], followUps=["Which points expire soon?"])

    # 4. Total value of everything.
    if any(w in text for w in ["how much", "total", "all my points", "worth in"]):
        rows = [[p.name, f"{p.available:,.0f} {p.unit}", money(p.plans[0].totalValue) if p.plans else "$0"] for p in req.programs]
        total = sum(p.plans[0].totalValue for p in req.programs if p.plans)
        return PilotResponse(reply=f"Used well, your points are worth about **{money(total)}** right now.", cards=[], table=Table(columns=["Program", "Available", "Best-use value"], rows=rows), notes=["Value is from each program’s best plan, not a fixed cents-per-point rate."], followUps=FOLLOW_UPS[:2])

    # 5. Best use of points, for one program or all of them (default).
    p = _program(text, progs)
    if p:
        if not p.plans:
            return PilotResponse(reply=f"You have {p.available:,.0f} {p.unit} with {p.name}, which isn’t enough for a reward yet.", cards=[], notes=notes, followUps=FOLLOW_UPS[:2])
        top = p.plans[0]
        reply = f"With {p.available:,.0f} {p.unit}, the best use is **{top.label}**: {money(top.totalValue)} of value. " + " ".join(top.reasons[1:3])
        return PilotResponse(reply=reply, cards=top.optionIds[:1], table=Table(columns=["Rank", "Plan", "Points", "Value", "Visits", "Note"], rows=_plan_rows(p)), notes=["Ranked by value, minus extra spending a minimum forces and a small cost per visit."], followUps=["Is the $15 coffee reward worth the minimum spend?", "Which points expire soon?"])

    if any(w in text for w in ["best", "use", "points", "spend", "should i", "recommend", "suggest"]):
        rows, cards = [], []
        for prog in sorted(progs, key=lambda x: -(x.plans[0].totalValue if x.plans else 0)):
            if prog.plans:
                rows.append([prog.name, prog.plans[0].label, money(prog.plans[0].totalValue), prog.plans[0].warnings[0] if prog.plans[0].warnings else prog.plans[0].reasons[1] if len(prog.plans[0].reasons) > 1 else ""])
                cards.append(prog.plans[0].optionIds[0])
        if not rows:
            return PilotResponse(reply="None of your balances cover a reward yet.", cards=[], notes=notes, followUps=FOLLOW_UPS[1:3])
        return PilotResponse(reply="Here’s the best use of each balance, highest value first:", cards=cards[:4], table=Table(columns=["Program", "Best plan", "Value", "Note"], rows=rows), notes=["Plans weigh value against minimum spends, visits and expiry dates."], followUps=["Which points expire soon?", "What should I use near me right now?"])

    return PilotResponse(
        reply="I can find the best use of your points, flag what’s about to expire, tell you what to use where you are, and check whether a minimum spend is worth it.",
        cards=[], notes=notes, followUps=FOLLOW_UPS,
    )
