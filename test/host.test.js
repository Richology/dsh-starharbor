import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { apply, translateDescription } from '../index.js';

test('description translation is independent of README banners and has an explicit source', async () => {
  const translated = [];
  const translator = {
    availableProviders: async () => ['google'],
    resolve: spec => spec,
    translate: async (spec, signal) => { assert.ok(signal instanceof AbortSignal); translated.push(spec.text); return '可用于评审智能体计划的工作区。'; },
  };
  const result = await translateDescription({ description: 'A workspace for reviewing agent plans.', readmeExcerpt: 'Sponsored by advertising. Donate now!' }, translator, new AbortController().signal);
  assert.deepEqual(translated, ['A workspace for reviewing agent plans.']);
  assert.equal(result.summaryZh, '可用于评审智能体计划的工作区。');
  assert.equal(result.summarySource, 'translated_description');
  assert.equal(result.summary, result.summaryZh);
});

test('Chinese originals and unavailable translation providers stay honest', async () => {
  const original = '本地优先的 GitHub 收藏工具。';
  assert.deepEqual(await translateDescription({ description: original }, undefined, new AbortController().signal), { summaryZh: original, summary: original, summarySource: 'original' });
  assert.deepEqual(await translateDescription({ description: 'An English description.' }, undefined, new AbortController().signal), {});
  assert.deepEqual(await translateDescription({ description: 'An English description.' }, { availableProviders: async () => ['paid-provider'] }, new AbortController().signal), {});
});

test('UI transport and agent tool share validation and persistent settings', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'starharbor-host-'));
  t.after(async () => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('starharbor-host-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  const effects = [];
  let route, tool;
  apply({
    workingDirectory: { defaultDirectory: root },
    get: () => undefined,
    effect: fn => effects.push(fn),
    connection: { fetch: { register: value => { route = value; return () => {}; } } },
    tools: { register: value => { tool = value; return () => {}; } },
  }, { dataDir: root });
  effects[0]();
  effects[1](); // Scheduler is deliberately not mounted in this transport test.
  const post = (body, header = true) => route.fetch(new Request('http://localhost/api/starharbor', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(header ? { 'X-StarHarbor': '1' } : {}) }, body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
  let response = await post({ action: 'status' }, false);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'access_denied');
  response = await post('{');
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'invalid_request');
  response = await post({ action: 'settings', settings: { hour: 24 } });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'invalid_settings');
  await assert.rejects(tool.execute({ action: 'settings', settings: { hour: 24 } }), error => error.code === 'invalid_settings');
  response = await post({ action: 'settings', settings: { cooldownDays: 3650, hour: 23 } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).settings.cooldownDays, 3650);
  const state = await tool.execute({ action: 'status' });
  assert.equal(state.settings.hour, 23);
  assert.equal(state.settings.cooldownDays, 3650);
  response = await post({ action: 'save', id: 999999 });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'not_recommended');
});
