import { CATEGORY_IDS, categoryLabel, classifyCategory } from './domain.js';

const DAY = 86400000;
const DEFAULTS = { dailyMin: 5000, weeklyMin: 10000, classicMin: 30000, preferredMin: 50000, cooldownDays: 30, recommendationCount: 5 };
const dateKey = value => new Date(new Date(value).getTime() + 8 * 3600000).toISOString().slice(0, 10);
const midnight = date => Date.parse(`${date}T00:00:00+08:00`);
const shift = (date, days) => dateKey(midnight(date) + days * DAY);
const fail = message => { throw new TypeError(`Invalid public feed: ${message}`); };
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}
function text(value, max, label, empty = true) {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.length) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) fail(`${label} is invalid`);
  return value;
}
function integer(value, label, min = 0) {
  if (!Number.isSafeInteger(value) || value < min) fail(`${label} must be a safe integer`);
  return value;
}
function stamp(value, label, limit) {
  if (typeof value !== 'string' || value.length > 35 || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) fail(`${label} must be an ISO timestamp`);
  const calendar = value.slice(0, 10);
  if (new Date(`${calendar}T00:00:00Z`).toISOString().slice(0, 10) !== calendar || Date.parse(value) > limit) fail(`${label} is invalid or in the future`);
  return new Date(value).toISOString();
}
export function validRepoName(value) {
  return typeof value === 'string' && value.length <= 140 && /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?\/[a-z\d_.-]{1,100}$/i.test(value) && !value.split('/')[0].includes('--') && !['.', '..'].includes(value.split('/')[1]);
}

/** Validate untrusted JSON and return a fresh, bounded public-only projection. */
export function validateFeed(value, { now = new Date() } = {}) {
  object(value, 'feed');
  const time = new Date(now).getTime();
  if (!Number.isFinite(time)) fail('now is invalid');
  if (value.schemaVersion !== 1) fail('unsupported schemaVersion');
  const generatedAt = stamp(value.generatedAt, 'generatedAt', time + 300000);
  if (typeof value.date !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(value.date) || dateKey(generatedAt) !== value.date) fail('date must be the Shanghai generation date');
  if (!Array.isArray(value.repos) || !value.repos.length || value.repos.length > 1000) fail('repos must contain 1–1000 repositories');
  const ids = new Set();
  const names = new Set();
  const repos = value.repos.map((raw, index) => {
    object(raw, `repos[${index}]`);
    const id = integer(raw.id, 'id', 1);
    if (ids.has(id) || !validRepoName(raw.name) || names.has(raw.name.toLowerCase())) fail('duplicate id/name or invalid owner/repo');
    ids.add(id); names.add(raw.name.toLowerCase());
    if (!CATEGORY_IDS.includes(raw.categoryId)) fail('categoryId is invalid');
    const description = text(raw.description, 10000, 'description');
    const language = raw.language === null ? null : text(raw.language, 100, 'language', false);
    const observedAt = stamp(raw.observedAt, 'observedAt', Math.min(time + 300000, Date.parse(generatedAt) + 300000));
    const pushedAt = raw.pushedAt === null ? null : stamp(raw.pushedAt, 'pushedAt', time + 300000);
    const result = { id, name: raw.name, url: `https://github.com/${raw.name}`, description, stars: integer(raw.stars, 'stars'), categoryId: classifyCategory({ name: raw.name, description }), language, pushedAt, observedAt };
    for (const [period, days] of [['daily', 1], ['weekly', 7]]) {
      const gain = raw[`${period}Gain`];
      const interval = raw[`${period}Interval`];
      if (gain === null) {
        if (interval !== null) fail(`${period} unknown growth must have null interval`);
        result[`${period}Gain`] = null; result[`${period}Interval`] = null;
      } else {
        integer(gain, `${period}Gain`, -Number.MAX_SAFE_INTEGER);
        // A later same-day unstar can put today's total below yesterday's valid net gain.
        object(interval, `${period}Interval`);
        const start = stamp(interval.start, 'interval.start', time + 300000);
        const end = stamp(interval.end, 'interval.end', time + 300000);
        if (Date.parse(start) !== midnight(shift(value.date, -days)) || Date.parse(end) !== midnight(value.date) || Date.parse(observedAt) < Date.parse(end) - 300000) fail(`${period} interval must cover complete Shanghai calendar days`);
        result[`${period}Gain`] = gain; result[`${period}Interval`] = { start, end };
      }
    }
    return result;
  });
  object(value.rankings, 'rankings'); object(value.rankingModes, 'rankingModes');
  const rankings = {};
  const rankingModes = {};
  const byId = new Map(repos.map(repo => [repo.id, repo]));
  for (const period of ['daily', 'weekly', 'classic']) {
    const list = value.rankings[period];
    if (!Array.isArray(list) || list.length > 1000 || new Set(list).size !== list.length || list.some(id => !ids.has(id))) fail(`${period} ranking contains duplicate or unknown ids`);
    rankings[period] = [...list];
    if (period !== 'classic') {
      const mode = value.rankingModes[period];
      if (![`${period}_gain`, `trending_${period}`].includes(mode)) fail(`${period} ranking mode is invalid`);
      if (mode === `${period}_gain` && list.some((id, i) => byId.get(id)[`${period}Gain`] === null || (i && byId.get(list[i - 1])[`${period}Gain`] < byId.get(id)[`${period}Gain`]))) fail(`${period} gain ranking lacks measured growth or is unsorted`);
      rankingModes[period] = mode;
    }
  }
  if (!Array.isArray(value.warnings) || value.warnings.length > 100) fail('warnings must be a bounded array');
  const warnings = value.warnings.map(raw => {
    object(raw, 'warning');
    if (typeof raw.code !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(raw.code)) fail('warning code is invalid');
    const warning = { code: raw.code };
    if (raw.params !== undefined) {
      object(raw.params, 'warning params');
      if (Object.keys(raw.params).length > 10) fail('too many warning params');
      warning.params = {};
      for (const [key, val] of Object.entries(raw.params)) {
        if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key)) fail('warning param key is invalid');
        if (typeof val === 'string') warning.params[key] = text(val, 2000, 'warning param');
        else if (typeof val === 'number' && Number.isSafeInteger(val) || typeof val === 'boolean' || val === null) warning.params[key] = val;
        else fail('warning params must be scalar');
      }
    }
    return warning;
  });
  return { schemaVersion: 1, date: value.date, generatedAt, repos, rankings, rankingModes, warnings };
}

function warningMessage(detail) {
  const params = detail.params || {};
  switch (detail.code) {
    case 'growth_unavailable': return 'Trending 展示近1日/近7日趋势；缺少完整上海午夜端点时，星数净增为未知。';
    case 'search_incomplete': return 'GitHub 搜索结果不完整，仅依据已返回的真实仓库推荐。';
    case 'metadata_budget': return `为减少限流，本次最多额外查询${params.limit}个 Trending 仓库；其余候选未核实。`;
    case 'leader_unavailable': return `${params.period === 'weekly' ? '近7日' : '近1日'}真实榜首元数据不可用，未用其他仓库冒充榜首。`;
    case 'recommendation_shortage': return `本次仅有 ${params.count}/${params.target} 个符合星数、去重、收藏排除、冷却和分类条件的真实项目，未填充虚构推荐。`;
    default: return `公共候选源提示：${detail.code}`;
  }
}
function project(repo) {
  return { ...repo, category: categoryLabel(repo.categoryId), summary: repo.description || '仓库未提供描述。', summarySource: 'original', summaryZh: /[\u4e00-\u9fff]/.test(repo.description) ? repo.description : '', readmeExcerpt: '', source: '', reason: '', sourceCode: null, reasonCode: null, badges: [] };
}

/** Apply private local preferences to a validated public feed without mutating either. */
export function selectFeedBoard(value, { settings = {}, history = [], saved = [], now = new Date() } = {}) {
  const feed = validateFeed(value, { now });
  const preferences = { ...DEFAULTS, ...settings };
  for (const key of Object.keys(DEFAULTS)) integer(preferences[key], `settings.${key}`, key === 'recommendationCount' ? 1 : 0);
  const target = preferences.recommendationCount;
  if (target > 10) fail('settings.recommendationCount must be an integer from 1 to 10');
  const byId = new Map(feed.repos.map(repo => [repo.id, project(repo)]));
  const savedIds = new Set(saved.map(repo => typeof repo === 'number' ? repo : repo.id));
  const cooled = new Set(history.filter(board => {
    const distance = (midnight(feed.date) - midnight(board.date)) / DAY;
    return distance >= 0 && distance < preferences.cooldownDays;
  }).flatMap(board => (board.repos || []).map(repo => repo.id)));
  const repos = [];
  const eligible = repo => !savedIds.has(repo.id) && !cooled.has(repo.id) && !repos.some(item => item.id === repo.id);
  const details = structuredClone(feed.warnings);
  const add = detail => { if (!details.some(item => item.code === detail.code && JSON.stringify(item.params) === JSON.stringify(detail.params))) details.push(detail); };
  const leaders = {};
  for (const period of ['daily', 'weekly']) {
    const mode = feed.rankingModes[period];
    const measured = mode === `${period}_gain`;
    const source = measured ? period === 'daily' ? '昨日净增（已观测候选）' : '近7日净增（已观测候选）' : `Trending ${period === 'daily' ? '近1日' : '近7日'}`;
    const label = measured ? `${period === 'daily' ? '昨日' : '近7日'}净增榜首（已观测候选，上海完整自然日）` : `${source}榜首（非${period === 'daily' ? '昨日星数净增' : '完整周净增'}冠军）`;
    const unavailable = details.some(item => item.code === 'leader_unavailable' && item.params?.period === period);
    const leader = unavailable ? null : byId.get(feed.rankings[period][0]) || null;
    leaders[period] = { label, labelCode: mode, repo: leader };
    if (!leader) add({ code: 'leader_unavailable', params: { period } });
    const chosen = feed.rankings[period].map(id => byId.get(id)).find(repo => repo.stars >= preferences[`${period}Min`] && eligible(repo));
    if (chosen && repos.length < target) repos.push({ ...chosen, source, reason: measured ? '按具备完整上海自然日端点的已观测候选星数净增排序。' : '按 GitHub Trending 榜单顺序选取；不代表完整自然日星数净增冠军。', sourceCode: mode, reasonCode: mode, badges: [source] });
  }
  const classics = feed.rankings.classic.map(id => byId.get(id)).sort((a, b) => Number(b.stars >= preferences.preferredMin) - Number(a.stars >= preferences.preferredMin) || b.stars - a.stars || a.id - b.id);
  const categories = new Set();
  for (let i = 0; i < Math.max(0, target - 2); i++) {
    const pool = classics.filter(repo => repo.stars >= preferences.classicMin && eligible(repo));
    const chosen = pool.find(repo => !categories.has(repo.categoryId)) || pool[0];
    if (!chosen) break;
    categories.add(chosen.categoryId);
    repos.push({ ...chosen, source: '经典高星', reason: '高星经典项目；优先达到偏好星数门槛，优先分类不同，分类不足时使用同类真实项目。', sourceCode: 'classic', reasonCode: 'classic', badges: ['经典高星'] });
  }
  for (const repo of repos) for (const leader of Object.values(leaders)) if (leader.repo?.id === repo.id) repo.badges.push(leader.label);
  if (repos.length < target) add({ code: 'recommendation_shortage', params: { count: repos.length, target } });
  if (feed.repos.some(repo => repo.dailyGain === null || repo.weeklyGain === null)) add({ code: 'growth_unavailable' });
  return { date: feed.date, generatedAt: new Date(now).toISOString(), feedGeneratedAt: feed.generatedAt, repos, warnings: details.map(warningMessage), warningDetails: details, leaders };
}
