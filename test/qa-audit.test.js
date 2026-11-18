import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHarbor } from '../core.js';
import { validateFeed, selectFeedBoard } from '../feed.js';
import { projectRepo, classifyCategory } from '../domain.js';
import { collectFeed } from '../scripts/collect-feed.mjs';
import { apply } from '../index.js';

// Independent QA: no real profile, real network, or live UI operations.
const AT = '2026-11-18T01:00:00.000Z';
const FEED_URL = 'https://example.invalid/public-feed.json';
const ids = board => board.repos.map(repo => repo.id);
function feed() {
  return { schemaVersion: 1, date: '2026-11-18', generatedAt: AT,
    repos: ['terminal editor', 'AI model', 'SQL database', 'design system', 'docker infrastructure', 'tutorial course', 'automation workflow', 'resources collection'].map((description, i) => ({
      id: i + 1, name: `audit/project-${i + 1}`, description, stars: 90000 - i * 1000, categoryId: 'general', language: null, pushedAt: null, observedAt: AT,
      dailyGain: null, weeklyGain: null, dailyInterval: null, weeklyInterval: null,
    })), rankings: { daily: [1, 2, 3, 4], weekly: [1, 2, 3, 4], classic: [1, 2, 3, 4, 5, 6, 7, 8] },
    rankingModes: { daily: 'trending_daily', weekly: 'trending_weekly' }, warnings: [] };
}
async function temp(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'starharbor-qa-audit-'));
  t.after(async () => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('starharbor-qa-audit-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  return root;
}
async function cloud(t) {
  const dataDir = await temp(t);
  let instant = AT, payload = feed(), response, calls = 0;
  const config = { dataDir, feedUrl: FEED_URL, now: () => new Date(instant), fetchImpl: async (_url, init) => {
    calls++; return response ? response(init) : Response.json(payload);
  } };
  return { dataDir, config, harbor: createHarbor(config), setTime: value => { instant = value; }, setFeed: value => { payload = value; }, setResponse: value => { response = value; }, calls: () => calls };
}
function measured(value, period, gain) {
  value[`${period}Gain`] = gain;
  value[`${period}Interval`] = { start: period === 'daily' ? '2026-11-17T00:00:00+08:00' : '2026-11-11T00:00:00+08:00', end: '2026-11-18T00:00:00+08:00' };
}
function meta(id, stars = 10000) { return { id, full_name: `audit/project-${id}`, stargazers_count: stars, description: 'terminal editor', language: null, pushed_at: null, private: false, fork: false, archived: false }; }
function collectorFetch(stars = 10000) {
  return async url => url.includes('/trending') ? new Response('<article><h2><a href="/audit/project-1">project</a></h2></article>') : Response.json({ items: [meta(1, stars)] });
}

test('QA a working bug-hunting tool with curated internal patterns keeps developer-tool purpose', () => {
  const actual = { name: 'elementalsouls/Claude-BugHunter', description: 'A Claude Code skill bundle for bug hunting and external red-team work - 82 skills, 15 slash commands, 681 disclosed-report patterns curated across 24 core vulnerability classes, plus enterprise integrations.' };
  assert.equal(classifyCategory(actual), 'devtools');
  assert.equal(classifyCategory({ name: 'audit/bug-hunting-resources', description: 'A curated list of bug hunting and external red-team tools.' }), 'resources');
  assert.equal(classifyCategory({ name: 'audit/security-list', description: 'A curated list of security testing tools and references.' }), 'resources');
});

test('QA legacy security-tool correction projects today, history and saved read-only while curated lists stay resources', async t => {
  const dataDir = await temp(t), file = path.join(dataDir, 'state.json'), md = path.join(dataDir, 'GitHub收藏.md');
  const actual = { id: 61, name: 'elementalsouls/Claude-BugHunter', description: 'A Claude Code skill bundle for bug hunting and external red-team work - 82 skills, 15 slash commands, 681 disclosed-report patterns curated across 24 core vulnerability classes.', categoryId: 'resources', category: '资源合集', stars: 10000, summary: 'Original summary' };
  const genuineList = { id: 62, name: 'audit/security-list', description: 'A curated list of bug hunting and red-team tools.', categoryId: 'resources', category: '资源合集' };
  const unrelated = { id: 63, name: 'audit/terminal-bundle', description: 'Curated terminal editor settings.', categoryId: 'resources', category: '旧分类' };
  const board = { date: '2026-11-18', generatedAt: AT, repos: [actual, genuineList, unrelated], warnings: [], leaders: { daily: { label: 'Trending 近1日', repo: actual } } };
  const bytes = JSON.stringify({ today: board, history: [board], saved: [actual, genuineList] }); await fs.writeFile(file, bytes);
  const notes = '# 手写收藏\n\n## 资源合集\n\n保留已有条目与分类。\n'; await fs.writeFile(md, notes);
  const h = createHarbor({ dataDir, fetchImpl: () => { throw new Error('projection must not fetch'); } }); const status = await h.status();
  for (const projected of [status.today.repos[0], status.history[0].repos[0], status.saved[0], status.today.leaders.daily.repo]) {
    assert.equal(projected.categoryId, 'devtools'); assert.equal(projected.category, '资源合集'); assert.equal(projected.summary, 'Original summary');
  }
  for (const projected of [status.today.repos[1], status.history[0].repos[1], status.saved[1]]) assert.equal(projected.categoryId, 'resources');
  assert.equal(status.today.repos[2].categoryId, 'resources'); // Narrow migration: do not silently recategorize every old tool.
  assert.equal(await fs.readFile(file, 'utf8'), bytes); assert.equal(await fs.readFile(md, 'utf8'), notes);
});

test('QA feed projections detach source fields and reject unsafe names, control text and malformed identity', () => {
  const bad = [r => { r.name = 'audit/../escape'; }, r => { r.name = 'audit/project%2fescape'; }, r => { r.id = Number.MAX_SAFE_INTEGER + 1; }, r => { r.description = 'bad\u0000text'; }, r => { r.language = ''; }];
  for (const mutate of bad) { const f = feed(); mutate(f.repos[0]); assert.throws(() => validateFeed(f, { now: AT })); }
  const f = feed(); f.repos[0].url = 'javascript:alert(1)'; f.repos[0].private = 'injected';
  const clean = validateFeed(f, { now: AT }); clean.repos[0].description = 'changed'; clean.rankings.daily.reverse();
  assert.equal(f.repos[0].description, 'terminal editor'); assert.deepEqual(f.rankings.daily, [1, 2, 3, 4]);
  assert.equal(clean.repos[0].url, 'https://github.com/audit/project-1'); assert.equal(clean.repos[0].private, undefined);
});

test('QA measured daily and weekly ranking skip candidates below their own cumulative floor and preserve real leaders', () => {
  const f = feed();
  for (const [i, r] of f.repos.entries()) { measured(r, 'daily', 100 - i); measured(r, 'weekly', 700 - i); }
  f.rankingModes = { daily: 'daily_gain', weekly: 'weekly_gain' };
  f.repos[0].stars = 4999; f.repos[1].stars = 5000; f.repos[2].stars = 9999; f.repos[3].stars = 10000;
  const b = selectFeedBoard(f, { now: AT });
  assert.deepEqual(ids(b).slice(0, 2), [2, 4]); assert.equal(b.leaders.daily.repo.id, 1); assert.equal(b.leaders.weekly.repo.id, 1);
  assert.equal(b.repos[0].sourceCode, 'daily_gain'); assert.equal(b.repos[1].sourceCode, 'weekly_gain');
});

test('QA negative measured growth sorts descending and stays distinct from unknown', () => {
  const f = feed(); f.rankings.daily = [2, 1]; f.rankingModes.daily = 'daily_gain';
  measured(f.repos[0], 'daily', -20); measured(f.repos[1], 'daily', -1);
  assert.equal(selectFeedBoard(f, { now: AT }).repos[0].dailyGain, -1);
  f.rankings.daily.reverse(); assert.throws(() => validateFeed(f, { now: AT }), /unsorted/);
});

test('QA cooldown precise day boundary, future history and permanent saved exclusion use numeric repository IDs', () => {
  const f = feed();
  const b = selectFeedBoard(f, { now: AT, saved: [1, { id: 2, name: 'old/renamed' }], history: [
    { date: '2026-10-20', repos: [{ id: 3 }] }, { date: '2026-10-19', repos: [{ id: 4 }] }, { date: '2026-11-19', repos: [{ id: 5 }] },
  ] });
  assert.equal(b.repos[0].id, 4); assert.ok(!ids(b).some(id => [1, 2, 3].includes(id))); assert.ok(ids(b).includes(5));
  assert.equal(new Set(ids(b)).size, b.repos.length);
});

test('QA classic category diversity falls back only after exhausting distinct eligible categories', () => {
  const f = feed(); f.rankings.daily = []; f.rankings.weekly = []; f.rankings.classic = [1, 2, 3, 4];
  f.repos[1].description = 'terminal editor';
  assert.deepEqual(ids(selectFeedBoard(f, { now: AT })), [1, 3, 4]);
  f.repos[2].description = 'terminal editor'; f.repos[3].description = 'terminal editor';
  assert.deepEqual(ids(selectFeedBoard(f, { now: AT })), [1, 2, 3]);
});

test('QA settings reject invalid boundaries without modifying bytes on disk', async t => {
  const x = await cloud(t); await x.harbor.settings({});
  const file = path.join(x.dataDir, 'state.json'), before = await fs.readFile(file, 'utf8');
  for (const patch of [null, [], false, { hour: 1.5 }, { hour: -1 }, { cooldownDays: 3651 }, { dailyMin: 1000000001 }, { weeklyMin: NaN }, { preferredMin: 29999 }, { constructor: 3 }, { extra: 1 }]) {
    await assert.rejects(x.harbor.settings(patch)); assert.equal(await fs.readFile(file, 'utf8'), before);
  }
  const b = await x.harbor.settings({ hour: 0, cooldownDays: 0, dailyMin: 0, weeklyMin: 0, classicMin: 0, preferredMin: 0 }); assert.equal(b.settings.hour, 0);
});

test('QA forced same-day sync survives restart and setting changes without reselecting the board', async t => {
  const x = await cloud(t); const first = await x.harbor.refresh();
  await x.harbor.settings({ dailyMin: 1000000000, cooldownDays: 0 });
  const changed = feed(); changed.rankings.daily.reverse(); x.setFeed(changed);
  const restarted = createHarbor(x.config); const again = await restarted.refresh({ force: true });
  assert.deepEqual(again.today, first.today); assert.equal(again.history.length, 1); assert.equal(x.calls(), 2);
});

test('QA stale cache, failed refresh and later recovery retain notes and history', async t => {
  const x = await cloud(t); const first = await x.harbor.refresh();
  const md = path.join(x.dataDir, 'GitHub收藏.md'); await fs.writeFile(md, '手写 QA 内容\n');
  x.setTime('2026-11-19T01:00:00Z'); x.setResponse(() => { throw new TypeError('offline audit'); });
  const failed = await x.harbor.refresh({ force: true });
  assert.equal(failed.feed.status, 'stale'); assert.equal(failed.lastError.code, 'feed_fetch_failed'); assert.deepEqual(failed.today, first.today);
  const next = feed(); next.date = '2026-11-19'; next.generatedAt = '2026-11-19T00:30:00Z'; for (const r of next.repos) r.observedAt = next.generatedAt;
  x.setFeed(next); x.setResponse(undefined);
  const recovered = await x.harbor.refresh({ force: true }); assert.equal(recovered.lastError, null); assert.equal(recovered.feed.status, 'fresh'); assert.equal(recovered.history.length, 2);
  assert.equal(await fs.readFile(md, 'utf8'), '手写 QA 内容\n');
});

test('QA older feed rollback never replaces a newer board, whether older date already has history or not', async t => {
  const x = await cloud(t); await x.harbor.settings({ cooldownDays: 0 }); await x.harbor.refresh();
  x.setTime('2026-11-19T01:00:00Z');
  const newer = feed(); newer.date = '2026-11-19'; newer.generatedAt = '2026-11-19T00:30:00Z'; for (const repo of newer.repos) repo.observedAt = newer.generatedAt;
  x.setFeed(newer); const current = await x.harbor.refresh({ force: true });
  for (const oldDate of ['2026-11-18', '2026-11-17']) {
    const older = feed(); older.date = oldDate; older.generatedAt = `${oldDate}T00:30:00Z`; for (const repo of older.repos) repo.observedAt = older.generatedAt;
    x.setFeed(older); const rollback = await x.harbor.refresh({ force: true });
    assert.equal(rollback.feed.status, 'stale'); assert.deepEqual(rollback.today, current.today); assert.deepEqual(rollback.history, current.history);
  }
});

test('QA distinct instances share a root refresh and serialize a queued settings write without losing either update', async t => {
  const x = await cloud(t); let begin, finish;
  const started = new Promise(resolve => { begin = resolve; });
  x.setResponse(() => { begin(); return new Promise(resolve => { finish = resolve; }); });
  const second = createHarbor(x.config); const a = x.harbor.refresh({ force: true }); await started;
  const b = second.refresh({ force: true }); assert.equal(a, b);
  const queued = second.settings({ cooldownDays: 17, hour: 11 });
  finish(Response.json(feed())); const board = await a; const after = await queued;
  assert.equal(x.calls(), 1); assert.equal(after.history.length, 1); assert.deepEqual(after.today, board.today); assert.equal(after.settings.cooldownDays, 17);
  assert.equal((await x.harbor.status()).settings.hour, 11);
});

test('QA timeout aborts body decoding, ignores its late result and releases the root lock', async t => {
  const x = await cloud(t); let resolveBody, requestSignal;
  x.setResponse(init => { requestSignal = init.signal; return { ok: true, json: () => new Promise(resolve => { resolveBody = resolve; }) }; });
  const h = createHarbor({ ...x.config, feedTimeoutMs: 15 }); const result = await h.refresh();
  assert.equal(result.lastError.code, 'feed_timeout'); assert.equal(requestSignal.aborted, true);
  const stateFile = path.join(x.dataDir, 'state.json'), before = await fs.readFile(stateFile, 'utf8'); resolveBody(feed());
  await new Promise(resolve => setImmediate(resolve)); assert.equal(await fs.readFile(stateFile, 'utf8'), before);
  x.setResponse(undefined); assert.equal((await x.harbor.refresh({ force: true })).lastError, null);
});

test('QA save by repository ID preserves notes, repairs MD-first state and survives renamed history', async t => {
  const x = await cloud(t); await x.harbor.refresh();
  const md = path.join(x.dataDir, 'GitHub收藏.md'), file = path.join(x.dataDir, 'state.json');
  await fs.writeFile(md, '# 私人笔记\n\n## 开发工具\n\n保留段落。\n');
  await Promise.all([x.harbor.save(1), x.harbor.save(1)]);
  const text = await fs.readFile(md, 'utf8'); assert.equal(text.split('<!-- starharbor:repo:1 -->').length, 2); assert.match(text, /保留段落。/);
  const raw = JSON.parse(await fs.readFile(file, 'utf8')); raw.saved = []; raw.today.repos[0].name = 'renamed/project'; await fs.writeFile(file, JSON.stringify(raw));
  assert.equal((await x.harbor.save(1)).saved.length, 1); assert.equal(await fs.readFile(md, 'utf8'), text);
  await assert.rejects(x.harbor.save('1')); await assert.rejects(x.harbor.save(999));
});

test('QA legacy web-purpose projection must use the corrected category for a NEW Markdown save', async t => {
  const dataDir = await temp(t);
  const legacy = { id: 51, name: 'audit/design-system', url: 'https://github.com/audit/design-system', stars: 100000, description: 'Agent-ready design system', summary: 'Design system', categoryId: 'ai', category: '人工智能' };
  const board = { date: '2026-11-18', generatedAt: AT, repos: [legacy], warnings: [] };
  const file = path.join(dataDir, 'state.json'); const bytes = JSON.stringify({ today: board, history: [board], saved: [] }); await fs.writeFile(file, bytes);
  const md = path.join(dataDir, 'GitHub收藏.md'); await fs.writeFile(md, '# 手写笔记\n\n## 人工智能\n\n保留旧分类。\n');
  const h = createHarbor({ dataDir });
  assert.equal((await h.status()).today.repos[0].categoryId, 'web'); assert.equal(await fs.readFile(file, 'utf8'), bytes);
  const receipt = await h.save(51);
  assert.equal(receipt.repo.categoryId, 'web'); assert.equal(receipt.repo.category, '前端与 Web');
  assert.equal(receipt.saved[0].categoryId, 'web'); assert.equal(receipt.saved[0].category, '前端与 Web');
  const persisted = JSON.parse(await fs.readFile(file, 'utf8')); assert.equal(persisted.saved[0].category, '前端与 Web');
  const text = await fs.readFile(md, 'utf8'); assert.match(text, /保留旧分类。/);
  assert.match(text, /## 前端与 Web\n\n<!-- starharbor:repo:51 -->/);
});

test('QA legacy unknown user categories remain intact on read without network or mutation', async t => {
  const dataDir = await temp(t), file = path.join(dataDir, 'state.json');
  const legacy = { id: 52, name: 'audit/plain', description: 'general purpose software', category: '用户自定义分类', summary: '原始摘要' };
  const raw = JSON.stringify({ today: { date: '2026-11-18', repos: [legacy], warnings: ['未知旧警告'] }, saved: [legacy], lastError: { message: '旧错误' } }); await fs.writeFile(file, raw);
  const h = createHarbor({ dataDir, fetchImpl: () => { throw new Error('read must not fetch'); } }); const status = await h.status();
  assert.equal(status.today.repos[0].category, '用户自定义分类'); assert.equal(projectRepo(legacy).categoryId, 'general'); assert.equal(status.lastError.details[0].code, 'legacy'); assert.equal(await fs.readFile(file, 'utf8'), raw);
});

test('QA saving an unknown general legacy category retains custom Markdown, receipt and saved-state category', async t => {
  const dataDir = await temp(t), file = path.join(dataDir, 'state.json');
  const repo = { id: 53, name: 'audit/plain', url: 'https://github.com/audit/plain', description: 'general purpose software', category: '用户自定义分类', summary: '原始摘要', stars: 12345 };
  const board = { date: '2026-11-18', repos: [repo], warnings: [] }; await fs.writeFile(file, JSON.stringify({ today: board, history: [board], saved: [] }));
  const h = createHarbor({ dataDir }); const result = await h.save(53);
  assert.equal(result.repo.categoryId, 'general'); assert.equal(result.repo.category, '用户自定义分类'); assert.equal(result.saved[0].category, '用户自定义分类');
  assert.match(await fs.readFile(path.join(dataDir, 'GitHub收藏.md'), 'utf8'), /## 用户自定义分类/);
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).saved[0].category, '用户自定义分类');
});

test('QA collector rejects private, forked and archived candidates without asserting fake leaders', async () => {
  for (const patch of [{ private: true }, { visibility: 'private' }]) {
    await assert.rejects(collectFeed({ now: () => new Date(AT), token: undefined, fetchImpl: async url => url.includes('/trending') ? new Response('<article><h2><a href="/audit/project-1">p</a></h2></article>') : Response.json({ items: [{ ...meta(1), ...patch }] }) }), /public repository metadata/);
  }
  const result = await collectFeed({ now: () => new Date(AT), token: undefined, fetchImpl: async url => {
    if (url.includes('/trending')) return new Response('<article><h2><a href="/audit/project-2">p</a></h2></article>');
    if (url.includes('/repos/')) return Response.json({ ...meta(2), archived: true });
    return Response.json({ items: [meta(1), { ...meta(3), fork: true }] });
  } });
  assert.deepEqual(result.feed.repos.map(r => r.id), [1]); assert.deepEqual(result.feed.rankings.daily, []); assert.ok(result.feed.warnings.some(w => w.code === 'leader_unavailable'));
});

test('QA collector midnight samples accept inclusive +/-five minutes and reject one millisecond outside', async () => {
  const midnight = Date.parse('2026-11-18T00:00:00+08:00');
  for (const delta of [-300001, -300000, 300000, 300001]) {
    const result = await collectFeed({ now: () => new Date(midnight + delta), fetchImpl: collectorFetch(), token: undefined });
    assert.equal(result.snapshots.some(s => s.date === '2026-11-18'), Math.abs(delta) <= 300000, `delta=${delta}`);
    assert.equal(result.feed.repos[0].dailyGain, null);
  }
});

test('QA legitimate historical growth may exceed current stars after later same-day unstars', async t => {
  // Midnight: 10 -> 10010 (+10000 yesterday); by 09:00 today: 9999.
  // These are all real nonnegative counts; historical gain remains +10000.
  for (const period of ['daily', 'weekly']) await t.test(period, async () => {
    const previousSnapshots = Array.from({ length: period === 'daily' ? 2 : 8 }, (_, i) => {
      const observedAt = new Date(Date.parse('2026-11-18T00:00:00+08:00') - i * 86400000).toISOString();
      const date = new Date(Date.parse(observedAt) + 8 * 3600000).toISOString().slice(0, 10);
      return { date, stars: { 1: i === 0 || period === 'weekly' && i === 1 ? 10010 : 10 }, observedAtByRepo: { 1: observedAt } };
    });
    const result = await collectFeed({ now: () => new Date(AT), fetchImpl: collectorFetch(9999), previousSnapshots, token: undefined });
    assert.equal(result.feed.repos[0].stars, 9999); assert.equal(result.feed.repos[0][`${period}Gain`], 10000);
  });
});

test('QA collector requires eight per-repository midnight endpoints for a weekly gain', async () => {
  const boundary = Date.parse('2026-11-18T00:00:00+08:00');
  const previousSnapshots = Array.from({ length: 8 }, (_, i) => {
    const observedAt = new Date(boundary - i * 86400000).toISOString();
    const date = new Date(Date.parse(observedAt) + 8 * 3600000).toISOString().slice(0, 10);
    return { date, stars: { 1: 10000 - i * 10 }, observedAtByRepo: { 1: observedAt } };
  });
  const complete = await collectFeed({ now: () => new Date(AT), fetchImpl: collectorFetch(), previousSnapshots, token: undefined });
  assert.equal(complete.feed.repos[0].dailyGain, 10); assert.equal(complete.feed.repos[0].weeklyGain, 70);
  const missing = structuredClone(previousSnapshots); delete missing[4].observedAtByRepo[1]; missing[4].observedAt = previousSnapshots[4].observedAtByRepo[1];
  const gap = await collectFeed({ now: () => new Date(AT), fetchImpl: collectorFetch(), previousSnapshots: missing, token: undefined });
  assert.equal(gap.feed.repos[0].dailyGain, 10); assert.equal(gap.feed.repos[0].weeklyGain, null); assert.equal(gap.feed.rankingModes.weekly, 'trending_weekly');
  const bad = structuredClone(previousSnapshots); bad[0].observedAtByRepo[1] = '2026-11-18T00:05:00.001+08:00';
  const outside = await collectFeed({ now: () => new Date(AT), fetchImpl: collectorFetch(), previousSnapshots: bad, token: undefined });
  assert.equal(outside.feed.repos[0].dailyGain, null); assert.equal(outside.feed.repos[0].weeklyGain, null);
});

test('QA optional metadata identity mismatch cannot substitute another repo for a source leader', async () => {
  const result = await collectFeed({ now: () => new Date(AT), token: undefined, fetchImpl: async url => {
    if (url.includes('/trending')) return new Response('<article><h2><a href="/other/wanted">wanted</a></h2></article>');
    if (url.includes('/repos/')) return Response.json({ ...meta(2), full_name: 'unrelated/substitute' });
    return Response.json({ items: [meta(1)] });
  } });
  assert.deepEqual(result.feed.repos.map(r => r.id), [1]); assert.deepEqual(result.feed.rankings.daily, []);
  assert.ok(result.feed.warnings.some(w => w.code === 'source_failed' && /name mismatch/.test(w.params.message)));
  assert.equal(selectFeedBoard(result.feed, { now: AT }).leaders.daily.repo, null);
});

function host(root) {
  const effects = []; let route, tool;
  apply({ workingDirectory: { defaultDirectory: root }, effect: fn => effects.push(fn), connection: { fetch: { register: value => { route = value; return () => {}; } } }, tools: { register: value => { tool = value; return () => {}; } } }, { dataDir: root });
  effects[0](); effects[1](); // Deliberately never mount scheduler.
  const post = value => route.fetch(new Request('http://localhost/api/starharbor', { method: 'POST', headers: { 'X-StarHarbor': '1' }, body: JSON.stringify(value) }));
  return { route, tool, post };
}

test('QA Host refuses invalid actions, invalid IDs and oversized requests consistently', async t => {
  const x = host(await temp(t));
  for (const value of [null, [], { action: 'delete' }, { action: 'save', id: 0 }, { action: 'save', id: '1' }, { action: 'settings', settings: { typo: 1 } }]) {
    const response = await x.post(value); assert.equal(response.status, 400); await assert.rejects(x.tool.execute(value));
  }
  const response = await x.post({ action: 'status', padding: 'a'.repeat(9000) }); assert.equal(response.status, 413);
});

test('QA Host rejects explicitly non-object settings instead of silently accepting a no-op', async t => {
  const x = host(await temp(t));
  for (const settings of [false, null, 0, '']) {
    const response = await x.post({ action: 'settings', settings });
    assert.equal(response.status, 400, `settings=${JSON.stringify(settings)}`);
    assert.equal((await response.json()).code, 'invalid_settings');
    await assert.rejects(x.tool.execute({ action: 'settings', settings }), error => error.code === 'invalid_settings');
  }
});
