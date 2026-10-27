"""Eligibility check. Unknown information is reported as unknown, never as a pass."""

from __future__ import annotations

from .models import EligibilityCheck, EligibilityRequest, EligibilityResponse
from .scoring import parse_dt

METHOD_LABEL = {
    "apple_pay": "Apple Pay",
    "saved_card": "a saved card",
    "online_banking": "online banking",
    "in_store": "in-store payment",
}
CHANNEL_LABEL = {"in_store": "in store", "online": "online", "app": "in the brand’s app"}


def check(req: EligibilityRequest) -> EligibilityResponse:
    c, ctx = req.conditions, req.context
    now = parse_dt(ctx.now)
    checks: list[EligibilityCheck] = []

    if c.validFrom and parse_dt(c.validFrom) > now:
        checks.append(EligibilityCheck(rule="dates", result="fail", reason="The offer hasn’t started yet."))
    elif c.expiresAt and parse_dt(c.expiresAt) < now:
        checks.append(EligibilityCheck(rule="dates", result="fail", reason="The offer has expired."))
    elif c.expiresAt:
        checks.append(EligibilityCheck(rule="dates", result="pass", reason="Within the offer dates."))
    else:
        checks.append(EligibilityCheck(rule="dates", result="unknown", reason="The provider didn’t give dates."))

    if c.channels:
        if ctx.channel is None:
            checks.append(EligibilityCheck(rule="channel", result="unknown", reason="Where you’ll buy isn’t known yet."))
        elif ctx.channel in c.channels:
            checks.append(EligibilityCheck(rule="channel", result="pass", reason=f"Valid {CHANNEL_LABEL.get(ctx.channel, ctx.channel)}."))
        else:
            allowed = ", ".join(CHANNEL_LABEL.get(x, x) for x in c.channels)
            checks.append(EligibilityCheck(rule="channel", result="fail", reason=f"Only valid {allowed}."))

    if c.paymentMethods:
        if ctx.paymentMethod is None:
            checks.append(EligibilityCheck(rule="payment", result="unknown", reason="No payment method chosen yet."))
        elif ctx.paymentMethod in c.paymentMethods:
            checks.append(EligibilityCheck(rule="payment", result="pass", reason=f"Works with {METHOD_LABEL.get(ctx.paymentMethod, ctx.paymentMethod)}."))
        else:
            checks.append(EligibilityCheck(rule="payment", result="fail", reason=f"Doesn’t work with {METHOD_LABEL.get(ctx.paymentMethod, ctx.paymentMethod)}."))

    if c.minSpend:
        if ctx.purchaseTotal is None:
            checks.append(EligibilityCheck(rule="min_spend", result="unknown", reason=f"Needs ${c.minSpend:,.2f}; purchase total not known."))
        elif ctx.purchaseTotal >= c.minSpend:
            checks.append(EligibilityCheck(rule="min_spend", result="pass", reason=f"Meets the ${c.minSpend:,.2f} minimum."))
        else:
            gap = c.minSpend - ctx.purchaseTotal
            checks.append(EligibilityCheck(rule="min_spend", result="fail", reason=f"${gap:,.2f} short of the ${c.minSpend:,.2f} minimum."))

    if c.requiresProgram:
        if ctx.connectedPrograms is None:
            checks.append(EligibilityCheck(rule="program", result="unknown", reason="Program connection not known."))
        elif c.requiresProgram in ctx.connectedPrograms:
            checks.append(EligibilityCheck(rule="program", result="pass", reason="Program connected."))
        else:
            checks.append(EligibilityCheck(rule="program", result="fail", reason="Connect the brand’s program first."))

    if c.activationRequired:
        if ctx.activated is None:
            checks.append(EligibilityCheck(rule="activation", result="unknown", reason="Activation status not known."))
        elif ctx.activated:
            checks.append(EligibilityCheck(rule="activation", result="pass", reason="Activated."))
        else:
            checks.append(EligibilityCheck(rule="activation", result="fail", reason="Needs activating before you buy."))

    if c.excludedTransactions:
        checks.append(
            EligibilityCheck(
                rule="exclusions",
                result="unknown",
                reason="Perkly can’t see your basket, so check the exclusions: " + "; ".join(c.excludedTransactions) + ".",
            )
        )

    results = {x.result for x in checks}
    if "fail" in results:
        status, summary = "ineligible", "Not eligible as things stand. See the failed checks."
    elif "unknown" in results:
        status, summary = "unknown", "Looks possible, but some conditions can’t be confirmed yet."
    else:
        status, summary = "eligible", "All known conditions are met."
    return EligibilityResponse(status=status, checks=checks, summary=summary)
