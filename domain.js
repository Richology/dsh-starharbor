const LABELS = Object.freeze({ ai: '人工智能', devtools: '开发工具', automation: '自动化', data: '数据与存储', infrastructure: '基础设施', web: '前端与 Web', apps: '应用软件', learning: '学习教程', resources: '资源合集', general: '综合项目' });
export const CATEGORY_IDS = Object.freeze(Object.keys(LABELS));
export const SOURCE_CODES = Object.freeze(['daily_gain', 'weekly_gain', 'trending_daily', 'trending_weekly', 'classic']);
const legacyCategories = { '人工智能': 'ai', '开发工具': 'devtools', '自动化': 'automation', '数据与存储': 'data', '基础设施': 'infrastructure', '前端与 Web': 'web', '应用软件': 'apps', '学习与资源': 'learning', '学习教程': 'learning', '资源合集': 'resources', '综合项目': 'general' };
export const categoryLabel = id => LABELS[id] || LABELS.general;

const securityPurpose = /\b(bug[\s-]+hunting|red[\s-]+team)\b/;
const webPurpose = /\b(design[\s-]+systems?|component[\s-]+librar(?:y|ies)|ui[\s-]+frameworks?)\b|设计系统|组件库|界面框架/;
function categoryText(repo) {
  const name = String(repo.name || repo.full_name || '').split('/').at(-1);
  return `${name} ${repo.description || ''} ${(repo.topics || []).join(' ')}`.toLowerCase();
}
// Match the repository's purpose, never its implementation language or incidental README text.
export function classifyCategory(repo) {
  const text = categoryText(repo);
  if (/\b(awesome|curated[\s-]+(?:list|collection|resources?)|resource[s]?|collection|collective.list|free.apis)\b|public-apis|资源合集|资源清单/.test(text)) return 'resources';
  if (/\b(learn|tutorial[s]?|course[s]?|book[s]?|interview|education|handbook)\b|build.your.own|master.programming|教程|课程|学习资料/.test(text)) return 'learning';
  if (/\b(automation|automate|workflow|scraper|scraping|rpa|browser.automation)\b|自动化|工作流/.test(text)) return 'automation';
  if (securityPurpose.test(text) || /\b(editor|terminal|cli|developer.tool[s]?|devtools|ide|debugger|compiler|linter|formatter|package.manager)\b|review.code|code.review|reverse.engineer|coding.agent|security.testing|开发工具|代码编辑器|逆向工程|代码审查|安全测试/.test(text)) return 'devtools';
  if (/\b(database|sql|redis|storage|postgres|postgresql|sqlite)\b|数据库|数据存储/.test(text)) return 'data';
  if (/\b(devops|docker|kubernetes|container|deployment|terraform|infrastructure)\b|基础设施|容器部署/.test(text)) return 'infrastructure';
  if (webPurpose.test(text) || /\b(react|vue|frontend|css|html|web.framework|nextjs|svelte)\b|前端|网页框架/.test(text)) return 'web';
  if (/\b(llm|ai|agent[s]?|claude|machine.learning|deep.learning|gpt|transformer[s]?|diffusion)\b|人工智能|大语言模型/.test(text)) return 'ai';
  if (/\b(application|desktop.app|note.taking|password.manager|music.player|messaging|email.client)\b|桌面应用|笔记应用|密码管理|音乐播放/.test(text)) return 'apps';
  return 'general';
}
export function sourceCode(text = '') {
  if (/^昨日净增/.test(text)) return 'daily_gain';
  if (/^近7日净增/.test(text)) return 'weekly_gain';
  if (/^Trending 近1日/.test(text)) return 'trending_daily';
  if (/^Trending 近7日/.test(text)) return 'trending_weekly';
  if (/^经典高星/.test(text)) return 'classic';
  return null;
}
export function projectRepo(repo) {
  if (!repo) return repo;
  const inferred = classifyCategory(repo);
  // Correct only the verified AI/agent-ready design-system misclassification in the returned view.
  const correctedWebPurpose = repo.categoryId === 'ai' && inferred === 'web' && webPurpose.test(categoryText(repo));
  const correctedSecurityPurpose = repo.categoryId === 'resources' && inferred === 'devtools' && securityPurpose.test(categoryText(repo));
  const categoryId = correctedWebPurpose ? 'web' : correctedSecurityPurpose ? 'devtools' : CATEGORY_IDS.includes(repo.categoryId) ? repo.categoryId : inferred !== 'general' ? inferred : legacyCategories[repo.category] || 'general';
  const code = SOURCE_CODES.includes(repo.sourceCode) ? repo.sourceCode : sourceCode(repo.source);
  const summaryZh = typeof repo.summaryZh === 'string' && repo.summaryZh.trim() ? repo.summaryZh : /[\u4e00-\u9fff]/.test(repo.summary || '') && /translated|enriched/.test(repo.summarySource || '') ? repo.summary.split(/[\r\n]/, 1)[0].trim() : '';
  return { ...repo, categoryId, language: repo.language || repo.category?.match(/^编程语言 · (.+)$/)?.[1] || null, summaryZh,
    sourceCode: code, reasonCode: SOURCE_CODES.includes(repo.reasonCode) ? repo.reasonCode : code };
}
export function warningDetail(message) {
  if (message === 'GitHub 搜索结果不完整，仅依据已返回的真实仓库推荐。') return { code: 'search_incomplete' };
  if (message.startsWith('Trending 展示近1日/近7日趋势；')) return { code: 'growth_unavailable' };
  if (message === '采集存在失败，保留此前推荐，未更换榜单。') return { code: 'previous_board_retained' };
  const budget = message.match(/最多额外查询(\d+)个 Trending/);
  if (budget) return { code: 'metadata_budget', params: { limit: Number(budget[1]) } };
  const shortage = message.match(/本次仅有 (\d+)\/(\d+) 个/);
  if (shortage) return { code: 'recommendation_shortage', params: { count: Number(shortage[1]), target: Number(shortage[2]) } };
  if (message.startsWith('近1日真实榜首元数据不可用')) return { code: 'leader_unavailable', params: { period: 'daily' } };
  if (message.startsWith('近7日真实榜首元数据不可用')) return { code: 'leader_unavailable', params: { period: 'weekly' } };
  return { code: 'legacy', params: { message } };
}
export function projectBoard(board) {
  if (!board) return board;
  return { ...board, repos: (board.repos || []).map(projectRepo), warnings: board.warnings || [],
    warningDetails: board.warningDetails || (board.warnings || []).map(warningDetail),
    ...(board.leaders ? { leaders: Object.fromEntries(Object.entries(board.leaders).map(([key, leader]) => [key, { ...leader, labelCode: leader.labelCode || sourceCode(leader.label), repo: projectRepo(leader.repo) }])) } : {}) };
}
