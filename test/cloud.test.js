import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getEventListeners } from 'node:events';
import { createHarbor } from '../core.js';

const URL = 'https://raw.githubusercontent.com/Richology/dsh-starharbor/data/latest.json';
function publicFeed(date = '2026-11-17', generatedAt = `${date}T00:30:00Z`) {
  const descriptions = ['AI agent', 'AI model', 'terminal cli', 'SQL database', 'react frontend', 'docker infrastructure', 'tutorial course', 'automation workflow'];
  return {
    schemaVersion: 1, date, generatedAt,
    repos: descriptions.map((description, i) => ({
      id: i + 1, name: `public/project-${i + 1}`, description, stars: 100000 - i * 1000, categoryId: 'general',
      language: 'JavaScript', pushedAt: '2026-10-01T00:00:00Z', observedAt: generatedAt,
      dailyGain: null, weeklyGain: null, dailyInterval: null, weeklyInterval: null
    })),
    rankings: { daily: [1, 2, 3, 4, 5, 6, 7, 8], weekly: [2, 3, 4, 5, 6, 7, 8, 1], classic: [3, 4, 5, 6, 7, 8, 1, 2] },
    rankingModes: { daily: 'trending_daily', weekly: 'trending_weekly' }, warnings: []
  };
}
async function setup(t, options = {}) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'starharbor-cloud-'));
  t.after(() => fs.rm(dataDir, { recursive: true, force: true }));
  let time = new Date('2026-11-17T09:00:00+08:00');
  let payload = publicFeed();
  let response;
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return response ? response(url, init) : Response.json(payload);
  };
  const config = { dataDir, feedUrl: URL, fetchImpl, now: () => time, ...options };
  return {
    harbor: createHarbor(config), config, dataDir, calls,
    setTime: value => { time = new Date(value); }, setFeed: value => { payload = value; }, setResponse: value => { response = value; }
  };
}

test('cloud fetches only the public feed without credentials, enrich, or private preferences', async t => {
  const fixture = await setup(t, { enrich: () => { throw new Error('cloud must not enrich'); } });
  const { harbor, calls, dataDir } = fixture;
  const prior = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = 'private-test-token';
  t.after(() => { if (prior === undefined) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN = prior; });
  await harbor.settings({ dailyMin: 7777, cooldownDays: 17 });
  const initial = await harbor.refresh();
  assert.equal(initial.today.repos.length, 5);
  assert.equal(initial.today.feedGeneratedAt, '2026-11-17T00:30:00.000Z');
  assert.equal(initial.today.generatedAt, '2026-11-17T01:00:00.000Z');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, URL);
  assert.deepEqual(calls[0].init.headers, { Accept: 'application/json' });
  assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(calls[0].init.body, undefined);
  assert.equal(calls[0].init.redirect, 'error');
  assert.ok(!JSON.stringify(calls).includes('private-test-token'));
  assert.ok(!JSON.stringify(calls).includes('7777'));
  assert.equal(initial.feed.status, 'fresh');
  assert.equal(initial.feed.candidateCount, 8);
  assert.equal(initial.feed.nextSyncAt, '2026-11-17T02:00:00.000Z');
  const file = path.join(dataDir, 'state.json');
  const before = await fs.readFile(file, 'utf8');
  const status = await harbor.status();
  status.feed.status = 'modified';
  assert.equal((await harbor.status()).feed.status, 'fresh');
  assert.equal(calls.length, 1);
  assert.equal(await fs.readFile(file, 'utf8'), before);
});

test('hourly and forced sync update feed status while the same feed-day board stays fixed', async t => {
  const { harbor, calls, setFeed, setTime } = await setup(t);
  const initial = await harbor.refresh();
  await harbor.settings({ dailyMin: 999999 });
  setFeed(publicFeed('2026-11-17', '2026-11-17T01:30:00Z'));
  setTime('2026-11-17T09:45:00+08:00');
  await harbor.refresh();
  assert.equal(calls.length, 1);
  const forced = await harbor.refresh({ force: true });
  assert.equal(calls.length, 2);
  assert.deepEqual(forced.today, initial.today);
  assert.equal(forced.feed.generatedAt, '2026-11-17T01:30:00.000Z');
  setTime('2026-11-17T10:44:59+08:00');
  await harbor.refresh();
  assert.equal(calls.length, 2);
  setTime('2026-11-17T10:45:00+08:00');
  const hourly = await harbor.refresh();
  assert.equal(calls.length, 3);
  assert.deepEqual(hourly.today, initial.today);
  assert.equal(hourly.history.length, 1);
});

test('startup sync before due hour and snapshotOnly cache feed without freezing a board', async t => {
  const fixture = await setup(t);
  const { harbor, calls, setTime } = fixture;
  setTime('2026-11-17T08:45:00+08:00');
  const early = await harbor.refresh();
  assert.equal(early.today, null);
  assert.equal(early.history.length, 0);
  assert.equal(early.feed.status, 'fresh');
  setTime('2026-11-17T09:00:00+08:00');
  const due = await createHarbor(fixture.config).refresh();
  assert.equal(calls.length, 1);
  assert.equal(due.today.date, '2026-11-17');
  assert.equal(due.today.generatedAt, '2026-11-17T01:00:00.000Z');
  setTime('2026-11-18T09:00:00+08:00');
  fixture.setFeed(publicFeed('2026-11-18'));
  const snapshot = await harbor.refresh({ snapshotOnly: true });
  assert.equal(snapshot.today.date, '2026-11-17');
  assert.equal(snapshot.feed.date, '2026-11-18');
  const selected = await harbor.refresh();
  assert.equal(calls.length, 2);
  assert.equal(selected.today.date, '2026-11-18');
});

test('manual force can generate before the configured hour and concurrent refreshes join', async t => {
  const { harbor, setTime, calls } = await setup(t);
  setTime('2026-11-17T08:45:00+08:00');
  const a = harbor.refresh({ force: true });
  const b = harbor.refresh({ force: true });
  assert.equal(a, b);
  assert.equal((await a).today.date, '2026-11-17');
  assert.equal(calls.length, 1);
});

test('invalid, future and HTTP feeds preserve cache, fixed history, saved IDs and local notes', async t => {
  const { harbor, dataDir, setFeed, setResponse } = await setup(t);
  const initial = await harbor.refresh();
  const notesPath = path.join(dataDir, 'GitHub收藏.md');
  await fs.writeFile(notesPath, '# Personal notes\n\nKeep my notes.\n');
  const id = initial.today.repos[0].id;
  await Promise.all([harbor.save(id), harbor.save(id)]);
  const notes = await fs.readFile(notesPath, 'utf8');
  assert.match(notes, /Keep my notes/);
  assert.equal(notes.split(`<!-- starharbor:repo:${id} -->`).length - 1, 1);
  const stateFile = path.join(dataDir, 'state.json');
  const cached = JSON.parse(await fs.readFile(stateFile, 'utf8')).feedCache;
  for (const payload of [{ schemaVersion: 99 }, publicFeed('2026-11-18')]) {
    setFeed(payload);
    const result = await harbor.refresh({ force: true });
    assert.equal(result.lastError.code, 'feed_invalid');
    assert.equal(result.feed.error.code, 'feed_invalid');
    assert.equal(result.feed.status, 'fresh');
    assert.deepEqual(result.today, initial.today);
    assert.equal(result.saved.length, 1);
    assert.deepEqual(JSON.parse(await fs.readFile(stateFile, 'utf8')).feedCache, cached);
  }
  setResponse(() => new Response('{}', { status: 503 }));
  const failed = await harbor.refresh({ force: true });
  assert.equal(failed.lastError.code, 'feed_http');
  assert.equal(failed.feed.error.httpStatus, 503);
  assert.equal(failed.history.length, 1);
  assert.equal(await fs.readFile(notesPath, 'utf8'), notes);
});

test('only normalized public feed fields are persisted and cache is revalidated on restart', async t => {
  const fixture = await setup(t);
  const payload = publicFeed();
  payload.untrustedExtra = 'must not persist';
  payload.repos[0].url = 'https://attacker.invalid/redirect';
  payload.repos[0].untrustedExtra = 'must not persist';
  fixture.setFeed(payload);
  const initial = await fixture.harbor.refresh({ snapshotOnly: true });
  const stateFile = path.join(fixture.dataDir, 'state.json');
  const raw = JSON.parse(await fs.readFile(stateFile, 'utf8'));
  assert.equal(raw.feedCache.untrustedExtra, undefined);
  assert.equal(raw.feedCache.repos[0].untrustedExtra, undefined);
  assert.equal(raw.feedCache.repos[0].url, 'https://github.com/public/project-1');
  assert.equal(initial.today, null);
  raw.feedCache.generatedAt = '2099-01-01T00:00:00Z';
  await fs.writeFile(stateFile, JSON.stringify(raw));
  const before = await fs.readFile(stateFile, 'utf8');
  const restarted = createHarbor(fixture.config);
  assert.equal((await restarted.status()).feed.status, 'unavailable');
  assert.equal(await fs.readFile(stateFile, 'utf8'), before);
  fixture.setResponse(() => { throw new TypeError('network unavailable'); });
  const failed = await restarted.refresh({ force: true });
  assert.equal(failed.lastError.code, 'feed_fetch_failed');
  assert.equal(failed.today, null);
  assert.equal(failed.history.length, 0);
  assert.equal(JSON.parse(await fs.readFile(stateFile, 'utf8')).feedCache.generatedAt, '2099-01-01T00:00:00Z');
});

test('first failure creates no empty board and valid data can recover on the same day', async t => {
  const { harbor, setResponse } = await setup(t);
  setResponse(() => new Response('invalid JSON'));
  const failed = await harbor.refresh();
  assert.equal(failed.today, null);
  assert.equal(failed.history.length, 0);
  assert.equal(failed.feed.status, 'unavailable');
  assert.equal(failed.feed.lastSuccessAt, null);
  assert.equal(failed.lastError.code, 'feed_invalid');
  setResponse(null);
  const recovered = await harbor.refresh({ force: true });
  assert.equal(recovered.lastError, null);
  assert.equal(recovered.feed.error, null);
  assert.equal(recovered.history.length, 1);
});

test('yesterday feed is stale, never becomes today, and retains an existing board', async t => {
  const fixture = await setup(t);
  const { harbor, setTime, setFeed } = fixture;
  const initial = await harbor.refresh();
  setTime('2026-11-18T09:00:00+08:00');
  const stale = await harbor.refresh();
  assert.equal(stale.feed.status, 'stale');
  assert.equal(stale.today.date, '2026-11-17');
  assert.deepEqual(stale.today, initial.today);
  assert.equal(stale.history.length, 1);
  setFeed(publicFeed('2026-11-16'));
  const older = await harbor.refresh({ force: true });
  assert.deepEqual(older.today, initial.today);
  assert.equal(older.history.length, 1);
  const empty = await setup(t);
  empty.setTime('2026-11-19T09:00:00+08:00');
  const firstStale = await empty.harbor.refresh();
  assert.equal(firstStale.feed.status, 'stale');
  assert.equal(firstStale.today.date, '2026-11-17');
  assert.ok(firstStale.today.warningDetails.some(warning => warning.code === 'feed_stale'));
});

test('a new local day uses the new feed candidate pool, excludes saved IDs and recent history', async t => {
  const { harbor, setFeed, setTime, calls } = await setup(t);
  await harbor.settings({ cooldownDays: 0 });
  const initial = await harbor.refresh();
  await harbor.save(initial.today.repos[0].id);
  setTime('2026-11-18T00:05:00+08:00');
  const feed = publicFeed('2026-11-18', '2026-11-17T16:00:00Z');
  setFeed(feed);
  const selected = await harbor.refresh({ force: true });
  assert.equal(selected.today.date, '2026-11-18');
  assert.ok(!selected.today.repos.some(repo => repo.id === initial.today.repos[0].id));
  assert.equal(selected.today.leaders.daily.repo.id, 1);
  assert.equal(selected.history.length, 2);
  assert.equal(calls.length, 2);
  await harbor.settings({ cooldownDays: 30 });
  setTime('2026-11-19T09:00:00+08:00');
  setFeed(publicFeed('2026-11-19'));
  const next = await harbor.refresh();
  const cooled = new Set([...initial.today.repos, ...selected.today.repos].map(repo => repo.id));
  assert.ok(next.today.repos.every(repo => !cooled.has(repo.id)));
});

test('new day selection is not cooled against an older board for the same feed date', async t => {
  const { harbor, setTime, setFeed } = await setup(t);
  setTime('2026-11-18T00:05:00+08:00');
  const stale = await harbor.refresh({ force: true });
  assert.equal(stale.today.date, '2026-11-17');
  setFeed(publicFeed('2026-11-18', '2026-11-17T16:00:00Z'));
  const next = await harbor.refresh({ force: true });
  assert.equal(next.today.date, '2026-11-18');
  assert.equal(next.history.length, 2);
  assert.ok(next.today.repos.every(repo => !stale.today.repos.some(prior => prior.id === repo.id)));
});

test('feed timeout and total refresh timeout abort ignored fetches and body decoding', async t => {
  for (const bodyHang of [false, true]) {
    const fixture = await setup(t, { feedTimeoutMs: 20 });
    let requestSignal;
    fixture.setResponse((_url, init) => {
      requestSignal = init.signal;
      return bodyHang ? { ok: true, json: () => new Promise(() => {}) } : new Promise(() => {});
    });
    const started = Date.now();
    const result = await fixture.harbor.refresh();
    assert.ok(Date.now() - started < 1000);
    assert.equal(result.lastError.code, 'feed_timeout');
    assert.equal(result.today, null);
    assert.equal(requestSignal.aborted, true);
  }
  const fixture = await setup(t, { refreshTimeoutMs: 10, feedTimeoutMs: 20000 });
  fixture.setResponse(() => new Promise(() => {}));
  assert.equal((await fixture.harbor.refresh()).lastError.code, 'refresh_timeout');
  for (const timeout of [0, -1, 20001, 1.5, Infinity]) {
    assert.throws(() => createHarbor({ dataDir: fixture.dataDir, feedUrl: URL, feedTimeoutMs: timeout }), /feedTimeoutMs/);
  }
  assert.throws(() => createHarbor({ dataDir: fixture.dataDir, feedUrl: 'https://name:secret@example.com/feed.json' }), /credentials/);
});

test('cancellation releases the shared lock, prevents state writes and ignores late responses', async t => {
  const controller = new AbortController();
  const fixture = await setup(t, { signal: controller.signal });
  await fixture.harbor.refresh();
  const stateFile = path.join(fixture.dataDir, 'state.json');
  const before = await fs.readFile(stateFile, 'utf8');
  let begin;
  let finish;
  const started = new Promise(resolve => { begin = resolve; });
  fixture.setResponse(() => { begin(); return new Promise(resolve => { finish = resolve; }); });
  const pending = fixture.harbor.refresh({ force: true, snapshotOnly: true });
  const queued = fixture.harbor.refresh({ force: true });
  const outcomes = Promise.allSettled([pending, queued]);
  await started;
  controller.abort(new Error('plugin disposed'));
  const results = await outcomes;
  assert.ok(results.every(result => result.status === 'rejected' && /plugin disposed/.test(result.reason.message)));
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  finish(Response.json(publicFeed()));
  await Promise.resolve();
  assert.equal(await fs.readFile(stateFile, 'utf8'), before);
  assert.equal((await createHarbor({ ...fixture.config, signal: undefined }).status()).today.date, '2026-11-17');
});
