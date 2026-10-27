"""Rule-based Copilot.

No language model is connected. Messages are matched to a small set of intents
and answered from the user's rewards, the scorer and the value calculator. The
response always says which numbers are estimates or illustrative.
"""

from __future__ import annotations

import re

from .compare import compare, cents_per_unit
from .models import (
    CompareRequest,
    CopilotRequest,
    CopilotResponse,
    RedemptionOption,
    RewardIn,
    Table,
)
from .scoring import CATEGORY_PHRASE, fmt_date, money, parse_dt, score_rewards

CATEGORY_WORDS = {
    "coffee": ["coffee", "latte", "espresso", "café", "cafe"],
    "food": ["food", "restaurant", "dinner", "lunch", "eat", "dining", "takeout", "noodle"],
    "groceries": ["grocer", "supermarket", "produce", "basket"],
    "travel": ["flight", "airline", "travel", "trip"],
    "hotels": ["hotel", "stay", "night"],
    "fashion": ["clothing", "fashion", "jacket", "coat", "outerwear", "clothes"],
    "watches": ["watch", "jewel", "engrav"],
    "beauty": ["beauty", "perfume", "fragrance", "skincare"],
    "tech": ["tech", "headphone", "speaker", "electronic", "gadget"],
    "entertainment": ["cinema", "movie", "film", "entertainment"],
    "transport": ["ride", "taxi", "transport", "commute"],
    "wellness": ["yoga", "fitness", "wellness", "gym"],
}

FOOD_LIKE = {"food", "coffee", "groceries"}

HELP_FOLLOWUPS = [
    "Find food rewards relevant to me.",
    "Which of my rewards expires soon?",
    "Should I use miles for a seat upgrade or save them for a ticket?",
    "Is this offer worth the minimum spend?",
]


def _mentioned_categories(text: str) -> set[str]:
    return {cat for cat, words in CATEGORY_WORDS.items() if any(w in text for w in words)}


def _mentioned_rewards(text: str, rewards: list[RewardIn]) -> list[RewardIn]:
    found = []
    for r in rewards:
        first = r.brandName.lower().split(" ")[0].strip("&,.")
        if r.brandName.lower() in text or (len(first) > 3 and first in text):
            found.append(r)
    return found


def _numbers(text: str) -> tuple[list[float], list[float]]:
    """Returns (unit amounts like '25,000 miles', dollar amounts like '$240')."""
    dollars = [float(x.replace(",", "")) for x in re.findall(r"\$\s?(\d[\d,]*(?:\.\d+)?)", text)]
    units = [
        float(m.group(1).replace(",", "")) * (1000 if m.group(2) else 1)
        for m in re.finditer(r"(?<![\$\d])(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:miles|points|pts)", text)
    ]
    return units, dollars


def _benefit_line(r: RewardIn) -> str:
    return r.benefit.summary or r.headline


def answer(req: CopilotRequest) -> CopilotResponse:
    text = req.message.lower().strip()
    ranked = score_rewards(req.user, req.rewards, req.time, req.location)
    by_id = {r.id: r for r in req.rewards}
    reasons = {x.offerId: x for x in ranked}
    now = parse_dt(req.time.now)
    notes: list[str] = []

    # 1. Miles: upgrade vs ticket, or any miles/points trade-off.
    if any(w in text for w in ["mile", "upgrade", "award", "ticket"]) and "expire" not in text:
        units, dollars = _numbers(text)
        miles_balance = req.user.balances.get("northwind-miles")
        upgrade = by_id.get("northwind-upgrade")
        award = by_id.get("northwind-award")
        up_units = units[0] if len(units) >= 1 else (upgrade.benefit.value if upgrade else 12000)
        tk_units = units[1] if len(units) >= 2 else (award.benefit.value if award else 18500)
        illustrative = len(dollars) < 2
        up_cash = dollars[0] if len(dollars) >= 1 else 150.0
        tk_cash = dollars[1] if len(dollars) >= 2 else 240.0
        tk_fees = 5.60
        result = compare(
            CompareRequest(
                options=[
                    RedemptionOption(label="Seat upgrade", unitsRequired=up_units, cashPrice=up_cash, fees=0,
                                     restrictions=["Existing ticket needed", "Not on Basic Economy"],
                                     flexibility="Subject to upgrade seats on your flight"),
                    RedemptionOption(label="Award ticket", unitsRequired=tk_units, cashPrice=tk_cash, fees=tk_fees,
                                     restrictions=["Northwind-operated routes", "Blackout dates apply"],
                                     flexibility="Award seats are limited and change daily"),
                ],
                balance=miles_balance,
            )
        )
        rows = []
        for o in result.options:
            rows.append([
                o.label,
                f"{o.unitsRequired:,.0f} miles",
                money(o.cashPrice or 0),
                money(o.fees),
                f"{o.valuePerUnitCents:.2f}¢" if o.valuePerUnitCents is not None else "Unknown",
                "; ".join(o.restrictions),
            ])
        lead = (
            "Here’s the trade-off using the prices you gave me."
            if not illustrative
            else "I don’t know the cash prices on your flight, so this uses illustrative prices "
            f"({money(up_cash)} for the upgrade, {money(tk_cash)} for the ticket). Tell me the real prices and I’ll redo it."
        )
        bal = f" You have {miles_balance:,.0f} Northwind miles (demo balance)." if miles_balance is not None else ""
        reply = f"{lead}{bal}\n\n{result.summary}"
        notes.append(result.formula + ".")
        notes += result.limitations
        if illustrative:
            notes.append("Cash prices are illustrative, not live Northwind prices.")
        return CopilotResponse(
            reply=reply,
            cards=[x for x in ["northwind-upgrade", "northwind-award"] if x in by_id],
            table=Table(columns=["Option", "Miles", "Cash price avoided", "Fees", "Value per mile", "Restrictions"], rows=rows),
            notes=notes,
            followUps=["The upgrade costs $210 and the ticket costs $260.", "Which of my rewards expires soon?"],
        )

    # 2. Is an offer worth its minimum spend?
    if "worth" in text or "minimum" in text or "min spend" in text:
        mentioned = [r for r in _mentioned_rewards(text, req.rewards) if r.minSpend]
        if not mentioned:
            cats = _mentioned_categories(text)
            pool = [by_id[x.offerId] for x in ranked if by_id[x.offerId].minSpend]
            if cats:
                pool = [r for r in pool if r.category in cats] or pool
            mentioned = pool[:1]
        if not mentioned:
            return CopilotResponse(reply="None of your current rewards has a minimum spend.", cards=[], notes=notes, followUps=HELP_FOLLOWUPS)
        r = mentioned[0]
        typical = (req.user.spending.typicalSpend.get(r.category) if req.user.spending else None)
        value = r.valueEstimate.amount
        parts = [f"**{r.brandName}: {r.headline}.** It needs {money(r.minSpend)}."]
        if value is not None:
            pct = value / r.minSpend * 100
            parts.append(f"The benefit is worth about {money(value)}, roughly {pct:.0f}% of the minimum spend (basis: {r.valueEstimate.basis[0].lower()}{r.valueEstimate.basis[1:].rstrip('.')}).")
        else:
            parts.append("The provider didn’t give enough information to estimate its value.")
        if typical:
            if r.minSpend > typical * 1.25:
                parts.append(f"You usually spend about {money(typical)} here, so you’d need to spend {money(r.minSpend - typical)} more than normal. Only worth it if you were going to buy that anyway.")
            else:
                parts.append(f"You usually spend about {money(typical)} here, so you’d likely qualify without changing how you shop.")
        else:
            parts.append("I don’t have your usual spend for this category, so I can’t say whether you’d reach the minimum naturally.")
        if r.youPay.knownFees:
            parts.append("Known fees: " + "; ".join(r.youPay.knownFees) + ".")
        notes.append("Values are estimates from the offer’s stated basis.")
        return CopilotResponse(reply=" ".join(parts), cards=[r.id], notes=notes, followUps=["Which of these offers gives me better value?", "Find rewards from my favorite brands."])

    # 3. Which offers give better value? Comparison table.
    if any(w in text for w in ["better value", "compare", "which of these", "best value", "better deal"]):
        cats = _mentioned_categories(text)
        pool = [by_id[x.offerId] for x in ranked]
        if cats:
            pool = [r for r in pool if r.category in cats]
        pool = pool[:3]
        if len(pool) < 2:
            return CopilotResponse(reply="I need at least two rewards to compare. Try naming a category, like groceries or coffee.", cards=[r.id for r in pool], notes=notes, followUps=HELP_FOLLOWUPS)
        rows = []
        for r in pool:
            required = r.minSpend or r.demoPurchaseTotal
            val = r.valueEstimate.amount
            ratio = f"{val / required * 100:.0f}%" if (val is not None and required) else "Unknown"
            rows.append([
                r.brandName,
                _benefit_line(r),
                money(r.minSpend) if r.minSpend else "None",
                money(val) if val is not None else "Unknown",
                ratio,
                fmt_date(parse_dt(r.expiresAt)),
            ])
        reply = (
            "Here they are side by side. “Value vs spend” is the estimated benefit divided by the spend it needs, "
            "so a smaller discount with no minimum can beat a bigger one that asks you to spend more."
        )
        notes.append("Estimated values come from each offer’s stated basis. Unknown means the provider didn’t give enough to calculate.")
        return CopilotResponse(
            reply=reply,
            cards=[r.id for r in pool],
            table=Table(columns=["Brand", "Benefit", "Min spend", "Est. value", "Value vs spend", "Expires"], rows=rows),
            notes=notes,
            followUps=["Is this offer worth the minimum spend?", "Which of my rewards expires soon?"],
        )

    # 4. Expiring soon.
    if "expir" in text or "soon" in text or "running out" in text:
        soon = sorted(
            [r for r in req.rewards if 0 <= (parse_dt(r.expiresAt) - now).total_seconds() <= 14 * 86400],
            key=lambda r: r.expiresAt,
        )[:4]
        if not soon:
            return CopilotResponse(reply="Nothing in your rewards expires in the next two weeks.", cards=[], notes=notes, followUps=HELP_FOLLOWUPS)
        lines = [f"- **{r.brandName}**: {_benefit_line(r)}, expires {fmt_date(parse_dt(r.expiresAt))}." for r in soon]
        reply = "These expire in the next two weeks, soonest first:\n" + "\n".join(lines)
        notes.append("Program point balances in this demo have no expiry dates, because the demo programs don’t supply them.")
        return CopilotResponse(reply=reply, cards=[r.id for r in soon], notes=notes, followUps=["Is this offer worth the minimum spend?", "Find food rewards relevant to me."])

    # 5. Favourite brands.
    if "favorite" in text or "favourite" in text:
        favs = [by_id[x.offerId] for x in ranked if by_id[x.offerId].brandId in req.user.favoriteBrands]
        if not favs:
            return CopilotResponse(reply="You haven’t picked any favorite brands yet, or they have no current rewards. You can add favorites in Profile.", cards=[], notes=notes, followUps=HELP_FOLLOWUPS)
        reply = f"{len(favs)} reward{'s' if len(favs) != 1 else ''} from your favorite brands, best match first."
        return CopilotResponse(reply=reply, cards=[r.id for r in favs[:4]], notes=notes, followUps=["Which of these offers gives me better value?"])

    # 6. Find rewards in a category ("food rewards relevant to me").
    cats = _mentioned_categories(text)
    if "food" in text:
        cats |= FOOD_LIKE
    if cats or any(w in text for w in ["find", "show", "reward", "offer", "deal"]):
        pool = [x for x in ranked if not cats or by_id[x.offerId].category in cats][:4]
        if not pool:
            return CopilotResponse(reply="I couldn’t find current rewards for that. Try Explore to browse everything.", cards=[], notes=notes, followUps=HELP_FOLLOWUPS)
        lines = []
        for x in pool:
            r = by_id[x.offerId]
            why = x.reasons[0] if x.reasons else "A current offer in this category."
            lines.append(f"- **{r.brandName}**: {_benefit_line(r)}. {why}")
            if x.warnings:
                lines[-1] += f" Note: {x.warnings[0]}"
        label = ", ".join(CATEGORY_PHRASE.get(c, ("", c))[1] for c in sorted(cats)) if cats else "you"
        reply = f"The most useful rewards for {label} right now:\n" + "\n".join(lines)
        return CopilotResponse(reply=reply, cards=[x.offerId for x in pool], notes=notes, followUps=["Which of these offers gives me better value?", "Is this offer worth the minimum spend?"])

    # 7. Fallback.
    return CopilotResponse(
        reply=(
            "I can find rewards that fit your spending, show what expires soon, compare offers side by side, "
            "check whether a minimum spend is worth it, and work out the value of miles. Try one of these."
        ),
        cards=[],
        notes=notes,
        followUps=HELP_FOLLOWUPS,
    )
