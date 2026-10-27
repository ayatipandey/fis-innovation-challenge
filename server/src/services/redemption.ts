// Coordinates the reward step and the payment step of one checkout. The two are
// separate systems; a transaction is only reported as complete when every
// required step is confirmed. Everything here runs against mock adapters.

import { randomUUID } from 'node:crypto';
import { computeCheckout, money } from '../../../shared/checkout';
import { brandById, programById } from '../../../shared/demo-data';
import type { PaymentMethodKind, RedemptionRecord } from '../../../shared/types';
import { mockLoyalty, mockPayments, type DemoScenario } from '../adapters';
import type { DB } from '../db';
import { nowIso } from '../db';
import { addActivity, connectedBalances, listPaymentMethods, saveRedemption } from '../store';
import type { CatalogSource } from './catalog';

export interface RedeemInput {
  offerId: string;
  purchaseTotal: number;
  unitsApplied: number;
  method: PaymentMethodKind | 'rewards_only' | null;
  scenario: DemoScenario;
}

type Outcome = { ok: true; record: RedemptionRecord } | { ok: false; status: number; error: string; errors?: string[] };

export function redeem(db: DB, catalog: CatalogSource, userId: string, input: RedeemInput): Outcome {
  const offer = catalog.get(input.offerId);
  if (!offer) return { ok: false, status: 404, error: 'This reward no longer exists.' };
  if (new Date(offer.expiresAt) < new Date()) return { ok: false, status: 409, error: 'This reward has expired.' };
  if (offer.redemption.providerOnly)
    return { ok: false, status: 409, error: `${brandById(offer.brandId)?.name} handles this reward directly. Perkly can’t complete it for you.` };

  if (offer.howToUse.activationRequired) {
    const activated = db.prepare('SELECT 1 FROM activations WHERE user_id = ? AND offer_id = ?').get(userId, offer.id);
    if (!activated) return { ok: false, status: 409, error: 'Activate this offer before you use it.' };
  }

  const split = offer.redemption.split;
  const balances = connectedBalances(db, userId);
  const balance = split ? balances[split.programId] ?? 0 : 0;
  if (input.unitsApplied > 0 && split && !(split.programId in balances)) {
    return { ok: false, status: 409, error: `Connect ${programById(split.programId)?.name} to pay with points.` };
  }

  let tokenRef: string | null = null;
  if (input.method === 'apple_pay' || input.method === 'saved_card' || input.method === 'online_banking') {
    const pm = listPaymentMethods(db, userId).find((m) => m.kind === input.method);
    if (!pm) return { ok: false, status: 422, error: 'Add this payment method in Profile first.' };
    tokenRef = pm.tokenRef;
  }

  const breakdown = computeCheckout(offer, { purchaseTotal: input.purchaseTotal, unitsApplied: input.unitsApplied, balance, method: input.method });
  if (!breakdown.qualifies) {
    return { ok: false, status: 422, error: `Add ${money(breakdown.shortfall)} to reach the ${money(offer.minSpend ?? 0)} minimum.` };
  }
  if (breakdown.errors.length) return { ok: false, status: 422, error: breakdown.errors[0], errors: breakdown.errors };

  const loyalty = mockLoyalty(db, input.scenario);
  const payments = mockPayments(input.scenario);
  const units = breakdown.unitsApplied;
  const programId = split?.programId ?? null;
  const steps: RedemptionRecord['steps'] = { reward: units > 0 ? 'failed' : 'skipped', payment: 'skipped' };
  let status: RedemptionRecord['status'] = 'completed_demo';
  let message = '';

  // Step 1: hold the points.
  if (units > 0 && programId) {
    const r = loyalty.redeem(userId, programId, units);
    if (!r.ok) {
      status = 'failed_demo';
      message = `${r.message} No payment was taken and your points weren’t used.`;
    } else {
      steps.reward = 'succeeded';
    }
  }

  // Step 2: take the remaining payment, unless it's paid to the merchant or nothing is due.
  if (status === 'completed_demo' && breakdown.amountDue > 0) {
    if (input.method === 'in_store') {
      steps.payment = 'skipped';
    } else if (tokenRef) {
      const p = payments.charge(tokenRef, breakdown.amountDue);
      if (p.ok) {
        steps.payment = 'succeeded';
      } else {
        steps.payment = 'failed';
        if (units > 0 && programId) {
          const back = loyalty.reverse(userId, programId, units);
          if (back.ok) {
            steps.reward = 'reversed';
            status = 'failed_demo';
            message = `${p.message} Your ${units.toLocaleString('en-US')} points were returned and nothing was charged.`;
          } else {
            status = 'partial_failure_demo';
            message = `${p.message} Your ${units.toLocaleString('en-US')} points are still on hold. Release them to try again.`;
          }
        } else {
          status = 'failed_demo';
          message = `${p.message} Nothing was charged.`;
        }
      }
    }
  }

  if (status === 'completed_demo') {
    if (units > 0 && programId) loyalty.release(userId, programId, units);
    message =
      input.method === 'in_store' && breakdown.amountDue > 0
        ? `Demo redemption recorded. Pay ${money(breakdown.amountDue)} to the merchant directly.`
        : 'Points and payment both went through in the demo.';
  }

  const after = programId ? connectedBalances(db, userId)[programId] ?? null : null;
  const record: RedemptionRecord = {
    id: randomUUID(),
    offerId: offer.id,
    createdAt: nowIso(),
    purchaseTotal: breakdown.purchaseTotal,
    discount: breakdown.discount,
    unitsApplied: units,
    rewardValueApplied: breakdown.rewardValue,
    amountDue: breakdown.amountDue,
    paymentMethod: breakdown.amountDue === 0 && units > 0 ? 'rewards_only' : input.method,
    status,
    steps,
    message,
    remainingBalance: after,
    isDemo: true,
  };
  saveRedemption(db, userId, record);

  if (status === 'completed_demo') {
    const brand = brandById(offer.brandId)?.name ?? '';
    const saved = breakdown.discount + breakdown.rewardValue;
    addActivity(db, userId, { kind: 'redeemed', label: `${brand}: ${offer.benefit.summary}`, amount: saved > 0 ? `−${money(saved)}` : 'Used', date: record.createdAt });
    if (breakdown.laterCredit) {
      addActivity(db, userId, { kind: 'pending', label: `${brand} cashback, posting`, amount: money(breakdown.laterCredit), date: record.createdAt });
    }
  }
  return { ok: true, record };
}

/** Recovery path for a payment failure whose points are still held. */
export function recover(db: DB, catalog: CatalogSource, userId: string, record: RedemptionRecord): RedemptionRecord {
  const offer = catalog.get(record.offerId);
  const programId = offer?.redemption.split?.programId;
  if (record.status !== 'partial_failure_demo' || !programId) return record;
  mockLoyalty(db, 'normal').reverse(userId, programId, record.unitsApplied);
  const updated: RedemptionRecord = {
    ...record,
    status: 'failed_demo',
    steps: { ...record.steps, reward: 'reversed' },
    message: `Your ${record.unitsApplied.toLocaleString('en-US')} points were released. Nothing was charged.`,
    remainingBalance: connectedBalances(db, userId)[programId] ?? null,
  };
  saveRedemption(db, userId, updated);
  return updated;
}
