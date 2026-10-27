import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import request from 'supertest';

// Point at a closed port so the fallback paths are exercised.
process.env.RECOMMENDER_URL = 'http://127.0.0.1:1';
process.env.RECOMMENDER_TIMEOUT_MS = '300';
process.env.BCRYPT_COST = '4';

const { createApp } = await import('../src/app.js');
const { openDb } = await import('../src/db.js');
const { ratingEffect } = await import('../src/routes/me.js');

const dbFile = join(mkdtempSync(join(tmpdir(), 'perkly-')), 'test.db');
const ready = openDb(`file:${dbFile}`);
const db = await ready;
const app = createApp(() => ready, { rateLimit: false, logRequests: false });
const H = { 'x-perkly-client': 'web' };

async function demoAgent() {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/demo').set(H);
  assert.equal(res.status, 201);
  return agent;
}

const coffee = async (agent: ReturnType<typeof request.agent>) => {
  const res = await agent.get('/api/me/programs');
  return res.body.programs.find((p: { program: { id: string } }) => p.program.id === 'campus-coffee').link;
};

describe('accounts', () => {
  it('refuses registration without consent', async () => {
    const res = await request(app).post('/api/auth/register').set(H).send({ email: 'a@example.com', password: 'longenough123', termsVersion: 'x' });
    assert.equal(res.status, 400);
  });

  it('enforces the password policy on the server', async () => {
    const res = await request(app).post('/api/auth/register').set(H).send({ email: 'b@example.com', password: 'short1', termsAccepted: true, termsVersion: 'x' });
    assert.equal(res.status, 400);
    assert.equal(res.body.field, 'password');
  });

  it('stores a bcrypt hash, signs in, and protects routes', async () => {
    const agent = request.agent(app);
    const reg = await agent
      .post('/api/auth/register')
      .set(H)
      .send({ email: 'Maya@Example.com', password: 'coffee-and-toast-42', firstName: 'Maya', termsAccepted: true, termsVersion: 'x', optional: { location: false, history: true, marketing: false } });
    assert.equal(reg.status, 201);
    assert.match(String(reg.headers['set-cookie']), /HttpOnly/);
    const row = await db.get<{ password_hash: string }>('SELECT password_hash FROM users WHERE email = ?', ['maya@example.com']);
    assert.match(row!.password_hash, /^\$2[aby]\$/);
    assert.equal(reg.body.preferences.privacy.location, false);
    assert.equal(reg.body.preferences.displayName, 'Maya');
    assert.equal(reg.body.user.email, undefined);

    await agent.post('/api/auth/logout').set(H);
    assert.equal((await agent.get('/api/me/summary')).status, 401);
    const bad = await agent.post('/api/auth/login').set(H).send({ email: 'maya@example.com', password: 'wrong-password-1' });
    assert.equal(bad.status, 401);
    const ok = await agent.post('/api/auth/login').set(H).send({ email: 'maya@example.com', password: 'coffee-and-toast-42' });
    assert.equal(ok.status, 200);
  });

  it('rejects state-changing requests without the client header', async () => {
    assert.equal((await request(app).post('/api/auth/demo')).status, 403);
  });
});

describe('linking programs', () => {
  it('needs the consent box, then reads balance, expiries and history', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/register')
      .set(H)
      .send({ email: 'link@example.com', password: 'coffee-and-toast-42', termsAccepted: true, termsVersion: 'x', optional: { location: true, history: true, marketing: false } });
    const no = await agent.post('/api/me/programs/campus-coffee/link').set(H).send({ shareHistory: true, shareVisits: true, agree: false });
    assert.equal(no.status, 400);
    const yes = await agent.post('/api/me/programs/campus-coffee/link').set(H).send({ shareHistory: true, shareVisits: true, agree: true });
    assert.equal(yes.status, 201);
    assert.equal(yes.body.link.balance, 70);
    assert.equal(yes.body.link.expiries[0].points, 30);
    const purchases = (await agent.get('/api/me/purchases')).body.purchases;
    assert.ok(purchases.length > 20);
    assert.ok(purchases.every((p: { category: string }) => p.category === 'coffee'));

    // Without history, nothing is stored and plans fall back to no habits.
    await agent.post('/api/me/programs/campus-coffee/link').set(H).send({ shareHistory: false, shareVisits: false, agree: true });
    assert.equal((await agent.get('/api/me/purchases')).body.purchases.length, 0);

    await agent.delete('/api/me/programs/campus-coffee').set(H);
    assert.equal(await coffee(agent), null);
  });
});

describe('plans', () => {
  it('ranks 7 × $2 off above the $15 reward that needs a $20 order', async () => {
    const agent = await demoAgent();
    const res = await agent.get('/api/me/plans');
    const c = res.body.programs.find((p: { program: { id: string } }) => p.program.id === 'campus-coffee');
    assert.equal(c.plans[0].label, '7 × $2 off any drink');
    assert.ok(c.plans.some((p: { label: string; warnings: string[] }) => p.label.startsWith('$15 off') && p.warnings.length));
  });
});

describe('holds', () => {
  it('prevents double spending under concurrent requests', async () => {
    const agent = await demoAgent();
    // 70 points; a free latte costs 25, so only two can be held at once.
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => agent.post('/api/me/holds').set(H).send({ optionId: 'cc-latte', channel: 'in_store', idempotencyKey: `tap-${i}-xxxxxxxx` })),
    );
    const ok = results.filter((r) => r.status === 201);
    const refused = results.filter((r) => r.status === 409);
    assert.equal(ok.length, 2, results.map((r) => `${r.status} ${r.body.error ?? ''}`).join(', '));
    assert.equal(refused.length, 3);
    const link = await coffee(agent);
    assert.equal(link.held, 50);
    assert.equal(link.available, 20);
    assert.equal(link.balance, 70);
  });

  it('returns the same hold for a repeated idempotency key', async () => {
    const agent = await demoAgent();
    const body = { optionId: 'cc-2off', channel: 'in_store', idempotencyKey: 'same-tap-123456' };
    const a = await agent.post('/api/me/holds').set(H).send(body);
    const b = await agent.post('/api/me/holds').set(H).send(body);
    assert.equal(a.body.hold.id, b.body.hold.id);
    assert.equal((await coffee(agent)).held, 10);
  });

  it('confirming spends the points, soonest-expiring first', async () => {
    const agent = await demoAgent();
    const h = (await agent.post('/api/me/holds').set(H).send({ optionId: 'cc-latte', channel: 'in_store', idempotencyKey: 'confirm-123456' })).body.hold;
    assert.match(h.code, /^CC-[0-9A-F]{8}$/);
    const twoHours = new Date(h.expiresAt).getTime() - new Date(h.createdAt).getTime();
    assert.equal(twoHours, 120 * 60_000);
    const c = await agent.post(`/api/me/holds/${h.id}/confirm`).set(H);
    assert.equal(c.body.hold.status, 'confirmed');
    const link = await coffee(agent);
    assert.equal(link.balance, 45);
    assert.equal(link.held, 0);
    assert.equal(link.expiries[0].points, 5); // 30 expiring soon − 25
    // Confirming twice doesn't spend twice.
    await agent.post(`/api/me/holds/${h.id}/confirm`).set(H);
    assert.equal((await coffee(agent)).balance, 45);
  });

  it('releasing or expiring returns the points', async () => {
    const agent = await demoAgent();
    const h = (await agent.post('/api/me/holds').set(H).send({ optionId: 'cc-latte', channel: 'in_store', idempotencyKey: 'release-123456' })).body.hold;
    await agent.post(`/api/me/holds/${h.id}/release`).set(H);
    assert.equal((await coffee(agent)).available, 70);
    assert.equal((await agent.post(`/api/me/holds/${h.id}/confirm`).set(H)).status, 409);

    const h2 = (await agent.post('/api/me/holds').set(H).send({ optionId: 'cc-latte', channel: 'in_store', idempotencyKey: 'expire-1234567' })).body.hold;
    await db.run('UPDATE holds SET expires_at = ? WHERE id = ?', [new Date(Date.now() - 1000).toISOString(), h2.id]);
    assert.equal((await coffee(agent)).available, 70);
    const late = await agent.post(`/api/me/holds/${h2.id}/confirm`).set(H);
    assert.equal(late.status, 409);
    assert.match(late.body.error, /expired/);
  });

  it('refuses a channel the reward does not support', async () => {
    const agent = await demoAgent();
    const res = await agent.post('/api/me/holds').set(H).send({ optionId: 'nl-credit', channel: 'in_store', idempotencyKey: 'channel-123456' });
    assert.equal(res.status, 409);
  });
});

describe('moments and ratings', () => {
  it('falls back to rules when the AI service is down, and stores the moment', async () => {
    const agent = await demoAgent();
    const res = await agent.post('/api/me/moments/evaluate').set(H).send({ lat: 30.2723, lng: -81.5081, hour: 8, minute: 10, weekday: 1, session: 's1' });
    assert.equal(res.status, 200);
    assert.equal(res.body.fallback, true);
    assert.ok(res.body.moment);
    assert.match(res.body.moment.body, /m from Campus Coffee/);
    assert.equal(res.body.moment.ratingKey, 'coffee:morning');
  });

  it('a Bad rating says what changes', async () => {
    const agent = await demoAgent();
    const m = (await agent.post('/api/me/moments/evaluate').set(H).send({ lat: 30.2723, lng: -81.5081, hour: 8, minute: 10, weekday: 1, session: 's2' })).body.moment;
    const r = await agent.post(`/api/me/moments/${m.id}/rate`).set(H).send({ rating: 'bad' });
    assert.equal(r.body.message, 'Got it, fewer coffee reminders in the morning.');
    assert.equal(ratingEffect('bad', 'coffee:evening'), 'Got it, fewer coffee reminders in the evening.');
  });

  it('respects quiet hours', async () => {
    const agent = await demoAgent();
    const res = await agent.post('/api/me/moments/evaluate').set(H).send({ lat: 30.2836, lng: -81.4956, hour: 22, minute: 40, weekday: 4, session: 's3' });
    if (res.body.moment) assert.equal(res.body.moment.sent, false);
  });
});

describe('pilot, insights and data rights', () => {
  it('Pilot falls back to the planner when the AI service is down', async () => {
    const agent = await demoAgent();
    const res = await agent.post('/api/me/pilot').set(H).send({ message: 'best use of my points?' });
    assert.equal(res.status, 200);
    assert.equal(res.body.engine, 'planner-fallback');
    assert.ok(res.body.table.rows.length >= 3);
  });

  it('insights are public, synthetic and aggregate', async () => {
    const res = await request(app).get('/api/insights');
    assert.equal(res.body.model.synthetic, true);
    assert.ok(res.body.model.overall.liftPoints > 0);
    assert.equal(typeof res.body.live.momentsSent, 'number');
  });

  it('exports and deletes everything', async () => {
    const agent = await demoAgent();
    const exp = await agent.get('/api/me/export');
    assert.equal(exp.body.linkedPrograms.length, 5);
    assert.equal((await agent.delete('/api/me/account').set(H)).status, 200);
    assert.equal((await agent.get('/api/me/summary')).status, 401);
  });
});
