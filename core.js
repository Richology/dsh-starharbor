import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { categoryLabel, classifyCategory, projectBoard, projectRepo, sourceCode, warningDetail } from './domain.js';
import { validateFeed, selectFeedBoard } from './feed.js';

const DEFAULTS = Object.freeze({ dailyMin: 5000, weeklyMin: 10000, classicMin: 30000, preferredMin: 50000, cooldownDays: 30, hour: 9, recommendationCount: 5 });
const locks = new Map();
const refreshes = new Map();
const DAY = 86400000;
const clone = value => structuredClone(value);
const dateKey = value => new Date(new Date(value).getTime() + 8 * 3600000).toISOString().slice(0, 10);
const shiftDate = (date, days) => dateKey(Date.parse(`${date}T00:00:00+08:00`) + days * DAY);
const midnight = date => Date.parse(`${date}T00:00:00+08:00`);
const validCount = value => Number.isSafeInteger(value) && value >= 1 && value <= 10;
// Keep the pending transition until a later edit so stale feed dates can resolve it too.
function countAt(state, date) {
  const schedule = state.countSchedule;
  let count = (state.countHistory || []).length ? DEFAULTS.recommendationCount
    : validCount(schedule?.activeCount) ? schedule.activeCount : DEFAULTS.recommendationCount;
  for (const transition of state.countHistory || []) {
    if (transition.effectiveDate <= date && validCount(transition.count)) count = transition.count;
  }
  if (validCount(schedule?.pendingCount) && schedule.effectiveDate <= date) count = schedule.pendingCount;
  return count;
}
function countScheduleView(state, date) {
  const schedule = state.countSchedule;
  const pending = validCount(schedule?.pendingCount) && typeof schedule.effectiveDate === 'string' && schedule.effectiveDate > date;
  return { activeCount: countAt(state, date), pendingCount: pending ? schedule.pendingCount : null, effectiveDate: pending ? schedule.effectiveDate : null };
}
function exclusive(key, work) {
  const previous = locks.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(work);
  locks.set(key, next);
  next.finally(() => { if (locks.get(key) === next) locks.delete(key); }).catch(() => {});
  return next;
}
async function atomic(file, content, signal) {
  signal?.throwIfAborted();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  try { signal?.throwIfAborted(); await fs.writeFile(temp, content, 'utf8'); signal?.throwIfAborted(); await fs.rename(temp, file); }
  finally { await fs.unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}
function trendingNames(html) {
  const names = [];
  for (const article of html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)) {
    const heading = article[1].match(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/i)?.[1] || article[1];
    const links = [...heading.matchAll(/href\s*=\s*["']\/(\w[\w.-]*\/[\w.-]+)\/?["']/gi)];
    const name = links.map(match => match[1]).find(value => !/^(sponsors|topics|collections|marketplace)\//i.test(value));
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}
function validSettings(patch, current) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('settings patch 必须是对象');
  const result = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (!Object.hasOwn(DEFAULTS, key)) throw new TypeError(`未知设置：${key}`);
    const [min, max] = key === 'hour' ? [0, 23] : key === 'cooldownDays' ? [0, 3650] : key === 'recommendationCount' ? [1, 10] : [0, 1000000000];
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new RangeError(`${key} 必须为 ${min}–${max} 的整数`);
    result[key] = value;
  }
  if (result.preferredMin < result.classicMin) throw new RangeError('preferredMin 不得小于 classicMin');
  return result;
}
const escapeMD = text => String(text ?? '').replace(/[\r\n]+/g, ' ').replace(/[\\`*_[\]<>]/g, '\\$&');

/** Local-only storage, optional public feed sync, and no automatic scheduler. */
export function createHarbor({ dataDir, fetchImpl = fetch, now = () => new Date(), enrich, refreshTimeoutMs = 120000, feedUrl, feedTimeoutMs = 20000, signal } = {}) {
  if (typeof dataDir !== 'string' || !dataDir) throw new TypeError('dataDir 必填');
  const root = path.resolve(dataDir);
  const statePath = path.join(root, 'state.json');
  const collectionPath = path.join(root, 'GitHub收藏.md');
  if (!Number.isSafeInteger(refreshTimeoutMs) || refreshTimeoutMs < 1) throw new RangeError('refreshTimeoutMs must be a positive integer');
  const cloud = feedUrl !== undefined;
  if (cloud) {
    if (typeof feedUrl !== 'string' || !feedUrl) throw new TypeError('feedUrl must be an HTTP(S) URL without credentials');
    const url = new URL(feedUrl);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new TypeError('feedUrl must be an HTTP(S) URL without credentials');
    if (!Number.isSafeInteger(feedTimeoutMs) || feedTimeoutMs < 1 || feedTimeoutMs > 20000) throw new RangeError('feedTimeoutMs must be an integer from 1 to 20000');
  }
  const clock = () => new Date(now());
  let deadline = Infinity;
  let budgetExpired = false;
  const timeoutError = () => { budgetExpired = true; return Object.assign(new Error('采集总耗时预算已用尽'), { code: 'refresh_timeout' }); };
  function remaining() {
    signal?.throwIfAborted();
    const value = deadline - Date.now();
    if (budgetExpired || value <= 0) throw timeoutError();
    return value;
  }
  async function bounded(work) {
    const budget = remaining();
    let timer;
    let cancel;
    try {
      return await Promise.race([Promise.resolve().then(() => { remaining(); return work(); }), new Promise((_, reject) => {
        cancel = () => reject(signal.reason);
        signal?.addEventListener('abort', cancel, { once: true });
        timer = setTimeout(() => reject(timeoutError()), budget);
      })]);
    } finally { clearTimeout(timer); if (cancel) signal?.removeEventListener('abort', cancel); }
  }
  async function load() {
    try {
      const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
      return { history: [], saved: [], snapshots: [], today: null, lastError: null, ...state, settings: { ...DEFAULTS, ...state.settings },
        today: projectBoard(state.today), history: (state.history || []).map(projectBoard), saved: (state.saved || []).map(projectRepo),
        lastError: state.lastError ? { ...state.lastError, code: state.lastError.code || 'collection_failed', details: state.lastError.details || [{ code: 'legacy', params: { message: state.lastError.message } }] } : null };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return { settings: { ...DEFAULTS }, history: [], saved: [], snapshots: [], today: null, lastError: null };
    }
  }
  const persist = state => atomic(statePath, JSON.stringify(state, null, 2) + '\n', signal);
  function cachedFeed(state) {
    if (!cloud || state.feed?.url !== feedUrl || !state.feedCache) return null;
    try { return validateFeed(state.feedCache, { now: clock() }); } catch { return null; }
  }
  const feedFresh = feed => feed && feed.date === dateKey(clock()) && clock().getTime() - Date.parse(feed.generatedAt) <= 36 * 3600000;
  function feedView(state) {
    const feed = cachedFeed(state);
    const metadata = state.feed?.url === feedUrl ? state.feed : {};
    const checked = Date.parse(metadata.lastCheckedAt);
    return {
      url: feedUrl, lastCheckedAt: metadata.lastCheckedAt || null, lastSuccessAt: metadata.lastSuccessAt || null,
      generatedAt: feed?.generatedAt || null, date: feed?.date || null,
      status: feed ? feedFresh(feed) ? 'fresh' : 'stale' : 'unavailable', candidateCount: feed?.repos.length || 0,
      nextSyncAt: Number.isFinite(checked) ? new Date(checked + 3600000).toISOString() : null,
      error: metadata.error || null
    };
  }
  const view = state => clone({ settings: state.settings, countSchedule: countScheduleView(state, dateKey(clock())), today: state.today, history: state.history, saved: state.saved, collectionPath, lastError: state.lastError,
    ...(cloud ? { feed: feedView(state) } : {}) });
  async function requestFeed() {
    const timeLeft = remaining();
    const budget = Math.min(feedTimeoutMs, timeLeft);
    const controller = new AbortController();
    let timer;
    let cancel;
    let stop;
    const stopped = new Promise((_, reject) => { stop = reject; });
    cancel = () => { controller.abort(signal.reason); stop(signal.reason); };
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      remaining();
      timer = setTimeout(() => {
        const error = timeLeft <= feedTimeoutMs ? timeoutError() : Object.assign(new Error('Cloud feed request timed out'), { code: 'feed_timeout' });
        controller.abort(error);
        stop(error);
      }, budget);
      const response = await Promise.race([
        Promise.resolve().then(() => fetchImpl(feedUrl, { signal: controller.signal, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', headers: { Accept: 'application/json' } })),
        stopped
      ]);
      if (!response.ok) throw Object.assign(new Error(`Cloud feed HTTP ${response.status}`), { code: 'feed_http', httpStatus: response.status });
      let value;
      try { value = await Promise.race([response.json(), stopped]); }
      catch (error) {
        if (controller.signal.aborted || signal?.aborted) throw error;
        throw Object.assign(new Error(`Invalid cloud feed JSON: ${error.message}`), { code: 'feed_invalid' });
      }
      try { return validateFeed(value, { now: clock() }); }
      catch (error) { throw Object.assign(new Error(`Invalid cloud feed: ${error.message}`), { code: 'feed_invalid' }); }
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
  }
  async function syncCloud(state, { force, snapshotOnly }) {
    let feed = cachedFeed(state);
    const previous = state.feed?.url === feedUrl ? state.feed : {};
    const checked = Date.parse(previous.lastCheckedAt);
    const elapsed = clock().getTime() - checked;
    const needsFetch = force || !Number.isFinite(checked) || elapsed < 0 || elapsed >= 3600000;
    if (needsFetch) {
      const at = clock().toISOString();
      state.feed = { url: feedUrl, lastCheckedAt: at, lastSuccessAt: previous.lastSuccessAt || null, error: null };
      try {
        feed = await requestFeed();
        signal?.throwIfAborted();
        state.feedCache = feed;
        state.feed.lastSuccessAt = clock().toISOString();
        state.lastError = null;
      } catch (error) {
        signal?.throwIfAborted();
        const code = error.code === 'refresh_timeout' ? 'refresh_timeout' : ['feed_timeout', 'feed_http', 'feed_invalid'].includes(error.code) ? error.code : 'feed_fetch_failed';
        state.lastError = { code, message: error.message || String(error), at: clock().toISOString(), httpStatus: error.httpStatus || null, retryAt: null,
          details: [{ code, params: { message: error.message || String(error), ...(error.httpStatus ? { httpStatus: error.httpStatus } : {}) } }] };
        state.feed.error = clone(state.lastError);
      }
    }
    // A cached feed can become due for selection before the next hourly fetch.
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', hourCycle: 'h23' }).format(clock()));
    if (feed && feed.date <= dateKey(clock()) && !snapshotOnly && (force || hour >= state.settings.hour)) {
      const sameDay = state.history.find(board => board.date === feed.date);
      if (sameDay && (!state.today || state.today.date <= feed.date)) state.today = clone(sameDay);
      else if (!sameDay && (feedFresh(feed) || !state.today)) {
        const board = selectFeedBoard(feed, { settings: { ...state.settings, recommendationCount: countAt(state, feed.date) }, history: state.history, saved: state.saved, now: clock() });
        if (!feedFresh(feed)) {
          board.warnings ||= [];
          board.warningDetails ||= [];
          appendWarnings(board, ['Cloud feed is stale; displaying recommendations for the feed date.'], [{ code: 'feed_stale', params: { date: feed.date, generatedAt: feed.generatedAt } }]);
        }
        state.today = board;
        state.history.push(clone(board));
      }
    }
    signal?.throwIfAborted();
    await persist(state);
    return view(state);
  }
  function appendWarnings(board, messages, details = []) {
    for (let i = 0; i < messages.length; i++) {
      if (board.warnings.includes(messages[i])) continue;
      board.warnings.push(messages[i]);
      board.warningDetails.push(details[i] || warningDetail(messages[i]));
    }
  }
  async function request(url, json = false, raw = false) {
    const timeLeft = remaining();
    const budget = Math.min(15000, timeLeft);
    const controller = new AbortController();
    const requestTimeout = () => timeLeft <= 15000 ? timeoutError() : Object.assign(new Error('请求超时（15秒）'), { code: 'request_timeout' });
    let timer;
    let cancel;
    let stop;
    const stopped = new Promise((_, reject) => { stop = reject; });
    cancel = () => { controller.abort(signal.reason); stop(signal.reason); };
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      timer = setTimeout(() => { const error = requestTimeout(); controller.abort(error); stop(error); }, budget);
      const response = await Promise.race([
        fetchImpl(url, { signal: controller.signal, headers: {
          Accept: raw ? 'application/vnd.github.raw+json' : json ? 'application/vnd.github+json' : 'text/html',
          'User-Agent': 'StarHarbor',
          ...(url.startsWith('https://api.github.com/') && process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
        } }),
        stopped
      ]);
      if (!response.ok) {
        const remaining = response.headers?.get('retry-after');
        const reset = response.headers?.get('x-ratelimit-reset');
        const retry = remaining ? (/^\d+$/.test(remaining) ? new Date(clock().getTime() + Number(remaining) * 1000).toISOString() : remaining)
          : reset && /^\d+$/.test(reset) ? new Date(Number(reset) * 1000).toISOString() : null;
        const error = new Error(`GitHub HTTP ${response.status}${[403, 429].includes(response.status) ? '：访问受限或触发限流' : ''}；${retry ? `重试时间 ${retry}` : '未提供重试时间，请稍后重试'}`);
        error.retryAt = retry;
        error.httpStatus = response.status;
        error.code = 'github_http';
        throw error;
      }
      // Keep body decoding inside the timeout, including injected fetch implementations.
      return await Promise.race([json ? response.json() : response.text(), stopped]);
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
  }
  function gains(state, repoId, date, days) {
    const ends = [];
    for (let i = 0; i <= days; i++) {
      const key = shiftDate(date, -i);
      const snap = state.snapshots.find(item => item.date === key && Math.abs(Date.parse(item.observedAtByRepo?.[repoId] || item.observedAt) - midnight(key)) <= 300000);
      if (!snap || !Number.isFinite(snap.stars[repoId])) return null;
      ends.push(snap.stars[repoId]);
    }
    return ends[0] - ends[days];
  }
  function normalize(meta, state, at) {
    const date = dateKey(at);
    const dailyGain = gains(state, meta.id, date, 1);
    const weeklyGain = gains(state, meta.id, date, 7);
    return {
      id: meta.id, name: meta.full_name, url: `https://github.com/${meta.full_name}`,
      description: meta.description || '', summary: meta.description ? /[\u4e00-\u9fff]/.test(meta.description) ? meta.description : `${meta.description}（原文未翻译）` : '仓库未提供描述。',
      summarySource: 'original', summaryZh: /[\u4e00-\u9fff]/.test(meta.description || '') ? meta.description : '', readmeExcerpt: '',
      category: categoryLabel(classifyCategory(meta)), categoryId: classifyCategory(meta), language: meta.language || null, stars: meta.stargazers_count, dailyGain, weeklyGain,
      dailyInterval: dailyGain === null ? null : { start: `${shiftDate(date, -1)}T00:00:00+08:00`, end: `${date}T00:00:00+08:00`, label: '完整自然日净增（上海）' },
      weeklyInterval: weeklyGain === null ? null : { start: `${shiftDate(date, -7)}T00:00:00+08:00`, end: `${date}T00:00:00+08:00`, label: '完整7个自然日净增（上海）' },
      reason: '', source: '', reasonCode: null, sourceCode: null, observedAt: at, pushedAt: meta.pushed_at || null, badges: []
    };
  }
  async function collect(state) {
    const observationTimes = new Map();
    const warnings = [];
    const failures = [];
    const capture = async (label, work, fallback, source) => {
      try { return await work(); } catch (error) {
        signal?.throwIfAborted();
        const message = `${label}失败：${error.message}`;
        const params = { source, message: error.message, ...(error.httpStatus ? { httpStatus: error.httpStatus } : {}), ...(error.retryAt ? { retryAt: error.retryAt } : {}) };
        const detail = { code: error.code === 'refresh_timeout' ? 'refresh_timeout' : 'source_failed', params };
        warnings.push(message);
        failures.push({ message, retryAt: error.retryAt || null, httpStatus: error.httpStatus, code: error.code || 'source_failed', detail });
        return fallback;
      }
    };
    const [daily, weekly, search] = await Promise.all([
      capture('Trending 近1日', async () => { const names = trendingNames(await request('https://github.com/trending?since=daily')); if (!names.length) throw new Error('未解析到仓库，页面结构可能变化'); return names; }, [], 'trending_daily'),
      capture('Trending 近7日', async () => { const names = trendingNames(await request('https://github.com/trending?since=weekly')); if (!names.length) throw new Error('未解析到仓库，页面结构可能变化'); return names; }, [], 'trending_weekly'),
      capture('GitHub 经典搜索', async () => {
        const body = await request(`https://api.github.com/search/repositories?q=stars:%3E%3D${state.settings.classicMin}+fork:false+archived:false&sort=stars&order=desc&per_page=100`, true);
        if (!Array.isArray(body.items)) throw new Error('搜索响应缺少 items');
        if (body.incomplete_results) warnings.push('GitHub 搜索结果不完整，仅依据已返回的真实仓库推荐。');
        const observed = clock().toISOString();
        for (const meta of body.items) observationTimes.set(meta.id, observed);
        return body.items;
      }, [], 'classic')
    ]);
    const metadata = new Map(search.filter(meta => Number.isSafeInteger(meta.id) && meta.full_name).map(meta => [meta.full_name.toLowerCase(), meta]));
    // Interleave both lists so weekly leaders are not starved by daily candidates.
    const candidates = [];
    for (let i = 0; i < Math.max(daily.length, weekly.length); i++) {
      for (const name of [daily[i], weekly[i]]) if (name && !metadata.has(name.toLowerCase()) && !candidates.includes(name)) candidates.push(name);
    }
    const lookups = candidates.slice(0, 20);
    for (const name of lookups) {
      if (budgetExpired || deadline <= Date.now()) break;
      const meta = await capture(`仓库 ${name}`, () => request(`https://api.github.com/repos/${name}`, true), null, 'repository');
      if (meta && Number.isSafeInteger(meta.id) && meta.full_name) {
        metadata.set(meta.full_name.toLowerCase(), meta);
        observationTimes.set(meta.id, clock().toISOString());
      }
      if (!meta && [403, 429].includes(failures.at(-1)?.httpStatus)) break;
    }
    if (candidates.length > 20) warnings.push('为减少限流，本次最多额外查询20个 Trending 仓库；其余候选未核实。');
    const at = clock().toISOString();
    const today = dateKey(at);
    const target = countAt(state, today);
    // An endpoint belongs to each repository's actual observation, not the end of a potentially slow batch.
    for (const meta of metadata.values()) {
      const observedAt = observationTimes.get(meta.id);
      const observedDay = dateKey(observedAt);
      const adjacent = [observedDay, shiftDate(observedDay, 1)].find(date => Math.abs(Date.parse(observedAt) - midnight(date)) <= 300000);
      if (!adjacent || !Number.isFinite(meta.stargazers_count)) continue;
      let snap = state.snapshots.find(item => item.date === adjacent);
      if (!snap) {
        snap = { date: adjacent, observedAt, stars: {}, observedAtByRepo: {} };
        state.snapshots.push(snap);
      }
      snap.observedAtByRepo ||= {};
      const priorAt = snap.observedAtByRepo[meta.id] || snap.observedAt;
      if (!Number.isFinite(snap.stars[meta.id]) || Math.abs(Date.parse(observedAt) - midnight(adjacent)) < Math.abs(Date.parse(priorAt) - midnight(adjacent))) {
        snap.stars[meta.id] = meta.stargazers_count;
        snap.observedAtByRepo[meta.id] = observedAt;
      }
    }
    const repos = new Map([...metadata].filter(([, meta]) => !meta.fork && !meta.archived && Number.isFinite(meta.stargazers_count)).map(([name, meta]) => [name, normalize(meta, state, at)]));
    const dailyRepos = daily.map(name => repos.get(name.toLowerCase())).filter(Boolean);
    const weeklyRepos = weekly.map(name => repos.get(name.toLowerCase())).filter(Boolean);
    const rankedDaily = [...repos.values()].filter(repo => repo.dailyGain !== null).sort((a, b) => b.dailyGain - a.dailyGain || b.stars - a.stars || a.id - b.id);
    const rankedWeekly = [...repos.values()].filter(repo => repo.weeklyGain !== null).sort((a, b) => b.weeklyGain - a.weeklyGain || b.stars - a.stars || a.id - b.id);
    const dailyLabel = rankedDaily.length ? '昨日净增榜首（已观测候选，上海完整自然日）' : 'Trending 近1日榜首（非昨日净增冠军）';
    const weeklyLabel = rankedWeekly.length ? '近7日净增榜首（已观测候选，上海完整自然日）' : 'Trending 近7日榜首（非完整周净增冠军）';
    const leaders = {
      daily: { label: dailyLabel, labelCode: rankedDaily.length ? 'daily_gain' : 'trending_daily', repo: rankedDaily[0] || (daily[0] ? repos.get(daily[0].toLowerCase()) || null : null) },
      weekly: { label: weeklyLabel, labelCode: rankedWeekly.length ? 'weekly_gain' : 'trending_weekly', repo: rankedWeekly[0] || (weekly[0] ? repos.get(weekly[0].toLowerCase()) || null : null) }
    };
    if (daily[0] && !leaders.daily.repo) warnings.push('近1日真实榜首元数据不可用，未用其他仓库冒充榜首。');
    if (weekly[0] && !leaders.weekly.repo) warnings.push('近7日真实榜首元数据不可用，未用其他仓库冒充榜首。');
    const saved = new Set(state.saved.map(repo => repo.id));
    const cooled = new Set(state.history.filter(board => {
      const distance = (midnight(today) - midnight(board.date)) / DAY;
      return distance >= 0 && distance < state.settings.cooldownDays;
    }).flatMap(board => board.repos.map(repo => repo.id)));
    const chosen = [];
    const eligible = repo => !saved.has(repo.id) && !cooled.has(repo.id) && !chosen.some(item => item.id === repo.id);
    function pick(list, min, source, reason) {
      if (chosen.length >= target) return;
      const repo = list.find(item => item.stars >= min && eligible(item));
      if (repo) chosen.push({ ...repo, source, reason, sourceCode: sourceCode(source), reasonCode: sourceCode(source), badges: [source] });
    }
    const dailySource = rankedDaily.length ? '昨日净增（已观测候选）' : 'Trending 近1日';
    const weeklySource = rankedWeekly.length ? '近7日净增（已观测候选）' : 'Trending 近7日';
    pick(rankedDaily.length ? rankedDaily : dailyRepos, state.settings.dailyMin, dailySource,
      rankedDaily.length ? '按具备完整上海自然日端点的已观测候选星数净增排序。' : '进入 GitHub Trending 近1日榜，按榜单顺序选取；不代表昨日星数净增冠军。');
    pick(rankedWeekly.length ? rankedWeekly : weeklyRepos, state.settings.weeklyMin, weeklySource,
      rankedWeekly.length ? '按具备连续完整7个上海自然日端点的已观测候选净增排序，与日推荐去重。' : '进入 GitHub Trending 近7日榜，按榜单顺序选取；不代表完整周星数净增冠军。');
    const classics = search.map(meta => repos.get(meta.full_name?.toLowerCase())).filter(Boolean).sort((a, b) =>
      Number(b.stars >= state.settings.preferredMin) - Number(a.stars >= state.settings.preferredMin) || b.stars - a.stars || a.id - b.id);
    const categories = new Set();
    for (let i = 0; i < Math.max(0, target - 2); i++) {
      const diverse = classics.filter(repo => !categories.has(repo.categoryId) && eligible(repo) && repo.stars >= state.settings.classicMin);
      const pool = diverse.length ? diverse : classics;
      const before = chosen.length;
      pick(pool, state.settings.classicMin, '经典高星', '高星经典项目；优先达到偏好星数门槛，优先分类不同，分类不足时使用同类真实项目。');
      if (chosen.length > before) categories.add(chosen.at(-1).categoryId);
    }
    for (const repo of chosen) {
      for (const leader of [leaders.daily, leaders.weekly]) {
        if (leader.repo?.id === repo.id && !repo.badges.includes(leader.label)) repo.badges.push(leader.label);
      }
    }
    if (chosen.length < target) warnings.push(`本次仅有 ${chosen.length}/${target} 个符合星数、去重、收藏排除、冷却和分类条件的真实项目，未填充虚构推荐。`);
    warnings.push('Trending 展示近1日/近7日趋势；缺少完整上海午夜端点时，星数净增为未知。');
    return { board: { date: today, generatedAt: at, repos: chosen, warnings, warningDetails: warnings.map(message => failures.find(failure => failure.message === message)?.detail || warningDetail(message)), leaders }, failures };
  }
  async function enhance(board) {
    if (typeof enrich !== 'function') return;
    for (const repo of board.repos) {
      try {
        const readme = await request(`https://api.github.com/repos/${repo.name}/readme`, false, true);
        repo.readmeExcerpt = readme
          .replace(/```[\s\S]*?```/g, '')
          .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
          .replace(/^[#>*\s-]+/gm, '').replace(/\s+/g, ' ').trim().slice(0, 1000);
      } catch (error) {
        signal?.throwIfAborted();
        board.warnings.push(`${repo.name} README 获取失败：${error.message}`);
        board.warningDetails.push({ code: 'readme_failed', params: { repo: repo.name, message: error.message } });
      }
      try {
        const result = await bounded(() => enrich(clone(repo)));
        if (typeof result?.summary === 'string' && result.summary.trim()) {
          repo.summary = result.summary.trim().slice(0, 10000);
          repo.summarySource = typeof result.summarySource === 'string' ? result.summarySource : 'enriched';
        }
        if (typeof result?.summaryZh === 'string' && result.summaryZh.trim()) repo.summaryZh = result.summaryZh.trim().slice(0, 10000);
        else if (!repo.summaryZh) repo.summaryZh = projectRepo(repo).summaryZh;
      } catch {
        signal?.throwIfAborted();
        board.warnings.push(`${repo.name} 简介增强失败，保留原文。`);
        board.warningDetails.push({ code: 'enrichment_failed', params: { repo: repo.name } });
      }
      if (budgetExpired || deadline <= Date.now()) break;
    }
  }
  const api = {
    status: () => exclusive(root, async () => view(await load())),
    refresh({ force = false, snapshotOnly = false } = {}) {
      if (signal?.aborted) return Promise.reject(signal.reason);
      const existing = refreshes.get(root);
      if (existing) {
        if (existing.snapshotOnly && !snapshotOnly) return existing.then(() => api.refresh({ force, snapshotOnly }));
        return existing;
      }
      const pending = exclusive(root, async () => {
        signal?.throwIfAborted();
        const state = await load();
        signal?.throwIfAborted();
        if (!cloud && !snapshotOnly && !force && !state.lastError && state.today?.date === dateKey(clock())) return view(state);
        deadline = Date.now() + (cloud ? Math.min(refreshTimeoutMs, 120000) : refreshTimeoutMs);
        budgetExpired = false;
        try {
          if (cloud) return await syncCloud(state, { force, snapshotOnly });
          const { board, failures } = await collect(state);
          const sameDay = state.history.find(item => item.date === board.date);
          if (snapshotOnly) {
            if (state.today && failures.length) appendWarnings(state.today, failures.map(item => item.message), failures.map(item => item.detail));
          } else if (sameDay) {
            state.today = clone(sameDay);
            appendWarnings(state.today, failures.map(item => item.message), failures.map(item => item.detail));
          } else if (failures.length && state.today) {
            appendWarnings(state.today, [...board.warnings, '采集存在失败，保留此前推荐，未更换榜单。'], [...board.warningDetails, { code: 'previous_board_retained' }]);
          } else {
            await enhance(board);
            state.today = board;
          }
          if ((budgetExpired || deadline <= Date.now()) && !failures.some(item => item.code === 'refresh_timeout')) {
            const error = timeoutError();
            const detail = { code: 'refresh_timeout', params: { source: 'refresh', message: error.message } };
            failures.push({ message: error.message, code: error.code, retryAt: null, detail });
            if (state.today) appendWarnings(state.today, [error.message], [detail]);
          }
          if (!snapshotOnly && !sameDay && state.today === board && !failures.length) state.history.push(clone(board));
          state.lastError = failures.length ? { message: failures.map(item => item.message).join('\n'), code: failures.some(item => item.code === 'refresh_timeout') ? 'refresh_timeout' : 'collection_failed',
            httpStatus: failures.find(item => item.httpStatus)?.httpStatus || null, at: clock().toISOString(), retryAt: failures.find(item => item.retryAt)?.retryAt || null, details: failures.map(item => item.detail) } : null;
          signal?.throwIfAborted();
          await persist(state);
          return view(state);
        } finally { deadline = Infinity; }
      });
      pending.snapshotOnly = snapshotOnly;
      refreshes.set(root, pending);
      pending.finally(() => { if (refreshes.get(root) === pending) refreshes.delete(root); }).catch(() => {});
      return pending;
    },
    settings: patch => exclusive(root, async () => {
      const state = await load();
      const settings = validSettings(patch, state.settings);
      if (Object.hasOwn(patch, 'recommendationCount') && settings.recommendationCount !== state.settings.recommendationCount) {
        const today = dateKey(clock());
        const activeCount = countAt(state, today);
        const previous = state.countSchedule;
        if (validCount(previous?.pendingCount) && previous.effectiveDate <= today) {
          state.countHistory ||= [];
          state.countHistory.push({ effectiveDate: previous.effectiveDate, count: previous.pendingCount });
        }
        const pendingCount = settings.recommendationCount === activeCount ? null : settings.recommendationCount;
        state.countSchedule = { activeCount, pendingCount, effectiveDate: pendingCount === null ? null : shiftDate(today, 1) };
      }
      state.settings = settings;
      await persist(state);
      return view(state);
    }),
    save: id => exclusive(root, async () => {
      if (!Number.isSafeInteger(id) || id <= 0) throw new TypeError('仓库 id 必须为正整数');
      const state = await load();
      const found = [state.today, ...state.history].filter(Boolean).flatMap(board => board.repos).find(item => item.id === id);
      if (!found) throw new Error('只能收藏已有推荐中的仓库 id');
      const repo = { ...found, category: found.categoryId !== 'general' ? categoryLabel(found.categoryId) : found.category || categoryLabel('general') };
      let content;
      try { content = await fs.readFile(collectionPath, 'utf8'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; content = '# GitHub 收藏\n'; }
      const marker = `<!-- starharbor:repo:${id} -->`;
      const alreadySaved = state.saved.some(item => item.id === id);
      if (!content.includes(marker)) {
        const heading = `## ${repo.category}`;
        const block = `${marker}\n- [${escapeMD(repo.name)}](${repo.url}) · ★ ${repo.stars.toLocaleString('en-US')}\n  ${escapeMD(repo.summary)}\n`;
        const lines = content.split('\n');
        const index = lines.findIndex(line => line.trim() === heading);
        if (index >= 0) lines.splice(index + 1, 0, '', block);
        else lines.push('', heading, '', block);
        content = lines.join('\n');
        await atomic(collectionPath, content, signal);
      }
      if (!alreadySaved) {
        state.saved.push({ ...repo, savedAt: clock().toISOString() });
        await persist(state);
      }
      return clone({ repo, alreadySaved, collectionPath, saved: state.saved });
    })
  };
  return api;
}
