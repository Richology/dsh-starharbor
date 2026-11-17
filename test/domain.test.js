import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORY_IDS, classifyCategory, projectRepo, projectBoard } from '../domain.js';

test('purpose categories prefer resources, education and tools over incidental AI technologies', () => {
  const cases = [
    ['awesome-llm', 'Curated AI resources', 'resources'],
    ['ai-course', 'A tutorial course about AI', 'learning'],
    ['browser-bot', 'AI browser automation workflow', 'automation'],
    ['agent-cli', 'An AI CLI for developers', 'devtools'],
    ['database', 'SQL storage implemented in TypeScript', 'data'],
    ['deploy', 'Docker deployment', 'infrastructure'],
    ['components', 'React frontend components', 'web'],
    ['brain', 'AI machine learning models', 'ai'],
    ['notes', 'A note taking application', 'apps'],
    ['misc', 'Systems software', 'general'],
  ];
  assert.equal(CATEGORY_IDS.length, 10);
  for (const [name, description, expected] of cases) assert.equal(classifyCategory({ name: `ai/${name}`, description, language: 'Rust' }), expected, name);
  assert.equal(classifyCategory({ name: 'ai/project', language: 'Python', readmeExcerpt: 'AI database course' }), 'general');
});

test('real recommendation descriptions classify by their documented purpose', () => {
  const fixtures = [
    ['public-apis/public-apis', 'A collective list of free APIs', 'resources'],
    ['backnotprop/plannotator', 'The workspace to stay in the loop and on top of agents - shape, decide, plan, annotate, review code, share with team, and send all feedback to agents with one click.', 'devtools'],
    ['codecrafters-io/build-your-own-x', 'Master programming by recreating your favorite technologies from scratch.', 'learning'],
    ['example/rea', 'Reverse engineer anything with agents, from app behavior down to native binaries.', 'devtools'],
  ];
  for (const [name, description, categoryId] of fixtures) assert.equal(classifyCategory({ name, description }), categoryId, name);
});

test('design systems, component libraries and UI frameworks retain web purpose when agent ready', () => {
  const fixtures = [
    { name: 'meta/astryx', description: "An open source design system that's fully customizable and agent ready", language: 'TypeScript' },
    { name: 'demo/components', description: 'An agent ready component library' },
    { name: 'demo/ui', description: 'A UI framework with AI integration' },
    { name: 'demo/interface', description: 'Agent-ready design-system and component-libraries' },
    { name: 'demo/chinese', description: '支持 AI 的设计系统与组件库' },
  ];
  for (const fixture of fixtures) assert.equal(classifyCategory(fixture), 'web', fixture.name);
  // Design and system alone do not establish a design-system purpose.
  assert.equal(classifyCategory({ name: 'demo/design', description: 'An AI system for product design' }), 'ai');
});

test('read-time projection corrects only stored AI IDs with an explicit web purpose', () => {
  const stored = { id: 7, name: 'meta/astryx', description: "An open source design system that's fully customizable and agent ready", language: 'TypeScript', categoryId: 'ai', category: '人工智能' };
  const before = structuredClone(stored);
  const projected = projectRepo(stored);
  assert.equal(projected.categoryId, 'web');
  assert.equal(projected.category, '人工智能');
  assert.deepEqual(stored, before);
  for (const categoryId of CATEGORY_IDS.filter(id => id !== 'ai')) assert.equal(projectRepo({ ...stored, categoryId }).categoryId, categoryId);
  assert.equal(projectRepo({ ...stored, description: 'A React frontend with AI integration' }).categoryId, 'ai');
  assert.equal(projectRepo({ ...stored, description: 'An AI system for product design' }).categoryId, 'ai');
  const board = { date: '2026-11-18', generatedAt: '2026-11-17T16:01:00.000Z', repos: [stored, { id: 8, name: 'demo/other', categoryId: 'general' }], warnings: [] };
  const beforeBoard = structuredClone(board);
  const view = projectBoard(board);
  assert.equal(view.repos[0].categoryId, 'web');
  assert.deepEqual(view.repos.map(repo => repo.id), [7, 8]);
  assert.equal(view.date, board.date);
  assert.equal(view.generatedAt, board.generatedAt);
  assert.deepEqual(board, beforeBoard);
});

test('old records preserve category and summary while projecting stable IDs and translation fallback', () => {
  const original = { id: 1, name: 'demo/tool', description: 'A terminal CLI', category: '我的工具', source: 'Trending 近1日', reason: '旧推荐理由', summary: '已翻译的简介', summarySource: 'translated' };
  const projected = projectRepo(original);
  assert.equal(projected.categoryId, 'devtools');
  assert.equal(projected.category, '我的工具');
  assert.equal(projected.sourceCode, 'trending_daily');
  assert.equal(projected.reasonCode, 'trending_daily');
  assert.equal(projected.summaryZh, original.summary);
  assert.equal(original.categoryId, undefined);
  const oldReadmeSummary = projectRepo({ ...original, summary: '仓库描述的译文。\n赞助横幅：购买托管服务。', summarySource: 'GitHub description + README excerpt · translated' });
  assert.equal(oldReadmeSummary.summaryZh, '仓库描述的译文。');
  assert.equal(oldReadmeSummary.summary, '仓库描述的译文。\n赞助横幅：购买托管服务。');
  assert.equal(projectRepo({ ...original, summaryZh: '明确的新摘要。\n保留第二行。' }).summaryZh, '明确的新摘要。\n保留第二行。');
  const language = projectRepo({ name: 'demo/misc', category: '编程语言 · Rust' });
  assert.equal(language.categoryId, 'general');
  assert.equal(language.language, 'Rust');
  assert.equal(projectRepo({ category: '人工智能', categoryId: 'invalid' }).categoryId, 'ai');
});

test('old boards project known warning codes and preserve unknown messages without inventing translations', () => {
  const projected = projectBoard({ repos: [], warnings: ['本次仅有 2/5 个符合星数条件的真实项目。', '用户旧警告'], leaders: { daily: { label: '昨日净增榜首（已观测候选，上海完整自然日）', repo: null } } });
  assert.deepEqual(projected.warningDetails, [{ code: 'recommendation_shortage', params: { count: 2, target: 5 } }, { code: 'legacy', params: { message: '用户旧警告' } }]);
  assert.equal(projected.leaders.daily.labelCode, 'daily_gain');
});
