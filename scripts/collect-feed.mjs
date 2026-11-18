import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { classifyCategory } from '../domain.js';
import { validateFeed, validRepoName } from '../feed.js';

const DAY = 86400000;
const dateKey = value => new Date(new Date(value).getTime() + 8 * 3600000).toISOString().slice(0, 10);
const midnight = date => Date.parse(`${date}T00:00:00+08:00`);
const shift = (date, days) => dateKey(midnight(date) + days * DAY);
function namesFromTrending(html) {
  if (typeof html !== 'string' || html.length > 10000000) throw new Error('Invalid Trending response');
  const names = [];
  for (const article of html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)) {
    const heading = article[1].match(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/i)?.[1];
    if (!heading) continue;
    for (const match of heading.matchAll(/href\s*=\s*["']\/([^"']+?)\/?["']/gi)) {
      if (validRepoName(match[1]) && !/^(sponsors|topics|collections|marketplace)\//i.test(match[1]) && !names.some(name => name.toLowerCase() === match[1].toLowerCase())) { names.push(match[1]); break; }
    }
  }
  if (!names.length) throw new Error('Trending returned no parseable repositories');
  return names.slice(0, 1000);
}
function publicMetadata(raw) {
  if (!raw || !Number.isSafeInteger(raw.id) || raw.id <= 0 || !validRepoName(raw.full_name) || !Number.isSafeInteger(raw.stargazers_count) || raw.stargazers_count < 0 || raw.private === true || raw.visibility && raw.visibility !== 'public') throw new Error('Invalid public repository metadata');
  if (raw.description !== null && raw.description !== undefined && (typeof raw.description !== 'string' || raw.description.length > 10000)) throw new Error('Invalid repository description');
  return { id: raw.id, name: raw.full_name, description: raw.description || '', stars: raw.stargazers_count, categoryId: classifyCategory({ name: raw.full_name, description: raw.description || '' }), language: raw.language || null, pushedAt: raw.pushed_at || null, excluded: !!(raw.fork || raw.archived) };
}
function cleanSnapshots(previous, date) {
  if (!Array.isArray(previous)) throw new TypeError('previousSnapshots must be a public snapshot array');
  const result = new Map();
  for (const raw of previous) {
    if (!raw || !/^\d{4}-\d\d-\d\d$/.test(raw.date || '') || !Number.isFinite(midnight(raw.date)) || dateKey(midnight(raw.date)) !== raw.date || raw.date < shift(date, -34) || raw.date > shift(date, 1)) continue;
    if (!raw.stars || typeof raw.stars !== 'object' || Array.isArray(raw.stars)) continue;
    let snapshot = result.get(raw.date);
    if (!snapshot) { snapshot = { date: raw.date, stars: {}, observedAtByRepo: {} }; result.set(raw.date, snapshot); }
    for (const [id, stars] of Object.entries(raw.stars).slice(0, 1000)) {
      const observedAt = raw.observedAtByRepo?.[id];
      // Never use an aggregate batch timestamp to invent a per-repository endpoint.
      if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || !Number.isSafeInteger(stars) || stars < 0 || typeof observedAt !== 'string' || !Number.isFinite(Date.parse(observedAt)) || Math.abs(Date.parse(observedAt) - midnight(raw.date)) > 300000) continue;
      const old = snapshot.observedAtByRepo[id];
      if (!old || Math.abs(Date.parse(observedAt) - midnight(raw.date)) < Math.abs(Date.parse(old) - midnight(raw.date))) {
        snapshot.stars[id] = stars; snapshot.observedAtByRepo[id] = new Date(observedAt).toISOString();
      }
    }
  }
  return [...result.values()].filter(snapshot => Object.keys(snapshot.stars).length).sort((a, b) => a.date.localeCompare(b.date)).slice(-35);
}
function gainFor(snapshots, id, date, days) {
  const points = [];
  for (let day = 0; day <= days; day++) {
    const key = shift(date, -day);
    const snap = snapshots.find(item => item.date === key);
    if (!snap || !Number.isSafeInteger(snap.stars[id]) || Math.abs(Date.parse(snap.observedAtByRepo[id]) - midnight(key)) > 300000) return null;
    points.push(snap.stars[id]);
  }
  return points[0] - points[days];
}

/** Public sources only. No local StarHarbor state, saved repositories, or credentials are serialized. */
export async function collectFeed({ fetchImpl = fetch, now = () => new Date(), previousSnapshots = [], token = process.env.GITHUB_TOKEN, timeoutMs = 120000, requestTimeoutMs = 15000, metadataLimit = 50, classicPages = 3 } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000 || !Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 15000 || !Number.isInteger(metadataLimit) || metadataLimit < 0 || metadataLimit > 50 || ![2, 3].includes(classicPages)) throw new RangeError('Invalid collector bounds');
  const clock = () => { const date = new Date(now()); if (!Number.isFinite(date.getTime())) throw new Error('Invalid collection clock'); return date; };
  const deadline = Date.now() + timeoutMs;
  const warnings = [];
  let rateLimit = null;
  async function request(url, json = false) {
    if (rateLimit) throw rateLimit;
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw Object.assign(new Error('Collection exceeded overall time budget'), { code: 'refresh_timeout' });
    const controller = new AbortController();
    let timer;
    try {
      const stopped = new Promise((_, reject) => { timer = setTimeout(() => { const error = Object.assign(new Error('GitHub request timed out'), { code: remaining <= requestTimeoutMs ? 'refresh_timeout' : 'request_timeout' }); controller.abort(error); reject(error); }, Math.min(remaining, requestTimeoutMs)); });
      const parsed = new URL(url);
      const response = await Promise.race([Promise.resolve().then(() => fetchImpl(url, { signal: controller.signal, redirect: 'error', headers: { Accept: json ? 'application/vnd.github+json' : 'text/html', 'User-Agent': 'StarHarbor-Public-Collector', ...(parsed.protocol === 'https:' && parsed.hostname === 'api.github.com' && token ? { Authorization: `Bearer ${token}` } : {}) } })), stopped]);
      if (!response.ok) {
        const retryAfter = response.headers?.get('retry-after');
        const reset = response.headers?.get('x-ratelimit-reset');
        let retryAt = null;
        if (retryAfter && /^\d+$/.test(retryAfter)) retryAt = new Date(clock().getTime() + Number(retryAfter) * 1000).toISOString();
        else if (retryAfter && Number.isFinite(Date.parse(retryAfter))) retryAt = new Date(retryAfter).toISOString();
        else if (reset && /^\d+$/.test(reset) && Number.isFinite(Number(reset) * 1000)) retryAt = new Date(Number(reset) * 1000).toISOString();
        const error = Object.assign(new Error(`GitHub HTTP ${response.status}${retryAt ? `; retry at ${retryAt}` : '; retry time not supplied'}`), { code: 'github_http', httpStatus: response.status, retryAt });
        if ([403, 429].includes(response.status)) rateLimit = error;
        throw error;
      }
      const body = await Promise.race([json ? response.json() : response.text(), stopped]);
      return { body, observedAt: clock().toISOString() };
    } finally { clearTimeout(timer); }
  }
  // Every one of these sources is required: failures reject the collection before publication.
  const requests = [request('https://github.com/trending?since=daily'), request('https://github.com/trending?since=weekly')];
  for (let page = 1; page <= classicPages; page++) requests.push(request(`https://api.github.com/search/repositories?q=stars:%3E%3D5000+fork:false+archived:false&sort=stars&order=desc&per_page=100&page=${page}`, true));
  const results = await Promise.all(requests);
  const daily = namesFromTrending(results[0].body);
  const weekly = namesFromTrending(results[1].body);
  const metadata = new Map();
  const classicNames = [];
  for (const { body, observedAt } of results.slice(2)) {
    if (!body || !Array.isArray(body.items) || !body.items.length || body.items.length > 100) throw new Error('Required classic search returned invalid or empty items');
    if (body.incomplete_results && !warnings.some(item => item.code === 'search_incomplete')) warnings.push({ code: 'search_incomplete' });
    for (const raw of body.items) {
      const repo = publicMetadata(raw);
      if (repo.excluded || repo.stars < 5000) continue;
      metadata.set(repo.name.toLowerCase(), { ...repo, observedAt }); classicNames.push(repo.name.toLowerCase());
    }
  }
  const candidates = [];
  for (let i = 0; i < Math.max(daily.length, weekly.length); i++) for (const name of [daily[i], weekly[i]]) if (name && !metadata.has(name.toLowerCase()) && !candidates.some(candidate => candidate.toLowerCase() === name.toLowerCase())) candidates.push(name);
  if (candidates.length > metadataLimit) warnings.push({ code: 'metadata_budget', params: { limit: metadataLimit } });
  const lookups = candidates.slice(0, metadataLimit);
  let cursor = 0;
  let optionalFailure = null;
  await Promise.all(Array.from({ length: Math.min(3, lookups.length) }, async () => {
    while (cursor < lookups.length && !rateLimit) {
      const name = lookups[cursor++];
      try {
        const { body, observedAt } = await request(`https://api.github.com/repos/${name}`, true);
        const repo = publicMetadata(body);
        if (repo.name.toLowerCase() !== name.toLowerCase()) throw new Error('Repository metadata name mismatch');
        if (!repo.excluded) metadata.set(name.toLowerCase(), { ...repo, observedAt });
      } catch (error) {
        if (error.code === 'refresh_timeout') throw error;
        optionalFailure ||= error;
      }
    }
  }));
  if (optionalFailure) warnings.push({ code: 'source_failed', params: { source: 'repository', message: optionalFailure.message, ...(optionalFailure.httpStatus ? { httpStatus: optionalFailure.httpStatus } : {}), ...(optionalFailure.retryAt ? { retryAt: optionalFailure.retryAt } : {}) } });
  if (Date.now() >= deadline) throw Object.assign(new Error('Collection exceeded overall time budget'), { code: 'refresh_timeout' });
  const generatedAt = clock().toISOString();
  const date = dateKey(generatedAt);
  let snapshots = cleanSnapshots(previousSnapshots, date);
  for (const repo of metadata.values()) {
    const observedDay = dateKey(repo.observedAt);
    const endpoint = [observedDay, shift(observedDay, 1)].find(key => Math.abs(Date.parse(repo.observedAt) - midnight(key)) <= 300000);
    if (!endpoint) continue;
    let snap = snapshots.find(item => item.date === endpoint);
    if (!snap) { snap = { date: endpoint, stars: {}, observedAtByRepo: {} }; snapshots.push(snap); }
    const prior = snap.observedAtByRepo[repo.id];
    if (!prior || Math.abs(Date.parse(repo.observedAt) - midnight(endpoint)) < Math.abs(Date.parse(prior) - midnight(endpoint))) { snap.stars[repo.id] = repo.stars; snap.observedAtByRepo[repo.id] = repo.observedAt; }
  }
  snapshots = cleanSnapshots(snapshots, date);
  const repos = [...metadata.values()].map(({ excluded, ...repo }) => {
    for (const [period, days] of [['daily', 1], ['weekly', 7]]) {
      const gain = gainFor(snapshots, repo.id, date, days);
      repo[`${period}Gain`] = gain;
      repo[`${period}Interval`] = gain === null ? null : { start: `${shift(date, -days)}T00:00:00+08:00`, end: `${date}T00:00:00+08:00` };
    }
    return repo;
  });
  const byName = new Map(repos.map(repo => [repo.name.toLowerCase(), repo]));
  const rankings = { classic: [...new Set(classicNames.map(name => byName.get(name)?.id).filter(Boolean))] };
  const rankingModes = {};
  for (const [period, names] of [['daily', daily], ['weekly', weekly]]) {
    const measured = repos.filter(repo => repo[`${period}Gain`] !== null).sort((a, b) => b[`${period}Gain`] - a[`${period}Gain`] || b.stars - a.stars || a.id - b.id);
    rankingModes[period] = measured.length ? `${period}_gain` : `trending_${period}`;
    rankings[period] = measured.length ? measured.map(repo => repo.id) : names.map(name => byName.get(name.toLowerCase())?.id).filter(Boolean);
    if (!measured.length && !byName.has(names[0].toLowerCase())) warnings.push({ code: 'leader_unavailable', params: { period } });
  }
  if (repos.some(repo => repo.dailyGain === null || repo.weeklyGain === null)) warnings.push({ code: 'growth_unavailable' });
  const feed = validateFeed({ schemaVersion: 1, date, generatedAt, repos, rankings, rankingModes, warnings }, { now: clock() });
  return { feed, snapshots };
}

async function atomic(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temporary, `${JSON.stringify(content, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' }); await fs.rename(temporary, file); }
  finally { await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}
export async function runCli(args = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    if (!['--output', '--snapshots'].includes(args[index]) || !args[index + 1] || args[index + 1].startsWith('--') || options[args[index]]) throw new Error('Usage: node scripts/collect-feed.mjs --output <public-feed-path> --snapshots <public-snapshots-path>');
    options[args[index]] = path.resolve(args[index + 1]);
  }
  if (!options['--output'] || !options['--snapshots'] || options['--output'] === options['--snapshots']) throw new Error('Distinct --output and --snapshots paths are required');
  let previousSnapshots = [];
  try { previousSnapshots = JSON.parse(await fs.readFile(options['--snapshots'], 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const { feed, snapshots } = await collectFeed({ previousSnapshots });
  // Collect and validate everything before touching either public artifact. Feed is committed last.
  await atomic(options['--snapshots'], snapshots);
  await atomic(options['--output'], feed);
  return { feed, snapshots };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runCli().catch(error => { console.error(error.message); process.exitCode = 1; });
}
