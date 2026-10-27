"""Points and miles value comparison.

value per unit = (cash price avoided − additional fees) ÷ units required

Values are computed only from what the caller supplies. A missing cash price
yields no value rather than a guess.
"""

from __future__ import annotations

from .models import ComparedOption, CompareRequest, CompareResponse

FORMULA = "Value per point or mile = (cash price avoided − additional fees) ÷ points or miles required"


def cents_per_unit(cash: float | None, fees: float, units: float) -> float | None:
    if cash is None or units <= 0:
        return None
    return round((cash - fees) / units * 100, 2)


def compare(req: CompareRequest) -> CompareResponse:
    out: list[ComparedOption] = []
    assumptions: list[str] = []
    limitations = [
        "Award availability and prices change. Check the provider before booking.",
        "This compares cash value only. Comfort, timing and flexibility may matter more to you.",
    ]
    for o in req.options:
        cpu = cents_per_unit(o.cashPrice, o.fees, o.unitsRequired)
        if o.cashPrice is None:
            assumptions.append(f"No cash price was given for “{o.label}”, so its value can’t be calculated.")
        affordable = None if req.balance is None else req.balance >= o.unitsRequired
        out.append(
            ComparedOption(
                label=o.label,
                unitsRequired=o.unitsRequired,
                cashPrice=o.cashPrice,
                fees=o.fees,
                valuePerUnitCents=cpu,
                affordable=affordable,
                restrictions=o.restrictions,
                expiresAt=o.expiresAt,
                flexibility=o.flexibility,
            )
        )

    priced = [o for o in out if o.valuePerUnitCents is not None]
    if len(priced) >= 2:
        hi = max(priced, key=lambda o: o.valuePerUnitCents or 0)
        lo = min(priced, key=lambda o: o.valuePerUnitCents or 0)
        if hi.valuePerUnitCents == lo.valuePerUnitCents:
            summary = "Both options give the same estimated value per unit, so choose on timing and flexibility."
        else:
            summary = (
                f"“{hi.label}” gives more estimated value per unit ({hi.valuePerUnitCents:.2f}¢ vs "
                f"{lo.valuePerUnitCents:.2f}¢). “{lo.label}” may still be the better choice if it "
                "fits your plans or keeps more of your balance free."
            )
    elif len(priced) == 1:
        p = priced[0]
        summary = f"“{p.label}” works out to about {p.valuePerUnitCents:.2f}¢ per unit. Add a cash price for the other options to compare them."
    else:
        summary = "Add the cash prices you see to compare these options."

    if req.balance is not None:
        short = [o.label for o in out if o.affordable is False]
        if short:
            limitations.append(f"Your balance doesn’t cover: {', '.join(short)}.")

    return CompareResponse(options=out, formula=FORMULA, summary=summary, assumptions=assumptions, limitations=limitations)
