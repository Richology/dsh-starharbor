import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { apply, DEFAULT_FEED_URL } from '../index.js';

test('installed Host uses the public cloud boundary for both UI and agent, without translator or private uploads', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'starharbor-host-cloud-'));
  const dispose = [];
  t.after(async () => {
    for (const fn of dispose.reverse()) if (typeof fn === 'function') await fn();
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('starharbor-host-cloud-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  const generatedAt = new Date().toISOString();
  const date = new Date(Date.parse(generatedAt) + 8 * 3600000).toISOString().slice(0, 10);
  const feed = { schemaVersion: 1, date, generatedAt,
    repos: [{ id: 42, name: 'sample/resources', description: 'A collection of public API resources.', stars: 90000,
      categoryId: 'resources', language: null, pushedAt: null, observedAt: generatedAt,
      dailyGain: null, weeklyGain: null, dailyInterval: null, weeklyInterval: null }],
    rankings: { daily: [42], weekly: [42], classic: [42] }, rankingModes: { daily: 'trending_daily', weekly: 'trending_weekly' }, warnings: [] };
  let fetches = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    fetches++;
    assert.equal(url, DEFAULT_FEED_URL);
    assert.equal(options.credentials, 'omit');
    assert.equal(options.body, undefined);
    assert.equal(options.headers.Authorization, undefined);
    return new Response(JSON.stringify(feed), { headers: { 'Content-Type': 'application/json' } });
  });
  const effects = [];
  let route, tool;
  apply({ workingDirectory: { defaultDirectory: root }, get: () => { throw new Error('Cloud mode must not request a translator'); },
    effect: fn => effects.push(fn),
    connection: { fetch: { register: value => { route = value; return () => {}; } } },
    tools: { register: value => { tool = value; return () => {}; } },
  }, { dataDir: root });
  dispose.push(effects[0](), effects[1]());
  // Do not mount the scheduler: exercise the two real entry points deterministically.
  const state = await tool.execute({ action: 'refresh', force: true });
  assert.equal(state.feed.status, 'fresh');
  assert.equal(state.today.date, date);
  assert.equal(state.today.repos[0].id, 42);
  const request = new Request('http://localhost/api/starharbor', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-StarHarbor': '1' }, body: JSON.stringify({ action: 'refresh', force: true }) });
  const response = await route.fetch(request);
  assert.equal(response.status, 200);
  const fromUi = await response.json();
  assert.equal(fromUi.today.generatedAt, state.today.generatedAt);
  assert.equal(fromUi.feed.url, DEFAULT_FEED_URL);
  assert.equal(fetches, 2);
});
