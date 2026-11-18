import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectFeed, runCli } from '../scripts/collect-feed.mjs';

const at = '2026-11-17T16:00:00.000Z'; // Shanghai midnight, 18 November.
const day = 86400000;
const html = names => names.map(name => `<article><h2><a href="/${name}">${name}</a></h2></article>`).join('');
const meta = (id, name = `owner/repo-${id}`) => ({ id, full_name: name, stargazers_count: 10000 + id, description: 'terminal editor', language: 'JavaScript', pushed_at: null, private: false, fork: false, archived: false });
function responder({ extra = [], requests = [], override } = {}) {
  return async (url, options) => {
    requests.push({ url, options });
    const custom = await override?.(url, options);
    if (custom) return custom;
    let body;
    if (url.includes('/trending')) body = html(extra.length ? extra : ['owner/repo-1', 'owner/repo-2']);
    else if (url.includes('/search/')) {
      const page = Number(new URL(url).searchParams.get('page'));
      body = { incomplete_results: false, items: Array.from({ length: 100 }, (_, i) => meta((page - 1) * 100 + i + 1)) };
    } else {
      const name = new URL(url).pathname.slice('/repos/'.length);
      body = meta(1000 + extra.indexOf(name), name);
    }
    return { ok: true, status: 200, text: async () => body, json: async () => body };
  };
}
function snapshotsFor(id, count = 8) {
  return Array.from({ length: count }, (_, index) => {
    const observedAt = new Date(Date.parse(at) - index * day).toISOString();
    return { date: new Date(Date.parse(observedAt) + 8 * 3600000).toISOString().slice(0, 10), stars: { [id]: 10001 - index * 10 }, observedAtByRepo: { [id]: observedAt } };
  });
}

test('collects broad classic pool and scopes token exclusively to GitHub API', async () => {
  const requests = [];
  const { feed, snapshots } = await collectFeed({ fetchImpl: responder({ requests }), now: () => new Date(at), token: 'test-secret' });
  assert.equal(feed.repos.length, 300);
  assert.equal(feed.rankings.classic.length, 300);
  assert.equal(feed.date, '2026-11-18');
  assert.equal(feed.rankingModes.daily, 'trending_daily');
  assert.equal(feed.repos[0].dailyGain, null);
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].observedAtByRepo['1'], at);
  assert.equal(JSON.stringify({ feed, snapshots }).includes('test-secret'), false);
  for (const { url, options } of requests) {
    assert.equal(options.headers.Authorization, new URL(url).hostname === 'api.github.com' ? 'Bearer test-secret' : undefined);
    assert.equal(options.redirect, 'error');
  }
});

test('complete endpoints produce measured gains; missing intermediate per-repo point leaves weekly unknown', async () => {
  const prior = snapshotsFor(1);
  const complete = await collectFeed({ fetchImpl: responder(), now: () => new Date(at), previousSnapshots: prior });
  assert.equal(complete.feed.repos[0].dailyGain, 10);
  assert.equal(complete.feed.repos[0].weeklyGain, 70);
  assert.equal(complete.feed.rankingModes.weekly, 'weekly_gain');
  delete prior[3].observedAtByRepo['1'];
  prior[3].observedAt = prior[3].date + 'T00:00:00+08:00';
  const gap = await collectFeed({ fetchImpl: responder(), now: () => new Date(at), previousSnapshots: prior });
  assert.equal(gap.feed.repos[0].dailyGain, 10);
  assert.equal(gap.feed.repos[0].weeklyGain, null);
  assert.equal(gap.feed.rankingModes.weekly, 'trending_weekly');
});

test('records actual per-repository observations and rejects midnight points outside five minutes', async () => {
  let instant = at;
  const fetchImpl = responder({ extra: ['other/late'], override: async url => {
    if (url.endsWith('/repos/other/late')) instant = '2026-11-17T16:05:01.000Z';
  } });
  const { feed, snapshots } = await collectFeed({ fetchImpl, now: () => new Date(instant), previousSnapshots: snapshotsFor(1000) });
  const late = feed.repos.find(repo => repo.name === 'other/late');
  assert.equal(late.observedAt, instant);
  assert.equal(late.dailyGain, 10); // Prior valid current endpoint can still be used.
  assert.equal(snapshots.find(snap => snap.date === '2026-11-18').observedAtByRepo['1000'], at);
  const noPrior = await collectFeed({ fetchImpl: responder({ extra: ['other/late'] }), now: () => new Date(instant), previousSnapshots: snapshotsFor(1000).slice(1) });
  assert.equal(noPrior.feed.repos.find(repo => repo.name === 'other/late').dailyGain, null);
  assert.equal(noPrior.snapshots.some(snap => snap.date === '2026-11-18'), false);
});

test('public snapshots retain at most 35 days and discard invalid or unrelated fields', async () => {
  const prior = snapshotsFor(1, 50);
  prior[0].secret = 'private-saved-data';
  const { snapshots } = await collectFeed({ fetchImpl: responder(), now: () => new Date(at), previousSnapshots: prior });
  assert.equal(snapshots.length, 35);
  assert.equal(snapshots[0].date, '2026-10-15');
  assert.equal(JSON.stringify(snapshots).includes('private-saved-data'), false);
});

test('metadata work is bounded to 50 lookups and concurrency three', async () => {
  const extra = Array.from({ length: 60 }, (_, i) => `extra/repo-${i}`);
  let active = 0;
  let maximum = 0;
  let count = 0;
  const base = responder({ extra });
  const fetchImpl = async (url, options) => {
    if (!url.includes('/repos/')) return base(url, options);
    count++; active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setImmediate(resolve));
    const result = await base(url, options);
    active--;
    return result;
  };
  const { feed } = await collectFeed({ fetchImpl, now: () => new Date(at) });
  assert.equal(count, 50);
  assert.equal(maximum, 3);
  assert.ok(feed.warnings.some(warning => warning.code === 'metadata_budget' && warning.params.limit === 50));
});

test('required failures reject; rate limits preserve retry information and stop optional requests', async () => {
  await assert.rejects(collectFeed({ fetchImpl: responder({ override: async url => url.includes('since=weekly') ? { ok: false, status: 503, headers: new Headers() } : undefined }), now: () => new Date(at) }), /HTTP 503/);
  await assert.rejects(collectFeed({ fetchImpl: responder({ override: async url => url.includes('/search/') ? { ok: true, json: async () => ({ items: [] }) } : undefined }), now: () => new Date(at) }), /invalid or empty/);
  const requests = [];
  const { feed } = await collectFeed({ fetchImpl: responder({ extra: ['missing/head', 'missing/two', 'missing/three', 'missing/four'], requests, override: async url => url.includes('/repos/') ? { ok: false, status: 429, headers: new Headers({ 'retry-after': '60' }) } : undefined }), now: () => new Date(at) });
  assert.ok(requests.filter(request => request.url.includes('/repos/')).length <= 3);
  assert.ok(feed.warnings.some(warning => warning.code === 'leader_unavailable'));
  assert.ok(feed.warnings.some(warning => warning.params?.retryAt === '2026-11-17T16:01:00.000Z'));
});

test('bounded requests also time out fetch implementations that ignore AbortSignal', async () => {
  await assert.rejects(collectFeed({ fetchImpl: () => new Promise(() => {}), now: () => new Date(at), timeoutMs: 20, requestTimeoutMs: 20 }), /timed out/);
});

test('CLI required collection failure preserves previous good artifacts', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'starharbor-collector-'));
  const output = path.join(directory, 'latest.json');
  const snapshots = path.join(directory, 'snapshots.json');
  await fs.writeFile(output, '{"previous":"good"}');
  await fs.writeFile(snapshots, '[]');
  const priorFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('real source unavailable'); };
  try {
    await assert.rejects(runCli(['--output', output, '--snapshots', snapshots]), /real source unavailable/);
    assert.equal(await fs.readFile(output, 'utf8'), '{"previous":"good"}');
    assert.equal(await fs.readFile(snapshots, 'utf8'), '[]');
  } finally {
    globalThis.fetch = priorFetch;
    // Known, directly-created temporary directory only.
    assert.equal(path.dirname(output), directory);
    await fs.rm(directory, { recursive: true, force: true });
  }
});
