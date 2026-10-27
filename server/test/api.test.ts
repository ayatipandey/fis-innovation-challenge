import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
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

describe('using a reward', () => {
  it('records an in-store use with its estimated saving', async () => {
    const agent = await demoAgent();
    const before = (await agent.get('/api/me/wallet')).body.summary;
    const res = await agent.post('/api/me/rewards/ember-flat-white/use').set(H).send({ channel: 'in_store' });
    assert.equal(res.status, 201);
    assert.equal(res.body.use.estimatedSaving, 2);
    assert.equal(res.body.use.status, 'reported_demo');
    assert.equal(res.body.simulated, true);
    const after = (await agent.get('/api/me/wallet')).body.summary;
    assert.equal(after.rewardsUsed, before.rewardsUsed + 1);
    assert.equal(after.estimatedSaved, Math.round((before.estimatedSaved + 2) * 100) / 100);
  });

  it('refuses a channel the partner doesn’t accept', async () => {
    const agent = await demoAgent();
    const res = await agent.post('/api/me/rewards/kin-noodle-online/use').set(H).send({ channel: 'in_store' });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /online/);
  });

  it('rejects unknown rewards and channels', async () => {
    const agent = await demoAgent();
    assert.equal((await agent.post('/api/me/rewards/nope/use').set(H).send({ channel: 'online' })).status, 404);
    assert.equal((await agent.post('/api/me/rewards/ember-flat-white/use').set(H).send({ channel: 'mail' })).status, 400);
  });

  it('lists uses in history', async () => {
    const agent = await demoAgent();
    await agent.post('/api/me/rewards/atelier-outerwear/use').set(H).send({ channel: 'online' });
    const h = await agent.get('/api/me/history');
    assert.equal(h.body.uses[0].offerId, 'atelier-outerwear');
    assert.equal(h.body.uses[0].channel, 'online');
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
    assert.ok(Array.isArray(exp.body.rewardsUsed));
    const del = await agent.delete('/api/me/account').set(H).send({ confirm: 'DELETE' });
    assert.equal(del.status, 200);
    assert.equal((await agent.get('/api/me/wallet')).status, 401);
  });
});
