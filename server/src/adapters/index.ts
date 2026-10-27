// Provider adapters. Reward redemption and payment are separate systems that the
// redemption orchestrator coordinates. Only mock adapters exist in this prototype:
// they never contact a loyalty program or move money.

import type { DB } from '../db';

export type DemoScenario = 'normal' | 'payment_declined' | 'reward_unavailable' | 'reversal_failed';

export interface StepResult {
  ok: boolean;
  reference: string | null;
  message: string;
}

export interface LoyaltyAdapter {
  /** Places a hold on points, then confirms it. */
  redeem(userId: string, programId: string, units: number): StepResult;
  reverse(userId: string, programId: string, units: number): StepResult;
  release(userId: string, programId: string, units: number): StepResult;
}

export interface PaymentAdapter {
  /** Charges a tokenized method. The token is the only payment data Perkly holds. */
  charge(tokenRef: string, amount: number): StepResult;
}

export function mockLoyalty(db: DB, scenario: DemoScenario): LoyaltyAdapter {
  let reversalAttempts = 0;
  return {
    redeem(userId, programId, units) {
      if (scenario === 'reward_unavailable') {
        return { ok: false, reference: null, message: 'The program didn’t respond (simulated outage).' };
      }
      const row = db.prepare('SELECT balance FROM program_links WHERE user_id = ? AND program_id = ? AND status = ?').get(userId, programId, 'connected') as
        | { balance: number }
        | undefined;
      if (!row || row.balance < units) return { ok: false, reference: null, message: 'Not enough points.' };
      db.prepare('UPDATE program_links SET balance = balance - ?, held = held + ? WHERE user_id = ? AND program_id = ?').run(units, units, userId, programId);
      return { ok: true, reference: `demo_rdm_${Date.now().toString(36)}`, message: 'Points held (simulated).' };
    },
    reverse(userId, programId, units) {
      reversalAttempts += 1;
      if (scenario === 'reversal_failed' && reversalAttempts === 1) {
        return { ok: false, reference: null, message: 'The program didn’t confirm the reversal (simulated).' };
      }
      db.prepare('UPDATE program_links SET balance = balance + ?, held = MAX(0, held - ?) WHERE user_id = ? AND program_id = ?').run(units, units, userId, programId);
      return { ok: true, reference: null, message: 'Points returned (simulated).' };
    },
    release(userId, programId, units) {
      db.prepare('UPDATE program_links SET held = MAX(0, held - ?) WHERE user_id = ? AND program_id = ?').run(units, userId, programId);
      return { ok: true, reference: null, message: 'Points redeemed (simulated).' };
    },
  };
}

export function mockPayments(scenario: DemoScenario): PaymentAdapter {
  return {
    charge(tokenRef, amount) {
      if (!tokenRef.startsWith('pm_demo_')) return { ok: false, reference: null, message: 'Only demo payment methods are accepted in this prototype.' };
      if (scenario === 'payment_declined' || scenario === 'reversal_failed') {
        return { ok: false, reference: null, message: 'The payment was declined (simulated).' };
      }
      return { ok: true, reference: `demo_pay_${Date.now().toString(36)}`, message: `Simulated charge of $${amount.toFixed(2)}. No money moved.` };
    },
  };
}
