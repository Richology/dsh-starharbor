import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getEventListeners } from 'node:events';
import { createHarbor } from '../core.js';

const meta = (id, name, stars, description, language = 'JavaScript') => ({ id, full_name: `demo/${name}`, stargazers_count: stars, description, language, fork: false, archived: false, pushed_at: '2026-10-01T00:00:00Z' });
const daily = [meta(1, 'day-first', 6000, 'daily project'), meta(2, 'day-second', 8000, 'daily second'), meta(3, 'day-third', 9000, 'daily third')];
const weekly = [meta(4, 'week-first', 12000, 'weekly project'), meta(5, 'week-second', 15000, 'weekly second'), meta(6, 'week-third', 17000, 'weekly third')];
const classics = [
  meta(11, 'brain', 120000, 'AI machine learning'), meta(12, 'brain-next', 110000, 'AI llm'),
  meta(13, 'data', 90000, 'SQL database'), meta(14, 'web', 70000, 'react frontend'),
  meta(15, 'infra', 65000, 'docker deployment'), meta(16, 'learn', 60000, 'tutorial course'),
  meta(17, 'tools', 55000, 'terminal cli'), meta(18, 'rust', 40000, 'systems project', 'Rust')
];
const html = repos => repos.map(repo => `<article class="Box-row"><a href="/sponsors/example">sponsor</a><h2><a href="/${repo.full_name}">${repo.full_name}</a></h2></article>`).join('');
async function setup(t, options = {}) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'starharbor-test-'));
  t.after(() => fs.rm(dataDir, { recursive: true, force: true }));
  let time = new Date('2026-11-17T09:00:00+08:00');
  let failed = false;
  let starOffset = 0;
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (failed) return new Response('{}', { status: 429, headers: { 'retry-after': '120' } });
    if (url.includes('/trending?since=daily')) return new Response(html(daily));
    if (url.includes('/trending?since=weekly')) return new Response(html(weekly));
    if (url.includes('/search/repositories')) return Response.json({ items: classics.map(repo => ({ ...repo, stargazers_count: repo.stargazers_count + starOffset })) });
    if (url.endsWith('/readme')) return new Response('# Useful software\n![badge](https://badge.example)\n<div>Build useful things.</div>\n[Docs](https://example.com)');
    const name = url.split('/repos/')[1];
    const repo = [...daily, ...weekly, ...classics].find(item => item.full_name === name);
    if (!repo) return new Response('{}', { status: 404 });
    return Response.json({ ...repo, stargazers_count: repo.stargazers_count + starOffset });
  };
  const harbor = createHarbor({ dataDir, fetchImpl, now: () => time, ...options });
  return { harbor, dataDir, calls, fetchImpl, setTime: value => { time = new Date(value); }, fail: () => { failed = true; }, offset: value => { starOffset = value; } };
}

test('daily/weekly follow true trending order; classics sort by stars with distinct categories', async t => {
  const { harbor, calls } = await setup(t);
  const status = await harbor.refresh();
  assert.deepEqual(status.today.repos.map(repo => repo.id), [1, 4, 11, 13, 14]);
  assert.equal(new Set(status.today.repos.slice(2).map(repo => repo.category)).size, 3);
  assert.equal(status.today.leaders.daily.repo.id, 1);
  assert.equal(status.today.leaders.weekly.repo.id, 4);
  assert.equal(status.saved.length, 0);
  assert.equal(calls.filter(call => call.url.includes('/repos/')).length, 6);
  assert.match(calls.find(call => call.url.includes('/search/')).url, /fork:false\+archived:false/);
  for (const repo of status.today.repos) {
    assert.equal(repo.dailyGain, null);
    assert.equal(repo.weeklyGain, null);
    assert.equal(repo.dailyInterval, null);
    assert.match(repo.summary, /原文未翻译/);
  }
  assert.match(status.today.leaders.daily.label, /Trending 近1日/);
});

test('cooldown excludes recommendations but preserves true leaders; saved IDs remain excluded after cooldown', async t => {
  const { harbor, setTime } = await setup(t);
  await harbor.refresh();
  await harbor.save(11);
  setTime('2026-11-18T09:00:00+08:00');
  const next = await harbor.refresh();
  assert.deepEqual(next.today.repos.map(repo => repo.id), [2, 5, 12, 15, 16]);
  assert.equal(next.today.leaders.daily.repo.id, 1);
  assert.equal(next.today.leaders.weekly.repo.id, 4);
  setTime('2026-12-20T09:00:00+08:00');
  const later = await harbor.refresh();
  assert.equal(later.today.repos[0].id, 1);
  assert.ok(!later.today.repos.some(repo => repo.id === 11));
});

test('concurrent refresh joins; force never changes today or duplicates history', async t => {
  const { harbor, calls, offset } = await setup(t);
  const a = harbor.refresh();
  const b = harbor.refresh({ force: true });
  assert.equal(a, b);
  const initial = await a;
  const count = calls.length;
  await harbor.refresh();
  assert.equal(calls.length, count);
  offset(9000);
  const forced = await harbor.refresh({ force: true });
  assert.deepEqual(forced.today.repos, initial.today.repos);
  assert.equal(forced.history.length, 1);
  assert.equal(forced.today.generatedAt, initial.today.generatedAt);
});

test('snapshotOnly records all candidates without generating; complete Shanghai endpoints yield natural-day gains', async t => {
  const { harbor, setTime, offset, dataDir } = await setup(t);
  for (let day = 10; day <= 17; day++) {
    setTime(`2026-11-${day}T00:00:00+08:00`);
    offset((day - 10) * 100);
    const status = await harbor.refresh({ snapshotOnly: true });
    assert.equal(status.today, null);
    assert.equal(status.history.length, 0);
  }
  const raw = JSON.parse(await fs.readFile(path.join(dataDir, 'state.json'), 'utf8'));
  assert.equal(raw.snapshots.length, 8);
  assert.equal(Object.keys(raw.snapshots[0].stars).length, 14);
  setTime('2026-11-17T09:00:00+08:00');
  const result = await harbor.refresh();
  assert.equal(result.today.repos[0].dailyGain, 100);
  assert.equal(result.today.repos[0].weeklyGain, 700);
  // Equal net gains tie-break on stars; candidates outside Trending may win.
  assert.deepEqual(result.today.repos.slice(0, 2).map(repo => repo.id), [11, 12]);
  assert.equal(result.today.leaders.daily.repo.id, 11);
  assert.equal(result.today.leaders.weekly.repo.id, 11);
  assert.match(result.today.leaders.daily.label, /已观测候选/);
  assert.ok(result.today.repos[0].badges.some(value => value.includes('昨日净增榜首')));
  assert.ok(result.today.repos[0].badges.some(value => value.includes('近7日净增榜首')));
  assert.equal(new Set(result.today.repos.map(repo => repo.id)).size, 5);
  assert.deepEqual(result.today.repos[0].dailyInterval, {
    start: '2026-11-16T00:00:00+08:00', end: '2026-11-17T00:00:00+08:00', label: '完整自然日净增（上海）'
  });
  assert.equal(result.today.repos[0].weeklyInterval.start, '2026-11-10T00:00:00+08:00');
});

test('missing interior endpoint invalidates weekly growth; daytime samples never become midnight endpoints', async t => {
  const { harbor, setTime, offset, dataDir } = await setup(t);
  for (let day = 10; day <= 17; day++) {
    setTime(`2026-11-${day}T${day === 13 ? '09' : '00'}:00:00+08:00`);
    offset((day - 10) * 100);
    await harbor.refresh({ snapshotOnly: true });
  }
  const raw = JSON.parse(await fs.readFile(path.join(dataDir, 'state.json'), 'utf8'));
  assert.ok(!raw.snapshots.some(item => item.date === '2026-11-13'));
  setTime('2026-11-17T09:00:00+08:00');
  const result = await harbor.refresh();
  assert.equal(result.today.repos[0].dailyGain, 100);
  assert.equal(result.today.repos[0].weeklyGain, null);
});

test('collection is idempotent, categorized, retains notes and recovers MD-first persistence', async t => {
  const { harbor, dataDir } = await setup(t);
  await harbor.refresh();
  const target = path.join(dataDir, 'GitHub收藏.md');
  const notes = '# 我的收藏\n\n手写内容：不要覆盖。\n\n## 人工智能\n\n自己的分类笔记。\n';
  await fs.writeFile(target, notes);
  await Promise.all([harbor.save(11), harbor.save(11)]);
  let text = await fs.readFile(target, 'utf8');
  assert.match(text, /手写内容：不要覆盖。/);
  assert.match(text, /自己的分类笔记。/);
  assert.equal(text.split('<!-- starharbor:repo:11 -->').length - 1, 1);
  assert.equal(text.split('## 人工智能').length - 1, 1);
  // Simulate a process stopping after markdown rename but before saved-state rename.
  const stateFile = path.join(dataDir, 'state.json');
  const raw = JSON.parse(await fs.readFile(stateFile, 'utf8'));
  raw.saved = [];
  await fs.writeFile(stateFile, JSON.stringify(raw));
  const recovered = await harbor.save(11);
  assert.equal(recovered.saved.length, 1);
  assert.equal(await fs.readFile(target, 'utf8'), text);
  await assert.rejects(harbor.save(999999), /已有推荐/);
  await assert.rejects(harbor.save('https://github.com/evil/repo'), /正整数/);
  assert.equal((await harbor.status()).saved.length, 1);
});

test('429 sources preserve prior board and expose retry time; no failure history entry is created', async t => {
  const { harbor, setTime, fail } = await setup(t);
  const initial = await harbor.refresh();
  fail();
  setTime('2026-11-18T09:00:00+08:00');
  const broken = await harbor.refresh();
  assert.deepEqual(broken.today.repos, initial.today.repos);
  assert.equal(broken.today.date, initial.today.date);
  assert.equal(broken.history.length, 1);
  assert.match(broken.lastError.message, /429/);
  assert.equal(broken.lastError.retryAt, '2026-11-18T01:02:00.000Z');
  assert.ok(broken.today.warnings.some(text => text.includes('保留此前推荐')));
});

test('shortage is explicit, settings validate ranges, and status is detached from persistence', async t => {
  const { harbor } = await setup(t);
  await assert.rejects(harbor.settings({ hour: 24 }), /hour/);
  await assert.rejects(harbor.settings({ cooldownDays: -1 }), /cooldownDays/);
  await assert.rejects(harbor.settings({ classicMin: 90000, preferredMin: 50000 }), /preferredMin/);
  await assert.rejects(harbor.settings({ token: 'do-not-store' }), /未知设置/);
  await harbor.settings({ dailyMin: 1000000, weeklyMin: 1000000, classicMin: 1000000, preferredMin: 1000000 });
  const result = await harbor.refresh();
  assert.equal(result.today.repos.length, 0);
  assert.ok(result.today.warnings.some(text => text.includes('0/5')));
  result.settings.hour = 22;
  assert.equal((await harbor.status()).settings.hour, 9);
});

test('metadata budget is capped at 20 and search metadata is reused', async t => {
  const candidates = Array.from({ length: 35 }, (_, index) => meta(100 + index, `candidate-${index}`, 7000, 'real project'));
  let requests = 0;
  const { harbor } = await setup(t, { fetchImpl: async url => {
    if (url.includes('/trending')) return new Response(html([classics[0], ...candidates]));
    if (url.includes('/search/')) return Response.json({ items: classics });
    requests++;
    const repo = candidates.find(item => url.endsWith(item.full_name));
    return Response.json(repo);
  } });
  const result = await harbor.refresh();
  assert.equal(requests, 20);
  assert.equal(result.today.leaders.daily.repo.id, 11);
  assert.ok(result.today.warnings.some(value => value.includes('最多额外查询20')));
});

test('classic categories fall back to real same-category candidates when diversity is unavailable', async t => {
  const sameCategory = [meta(21, 'a', 80000, 'AI'), meta(22, 'b', 70000, 'AI'), meta(23, 'c', 60000, 'AI')];
  const { harbor } = await setup(t, { fetchImpl: async url => {
    if (url.includes('/trending?since=daily')) return new Response(html(daily));
    if (url.includes('/trending?since=weekly')) return new Response(html(weekly));
    if (url.includes('/search/')) return Response.json({ items: sameCategory });
    return Response.json([...daily, ...weekly].find(repo => url.endsWith(repo.full_name)));
  } });
  const result = await harbor.refresh();
  assert.deepEqual(result.today.repos.map(repo => repo.id), [1, 4, 21, 22, 23]);
});

test('a normal refresh queued during snapshotOnly still generates the daily board', async t => {
  const { harbor } = await setup(t);
  const snapshot = harbor.refresh({ snapshotOnly: true });
  const normal = harbor.refresh();
  assert.equal((await snapshot).today, null);
  assert.equal((await normal).today.repos.length, 5);
  assert.equal((await harbor.status()).history.length, 1);
});

test('first-run source failures do not freeze empty history and can recover on the same day', async t => {
  let broken = true;
  const fixture = await setup(t);
  const harbor = createHarbor({ dataDir: fixture.dataDir, now: () => new Date('2026-11-17T09:00:00+08:00'), fetchImpl: async (url, init) => broken
    ? new Response('{}', { status: 403 }) : fixture.fetchImpl(url, init) });
  const failed = await harbor.refresh();
  assert.equal(failed.history.length, 0);
  assert.ok(failed.lastError);
  assert.equal(failed.today.repos.length, 0);
  broken = false;
  const recovered = await harbor.refresh();
  assert.equal(recovered.history.length, 1);
  assert.equal(recovered.today.repos.length, 5);
  assert.equal(recovered.lastError, null);
});

test('optional enrich receives README excerpt and can change summary; failures retain honest original', async t => {
  const seen = [];
  const { harbor } = await setup(t, { enrich: async repo => {
    seen.push(repo);
    if (repo.id === 4) throw new Error('translation unavailable');
    return { summary: '用于构建实用工具的开源项目。', summarySource: 'translated' };
  } });
  const result = await harbor.refresh();
  assert.equal(seen.length, 5);
  assert.match(seen[0].readmeExcerpt, /Build useful things/);
  assert.ok(!seen[0].readmeExcerpt.includes('badge'));
  assert.equal(result.today.repos[0].summarySource, 'translated');
  assert.equal(result.today.repos[0].summaryZh, '用于构建实用工具的开源项目。');
  assert.equal(result.today.repos[1].summarySource, 'original');
  assert.match(result.today.repos[1].summary, /原文未翻译/);
});

test('summaryZh is accepted independently and enrichment cannot change purpose categories', async t => {
  const { harbor } = await setup(t, { enrich: async () => ({ summary: ' ', summaryZh: '  真实描述的中文翻译。  ', category: '任意名称', categoryId: 'resources' }) });
  const result = await harbor.refresh();
  const ai = result.today.repos.find(repo => repo.id === 11);
  assert.equal(ai.categoryId, 'ai');
  assert.equal(ai.category, '人工智能');
  assert.equal(ai.language, 'JavaScript');
  assert.equal(ai.summaryZh, '真实描述的中文翻译。');
  assert.equal(ai.summarySource, 'original');
  assert.match(ai.summary, /原文未翻译/);
  assert.equal(ai.sourceCode, 'classic');
  assert.equal(ai.reasonCode, 'classic');
});

test('legacy projection is read-only and preserves existing Markdown, categories and same-day board', async t => {
  const { harbor, dataDir, calls } = await setup(t);
  const initial = await harbor.refresh();
  const stateFile = path.join(dataDir, 'state.json');
  const raw = JSON.parse(await fs.readFile(stateFile, 'utf8'));
  const legacy = { ...raw.today.repos[0], category: '用户原分类' };
  for (const key of ['categoryId', 'language', 'sourceCode', 'reasonCode', 'summaryZh']) delete legacy[key];
  raw.today.repos[0] = legacy;
  raw.history[0] = structuredClone(raw.today);
  delete raw.today.warningDetails;
  delete raw.history[0].warningDetails;
  for (const board of [raw.today, raw.history[0]]) for (const leader of Object.values(board.leaders)) delete leader.labelCode;
  raw.saved = [{ ...legacy, savedAt: initial.today.generatedAt }];
  const before = JSON.stringify(raw);
  await fs.writeFile(stateFile, before);
  const markdown = '# 手写收藏\n\n## 用户原分类\n\n这段不应修改。\n';
  await fs.writeFile(path.join(dataDir, 'GitHub收藏.md'), markdown);
  const count = calls.length;
  const projected = await harbor.refresh();
  assert.equal(calls.length, count);
  assert.equal(projected.today.generatedAt, initial.today.generatedAt);
  assert.equal(projected.today.repos[0].category, '用户原分类');
  assert.equal(projected.saved[0].category, '用户原分类');
  assert.equal(projected.today.repos[0].categoryId, 'general');
  assert.equal(projected.today.repos[0].sourceCode, 'trending_daily');
  assert.equal(projected.today.warningDetails[0].code, 'growth_unavailable');
  assert.equal(await fs.readFile(stateFile, 'utf8'), before);
  assert.equal(await fs.readFile(path.join(dataDir, 'GitHub收藏.md'), 'utf8'), markdown);
});

test('classic search uses the configured threshold and settings reject inherited property names', async t => {
  const { harbor, calls } = await setup(t);
  await assert.rejects(harbor.settings({ constructor: 1 }), /未知设置/);
  await harbor.settings({ classicMin: 15000 });
  await harbor.refresh();
  assert.match(calls.find(call => call.url.includes('/search/')).url, /stars:%3E%3D15000\+/);
});

test('a batch ending outside the midnight window retains earlier valid per-repository observations', async t => {
  const fixture = await setup(t);
  let time = new Date('2026-11-17T23:59:00+08:00');
  const harbor = createHarbor({ dataDir: fixture.dataDir, now: () => time, fetchImpl: async url => {
    if (url.includes('/trending')) return new Response(html([classics[0], daily[0]]));
    if (url.includes('/search/')) return Response.json({ items: [classics[0]] });
    time = new Date('2026-11-18T00:06:00+08:00');
    return Response.json(daily[0]);
  } });
  await harbor.refresh({ snapshotOnly: true });
  const raw = JSON.parse(await fs.readFile(path.join(fixture.dataDir, 'state.json'), 'utf8'));
  assert.equal(raw.snapshots.length, 1);
  assert.equal(raw.snapshots[0].date, '2026-11-18');
  assert.equal(raw.snapshots[0].stars[11], classics[0].stargazers_count);
  assert.equal(raw.snapshots[0].observedAtByRepo[11], '2026-11-17T15:59:00.000Z');
  assert.equal(raw.snapshots[0].stars[1], undefined);
});

test('midnight sampling accepts exactly plus/minus five minutes and rejects the adjacent millisecond', async t => {
  const boundary = Date.parse('2026-11-18T00:00:00+08:00');
  for (const delta of [-300001, -300000, 300000, 300001]) {
    const fixture = await setup(t);
    const harbor = createHarbor({ dataDir: fixture.dataDir, now: () => new Date(boundary + delta), fetchImpl: fixture.fetchImpl });
    await harbor.refresh({ snapshotOnly: true });
    const raw = JSON.parse(await fs.readFile(path.join(fixture.dataDir, 'state.json'), 'utf8'));
    assert.equal(raw.snapshots.length, Math.abs(delta) <= 300000 ? 1 : 0, String(delta));
    if (raw.snapshots.length) assert.equal(raw.snapshots[0].date, '2026-11-18');
  }
});

test('closer partial snapshots merge by repository and keep other repositories and legacy endpoints', async t => {
  const fixture = await setup(t);
  let time = new Date('2026-11-17T00:03:00+08:00');
  let partial = false;
  const stateFile = path.join(fixture.dataDir, 'state.json');
  await fs.writeFile(stateFile, JSON.stringify({ snapshots: [{ date: '2026-11-16', observedAt: '2026-11-15T16:00:00.000Z', stars: { 11: 119000 } }] }));
  const harbor = createHarbor({ dataDir: fixture.dataDir, now: () => time, fetchImpl: async (url, init) => {
    if (!partial) return fixture.fetchImpl(url, init);
    if (url.includes('/trending')) return new Response(html([classics[0]]));
    return Response.json({ items: [{ ...classics[0], stargazers_count: 120123 }] });
  } });
  await harbor.refresh({ snapshotOnly: true });
  partial = true;
  time = new Date('2026-11-17T00:01:00+08:00');
  await harbor.refresh({ snapshotOnly: true });
  let raw = JSON.parse(await fs.readFile(stateFile, 'utf8'));
  const snapshot = raw.snapshots.find(item => item.date === '2026-11-17');
  assert.equal(snapshot.stars[11], 120123);
  assert.equal(snapshot.stars[13], classics[2].stargazers_count);
  assert.equal(snapshot.observedAtByRepo[11], '2026-11-16T16:01:00.000Z');
  assert.equal(snapshot.observedAtByRepo[13], '2026-11-16T16:03:00.000Z');
  // A farther observation must not overwrite the closer count.
  time = new Date('2026-11-17T00:04:00+08:00');
  partial = false;
  await harbor.refresh({ snapshotOnly: true });
  raw = JSON.parse(await fs.readFile(stateFile, 'utf8'));
  assert.equal(raw.snapshots.find(item => item.date === '2026-11-17').stars[11], 120123);
  time = new Date('2026-11-17T09:00:00+08:00');
  const status = await harbor.refresh();
  assert.equal(status.today.leaders.daily.repo.id, 11);
  assert.equal(status.today.leaders.daily.repo.dailyGain, 1123);
  assert.equal(status.today.leaders.daily.labelCode, 'daily_gain');
});

test('HTTP failures have stable structured details without losing legacy messages', async t => {
  const { harbor, fail } = await setup(t);
  fail();
  const result = await harbor.refresh();
  assert.equal(result.lastError.code, 'collection_failed');
  assert.equal(result.lastError.httpStatus, 429);
  assert.equal(result.lastError.details[0].code, 'source_failed');
  assert.equal(result.lastError.details[0].params.source, 'trending_daily');
  assert.equal(result.lastError.details[0].params.httpStatus, 429);
  assert.ok(result.today.warningDetails.some(item => item.code === 'source_failed'));
  assert.ok(result.today.warningDetails.some(item => item.code === 'recommendation_shortage'));
  assert.match(result.lastError.message, /429/);
});

test('refresh has a total deadline even when fetch ignores cancellation', async t => {
  let calls = 0;
  const { harbor } = await setup(t, { refreshTimeoutMs: 40, fetchImpl: () => { calls++; return new Promise(() => {}); } });
  const started = Date.now();
  const result = await harbor.refresh();
  assert.ok(Date.now() - started < 2000);
  assert.equal(calls, 3);
  assert.equal(result.lastError.code, 'refresh_timeout');
  assert.equal(result.history.length, 0);
  assert.ok(result.lastError.details.some(item => item.code === 'refresh_timeout'));
});

test('hanging enrichment is bounded and late results cannot mutate persisted recommendations', async t => {
  let finish;
  let count = 0;
  const { harbor, dataDir, calls } = await setup(t, { refreshTimeoutMs: 100, enrich: () => { count++; return new Promise(resolve => { finish = resolve; }); } });
  const result = await harbor.refresh();
  assert.equal(count, 1);
  assert.equal(result.lastError.code, 'refresh_timeout');
  assert.equal(result.history.length, 0);
  const before = await fs.readFile(path.join(dataDir, 'state.json'), 'utf8');
  const requestCount = calls.length;
  finish({ summary: 'late changed text', summaryZh: '迟到的翻译' });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(calls.length, requestCount);
  assert.equal(await fs.readFile(path.join(dataDir, 'state.json'), 'utf8'), before);
  assert.match((await harbor.status()).today.repos[0].summary, /原文未翻译/);
});

test('disposal cancels ignored fetches and queued refreshes without overwriting existing state', async t => {
  const fixture = await setup(t);
  await fixture.harbor.refresh();
  const stateFile = path.join(fixture.dataDir, 'state.json');
  const before = await fs.readFile(stateFile, 'utf8');
  const controller = new AbortController();
  let begin;
  const started = new Promise(resolve => { begin = resolve; });
  let calls = 0;
  const harbor = createHarbor({ dataDir: fixture.dataDir, signal: controller.signal, now: () => new Date('2026-11-18T00:00:00+08:00'), fetchImpl: () => { calls++; begin(); return new Promise(() => {}); } });
  const snapshot = harbor.refresh({ snapshotOnly: true });
  const queued = harbor.refresh();
  const outcomes = Promise.allSettled([snapshot, queued]);
  await started;
  controller.abort(new Error('plugin disposed'));
  const settled = await outcomes;
  assert.ok(settled.every(item => item.status === 'rejected' && /plugin disposed/.test(item.reason.message)));
  assert.equal(calls, 3);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  assert.equal(await fs.readFile(stateFile, 'utf8'), before);
  await assert.rejects(harbor.refresh(), /plugin disposed/);
  assert.equal(calls, 3);
});

test('disposal cancels hanging enrichment and ignores its later result', async t => {
  const controller = new AbortController();
  let begin;
  let finish;
  const started = new Promise(resolve => { begin = resolve; });
  const { harbor, dataDir } = await setup(t, { signal: controller.signal, enrich: () => { begin(); return new Promise(resolve => { finish = resolve; }); } });
  const pending = harbor.refresh();
  const rejected = assert.rejects(pending, /plugin disposed/);
  await started;
  controller.abort(new Error('plugin disposed'));
  await rejected;
  finish({ summaryZh: '迟到结果不应写入' });
  await Promise.resolve();
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  await assert.rejects(fs.readFile(path.join(dataDir, 'state.json'), 'utf8'), { code: 'ENOENT' });
});
