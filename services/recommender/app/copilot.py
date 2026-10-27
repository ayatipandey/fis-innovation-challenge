"""Rule-based Copilot.

No language model is connected. Messages are matched to a small set of intents
and answered from the member's rewards and the scorer. Any number that is an
estimate says so, and missing information is reported rather than guessed.
"""

from __future__ import annotations

import re

from .models import CopilotRequest, CopilotResponse, RewardIn, Table
from .scoring import CATEGORY_PHRASE, fmt_date, money, parse_dt, score_rewards

CATEGORY_WORDS = {
    "coffee": ["coffee", "latte", "espresso", "café", "cafe", "flat white"],
    "food": ["food", "restaurant", "dinner", "lunch", "eat", "dining", "takeout", "noodle"],
    "groceries": ["grocer", "supermarket", "produce", "basket"],
    "travel": ["flight", "airline", "travel", "trip", "fare"],
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
    "How much would I save on a $90 grocery shop?",
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


def _dollars(text: str) -> list[float]:
    return [float(x.replace(",", "")) for x in re.findall(r"\$\s?(\d[\d,]*(?:\.\d+)?)", text)]


def saving_at(r: RewardIn, amount: float) -> tuple[float | None, str]:
    """Saving on a purchase of `amount`, with the reason when it can't be calculated."""
    if r.minSpend and amount < r.minSpend:
        return 0.0, f"Below the {money(r.minSpend)} minimum"
    kind, value = r.benefit.kind, r.benefit.value
    if kind == "amount_off" and value is not None:
        return min(value, amount), "Fixed discount"
    if kind == "percent_off" and value is not None:
        s = amount * value / 100
        if r.maxBenefit is not None:
            s = min(s, r.maxBenefit)
        return round(s, 2), f"{value:g}% off" + (f", capped at {money(r.maxBenefit)}" if r.maxBenefit else "")
    if r.valueEstimate.amount is not None:
        return r.valueEstimate.amount, "Free item, estimated value"
    return None, "Value not disclosed"


def answer(req: CopilotRequest) -> CopilotResponse:
    text = req.message.lower().strip()
    ranked = score_rewards(req.user, req.rewards, req.time, req.location)
    by_id = {r.id: r for r in req.rewards}
    now = parse_dt(req.time.now)
    notes: list[str] = []

    # 1. Points and miles are outside Perkly's model; say so plainly.
    if any(w in text for w in ["mile", "points", "upgrade", "award", "loyalty"]):
        return CopilotResponse(
            reply=(
                "Perkly doesn’t hold or redeem points or miles. Every reward here is a partner offer that comes with your "
                "Perkly membership, used on the brand’s site or in store. For a points balance, check that program directly."
            ),
            cards=[],
            notes=notes,
            followUps=["Find travel rewards relevant to me.", "Which of my rewards expires soon?"],
        )

    # 2. How much would I save on a $X purchase?
    amounts = _dollars(text)
    if amounts and any(w in text for w in ["save", "saving", "spend", "shop", "buy", "order", "purchase"]):
        amount = amounts[0]
        cats = _mentioned_categories(text)
        pool = [by_id[x.offerId] for x in ranked]
        named = _mentioned_rewards(text, req.rewards)
        if named:
            pool = named
        elif cats:
            pool = [r for r in pool if r.category in cats]
        pool = pool[:4]
        if not pool:
            return CopilotResponse(reply="I couldn’t find a current reward for that. Try naming a category, like groceries or dinner.", cards=[], notes=notes, followUps=HELP_FOLLOWUPS)
        rows, best = [], None
        for r in pool:
            s, why = saving_at(r, amount)
            rows.append([r.brandName, r.benefit.summary, money(r.minSpend) if r.minSpend else "None", money(s) if s is not None else "Unknown", why])
            if s and (best is None or s > best[1]):
                best = (r, s)
        lead = f"On a {money(amount)} purchase:"
        verdict = (
            f" **{best[0].brandName}** saves the most, about {money(best[1])}. Check the exclusions before you rely on it."
            if best
            else " none of these rewards would apply at that amount."
        )
        notes.append("Savings are estimates from each offer’s stated terms. Taxes, fees and excluded items can change the result.")
        return CopilotResponse(
            reply=lead + verdict,
            cards=[r.id for r in pool],
            table=Table(columns=["Brand", "Reward", "Min spend", "You’d save", "How it’s worked out"], rows=rows),
            notes=notes,
            followUps=["Which of my rewards expires soon?", "Is this offer worth the minimum spend?"],
        )

    # 3. Is an offer worth its minimum spend?
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
        typical = req.user.spending.typicalSpend.get(r.category) if req.user.spending else None
        value = r.valueEstimate.amount
        parts = [f"**{r.brandName}: {r.headline}.** It needs {money(r.minSpend)}."]
        if value is not None:
            pct = value / r.minSpend * 100
            basis = r.valueEstimate.basis.rstrip(".")
            parts.append(f"The benefit is worth about {money(value)}, roughly {pct:.0f}% of the minimum spend (basis: {basis[0].lower()}{basis[1:]}).")
        else:
            parts.append("The brand didn’t give enough information to estimate its value.")
        if typical:
            if r.minSpend > typical * 1.25:
                parts.append(f"You usually spend about {money(typical)} here, so you’d need to spend {money(r.minSpend - typical)} more than normal. It’s only worth it if you were going to buy that anyway.")
            else:
                parts.append(f"You usually spend about {money(typical)} here, so you’d likely qualify without changing how you shop.")
        else:
            parts.append("I don’t have your usual spend for this category, so I can’t say whether you’d reach the minimum naturally.")
        if r.youPay.knownFees:
            parts.append("Known fees: " + "; ".join(r.youPay.knownFees) + ".")
        notes.append("Values are estimates from the offer’s stated basis.")
        return CopilotResponse(reply=" ".join(parts), cards=[r.id], notes=notes, followUps=["How much would I save on a $90 grocery shop?", "Find rewards from my favorite brands."])

    # 4. Which offers give better value? Comparison table.
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
            val = r.valueEstimate.amount
            ratio = f"{val / r.minSpend * 100:.0f}%" if (val is not None and r.minSpend) else ("No minimum" if val is not None else "Unknown")
            rows.append([r.brandName, r.benefit.summary, money(r.minSpend) if r.minSpend else "None", money(val) if val is not None else "Unknown", ratio, fmt_date(parse_dt(r.expiresAt))])
        reply = (
            "Here they are side by side. “Value vs spend” is the estimated benefit divided by the spend it needs, "
            "so a smaller discount with no minimum can beat a bigger one that asks you to spend more."
        )
        notes.append("Estimated values come from each offer’s stated basis. Unknown means the brand didn’t give enough to calculate.")
        return CopilotResponse(
            reply=reply,
            cards=[r.id for r in pool],
            table=Table(columns=["Brand", "Reward", "Min spend", "Est. value", "Value vs spend", "Expires"], rows=rows),
            notes=notes,
            followUps=["Is this offer worth the minimum spend?", "Which of my rewards expires soon?"],
        )

    # 5. Expiring soon.
    if "expir" in text or "soon" in text or "running out" in text:
        soon = sorted(
            [r for r in req.rewards if 0 <= (parse_dt(r.expiresAt) - now).total_seconds() <= 14 * 86400],
            key=lambda r: r.expiresAt,
        )[:4]
        if not soon:
            return CopilotResponse(reply="Nothing expires in the next two weeks.", cards=[], notes=notes, followUps=HELP_FOLLOWUPS)
        lines = [f"- **{r.brandName}**: {r.benefit.summary}, expires {fmt_date(parse_dt(r.expiresAt))}." for r in soon]
        return CopilotResponse(reply="These expire in the next two weeks, soonest first:\n" + "\n".join(lines), cards=[r.id for r in soon], notes=notes, followUps=["Is this offer worth the minimum spend?", "Find food rewards relevant to me."])

    # 6. Favourite brands.
    if "favorite" in text or "favourite" in text:
        favs = [by_id[x.offerId] for x in ranked if by_id[x.offerId].brandId in req.user.favoriteBrands]
        if not favs:
            return CopilotResponse(reply="You haven’t picked any favorite brands yet, or they have no current rewards. You can add favorites in Profile.", cards=[], notes=notes, followUps=HELP_FOLLOWUPS)
        reply = f"{len(favs)} reward{'s' if len(favs) != 1 else ''} from your favorite brands, best match first."
        return CopilotResponse(reply=reply, cards=[r.id for r in favs[:4]], notes=notes, followUps=["Which of these offers gives me better value?"])

    # 7. Find rewards in a category ("food rewards relevant to me").
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
            why = x.reasons[0] if x.reasons else "A current partner reward in this category."
            lines.append(f"- **{r.brandName}**: {r.benefit.summary}. {why}")
            if x.warnings:
                lines[-1] += f" Note: {x.warnings[0]}"
        label = ", ".join(CATEGORY_PHRASE.get(c, ("", c))[1] for c in sorted(cats)) if cats else "you"
        reply = f"The most useful rewards for {label} right now:\n" + "\n".join(lines)
        return CopilotResponse(reply=reply, cards=[x.offerId for x in pool], notes=notes, followUps=["Which of these offers gives me better value?", "Is this offer worth the minimum spend?"])

    # 8. Fallback.
    return CopilotResponse(
        reply=(
            "I can find rewards that fit what you buy, show what expires soon, compare offers side by side, "
            "work out what you’d save on a purchase, and check whether a minimum spend is worth it. Try one of these."
        ),
        cards=[],
        notes=notes,
        followUps=HELP_FOLLOWUPS,
    )
