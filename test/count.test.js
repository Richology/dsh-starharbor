import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHarbor } from '../core.js';
import { selectFeedBoard } from '../feed.js';

const feedUrl = 'https://example.test/feed.json';
function feed(date = '2026-11-18') {
  const generatedAt = `${date}T00:00:00+08:00`;
  const repos = Array.from({ length: 110 }, (_, i) => ({
    id: i + 1, name: `demo/project-${i + 1}`, description: i % 2 ? 'SQL database' : 'terminal cli',
    stars: 200000 - i, categoryId: 'general', language: 'JavaScript', observedAt: generatedAt,
    pushedAt: null, dailyGain: null, weeklyGain: null, dailyInterval: null, weeklyInterval: null
  }));
  return { schemaVersion: 1, date, generatedAt, repos,
    rankings: { daily: repos.map(r => r.id), weekly: [...repos.slice(1), repos[0]].map(r => r.id), classic: repos.map(r => r.id) },
    rankingModes: { daily: 'trending_daily', weekly: 'trending_weekly' }, warnings: [] };
}
async function fixture(t, { legacy = false } = {}) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'starharbor-count-'));
  t.after(async () => {
    const resolved = path.resolve(dataDir);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('starharbor-count-'));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  let at = '2026-11-18T09:00:00+08:00';
  let payload = feed();
  const fetchImpl = async url => {
    if (!legacy) return Response.json(payload);
    const metas = payload.repos.map(repo => ({ id: repo.id, full_name: repo.name, stargazers_count: repo.stars, description: repo.description, language: repo.language, fork: false, archived: false }));
    if (url.includes('/trending')) {
      const items = url.includes('weekly') ? metas.slice(1) : metas;
      return new Response(items.slice(0, 2).map(repo => `<article><h2><a href="/${repo.full_name}">repo</a></h2></article>`).join(''));
    }
    if (url.includes('/search/')) return Response.json({ items: metas });
    throw new Error(`Unexpected URL ${url}`);
  };
  const config = { dataDir, fetchImpl, now: () => new Date(at), ...(legacy ? {} : { feedUrl }) };
  return { dataDir, stateFile: path.join(dataDir, 'state.json'), harbor: createHarbor(config),
    restart: () => createHarbor(config), setTime: value => { at = value; }, setFeed: date => { payload = feed(date); } };
}
const schedule = (activeCount, pendingCount = null, effectiveDate = null) => ({ activeCount, pendingCount, effectiveDate });

test('feed count defaults to five; every supported target preserves source slots and leaders', () => {
  const payload = feed();
  assert.equal(selectFeedBoard(payload, { now: '2026-11-18T09:00:00+08:00' }).repos.length, 5);
  for (let count = 1; count <= 10; count++) {
    const board = selectFeedBoard(payload, { now: '2026-11-18T09:00:00+08:00', settings: { recommendationCount: count } });
    assert.equal(board.repos.length, count);
    assert.equal(board.repos[0].sourceCode, 'trending_daily');
    if (count >= 2) assert.equal(board.repos[1].sourceCode, 'trending_weekly');
    assert.ok(board.repos.slice(2).every(repo => repo.sourceCode === 'classic'));
    assert.equal(board.leaders.weekly.repo.id, 2);
  }
  for (const recommendationCount of [0, 11, 1.5, '5', null]) {
    assert.throws(() => selectFeedBoard(payload, { now: '2026-11-18T09:00:00+08:00', settings: { recommendationCount } }));
  }
});

test('one slot falls back to weekly; shortage target and saved ninety exclusion remain truthful', () => {
  const payload = feed();
  payload.rankings.daily = [];
  const fallback = selectFeedBoard(payload, { now: '2026-11-18T09:00:00+08:00', settings: { recommendationCount: 1 } });
  assert.equal(fallback.repos.length, 1);
  assert.equal(fallback.repos[0].sourceCode, 'trending_weekly');
  assert.equal(fallback.leaders.daily.repo, null);
  const saved = Array.from({ length: 90 }, (_, i) => ({ id: i + 1 }));
  const full = selectFeedBoard(feed(), { now: '2026-11-18T09:00:00+08:00', saved, settings: { recommendationCount: 10 } });
  assert.equal(full.repos.length, 10);
  assert.ok(full.repos.every(repo => repo.id > 90));
  assert.equal(full.leaders.daily.repo.id, 1);
  const short = selectFeedBoard(feed(), { now: '2026-11-18T09:00:00+08:00', saved: feed().repos, settings: { recommendationCount: 10 } });
  assert.deepEqual(short.warningDetails.find(w => w.code === 'recommendation_shortage').params, { count: 0, target: 10 });
});

test('first generation after saving count still uses five today; force and restart preserve fixed board', async t => {
  const f = await fixture(t);
  const saved = await f.harbor.settings({ recommendationCount: 10 });
  assert.equal(saved.settings.recommendationCount, 10);
  assert.deepEqual(saved.countSchedule, schedule(5, 10, '2026-11-19'));
  const initial = await f.restart().refresh({ force: true });
  assert.equal(initial.today.repos.length, 5);
  await f.harbor.settings({ recommendationCount: 1 });
  assert.deepEqual((await f.restart().refresh({ force: true })).today, initial.today);
  assert.deepEqual((await f.harbor.status()).countSchedule, schedule(5, 1, '2026-11-19'));
});

test('Shanghai midnight activates count at UTC 16h and status does not write state', async t => {
  const f = await fixture(t);
  await f.harbor.settings({ recommendationCount: 10, cooldownDays: 0, hour: 0 });
  f.setTime('2026-11-18T15:59:59.999Z');
  assert.deepEqual((await f.harbor.status()).countSchedule, schedule(5, 10, '2026-11-19'));
  const before = await fs.readFile(f.stateFile, 'utf8');
  f.setTime('2026-11-18T16:00:00.000Z');
  assert.deepEqual((await f.restart().status()).countSchedule, schedule(10));
  assert.equal(await fs.readFile(f.stateFile, 'utf8'), before);
  f.setFeed('2026-11-19');
  assert.equal((await f.restart().refresh()).today.repos.length, 10);
});

test('repeated edits replace pending; returning to active cancels; invalid edits leave bytes intact', async t => {
  const f = await fixture(t);
  await f.harbor.settings({ recommendationCount: 10 });
  assert.deepEqual((await f.harbor.settings({ recommendationCount: 2 })).countSchedule, schedule(5, 2, '2026-11-19'));
  assert.deepEqual((await f.restart().settings({ recommendationCount: 5 })).countSchedule, schedule(5));
  const before = await fs.readFile(f.stateFile, 'utf8');
  for (const recommendationCount of [0, 11, 1.5, '5']) await assert.rejects(f.harbor.settings({ recommendationCount }), /recommendationCount/);
  assert.equal(await fs.readFile(f.stateFile, 'utf8'), before);
  f.setTime('2026-11-19T09:00:00+08:00');
  f.setFeed('2026-11-19');
  assert.equal((await f.restart().refresh()).today.repos.length, 5);
});

test('matured pending becomes active before future edits, repeat desired does not postpone, and cancel works', async t => {
  const f = await fixture(t);
  await f.harbor.settings({ recommendationCount: 10 });
  f.setTime('2026-11-19T09:00:00+08:00');
  assert.deepEqual((await f.restart().settings({ recommendationCount: 1 })).countSchedule, schedule(10, 1, '2026-11-20'));
  assert.deepEqual((await f.restart().settings({ recommendationCount: 1 })).countSchedule, schedule(10, 1, '2026-11-20'));
  assert.deepEqual((await f.harbor.settings({ recommendationCount: 10 })).countSchedule, schedule(10));
  await f.harbor.settings({ recommendationCount: 2 });
  f.setTime('2026-11-20T09:00:00+08:00');
  assert.deepEqual((await f.restart().settings({ recommendationCount: 3 })).countSchedule, schedule(2, 3, '2026-11-21'));
  f.setFeed('2026-11-20');
  assert.equal((await f.restart().refresh({ force: true })).today.repos.length, 2);
});

test('stale feed uses its historical date count across matured transitions and new edits', async t => {
  const f = await fixture(t);
  await f.harbor.settings({ recommendationCount: 10 });
  f.setTime('2026-11-19T09:00:00+08:00');
  await f.restart().settings({ recommendationCount: 1 });
  f.setTime('2026-11-20T09:00:00+08:00');
  await f.restart().settings({ recommendationCount: 3 });
  // No board has been generated: the old feed must still use the original five.
  const old = await f.restart().refresh({ force: true });
  assert.equal(old.today.date, '2026-11-18');
  assert.equal(old.today.repos.length, 5);
  assert.ok(old.today.warningDetails.some(w => w.code === 'feed_stale'));
  assert.deepEqual(old.countSchedule, schedule(1, 3, '2026-11-21'));
});

test('stale feed from an intermediate transition uses that count rather than current or future count', async t => {
  const f = await fixture(t);
  await f.harbor.settings({ recommendationCount: 10 });
  f.setTime('2026-11-19T09:00:00+08:00');
  await f.harbor.settings({ recommendationCount: 1 });
  f.setTime('2026-11-20T09:00:00+08:00');
  await f.harbor.settings({ recommendationCount: 3 });
  f.setFeed('2026-11-19');
  const result = await f.restart().refresh({ force: true });
  assert.equal(result.today.repos.length, 10);
  assert.deepEqual(result.countSchedule, schedule(1, 3, '2026-11-21'));
});

test('cloud first board generated tomorrow uses one without any board on the settings day', async t => {
  const f = await fixture(t);
  await f.harbor.settings({ recommendationCount: 1 });
  f.setTime('2026-11-19T09:00:00+08:00');
  f.setFeed('2026-11-19');
  const result = await f.restart().refresh({ force: true });
  assert.equal(result.history.length, 1);
  assert.equal(result.today.repos.length, 1);
  assert.deepEqual(result.countSchedule, schedule(1));
});

test('legacy state defaults to five without status writes or a count schedule', async t => {
  const f = await fixture(t);
  const bytes = JSON.stringify({ settings: { hour: 9 }, saved: [], history: [], snapshots: [], today: null });
  await fs.writeFile(f.stateFile, bytes);
  const result = await f.restart().status();
  assert.equal(result.settings.recommendationCount, 5);
  assert.deepEqual(result.countSchedule, schedule(5));
  assert.equal(await fs.readFile(f.stateFile, 'utf8'), bytes);
});

for (const recommendationCount of [1, 10]) test(`legacy collector applies next-day target ${recommendationCount} and preserves forced fixed board`, async t => {
  const f = await fixture(t, { legacy: true });
  await f.harbor.settings({ recommendationCount, cooldownDays: 0 });
  const initial = await f.harbor.refresh({ force: true });
  assert.equal(initial.today.repos.length, 5);
  f.setTime('2026-11-19T09:00:00+08:00');
  const next = await f.restart().refresh({ force: true });
  assert.equal(next.today.repos.length, recommendationCount);
  await f.harbor.settings({ recommendationCount: recommendationCount === 1 ? 10 : 1 });
  assert.deepEqual((await f.restart().refresh({ force: true })).today, next.today);
});
