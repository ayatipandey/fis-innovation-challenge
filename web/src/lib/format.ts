import type { Offer, PaymentMethodKind, Program } from '@shared/types';

export { money } from '@shared/checkout';

export const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const longDateline = (d = new Date()) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

export function daysUntil(iso: string, now = Date.now()) {
  return Math.ceil((new Date(iso).getTime() - now) / 86400_000);
}

export function expiryPhrase(iso: string) {
  const d = daysUntil(iso);
  if (d <= 0) return 'Expires today';
  if (d === 1) return 'Expires tomorrow';
  if (d <= 7) return `Expires ${new Date(iso).toLocaleDateString('en-US', { weekday: 'long' })}, ${shortDate(iso)}`;
  return `Expires ${shortDate(iso)}`;
}

export const isUrgent = (iso: string) => daysUntil(iso) <= 3;

export const units = (n: number, unit: string) => `${Math.round(n).toLocaleString('en-US')} ${unit}`;

export function balanceValue(balance: number, program: Program) {
  return program.unitValue != null ? balance * program.unitValue : null;
}

export const METHOD_LABEL: Record<PaymentMethodKind | 'rewards_only', string> = {
  apple_pay: 'Apple Pay',
  saved_card: 'Saved card',
  online_banking: 'Online banking',
  in_store: 'In store: cash or card',
  rewards_only: 'Rewards only',
};

export function greeting(hour = new Date().getHours()) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function benefitKicker(o: Offer) {
  switch (o.benefit.kind) {
    case 'points_pay':
      return 'Pay with points';
    case 'cashback':
      return 'Cashback';
    case 'miles_redemption':
      return 'Miles';
    case 'points_redemption':
      return 'Points';
    case 'percent_off':
    case 'amount_off':
      return 'Discount';
    case 'freebie':
      return 'Complimentary';
    case 'points_multiplier':
      return 'Bonus points';
    default:
      return 'Benefit';
  }
}
