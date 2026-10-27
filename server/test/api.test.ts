import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import request from 'supertest';

// Point at a closed port so the fallback ranking path is exercised.
process.env.RECOMMENDER_URL = 'http://127.0.0.1:1';
process.env.RECOMMENDER_TIMEOUT_MS = '300';
process.env.BCRYPT_COST = '4';

const { createApp } = await import('../src/app');
const { openDb } = await import('../src/db');
const { demoCatalog } = await import('../src/services/catalog');

const db = openDb(':memory:');
const app = createApp(db, demoCatalog(), { rateLimit: false, logRequests: false });
const H = { 'x-perkly-client': 'web' };

async function demoAgent() {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/demo').set(H);
  assert.equal(res.status, 201);
  return agent;
}

describe('accounts', () => {
  it('refuses registration without consent', async () => {
    const res = await request(app).post('/api/auth/register').set(H).send({ email: 'a@example.com', password: 'longenough123', termsVersion: 'x' });
    assert.equal(res.status, 400);
  });

  it('enforces the password policy on the server', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set(H)
      .send({ email: 'b@example.com', password: 'short1', termsAccepted: true, termsVersion: 'x' });
    assert.equal(res.status, 400);
    assert.equal(res.body.field, 'password');
  });

  it('stores a bcrypt hash, signs in, and protects routes', async () => {
    const agent = request.agent(app);
    const reg = await agent
      .post('/api/auth/register')
      .set(H)
      .send({ email: 'Maya@Example.com', password: 'coffee-and-toast-42', termsAccepted: true, termsVersion: 'x', optional: { spendingData: true, location: false, marketing: false } });
    assert.equal(reg.status, 201);
    assert.match(String(reg.headers['set-cookie']), /HttpOnly/);
    const row = db.prepare('SELECT password_hash FROM users WHERE email = ?').get('maya@example.com') as { password_hash: string };
    assert.match(row.password_hash, /^\$2[aby]\$/);
    assert.equal(reg.body.preferences.privacy.location, false);

    const dup = await request(app).post('/api/auth/register').set(H).send({ email: 'maya@example.com', password: 'coffee-and-toast-42', termsAccepted: true, termsVersion: 'x' });
    assert.equal(dup.status, 409);

    assert.equal((await request(app).get('/api/me/wallet')).status, 401);
    const bad = await request(app).post('/api/auth/login').set(H).send({ email: 'maya@example.com', password: 'wrong-password-1' });
    assert.equal(bad.status, 401);
    const ok = await request(app).post('/api/auth/login').set(H).send({ email: 'maya@example.com', password: 'coffee-and-toast-42' });
    assert.equal(ok.status, 200);
  });

  it('rejects state-changing requests without the client header', async () => {
    const res = await request(app).post('/api/auth/demo');
    assert.equal(res.status, 403);
  });
});

describe('payment methods', () => {
  it('never accepts card details', async () => {
    const agent = await demoAgent();
    const res = await agent.post('/api/me/payment-methods').set(H).send({ kind: 'saved_card', number: '4242424242424242', cvv: '123' });
    assert.equal(res.status, 400);
  });
});

describe('split redemption', () => {
  it('splits a $10 bill into 10 points ($2) and $8 by card', async () => {
    const agent = await demoAgent();
    const res = await agent.post('/api/me/redemptions').set(H).send({ offerId: 'ember-points-pay', purchaseTotal: 10, unitsApplied: 10, method: 'saved_card' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.rewardValueApplied, 2);
    assert.equal(res.body.amountDue, 8);
    assert.equal(res.body.status, 'completed_demo');
    assert.equal(res.body.remainingBalance, 130);
    assert.equal(res.body.isDemo, true);
  });

  it('allows rewards-only when points cover the bill', async () => {
    const agent = await demoAgent();
    const res = await agent.post('/api/me/redemptions').set(H).send({ offerId: 'ember-points-pay', purchaseTotal: 10, unitsApplied: 50, method: 'rewards_only' });
    assert.equal(res.status, 201);
    assert.equal(res.body.amountDue, 0);
    assert.equal(res.body.paymentMethod, 'rewards_only');
  });

  it('returns points when the payment fails', async () => {
    const agent = await demoAgent();
    const res = await agent.post('/api/me/redemptions').set(H).send({ offerId: 'ember-points-pay', purchaseTotal: 10, unitsApplied: 10, method: 'saved_card', scenario: 'payment_declined' });
    assert.equal(res.body.status, 'failed_demo');
    assert.equal(res.body.steps.reward, 'reversed');
    assert.equal(res.body.remainingBalance, 140);
  });

  it('reports a partial failure honestly and offers recovery', async () => {
    const agent = await demoAgent();
    const res = await agent.post('/api/me/redemptions').set(H).send({ offerId: 'ember-points-pay', purchaseTotal: 10, unitsApplied: 10, method: 'saved_card', scenario: 'reversal_failed' });
    assert.equal(res.body.status, 'partial_failure_demo');
    assert.equal(res.body.remainingBalance, 130);
    const fixed = await agent.post(`/api/me/redemptions/${res.body.id}/recover`).set(H);
    assert.equal(fixed.body.status, 'failed_demo');
    assert.equal(fixed.body.remainingBalance, 140);
  });

  it('does not take payment when the reward step fails', async () => {
    const agent = await demoAgent();
    const res = await agent.post('/api/me/redemptions').set(H).send({ offerId: 'ember-points-pay', purchaseTotal: 10, unitsApplied: 10, method: 'saved_card', scenario: 'reward_unavailable' });
    assert.equal(res.body.status, 'failed_demo');
    assert.equal(res.body.steps.payment, 'skipped');
  });

  it('rejects more points than allowed and below-minimum spend', async () => {
    const agent = await demoAgent();
    const tooMany = await agent.post('/api/me/redemptions').set(H).send({ offerId: 'ember-points-pay', purchaseTotal: 10, unitsApplied: 55, method: 'rewards_only' });
    assert.equal(tooMany.status, 422);
    const short = await agent.post('/api/me/redemptions').set(H).send({ offerId: 'greenleaf-10-off-75', purchaseTotal: 60, unitsApplied: 0, method: 'saved_card' });
    assert.equal(short.status, 422);
    assert.match(short.body.error, /\$15\.00/);
  });

  it('tells in-store users to pay the merchant', async () => {
    const agent = await demoAgent();
    const res = await agent.post('/api/me/redemptions').set(H).send({ offerId: 'ember-points-pay', purchaseTotal: 10, unitsApplied: 10, method: 'in_store' });
    assert.equal(res.body.steps.payment, 'skipped');
    assert.match(res.body.message, /Pay \$8\.00 to the merchant/);
  });

  it('refuses provider-only rewards', async () => {
    const agent = await demoAgent();
    const res = await agent.post('/api/me/redemptions').set(H).send({ offerId: 'northwind-upgrade', purchaseTotal: 0, unitsApplied: 0, method: null });
    assert.equal(res.status, 409);
  });
});

describe('recommendations', () => {
  it('falls back to the local ranking when the service is down', async () => {
    const agent = await demoAgent();
    const res = await agent.get('/api/me/recommendations?weekday=1&hour=8');
    assert.equal(res.status, 200);
    assert.equal(res.body.engine, 'local-fallback-v1');
    assert.ok(res.body.items.length > 0);
  });

  it('reports Copilot unavailability instead of inventing an answer', async () => {
    const agent = await demoAgent();
    const res = await agent.post('/api/me/copilot').set(H).send({ message: 'Find food rewards relevant to me.' });
    assert.equal(res.status, 503);
  });
});

describe('data rights', () => {
  it('exports without secrets and deletes the account', async () => {
    const agent = await demoAgent();
    const exp = await agent.get('/api/me/export');
    assert.equal(exp.status, 200);
    assert.ok(!JSON.stringify(exp.body).includes('password_hash'));
    assert.ok(!JSON.stringify(exp.body).includes('pm_demo_'));
    const del = await agent.delete('/api/me/account').set(H).send({ confirm: 'DELETE' });
    assert.equal(del.status, 200);
    assert.equal((await agent.get('/api/me/wallet')).status, 401);
  });
});
