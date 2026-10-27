// Checkout maths shared by the reward screen and the API, so the breakdown a
// user confirms is exactly the one the server validates. All maths in cents.

import type { Offer, PaymentMethodKind } from './types';

export interface CheckoutInput {
  purchaseTotal: number;
  unitsApplied: number;
  /** Available balance in the offer's split program. 0 when not connected. */
  balance: number;
  method: PaymentMethodKind | 'rewards_only' | null;
}

export interface CheckoutBreakdown {
  purchaseTotal: number;
  qualifies: boolean;
  /** Extra spend needed to reach the minimum, 0 if met. */
  shortfall: number;
  discount: number;
  subtotal: number;
  unitsApplied: number;
  rewardValue: number;
  amountDue: number;
  /** Cashback credited after purchase, when it can be calculated. */
  laterCredit: number | null;
  maxUsableUnits: number;
  rewardsCoverAll: boolean;
  payToMerchant: boolean;
  errors: string[];
}

const cents = (n: number) => Math.round(n * 100);
const dollars = (c: number) => c / 100;

export function maxUsableUnits(offer: Offer, subtotal: number, balance: number): number {
  const split = offer.redemption.split;
  if (!split) return 0;
  const byValue = Math.floor(cents(subtotal) / cents(split.unitValue));
  const cap = Math.min(balance, split.maxUnits ?? Number.POSITIVE_INFINITY, byValue);
  const stepped = Math.floor(cap / split.step) * split.step;
  return stepped >= split.minUnits ? stepped : 0;
}

export function computeCheckout(offer: Offer, input: CheckoutInput): CheckoutBreakdown {
  const errors: string[] = [];
  const totalC = Math.max(0, cents(input.purchaseTotal));
  const minC = offer.minSpend != null ? cents(offer.minSpend) : 0;
  const qualifies = totalC >= minC;
  const shortfall = qualifies ? 0 : dollars(minC - totalC);

  let discountC = 0;
  let laterCredit: number | null = null;
  const { kind, value, unit } = offer.benefit;
  if (qualifies && value != null) {
    if (kind === 'amount_off') discountC = Math.min(cents(value), totalC);
    if (kind === 'percent_off') {
      discountC = Math.round((totalC * value) / 100);
      if (offer.maxBenefit != null) discountC = Math.min(discountC, cents(offer.maxBenefit));
    }
    if (kind === 'cashback') {
      let c = unit === 'percent' ? Math.round((totalC * value) / 100) : cents(value);
      if (offer.maxBenefit != null) c = Math.min(c, cents(offer.maxBenefit));
      laterCredit = dollars(c);
    }
  }

  const subtotalC = totalC - discountC;
  const subtotal = dollars(subtotalC);
  const split = offer.redemption.split;
  const maxUnits = maxUsableUnits(offer, subtotal, input.balance);

  let units = Math.max(0, Math.floor(input.unitsApplied));
  let rewardC = 0;
  if (units > 0) {
    if (!split) {
      errors.push('This offer does not support paying with points.');
      units = 0;
    } else {
      if (units < split.minUnits) errors.push(`The minimum is ${split.minUnits.toLocaleString('en-US')} points.`);
      if (units % split.step !== 0) errors.push(`Points apply in steps of ${split.step.toLocaleString('en-US')}.`);
      if (units > input.balance) errors.push('That is more points than your available balance.');
      if (split.maxUnits != null && units > split.maxUnits)
        errors.push(`The maximum is ${split.maxUnits.toLocaleString('en-US')} points per order.`);
      rewardC = units * cents(split.unitValue);
      if (rewardC > subtotalC) errors.push('Points cannot be worth more than the amount left to pay.');
    }
  }

  const amountDueC = Math.max(0, subtotalC - rewardC);
  const rewardsCoverAll = units > 0 && amountDueC === 0 && totalC > 0;

  if (input.method === 'rewards_only' && !rewardsCoverAll)
    errors.push('Rewards only works when your points cover the whole amount.');
  if (input.method && input.method !== 'rewards_only' && !offer.redemption.methods.includes(input.method))
    errors.push('This offer does not support that payment method.');
  if (!input.method && amountDueC > 0 && !offer.redemption.providerOnly)
    errors.push('Choose how to pay the remaining balance.');

  return {
    purchaseTotal: dollars(totalC),
    qualifies,
    shortfall,
    discount: dollars(discountC),
    subtotal,
    unitsApplied: units,
    rewardValue: dollars(rewardC),
    amountDue: dollars(amountDueC),
    laterCredit,
    maxUsableUnits: maxUnits,
    rewardsCoverAll,
    payToMerchant: input.method === 'in_store',
    errors,
  };
}

export const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
