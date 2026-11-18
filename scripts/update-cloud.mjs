import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { collectFeed } from './collect-feed.mjs';
import { validateFeed, validRepoName } from '../feed.js';

const MAX_BYTES = 10000000;
const BRANCH = 'data';
const sha = value => {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/i.test(value)) throw new Error('Invalid publisher Git object SHA');
  return value;
};
function decodePublicFile(file) {
  if (!file || file.encoding !== 'base64' || typeof file.content !== 'string' || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_BYTES || file.content.length > Math.ceil(MAX_BYTES / 3) * 4 + 300000) throw new Error('Invalid stored public snapshots');
  const encoded = file.content.replace(/[\r\n]/g, '');
  if (encoded.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw new Error('Invalid stored snapshots base64');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length !== file.size || bytes.length > MAX_BYTES) throw new Error('Invalid stored snapshots size');
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
function publicSnapshots(value) {
  if (!Array.isArray(value) || value.length > 35) throw new Error('Public snapshots must be an array of at most 35 days');
  const dates = new Set();
  return value.map(raw => {
    if (!raw || typeof raw !== 'object' || typeof raw.date !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(raw.date) || !Number.isFinite(Date.parse(`${raw.date}T00:00:00Z`)) || new Date(`${raw.date}T00:00:00Z`).toISOString().slice(0, 10) !== raw.date || dates.has(raw.date)) throw new Error('Invalid public snapshot date');
    dates.add(raw.date);
    if (!raw.stars || typeof raw.stars !== 'object' || Array.isArray(raw.stars) || !raw.observedAtByRepo || typeof raw.observedAtByRepo !== 'object' || Array.isArray(raw.observedAtByRepo) || Object.keys(raw.stars).length > 1000) throw new Error('Invalid public snapshot observations');
    const stars = {};
    const observedAtByRepo = {};
    for (const [id, count] of Object.entries(raw.stars)) {
      const at = raw.observedAtByRepo[id];
      if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || !Number.isSafeInteger(count) || count < 0 || typeof at !== 'string' || !Number.isFinite(Date.parse(at)) || Math.abs(Date.parse(at) - Date.parse(`${raw.date}T00:00:00+08:00`)) > 300000) throw new Error('Invalid public snapshot observation');
      stars[id] = count; observedAtByRepo[id] = new Date(at).toISOString();
    }
    return { date: raw.date, stars, observedAtByRepo };
  });
}

/** Publish public candidates to the independent data branch. Never reads a local DSH profile. */
export async function publish({ fetchImpl = fetch, collect = collectFeed, repository = process.env.GITHUB_REPOSITORY || 'Richology/dsh-starharbor', token = process.env.GITHUB_TOKEN, now = () => new Date() } = {}) {
  if (typeof token !== 'string' || !token.trim()) throw new Error('GITHUB_TOKEN is required for the publisher job');
  if (!validRepoName(repository)) throw new Error('Invalid publisher repository');
  const base = `https://api.github.com/repos/${repository}`;
  async function api(route, { method = 'GET', body, allowMissing = false } = {}) {
    const response = await fetchImpl(`${base}${route}`, {
      method, signal: AbortSignal.timeout(30000), redirect: 'error',
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'StarHarbor-publisher', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) throw new Error(`Publisher API ${method} ${route}: HTTP ${response.status}`);
    return response.json();
  }
  const reference = await api(`/git/ref/heads/${BRANCH}`, { allowMissing: true });
  const parent = reference ? sha(reference.object?.sha) : null;
  let snapshots = [];
  if (parent) {
    let stored = await api(`/contents/snapshots.json?ref=${parent}`);
    if (!stored || !Number.isSafeInteger(stored.size) || stored.size < 0 || stored.size > MAX_BYTES) throw new Error('Invalid stored public snapshots size');
    // Contents omits inline content for files over 1 MB. Follow only its Git SHA,
    // through this repository's Git API; never follow an arbitrary download URL.
    if (stored.encoding === 'none' && (stored.content === '' || stored.content === undefined)) {
      const expectedSize = stored.size;
      stored = await api(`/git/blobs/${sha(stored.sha)}`);
      if (stored.size !== expectedSize) throw new Error('Stored public snapshot blob size mismatch');
    }
    snapshots = publicSnapshots(JSON.parse(decodePublicFile(stored)));
  }
  const result = await collect({ previousSnapshots: snapshots, token, fetchImpl, now });
  const feed = validateFeed(result.feed, { now: now() });
  const publishedSnapshots = publicSnapshots(result.snapshots);
  const files = [
    { path: 'latest.json', content: JSON.stringify(feed) + '\n' },
    { path: 'snapshots.json', content: JSON.stringify(publishedSnapshots) + '\n' },
    { path: 'README.md', content: '# StarHarbor public candidate data\n\nGenerated by the source repository GitHub Actions workflow. Contains public repository observations only; no user collections, preferences, or recommendation histories.\n\nSource: https://github.com/' + repository + '\n' },
  ];
  if (files.some(file => Buffer.byteLength(file.content, 'utf8') > MAX_BYTES)) throw new Error('Public artifact exceeds 10 MB limit');
  // All collection and validation finishes before any remote write. Omitting
  // base_tree produces exactly these three files, including on later updates.
  const tree = await api('/git/trees', { method: 'POST', body: { tree: files.map(file => ({ ...file, mode: '100644', type: 'blob' })) } });
  const treeSha = sha(tree.sha);
  const commit = await api('/git/commits', { method: 'POST', body: { message: `Update public candidates ${feed.generatedAt}`, tree: treeSha, parents: parent ? [parent] : [] } });
  const commitSha = sha(commit.sha);
  if (parent) await api(`/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: { sha: commitSha, force: false } });
  else await api('/git/refs', { method: 'POST', body: { ref: `refs/heads/${BRANCH}`, sha: commitSha } });
  return { generatedAt: feed.generatedAt, candidates: feed.repos.length, commit: commitSha, url: `https://raw.githubusercontent.com/${repository}/${BRANCH}/latest.json` };
}

// URL comparison works on Node 22, including versions without import.meta.main.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  publish().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
