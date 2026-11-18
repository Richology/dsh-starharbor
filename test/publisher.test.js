import test from 'node:test';
import assert from 'node:assert/strict';
import { publish } from '../scripts/update-cloud.mjs';

const at = '2026-11-18T02:00:00.000Z';
const HEAD = 'a'.repeat(40);
const TREE = 'b'.repeat(40);
const COMMIT = 'c'.repeat(40);
const BLOB = 'd'.repeat(40);
const options = { repository: 'owner/project', token: 'publisher-test-token', now: () => new Date(at) };
function result() {
  return { feed: { schemaVersion: 1, date: '2026-11-18', generatedAt: at, repos: [{ id: 1, name: 'public/repository', description: 'terminal editor', stars: 10000, categoryId: 'devtools', language: null, pushedAt: null, observedAt: at, dailyGain: null, weeklyGain: null, dailyInterval: null, weeklyInterval: null }], rankings: { daily: [1], weekly: [1], classic: [1] }, rankingModes: { daily: 'trending_daily', weekly: 'trending_weekly' }, warnings: [] }, snapshots: [] };
}
function encoded(value) {
  const content = JSON.stringify(value);
  return { encoding: 'base64', content: Buffer.from(content).toString('base64'), size: Buffer.byteLength(content), sha: BLOB };
}
const reply = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
function fixture({ existing = false, stored = encoded([]), blob, failRoute, failStatus = 503 } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://api.github.com');
    assert.equal(init.headers.Authorization, 'Bearer publisher-test-token');
    assert.equal(init.redirect, 'error');
    const route = parsed.pathname.slice('/repos/owner/project'.length) + parsed.search;
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ route, method: init.method, body });
    if (route === failRoute) return reply({}, failStatus);
    if (route === '/git/ref/heads/data') return existing ? reply({ object: { sha: HEAD } }) : reply({}, 404);
    if (route === `/contents/snapshots.json?ref=${HEAD}`) return reply(stored);
    if (route === `/git/blobs/${BLOB}`) return reply(blob);
    if (route === '/git/trees') return reply({ sha: TREE });
    if (route === '/git/commits') return reply({ sha: COMMIT });
    if (route === '/git/refs' || route === '/git/refs/heads/data') return reply({ object: { sha: COMMIT } });
    throw new Error(`Unexpected API request ${route}`);
  };
  return { calls, fetchImpl };
}
const writes = calls => calls.filter(call => call.method !== 'GET');
const refs = calls => calls.filter(call => /^\/git\/refs(?:\/|$)/.test(call.route));

test('first publish creates an orphan data branch with exactly three public files', async () => {
  const api = fixture();
  const collected = result();
  collected.feed.saved = [{ name: 'PRIVATE-LOCAL-COLLECTION' }];
  collected.feed.settings = { secret: 'PRIVATE-LOCAL-SETTINGS' };
  collected.feed.repos[0].url = 'https://private.example/local';
  collected.feed.repos[0].readmeExcerpt = 'PRIVATE-LOCAL-README';
  let collectorCalls = 0;
  const output = await publish({ ...options, fetchImpl: api.fetchImpl, collect: async input => {
    collectorCalls++;
    assert.deepEqual(input.previousSnapshots, []);
    assert.deepEqual(Object.keys(input).sort(), ['fetchImpl', 'now', 'previousSnapshots', 'token']);
    return collected;
  } });
  assert.equal(collectorCalls, 1);
  const tree = api.calls.find(call => call.route === '/git/trees').body;
  assert.deepEqual(tree.tree.map(file => file.path), ['latest.json', 'snapshots.json', 'README.md']);
  assert.equal(tree.base_tree, undefined);
  assert.ok(tree.tree.every(file => file.mode === '100644' && file.type === 'blob'));
  assert.deepEqual(api.calls.find(call => call.route === '/git/commits').body.parents, []);
  assert.deepEqual(refs(api.calls), [{ route: '/git/refs', method: 'POST', body: { ref: 'refs/heads/data', sha: COMMIT } }]);
  const serialized = JSON.stringify(writes(api.calls));
  assert.equal(serialized.includes('PRIVATE-LOCAL'), false);
  assert.equal(serialized.includes('private.example'), false);
  assert.equal(serialized.includes('publisher-test-token'), false);
  assert.equal(output.commit, COMMIT);
  assert.equal(output.url, 'https://raw.githubusercontent.com/owner/project/data/latest.json');
});

test('subsequent publish reads snapshots pinned to previous head and updates without force', async () => {
  const previous = [{ date: '2026-11-18', stars: { 1: 10000 }, observedAtByRepo: { 1: '2026-11-17T16:00:00.000Z' }, private: 'PRIVATE-LOCAL' }];
  const api = fixture({ existing: true, stored: encoded(previous) });
  await publish({ ...options, fetchImpl: api.fetchImpl, collect: async input => {
    assert.equal(input.previousSnapshots[0].stars['1'], 10000);
    assert.equal(input.previousSnapshots[0].private, undefined);
    const collected = result();
    collected.snapshots = previous;
    return collected;
  } });
  assert.ok(api.calls.some(call => call.route === `/contents/snapshots.json?ref=${HEAD}`));
  assert.deepEqual(api.calls.find(call => call.route === '/git/commits').body.parents, [HEAD]);
  assert.deepEqual(refs(api.calls), [{ route: '/git/refs/heads/data', method: 'PATCH', body: { sha: COMMIT, force: false } }]);
  assert.equal(api.calls.find(call => call.route === '/git/trees').body.base_tree, undefined);
  assert.equal(JSON.stringify(writes(api.calls)).includes('PRIVATE-LOCAL'), false);
});

test('Contents files over 1 MB safely fall back to the returned Git blob SHA', async () => {
  const previous = Array.from({ length: 35 }, (_, day) => {
    const midnight = new Date(Date.parse('2026-11-17T16:00:00Z') - day * 86400000);
    const date = new Date(midnight.getTime() + 8 * 3600000).toISOString().slice(0, 10);
    return { date, stars: Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [i + 1, 10000])), observedAtByRepo: Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [i + 1, midnight.toISOString()])) };
  });
  const blob = encoded(previous);
  assert.ok(blob.size > 1000000);
  const api = fixture({ existing: true, stored: { encoding: 'none', content: '', size: blob.size, sha: BLOB, download_url: 'https://untrusted.example/snapshots' }, blob });
  await publish({ ...options, fetchImpl: api.fetchImpl, collect: async input => {
    assert.equal(input.previousSnapshots.length, 35);
    assert.equal(Object.keys(input.previousSnapshots[0].stars).length, 1000);
    return result();
  } });
  assert.ok(api.calls.some(call => call.route === `/git/blobs/${BLOB}`));
});

test('required collection failure creates no tree, commit or ref', async () => {
  for (const existing of [false, true]) {
    const api = fixture({ existing });
    await assert.rejects(publish({ ...options, fetchImpl: api.fetchImpl, collect: async () => { throw new Error('Required Trending source failed'); } }), /Required Trending source failed/);
    assert.deepEqual(writes(api.calls), []);
  }
});

test('invalid collected feed or snapshots is rejected before remote writes', async () => {
  for (const corrupt of [
    collected => { collected.feed.repos = []; },
    collected => { collected.snapshots = { saved: ['PRIVATE'] }; },
    collected => { collected.snapshots = [{ date: '2026-11-18', stars: { private: 123 }, observedAtByRepo: {} }]; }
  ]) {
    const api = fixture();
    const collected = result(); corrupt(collected);
    await assert.rejects(publish({ ...options, fetchImpl: api.fetchImpl, collect: async () => collected }));
    assert.deepEqual(writes(api.calls), []);
  }
});

test('API read, tree, or commit failure never attempts ref updates', async () => {
  for (const failRoute of ['/git/ref/heads/data', `/contents/snapshots.json?ref=${HEAD}`, '/git/trees', '/git/commits']) {
    const api = fixture({ existing: true, failRoute });
    await assert.rejects(publish({ ...options, fetchImpl: api.fetchImpl, collect: async () => result() }), /HTTP 503/);
    assert.deepEqual(refs(api.calls), []);
    if (failRoute === '/git/trees') assert.equal(api.calls.some(call => call.route === '/git/commits'), false);
  }
});

test('concurrent ref conflict is reported without force or retry', async () => {
  const api = fixture({ existing: true, failRoute: '/git/refs/heads/data', failStatus: 409 });
  await assert.rejects(publish({ ...options, fetchImpl: api.fetchImpl, collect: async () => result() }), /HTTP 409/);
  assert.equal(refs(api.calls).length, 1);
  assert.deepEqual(refs(api.calls)[0].body, { sha: COMMIT, force: false });
});

test('oversized, malformed, unsafe-SHA or failed blob reads fail before writes', async () => {
  const scenarios = [
    { stored: { encoding: 'none', content: '', sha: BLOB, size: 10000001 } },
    { stored: { encoding: 'none', content: '', sha: '../../arbitrary', size: 2 } },
    { stored: { encoding: 'base64', content: '!!!!', sha: BLOB, size: 2 } },
    { stored: { encoding: 'base64', content: Buffer.from('[]').toString('base64'), sha: BLOB, size: 3 } },
    { stored: { encoding: 'none', content: '', sha: BLOB, size: 2 }, blob: { encoding: 'base64', content: 'W10=', size: 10000001 } },
    { stored: { encoding: 'none', content: '', sha: BLOB, size: 2 }, failRoute: `/git/blobs/${BLOB}` }
  ];
  for (const scenario of scenarios) {
    const api = fixture({ existing: true, ...scenario });
    let collected = false;
    await assert.rejects(publish({ ...options, fetchImpl: api.fetchImpl, collect: async () => { collected = true; return result(); } }));
    assert.equal(collected, false);
    assert.deepEqual(writes(api.calls), []);
  }
});
