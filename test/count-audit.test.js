import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHarbor } from '../core.js';
import { apply } from '../index.js';

const URL = 'https://count-audit.invalid/feed.json';
const schedule = (activeCount, pendingCount = null, effectiveDate = null) => ({ activeCount, pendingCount, effectiveDate });
function feed(date) {
  const generatedAt = `${date}T00:00:00+08:00`;
  const repos = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, name: `audit/project-${i + 1}`, description: 'terminal cli', stars: 100000 - i, categoryId: 'devtools', language: null, observedAt: generatedAt, pushedAt: null, dailyGain: null, weeklyGain: null, dailyInterval: null, weeklyInterval: null }));
  return { schemaVersion: 1, date, generatedAt, repos, rankings: { daily: repos.map(r => r.id), weekly: repos.slice(1).map(r => r.id), classic: repos.map(r => r.id) }, rankingModes: { daily: 'trending_daily', weekly: 'trending_weekly' }, warnings: [] };
}
async function fixture(t, at = '2026-11-18T12:00:00+08:00') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'starharbor-count-audit-'));
  t.after(async () => {
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('starharbor-count-audit-'));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  let time = at, payload = feed(at.slice(0, 10));
  const config = { dataDir: root, now: () => new Date(time), feedUrl: URL, fetchImpl: async () => Response.json(payload) };
  return { root, file: path.join(root, 'state.json'), restart: () => createHarbor(config), setTime: next => { time = next; }, setFeed: date => { payload = feed(date); } };
}

test('count audit: no-board setting at year boundary remains deferred through unrelated edits and restart', async t => {
  const f = await fixture(t, '2026-12-31T23:59:59.999+08:00');
  const saved = await f.restart().settings({ recommendationCount: 1, cooldownDays: 0 });
  assert.deepEqual(saved.countSchedule, schedule(5, 1, '2027-01-01'));
  assert.equal(saved.today, null);
  assert.deepEqual((await f.restart().settings({ dailyMin: 6000 })).countSchedule, saved.countSchedule);
  const bytes = await fs.readFile(f.file, 'utf8');
  f.setTime('2027-01-01T00:00:00.000+08:00');
  assert.deepEqual((await f.restart().status()).countSchedule, schedule(1));
  assert.equal(await fs.readFile(f.file, 'utf8'), bytes);
  f.setFeed('2027-01-01');
  assert.equal((await f.restart().refresh({ force: true })).today.repos.length, 1);
});

test('count audit: cancelled pending value must never appear when revisiting its feed date', async t => {
  const f = await fixture(t);
  await f.restart().settings({ recommendationCount: 10 });
  f.setTime('2026-11-19T12:00:00+08:00');
  await f.restart().settings({ recommendationCount: 1 });
  await f.restart().settings({ recommendationCount: 10 }); // Cancel tomorrow one.
  await f.restart().settings({ recommendationCount: 8 });
  await f.restart().settings({ recommendationCount: 2 }); // Replace tomorrow eight.
  f.setTime('2026-11-20T12:00:00+08:00');
  await f.restart().settings({ recommendationCount: 3 });
  f.setTime('2026-11-21T12:00:00+08:00');
  await f.restart().settings({ recommendationCount: 4 });
  const ledgerBytes = await fs.readFile(f.file, 'utf8');
  for (const [date, expected] of [['2026-11-18', 5], ['2026-11-19', 10], ['2026-11-20', 2], ['2026-11-21', 3]]) {
    await fs.writeFile(f.file, ledgerBytes); // Independently replay each no-board state, preserving the identical transition ledger.
    f.setFeed(date);
    const result = await f.restart().refresh({ force: true });
    assert.equal(result.today.date, date);
    assert.equal(result.today.repos.length, expected);
    assert.deepEqual(result.countSchedule, schedule(3, 4, '2026-11-22'));
  }
});

test('count audit: all invalid count types reject atomically with valid fields and pending schedule intact', async t => {
  const f = await fixture(t);
  await f.restart().settings({ recommendationCount: 10 });
  const before = await fs.readFile(f.file, 'utf8');
  for (const count of [null, false, true, '', '1', [], {}, 0, -1, 11, 2.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER]) {
    await assert.rejects(f.restart().settings({ hour: 2, recommendationCount: count }));
    assert.equal(await fs.readFile(f.file, 'utf8'), before);
  }
});

test('count audit: failed midnight feed sync activates setting but preserves yesterday board; recovery uses new target', async t => {
  const f = await fixture(t);
  const prior = await f.restart().refresh({ force: true });
  await f.restart().settings({ recommendationCount: 10, cooldownDays: 0 });
  f.setTime('2026-11-19T00:00:00+08:00');
  const failing = createHarbor({ dataDir: f.root, now: () => new Date('2026-11-19T00:00:00+08:00'), feedUrl: URL, fetchImpl: async () => { throw new Error('offline'); } });
  const result = await failing.refresh({ force: true });
  assert.deepEqual(result.countSchedule, schedule(10));
  assert.deepEqual(result.today, prior.today);
  assert.equal(result.history.length, 1);
  f.setFeed('2026-11-19');
  const recovered = await f.restart().refresh({ force: true });
  assert.equal(recovered.today.repos.length, 10);
  assert.equal(recovered.history.length, 2);
});

test('count audit: tomorrow feed within clock-skew allowance cannot apply pending count before Shanghai midnight', async t => {
  const f = await fixture(t, '2026-11-18T23:59:00+08:00');
  await f.restart().settings({ recommendationCount: 10, hour: 0 });
  f.setFeed('2026-11-19'); // +60s clock skew is permitted by public-feed validation.
  const result = await f.restart().refresh({ force: true });
  assert.deepEqual(result.countSchedule, schedule(5, 10, '2026-11-19'));
  assert.equal(result.today, null, 'future-dated feed must not create tomorrow board or activate its pending count tonight');
  assert.equal(result.history.length, 0);
  f.setTime('2026-11-19T00:00:00+08:00');
  const cached = createHarbor({ dataDir: f.root, now: () => new Date('2026-11-19T00:00:00+08:00'), feedUrl: URL, fetchImpl: () => { throw new Error('freshly cached tomorrow feed must not be fetched again'); } });
  const next = await cached.refresh();
  assert.equal(next.lastError, null);
  assert.equal(next.today.date, '2026-11-19');
  assert.equal(next.today.repos.length, 10);
});

test('count audit: HTTP and agent count validation agree and valid no-board edits expose active/pending', async t => {
  const f = await fixture(t);
  const effects = []; let route, tool;
  apply({ workingDirectory: { defaultDirectory: f.root }, effect: fn => effects.push(fn), connection: { fetch: { register: value => { route = value; return () => {}; } } }, tools: { register: value => { tool = value; return () => {}; } } }, { dataDir: f.root, feedUrl: URL });
  effects[0](); effects[1](); // No scheduler or network in boundary test.
  const post = count => route.fetch(new Request('http://localhost/api/starharbor', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-StarHarbor': '1' }, body: JSON.stringify({ action: 'settings', settings: { recommendationCount: count } }) }));
  const response = await post(10);
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal(saved.settings.recommendationCount, 10);
  assert.equal(saved.countSchedule.activeCount, 5);
  assert.equal(saved.countSchedule.pendingCount, 10);
  assert.equal(saved.today, null);
  const before = await fs.readFile(f.file, 'utf8');
  for (const count of [null, false, true, '', '1', [], {}, 0, -1, 11, 2.5, 1e20]) {
    const invalid = await post(count);
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).code, 'invalid_settings');
    await assert.rejects(tool.execute({ action: 'settings', settings: { recommendationCount: count } }), error => error.code === 'invalid_settings');
    assert.equal(await fs.readFile(f.file, 'utf8'), before);
  }
  assert.deepEqual((await tool.execute({ action: 'status' })).countSchedule, saved.countSchedule);
});
