import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const DEFAULTS = Object.freeze({ dailyMin: 5000, weeklyMin: 10000, classicMin: 30000, preferredMin: 50000, cooldownDays: 30, hour: 9 });
const locks = new Map();
const refreshes = new Map();
const DAY = 86400000;
const clone = value => structuredClone(value);
const dateKey = value => new Date(new Date(value).getTime() + 8 * 3600000).toISOString().slice(0, 10);
const shiftDate = (date, days) => dateKey(Date.parse(`${date}T00:00:00+08:00`) + days * DAY);
const midnight = date => Date.parse(`${date}T00:00:00+08:00`);
function exclusive(key, work) {
  const previous = locks.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(work);
  locks.set(key, next);
  next.finally(() => { if (locks.get(key) === next) locks.delete(key); }).catch(() => {});
  return next;
}
async function atomic(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temp, content, 'utf8'); await fs.rename(temp, file); }
  finally { await fs.unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}
function category(repo) {
  const text = `${repo.full_name} ${repo.description || ''} ${(repo.topics || []).join(' ')}`.toLowerCase();
  if (/\b(llm|ai|machine.learning|deep.learning|gpt|transformer|diffusion)\b/.test(text)) return '人工智能';
  if (/\b(database|sql|redis|storage|postgres|sqlite)\b/.test(text)) return '数据与存储';
  if (/\b(react|vue|frontend|css|html|web.framework|nextjs|svelte)\b/.test(text)) return '前端与 Web';
  if (/\b(devops|docker|kubernetes|container|deployment|terraform)\b/.test(text)) return '基础设施';
  if (/\b(learn|tutorial|course|book|interview|awesome|education)\b/.test(text)) return '学习与资源';
  if (/\b(editor|terminal|cli|developer.tool|ide|productivity)\b/.test(text)) return '开发工具';
  return repo.language ? `编程语言 · ${repo.language}` : '综合项目';
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
    if (!(key in DEFAULTS)) throw new TypeError(`未知设置：${key}`);
    const [min, max] = key === 'hour' ? [0, 23] : key === 'cooldownDays' ? [0, 3650] : [0, 1000000000];
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new RangeError(`${key} 必须为 ${min}–${max} 的整数`);
    result[key] = value;
  }
  if (result.preferredMin < result.classicMin) throw new RangeError('preferredMin 不得小于 classicMin');
  return result;
}
const escapeMD = text => String(text ?? '').replace(/[\r\n]+/g, ' ').replace(/[\\`*_[\]<>]/g, '\\$&');

/** Local-only storage, native fetch, no automatic scheduler or automatic collection. */
export function createHarbor({ dataDir, fetchImpl = fetch, now = () => new Date(), enrich } = {}) {
  if (typeof dataDir !== 'string' || !dataDir) throw new TypeError('dataDir 必填');
  const root = path.resolve(dataDir);
  const statePath = path.join(root, 'state.json');
  const collectionPath = path.join(root, 'GitHub收藏.md');
  const clock = () => new Date(now());
  async function load() {
    try {
      const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
      return { history: [], saved: [], snapshots: [], today: null, lastError: null, ...state, settings: { ...DEFAULTS, ...state.settings } };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return { settings: { ...DEFAULTS }, history: [], saved: [], snapshots: [], today: null, lastError: null };
    }
  }
  const persist = state => atomic(statePath, JSON.stringify(state, null, 2) + '\n');
  const view = state => clone({ settings: state.settings, today: state.today, history: state.history, saved: state.saved, collectionPath, lastError: state.lastError });
  async function request(url, json = false, raw = false) {
    const controller = new AbortController();
    let timer;
    try {
      const response = await Promise.race([
        fetchImpl(url, { signal: controller.signal, headers: {
          Accept: raw ? 'application/vnd.github.raw+json' : json ? 'application/vnd.github+json' : 'text/html',
          'User-Agent': 'StarHarbor',
          ...(url.startsWith('https://api.github.com/') && process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
        } }),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('请求超时（15秒）')); }, 15000); })
      ]);
      if (!response.ok) {
        const remaining = response.headers?.get('retry-after');
        const reset = response.headers?.get('x-ratelimit-reset');
        const retry = remaining ? (/^\d+$/.test(remaining) ? new Date(clock().getTime() + Number(remaining) * 1000).toISOString() : remaining)
          : reset && /^\d+$/.test(reset) ? new Date(Number(reset) * 1000).toISOString() : null;
        const error = new Error(`GitHub HTTP ${response.status}${[403, 429].includes(response.status) ? '：访问受限或触发限流' : ''}；${retry ? `重试时间 ${retry}` : '未提供重试时间，请稍后重试'}`);
        error.retryAt = retry;
        throw error;
      }
      // Keep body decoding inside the timeout, including injected fetch implementations.
      return await Promise.race([json ? response.json() : response.text(), new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(new Error('请求超时（15秒）')), { once: true });
      })]);
    } finally { clearTimeout(timer); }
  }
  function gains(state, repoId, date, days) {
    const ends = [];
    for (let i = 0; i <= days; i++) {
      const key = shiftDate(date, -i);
      const snap = state.snapshots.find(item => item.date === key && Math.abs(Date.parse(item.observedAt) - midnight(key)) <= 300000);
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
      description: meta.description || '', summary: meta.description ? `${meta.description}（原文未翻译）` : '仓库未提供描述。',
      summarySource: 'original', readmeExcerpt: '', category: category(meta), stars: meta.stargazers_count, dailyGain, weeklyGain,
      dailyInterval: dailyGain === null ? null : { start: `${shiftDate(date, -1)}T00:00:00+08:00`, end: `${date}T00:00:00+08:00`, label: '完整自然日净增（上海）' },
      weeklyInterval: weeklyGain === null ? null : { start: `${shiftDate(date, -7)}T00:00:00+08:00`, end: `${date}T00:00:00+08:00`, label: '完整7个自然日净增（上海）' },
      reason: '', source: '', observedAt: at, pushedAt: meta.pushed_at || null, badges: []
    };
  }
  async function collect(state) {
    const observationTimes = new Map();
    const warnings = [];
    const failures = [];
    const capture = async (label, work, fallback) => {
      try { return await work(); } catch (error) {
        warnings.push(`${label}失败：${error.message}`);
        failures.push({ message: `${label}失败：${error.message}`, retryAt: error.retryAt || null });
        return fallback;
      }
    };
    const [daily, weekly, search] = await Promise.all([
      capture('Trending 近1日', async () => { const names = trendingNames(await request('https://github.com/trending?since=daily')); if (!names.length) throw new Error('未解析到仓库，页面结构可能变化'); return names; }, []),
      capture('Trending 近7日', async () => { const names = trendingNames(await request('https://github.com/trending?since=weekly')); if (!names.length) throw new Error('未解析到仓库，页面结构可能变化'); return names; }, []),
      capture('GitHub 经典搜索', async () => {
        const body = await request('https://api.github.com/search/repositories?q=stars:%3E%3D30000+fork:false+archived:false&sort=stars&order=desc&per_page=100', true);
        if (!Array.isArray(body.items)) throw new Error('搜索响应缺少 items');
        if (body.incomplete_results) warnings.push('GitHub 搜索结果不完整，仅依据已返回的真实仓库推荐。');
        const observed = clock().toISOString();
        for (const meta of body.items) observationTimes.set(meta.id, observed);
        return body.items;
      }, [])
    ]);
    const metadata = new Map(search.filter(meta => Number.isSafeInteger(meta.id) && meta.full_name).map(meta => [meta.full_name.toLowerCase(), meta]));
    // Interleave both lists so weekly leaders are not starved by daily candidates.
    const candidates = [];
    for (let i = 0; i < Math.max(daily.length, weekly.length); i++) {
      for (const name of [daily[i], weekly[i]]) if (name && !metadata.has(name.toLowerCase()) && !candidates.includes(name)) candidates.push(name);
    }
    const lookups = candidates.slice(0, 20);
    for (const name of lookups) {
      const meta = await capture(`仓库 ${name}`, () => request(`https://api.github.com/repos/${name}`, true), null);
      if (meta && Number.isSafeInteger(meta.id) && meta.full_name) {
        metadata.set(meta.full_name.toLowerCase(), meta);
        observationTimes.set(meta.id, clock().toISOString());
      }
      if (!meta && /HTTP (403|429)/.test(failures.at(-1)?.message || '')) break;
    }
    if (candidates.length > 20) warnings.push('为减少限流，本次最多额外查询20个 Trending 仓库；其余候选未核实。');
    const at = clock().toISOString();
    const today = dateKey(at);
    const adjacent = [today, shiftDate(today, 1)].find(date => Math.abs(Date.parse(at) - midnight(date)) <= 300000);
    if (adjacent && metadata.size) {
      const stars = Object.fromEntries([...metadata.values()]
        .filter(meta => Math.abs(Date.parse(observationTimes.get(meta.id)) - midnight(adjacent)) <= 300000)
        .map(meta => [meta.id, meta.stargazers_count]).filter(([, count]) => Number.isFinite(count)));
      const prior = state.snapshots.find(item => item.date === adjacent);
      // The closest observation to midnight is the stable endpoint for a day.
      if (!prior || Math.abs(Date.parse(at) - midnight(adjacent)) < Math.abs(Date.parse(prior.observedAt) - midnight(adjacent))) {
        state.snapshots = state.snapshots.filter(item => item.date !== adjacent);
        state.snapshots.push({ date: adjacent, observedAt: at, stars });
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
      daily: { label: dailyLabel, repo: rankedDaily[0] || (daily[0] ? repos.get(daily[0].toLowerCase()) || null : null) },
      weekly: { label: weeklyLabel, repo: rankedWeekly[0] || (weekly[0] ? repos.get(weekly[0].toLowerCase()) || null : null) }
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
      const repo = list.find(item => item.stars >= min && eligible(item));
      if (repo) chosen.push({ ...repo, source, reason, badges: [source] });
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
    for (let i = 0; i < 3; i++) {
      const diverse = classics.filter(repo => !categories.has(repo.category) && eligible(repo) && repo.stars >= state.settings.classicMin);
      const pool = diverse.length ? diverse : classics;
      const before = chosen.length;
      pick(pool, state.settings.classicMin, '经典高星', '高星经典项目；优先达到偏好星数门槛，优先分类不同，分类不足时使用同类真实项目。');
      if (chosen.length > before) categories.add(chosen.at(-1).category);
    }
    for (const repo of chosen) {
      for (const leader of [leaders.daily, leaders.weekly]) {
        if (leader.repo?.id === repo.id && !repo.badges.includes(leader.label)) repo.badges.push(leader.label);
      }
    }
    if (chosen.length < 5) warnings.push(`本次仅有 ${chosen.length}/5 个符合星数、去重、收藏排除、冷却和分类条件的真实项目，未填充虚构推荐。`);
    warnings.push('Trending 展示近1日/近7日趋势；缺少完整上海午夜端点时，星数净增为未知。');
    return { board: { date: today, generatedAt: at, repos: chosen, warnings, leaders }, failures };
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
      } catch (error) { board.warnings.push(`${repo.name} README 获取失败：${error.message}`); }
      try {
        const result = await enrich(clone(repo));
        if (typeof result?.summary === 'string' && result.summary.trim()) {
          repo.summary = result.summary.trim().slice(0, 10000);
          repo.summarySource = typeof result.summarySource === 'string' ? result.summarySource : 'enriched';
        }
        if (typeof result?.category === 'string' && result.category.trim()) repo.category = result.category.trim().replace(/[\r\n]/g, ' ').slice(0, 80);
      } catch { board.warnings.push(`${repo.name} 简介增强失败，保留原文。`); }
    }
  }
  const api = {
    status: () => exclusive(root, async () => view(await load())),
    refresh({ force = false, snapshotOnly = false } = {}) {
      const existing = refreshes.get(root);
      if (existing) {
        if (existing.snapshotOnly && !snapshotOnly) return existing.then(() => api.refresh({ force, snapshotOnly }));
        return existing;
      }
      const pending = exclusive(root, async () => {
        const state = await load();
        if (!snapshotOnly && !force && !state.lastError && state.today?.date === dateKey(clock())) return view(state);
        const { board, failures } = await collect(state);
        const sameDay = state.history.find(item => item.date === board.date);
        if (snapshotOnly) {
          if (state.today && failures.length) state.today.warnings = [...new Set([...state.today.warnings, ...failures.map(item => item.message)])];
        } else if (sameDay) {
          state.today = { ...sameDay, warnings: [...new Set([...sameDay.warnings, ...failures.map(item => item.message)])] };
        } else if (failures.length && state.today) {
          state.today = { ...state.today, warnings: [...new Set([...state.today.warnings, ...board.warnings, '采集存在失败，保留此前推荐，未更换榜单。'])] };
        } else {
          await enhance(board);
          state.today = board;
          if (!failures.length) state.history.push(clone(board));
        }
        state.lastError = failures.length ? { message: failures.map(item => item.message).join('\n'), at: clock().toISOString(), retryAt: failures.find(item => item.retryAt)?.retryAt || null } : null;
        await persist(state);
        return view(state);
      });
      pending.snapshotOnly = snapshotOnly;
      refreshes.set(root, pending);
      pending.finally(() => { if (refreshes.get(root) === pending) refreshes.delete(root); }).catch(() => {});
      return pending;
    },
    settings: patch => exclusive(root, async () => {
      const state = await load();
      state.settings = validSettings(patch, state.settings);
      await persist(state);
      return view(state);
    }),
    save: id => exclusive(root, async () => {
      if (!Number.isSafeInteger(id) || id <= 0) throw new TypeError('仓库 id 必须为正整数');
      const state = await load();
      const repo = [state.today, ...state.history].filter(Boolean).flatMap(board => board.repos).find(item => item.id === id);
      if (!repo) throw new Error('只能收藏已有推荐中的仓库 id');
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
        await atomic(collectionPath, content);
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
