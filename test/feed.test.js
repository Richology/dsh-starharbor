import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFeed, selectFeedBoard } from '../feed.js';

const at = '2026-11-18T02:00:00.000Z';
function repo(id, description = 'terminal editor') {
  return { id, name: `owner/repo-${id}`, description, stars: 100000 - id, categoryId: 'ai', language: 'JavaScript', pushedAt: null, observedAt: at, dailyGain: null, weeklyGain: null, dailyInterval: null, weeklyInterval: null };
}
function fixture() {
  return { schemaVersion: 1, date: '2026-11-18', generatedAt: at, repos: [repo(1), repo(2), repo(3), repo(4, 'database'), repo(5, 'design system'), repo(6), repo(7)], rankings: { daily: [1, 2], weekly: [1, 2, 3], classic: [1, 2, 3, 4, 5, 6, 7] }, rankingModes: { daily: 'trending_daily', weekly: 'trending_weekly' }, warnings: [] };
}

test('normalizes safe URLs, drops arbitrary fields and classifies controlled categories', () => {
  const feed = fixture();
  feed.repos[0].url = 'javascript:alert(1)';
  feed.repos[0].html = '<script>alert(1)</script>';
  const parsed = validateFeed(feed, { now: at });
  assert.equal(parsed.repos[0].url, 'https://github.com/owner/repo-1');
  assert.equal(parsed.repos[0].categoryId, 'devtools');
  assert.equal(parsed.repos[0].html, undefined);
  feed.repos[0].name = 'owner/repo?x=javascript:alert(1)';
  assert.throws(() => validateFeed(feed, { now: at }), /owner\/repo/);
});

test('rejects malformed fields, duplicates, invalid relations, dates, oversized feeds and future data', () => {
  const mutations = [
    feed => { feed.schemaVersion = 2; },
    feed => { feed.repos[0].id = 0; },
    feed => { feed.repos[0].stars = -1; },
    feed => { feed.repos[0].stars = 1.5; },
    feed => { feed.repos[1].id = 1; },
    feed => { feed.repos[1].name = 'OWNER/REPO-1'; },
    feed => { feed.rankings.daily = [999]; },
    feed => { feed.rankings.daily = [1, 1]; },
    feed => { feed.rankingModes.daily = 'daily_gain'; },
    feed => { feed.generatedAt = '2026-11-18T02:05:01Z'; },
    feed => { feed.repos[0].observedAt = '2026-11-18T02:05:01Z'; },
    feed => { feed.repos[0].pushedAt = '2026-02-30T00:00:00Z'; },
    feed => { feed.date = '2026-11-17'; },
    feed => { feed.repos[0].dailyGain = 2; },
    feed => { feed.repos[0].language = {}; },
    feed => { feed.repos[0].description = 'a'.repeat(10001); },
    feed => { feed.warnings = [{ code: 'unsafe', params: { html: {} } }]; },
    feed => { feed.repos = Array.from({ length: 1001 }, (_, i) => repo(i + 1)); }
  ];
  for (const mutate of mutations) { const feed = fixture(); mutate(feed); assert.throws(() => validateFeed(feed, { now: at })); }
  const boundary = fixture(); boundary.generatedAt = '2026-11-18T02:05:00Z';
  assert.doesNotThrow(() => validateFeed(boundary, { now: at }));
});

test('local filtering honors saved exclusion, cooldown, thresholds, dedup and classic diversity', () => {
  const feed = fixture();
  const board = selectFeedBoard(feed, { now: at, saved: [{ id: 1 }], history: [{ date: '2026-10-20', repos: [{ id: 3 }] }], settings: { dailyMin: 5000, weeklyMin: 10000, classicMin: 30000, preferredMin: 50000, cooldownDays: 30 } });
  assert.deepEqual(board.repos.map(item => item.id), [2, 4, 5, 6]);
  assert.equal(board.repos[0].sourceCode, 'trending_daily');
  assert.equal(board.repos[1].sourceCode, 'classic');
  assert.equal(new Set(board.repos.map(item => item.id)).size, board.repos.length);
  assert.equal(board.leaders.daily.repo.id, 1); // True source leader stays honest even if saved locally.
  assert.equal(board.repos[0].dailyGain, null);
  assert.ok(board.warningDetails.some(item => item.code === 'growth_unavailable'));
  assert.ok(board.warningDetails.some(item => item.code === 'recommendation_shortage'));
  assert.equal(feed.repos[0].url, undefined);
});

test('30-day boundary is eligible; old feed retains its date and local generation time', () => {
  const feed = fixture();
  const now = '2026-11-19T02:00:00Z';
  const board = selectFeedBoard(feed, { now, history: [{ date: '2026-10-19', repos: [{ id: 1 }] }] });
  assert.equal(board.date, '2026-11-18');
  assert.equal(board.generatedAt, '2026-11-19T02:00:00.000Z');
  assert.equal(board.feedGeneratedAt, at);
  assert.equal(board.repos[0].id, 1);
  assert.equal(board.repos[1].id, 2);
  assert.equal(board.repos.length, 5);
});

test('missing leader is unknown instead of promoting next available trending candidate', () => {
  const feed = fixture();
  feed.warnings = [{ code: 'leader_unavailable', params: { period: 'daily' } }];
  const board = selectFeedBoard(feed, { now: at });
  assert.equal(board.leaders.daily.repo, null);
  assert.equal(board.repos[0].id, 1);
});

test('measured growth requires correct intervals and descending rank order', () => {
  const feed = fixture();
  for (const item of feed.repos.slice(0, 2)) {
    item.dailyGain = 100 - item.id;
    item.dailyInterval = { start: '2026-11-17T00:00:00+08:00', end: '2026-11-18T00:00:00+08:00' };
  }
  feed.rankingModes.daily = 'daily_gain';
  assert.equal(selectFeedBoard(feed, { now: at }).repos[0].sourceCode, 'daily_gain');
  feed.rankings.daily.reverse();
  assert.throws(() => validateFeed(feed, { now: at }), /unsorted/);
  feed.rankings.daily.reverse();
  feed.repos[0].dailyInterval.start = '2026-11-17T00:01:00+08:00';
  assert.throws(() => validateFeed(feed, { now: at }), /calendar days/);
});
