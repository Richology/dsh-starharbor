window.__ModuleLoader__.load({
  id: 'dsh-starharbor',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const dictionaries = {
      zh: { title: 'StarHarbor 星港', subtitle: '每天最多 5 个值得收藏的 GitHub 项目', today: '今日推荐', history: '往日发现', saved: '已收藏', settings: '推荐设置', refresh: '更新数据', busy: '正在处理…', save: '收藏到 Markdown', collected: '已收藏', empty: '还没有推荐，点击「更新数据」开始发现。', noSaved: '看到感兴趣的项目时，点击卡片上的收藏按钮。', stars: '累计 Star', daily: '昨日净增', weekly: '近 7 日净增', unknown: '未积累完整数据', original: '仓库原始简介', observed: '数据时间', source: '来源', leaders: '候选榜首', boundary: '榜单来自已采集候选，非全 GitHub 排名。Trending 是趋势来源；完整自然日快照积累前，不显示昨日或周净增长。', collection: '收藏保存位置', configNote: '每天按北京时间生成。DSH 关闭时暂停采集；重新打开后补当日推荐。更新门槛从下一次生成开始生效。', dailyMin: '日趋势最低 Star', weeklyMin: '周趋势最低 Star', classicMin: '经典项目最低 Star', preferredMin: '经典项目优先 Star', cooldownDays: '重复推荐间隔（天）', hour: '每日生成时间（北京时间 / 小时）', submit: '保存设置', done: '设置已保存', read: '在 GitHub 查看 ↗', count: '个项目', latest: '今日', more: '排名与数据说明', noHistory: '每日推荐将自动留在这里。', savedNotice: '已写入收藏文件', loading: '正在读取星港…', inactive: '最近一年未更新', error: '操作失败', archive: '发现记录', generated: '生成时间', observing: '正在积累涨星数据', observingNote: '当前结合 Trending 与累计 Star 推荐；完整观测后展示净增。' },
      en: { title: 'StarHarbor', subtitle: 'Up to five GitHub projects worth keeping, every day', today: 'Today', history: 'History', saved: 'Collection', settings: 'Settings', refresh: 'Refresh data', busy: 'Working…', save: 'Save to Markdown', collected: 'Saved', empty: 'No discoveries yet. Refresh data to get started.', noSaved: 'Save a project from its discovery card to start your collection.', stars: 'Total stars', daily: 'Yesterday’s net gain', weekly: '7-day net gain', unknown: 'Incomplete history', original: 'Original description', observed: 'Observed', source: 'Source', leaders: 'Candidate leaders', boundary: 'Rankings cover observed candidates, not all GitHub. Trending is a discovery source; calendar-day gains require complete boundary snapshots.', collection: 'Collection file', configNote: 'Generated daily in Asia/Shanghai. Collection pauses when DSH is closed; the next launch catches up today’s picks. New thresholds apply to the next selection.', dailyMin: 'Daily minimum stars', weeklyMin: 'Weekly minimum stars', classicMin: 'Classic minimum stars', preferredMin: 'Classic preferred stars', cooldownDays: 'Recommendation cooldown (days)', hour: 'Generation hour (Asia/Shanghai)', submit: 'Save settings', done: 'Settings saved', read: 'View on GitHub ↗', count: 'projects', latest: 'Today', more: 'Ranking methodology', noHistory: 'Daily discoveries will appear here.', savedNotice: 'Written to collection', loading: 'Loading StarHarbor…', inactive: 'No updates in a year', error: 'Action failed', archive: 'Discovery archive', generated: 'Generated', observing: 'Building growth history', observingNote: 'Picks currently combine Trending and total stars. Net gains appear after complete observations.' },
    };
    Object.assign(dictionaries.zh, {
      lastCollectionFailed: '上次采集未完成', retryingPrevious: '正在重试，暂时展示上次推荐。', previousAvailable: '此前推荐仍可查看。', validationCount: '有 {count} 项需要修正', saving: '正在收藏…', savedRepo: '已收藏 {name}', diagnostics: '原始诊断', fallback: '原文', noDescription: '仓库未提供简介。',
      copy: '复制路径', copied: '收藏文件路径已复制', copyFailed: '复制失败，请选中路径并手动复制。', pathUnavailable: '收藏文件路径暂不可用。',
      search: '搜索收藏', searchPlaceholder: '仓库名称或简介', categoryFilter: '按分类筛选', allCategories: '全部分类', noMatches: '没有匹配的收藏。', clearFilters: '清空筛选',
      unsaved: '有未保存的更改', unchanged: '设置未更改', settingsSaving: '正在保存设置…', validationRange: '请输入 {min} 到 {max} 之间的整数。', validationPreferred: '优先门槛不能低于经典项目最低门槛。',
      category_ai: '人工智能', category_devtools: '开发工具', category_automation: '自动化', category_data: '数据与存储', category_infrastructure: '基础设施', category_web: '前端与 Web', category_apps: '应用软件', category_learning: '学习教程', category_resources: '资源合集', category_general: '综合项目',
      source_daily_gain: '昨日净增', source_weekly_gain: '近 7 日净增', source_trending_daily: 'Trending 日趋势', source_trending_weekly: 'Trending 周趋势', source_classic: '经典高星', source_unknown: '推荐候选',
      reason_daily_gain: '按已观测候选的昨日净增选入。', reason_weekly_gain: '按已观测候选的近 7 日净增选入。', reason_trending_daily: '来自 GitHub Trending 日趋势候选。', reason_trending_weekly: '来自 GitHub Trending 周趋势候选。', reason_classic: '按经典项目累计 Star 门槛选入。', reason_unknown: '根据当前候选与推荐设置选入。',
      leader_daily_gain: '昨日净增榜首', leader_weekly_gain: '近 7 日净增榜首', leader_trending_daily: 'Trending 日趋势榜首', leader_trending_weekly: 'Trending 周趋势榜首', leader_classic: '经典高星榜首', leader_unknown: '候选榜首',
      warning_source_failed: '部分来源采集失败，本次结果可能不完整。', warning_search_incomplete: 'GitHub 搜索返回不完整，仅使用已返回的真实仓库。', warning_metadata_budget: '已达到 Trending 元数据补充查询上限（{limit}）。', warning_leader_daily: '日趋势榜首元数据暂不可用。', warning_leader_weekly: '周趋势榜首元数据暂不可用。', warning_recommendation_shortage: '当前可推荐 {count} 个项目，目标最多 {target} 个。', warning_growth_unavailable: '完整观测尚未积累，暂不展示净增数据。', warning_previous_board_retained: '采集未完成，保留此前推荐。', warning_readme_failed: '未能读取 {repo} 的 README。', warning_enrichment_failed: '未能补充 {repo} 的简介翻译。', warning_legacy: '本次采集有补充诊断信息。',
      warning_refresh_timeout: '采集已达到时间预算，部分数据暂不可用。', error_refresh_timeout: '采集超时，可稍后重试。', error_invalid_request: '请求无效，请重试。', error_access_denied: '此操作未获授权，请检查访问权限。',
      source_repository: '仓库元数据', source_refresh: '数据刷新',
      error_invalid_settings: '设置不符合要求，请检查输入。', error_invalid_id: '仓库标识无效，请更新数据后重试。', error_not_recommended: '此仓库当前不可收藏，请更新推荐后重试。', error_request_failed: '请求未完成，请重试。', error_http_error: '服务请求失败，请重试。', error_collection_failed: '采集失败，可稍后重试。', retry: '重试读取', retryAt: '可在 {time} 后重试。',
    });
    Object.assign(dictionaries.en, {
      lastCollectionFailed: 'The last collection did not complete', retryingPrevious: 'Retrying now; previous recommendations remain available.', previousAvailable: 'Previous recommendations remain available.', validationCount: '{count} fields need attention', saving: 'Saving…', savedRepo: 'Saved {name}', diagnostics: 'Diagnostics (original)', fallback: 'Original text', noDescription: 'No repository description available.',
      copy: 'Copy path', copied: 'Collection file path copied', copyFailed: 'Copy failed. Select the path and copy it manually.', pathUnavailable: 'Collection file path is unavailable.',
      search: 'Search collection', searchPlaceholder: 'Repository name or description', categoryFilter: 'Filter by category', allCategories: 'All categories', noMatches: 'No saved projects match your filters.', clearFilters: 'Clear filters',
      unsaved: 'Unsaved changes', unchanged: 'No changes to save', settingsSaving: 'Saving settings…', validationRange: 'Enter an integer from {min} to {max}.', validationPreferred: 'Preferred stars must be at least the classic minimum.',
      category_ai: 'Artificial intelligence', category_devtools: 'Developer tools', category_automation: 'Automation', category_data: 'Data and storage', category_infrastructure: 'Infrastructure', category_web: 'Frontend and web', category_apps: 'Applications', category_learning: 'Learning', category_resources: 'Resources', category_general: 'General',
      source_daily_gain: 'Daily net gain', source_weekly_gain: '7-day net gain', source_trending_daily: 'Trending daily', source_trending_weekly: 'Trending weekly', source_classic: 'Classic high stars', source_unknown: 'Recommended candidate',
      reason_daily_gain: 'Selected by yesterday’s net gain among observed candidates.', reason_weekly_gain: 'Selected by 7-day net gain among observed candidates.', reason_trending_daily: 'Discovered through GitHub Trending daily.', reason_trending_weekly: 'Discovered through GitHub Trending weekly.', reason_classic: 'Selected using classic project star thresholds.', reason_unknown: 'Selected from current candidates using recommendation settings.',
      leader_daily_gain: 'Daily net gain leader', leader_weekly_gain: '7-day net gain leader', leader_trending_daily: 'Trending daily leader', leader_trending_weekly: 'Trending weekly leader', leader_classic: 'Classic high-star leader', leader_unknown: 'Candidate leader',
      warning_source_failed: 'Some sources could not be collected. Results may be incomplete.', warning_search_incomplete: 'GitHub search returned incomplete results. Only returned repositories are used.', warning_metadata_budget: 'The Trending metadata lookup limit ({limit}) was reached.', warning_leader_daily: 'Daily trend leader metadata is unavailable.', warning_leader_weekly: 'Weekly trend leader metadata is unavailable.', warning_recommendation_shortage: '{count} projects are available, with a target of up to {target}.', warning_growth_unavailable: 'Net gains are unavailable until complete observations accumulate.', warning_previous_board_retained: 'Collection did not complete. Previous recommendations were retained.', warning_readme_failed: 'Could not read the README for {repo}.', warning_enrichment_failed: 'Could not translate the description for {repo}.', warning_legacy: 'Additional collection diagnostics are available.',
      warning_refresh_timeout: 'Collection reached its time budget. Some data is unavailable.', error_refresh_timeout: 'Collection timed out. You can retry later.', error_invalid_request: 'The request is invalid. Please retry.', error_access_denied: 'This action is not authorized. Check access permissions.',
      source_repository: 'Repository metadata', source_refresh: 'Data refresh',
      error_invalid_settings: 'Settings are invalid. Check the fields below.', error_invalid_id: 'The repository ID is invalid. Refresh data and try again.', error_not_recommended: 'This repository is not currently available to save. Refresh recommendations and try again.', error_request_failed: 'The request did not complete. Please retry.', error_http_error: 'The service request failed. Please retry.', error_collection_failed: 'Collection failed. You can retry later.', retry: 'Retry loading', retryAt: 'Try again after {time}.',
    });
    const categoryIds = ['ai', 'devtools', 'automation', 'data', 'infrastructure', 'web', 'apps', 'learning', 'resources', 'general'];
    const sourceCodes = ['daily_gain', 'weekly_gain', 'trending_daily', 'trending_weekly', 'classic'];
    const settingKeys = ['dailyMin', 'weeklyMin', 'classicMin', 'preferredMin', 'cooldownDays', 'hour'];
    const settingMax = key => key === 'hour' ? 23 : key === 'cooldownDays' ? 3650 : 1000000000;
    const settingsDraft = settings => Object.fromEntries(settingKeys.map(key => [key, settings?.[key] == null ? '' : String(settings[key])]));
    const css = `
.sh-page,.sh-page *{box-sizing:border-box}
.sh-page{height:100%;min-height:0;flex:1;overflow:auto;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-family:inherit;font-size:16px;line-height:1.65;padding:36px clamp(24px,3vw,64px) 56px}
.sh-wrap{max-width:1560px;margin:auto}
.sh-header{display:flex;gap:20px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:8px 0 26px}
.sh-brand{display:flex;align-items:center;gap:14px}
.sh-page h1{font-size:30px;letter-spacing:-.6px;margin:0;font-weight:650}
.sh-sub,.sh-muted{color:var(--dsw-alias-label-secondary)}
.sh-sub{font-size:14px;margin:5px 0 0}.sh-muted{font-size:14px}
.sh-btn,.sh-tab,.sh-input{font:inherit;color:inherit;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:9px;padding:9px 15px}
.sh-btn{font-size:14px;min-height:42px;cursor:pointer;white-space:nowrap}
.sh-btn:hover{border-color:var(--dsw-alias-brand-primary)}
.sh-btn:disabled{opacity:.55;cursor:default}
.sh-btn:focus-visible,.sh-tab:focus-visible,.sh-input:focus-visible,.sh-page a:focus-visible,.sh-page summary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px}
.sh-primary{background:color-mix(in srgb,var(--dsw-alias-label-primary) 14%,var(--dsw-alias-bg-layer-1));border-color:color-mix(in srgb,var(--dsw-alias-label-primary) 45%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);font-weight:600}
.sh-primary:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 22%,var(--dsw-alias-bg-layer-1));border-color:var(--dsw-alias-brand-primary)}
.sh-nav{display:flex;gap:10px;border-bottom:1px solid var(--dsw-alias-border-l1);padding-bottom:15px;margin-bottom:26px;flex-wrap:wrap}
.sh-tab{font-size:15px;padding:9px 16px;background:transparent;border-color:transparent;cursor:pointer}
.sh-tab[aria-selected=true]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary)}
.sh-sectionTitle{display:flex;align-items:baseline;justify-content:space-between;gap:14px;margin:20px 0 14px}
.sh-sectionTitle h2{font-size:20px;margin:0}
.sh-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}
.sh-card{min-width:0;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;padding:24px;background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;gap:14px}
.sh-card h3{font-size:24px;line-height:1.35;letter-spacing:-.3px;margin:0;overflow-wrap:anywhere;font-weight:650}
.sh-card a{color:var(--dsw-alias-label-primary);text-decoration:none}.sh-card h3 a:hover{text-decoration:underline;text-underline-offset:4px}
.sh-summary{font-size:16px;line-height:1.65;margin:0;max-width:85ch;overflow-wrap:anywhere}
.sh-badges{display:flex;align-items:center;flex-wrap:wrap;gap:10px}
.sh-badge{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-secondary)}
.sh-badge:first-child{font-weight:600;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);padding:3px 9px;border-radius:6px}
.sh-stats{display:flex;gap:24px;flex-wrap:wrap;align-items:center;margin-top:auto;padding-top:8px}
.sh-stat{display:flex;align-items:baseline;gap:10px}
.sh-number,.sh-gain{font-size:21px;line-height:1.3;font-weight:600;font-variant-numeric:tabular-nums}
.sh-foot{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;padding-top:16px;border-top:1px solid var(--dsw-alias-border-l1)}
.sh-foot a{font-size:14px;font-weight:500;padding:8px 0;text-decoration:underline;text-underline-offset:4px}
.sh-status{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;padding:14px 18px;margin:0 0 22px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);font-size:14px}
.sh-status strong{font-weight:600}.sh-status strong::before{content:'◷';margin-right:8px}
.sh-notice{padding:14px 18px;margin:0 0 18px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;font-size:14px}
.sh-error{color:var(--dsw-alias-state-error-primary)}.sh-success{color:var(--dsw-alias-state-success-primary)}
.sh-detail{font-size:14px;padding:16px 18px;margin-top:24px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;color:var(--dsw-alias-label-secondary)}
.sh-detail summary{cursor:pointer;color:var(--dsw-alias-label-primary)}.sh-detail p{max-width:90ch;overflow-wrap:anywhere}
.sh-form{display:grid;gap:22px;max-width:720px}.sh-form>p{font-size:15px;margin:0 0 4px;max-width:70ch}
.sh-field{display:grid;grid-template-columns:minmax(0,250px) minmax(96px,160px);align-items:center;column-gap:18px;row-gap:6px;font-size:15px}
.sh-input{font-size:16px;width:100%;min-width:0;font-variant-numeric:tabular-nums}
.sh-form>.sh-btn{justify-self:start;min-width:160px;margin-top:4px}
.sh-path{margin:22px 0 0;max-width:100%;overflow-wrap:anywhere;font-size:14px;color:var(--dsw-alias-label-secondary)}
.sh-path strong{display:block;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;margin-bottom:6px}
.sh-path code{font-size:13px;white-space:normal;overflow-wrap:anywhere}
.sh-history{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px}
.sh-empty{padding:36px 24px;border:1px dashed var(--dsw-alias-border-l2);border-radius:12px;font-size:15px;color:var(--dsw-alias-label-secondary)}
.sh-saved{color:var(--dsw-alias-state-success-primary);font-weight:600}.sh-btn.sh-saved:disabled{opacity:1}
.sh-fallback{font-size:12px;margin-right:8px;color:var(--dsw-alias-label-secondary)}
.sh-filters{display:flex;align-items:end;gap:14px;flex-wrap:wrap;margin-bottom:22px}.sh-filter{display:grid;gap:6px;font-size:14px;min-width:180px}.sh-filter:first-child{flex:1}
.sh-field-control{display:grid;gap:6px}.sh-field-error{grid-column:1/-1;font-size:14px;line-height:1.5;color:var(--dsw-alias-state-error-primary)}.sh-input[aria-invalid=true]{border-color:var(--dsw-alias-state-error-primary)}
.sh-diagnostics{font-size:13px;margin-top:10px}.sh-diagnostics summary{cursor:pointer}.sh-diagnostics pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;user-select:text}
.sh-path code{user-select:text;cursor:text}.sh-path .sh-btn{margin-top:10px;display:block}.sh-path-note{display:block;margin-top:8px}
.sh-tabpanel:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:4px}
@media(max-width:1100px){.sh-grid{grid-template-columns:1fr}.sh-wrap{max-width:840px}}
@media(max-width:700px){.sh-page{padding:22px 18px}.sh-page h1{font-size:25px}.sh-card{padding:20px}.sh-card h3{font-size:21px}.sh-status{gap:5px}.sh-foot{gap:12px}.sh-field{gap:14px}.sh-brand{gap:10px}}
`;
    function Icon({ size = 22 }) {
      return h('svg', { viewBox: '0 0 32 32', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true }, h('path', { d: 'm16 3 3.1 6.3 7 .9-5.1 5 1.2 6.9-6.2-3.3-6.2 3.3 1.2-6.9-5.1-5 7-.9Z' }), h('path', { d: 'M5 25c5 5 17 5 22 0' }));
    }
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        for (const [language, dictionary] of Object.entries(dictionaries)) ctx.effect(() => ctx.locale.register('starharbor', language, dictionary));
        const t = ctx.locale.bind('starharbor');
        function Page() {
          const localeSnapshot = React.useSyncExternalStore(fn => ctx.locale.subscribe(fn), () => ctx.locale.getSnapshot());
          const language = String(localeSnapshot?.active || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en';
          const t = (key, params = {}) => (dictionaries[language][key] || dictionaries.en[key] || key).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? '—'));
          const [state, setState] = React.useState(null);
          const [tab, setTab] = React.useState('today');
          const [date, setDate] = React.useState('');
          const [pendingCount, setPendingCount] = React.useState(0);
          const [pendingSaves, setPendingSaves] = React.useState(new Set());
          const [settingsSaving, setSettingsSaving] = React.useState(false);
          const [refreshing, setRefreshing] = React.useState(false);
          const [error, setError] = React.useState(null);
          const [notice, setNotice] = React.useState(null);
          const [draft, setDraft] = React.useState({});
          const [query, setQuery] = React.useState('');
          const [category, setCategory] = React.useState('');
          const [copyState, setCopyState] = React.useState('');
          const queue = React.useRef(Promise.resolve());
          const lifecycle = React.useRef(null);
          const saveIds = React.useRef(new Set());
          const initialized = React.useRef(false);
          const draftVersion = React.useRef(0);
          const tabRefs = React.useRef({});
          const instanceId = React.useId();
          const busy = pendingCount > 0;
          const isLive = life => life && !life.signal.aborted && lifecycle.current === life;

          // Serialize mutations so an older response cannot replace newer collection state.
          // Each queued card is marked immediately; settings drafts are never reset by refresh/save.
          function call(input, options = {}) {
            const life = lifecycle.current;
            if (!isLive(life) || (input.action === 'save' && saveIds.current.has(input.id))) return;
            const version = draftVersion.current;
            if (input.action === 'save') {
              saveIds.current.add(input.id);
              setPendingSaves(new Set(saveIds.current));
            }
            if (input.action === 'settings') setSettingsSaving(true);
            if (input.action === 'refresh') setRefreshing(true);
            setPendingCount(n => n + 1);
            setError(null); setNotice(null);
            const run = async () => {
              if (!isLive(life)) return;
              setError(null); setNotice(null);
              const controller = new AbortController();
              const abort = () => controller.abort();
              life.signal.addEventListener('abort', abort, { once: true });
              const timer = setTimeout(abort, 180000);
              try {
                const response = await fetch('/api/starharbor', options.initial ? {
                  signal: controller.signal, credentials: 'same-origin',
                } : {
                  method: 'POST', signal: controller.signal, credentials: 'same-origin',
                  headers: { 'Content-Type': 'application/json', 'X-StarHarbor': '1' }, body: JSON.stringify(input),
                });
                let result;
                try { result = await response.json(); }
                catch { throw { code: response.ok ? 'request_failed' : 'http_error', details: { httpStatus: response.status, message: 'Invalid JSON response' } }; }
                if (!response.ok || result?.error) throw {
                  code: result?.code || (response.ok ? 'request_failed' : 'http_error'),
                  details: result?.details, message: result?.error, httpStatus: response.status,
                };
                if (!result || typeof result !== 'object' || Array.isArray(result)) throw { code: 'request_failed', message: 'Invalid state response' };
                if (!isLive(life)) return;
                setState(result);
                if (!initialized.current || (input.action === 'settings' && draftVersion.current === version)) {
                  initialized.current = true;
                  setDraft(settingsDraft(result.settings));
                }
                if (input.action === 'save') setNotice({ key: 'savedRepo', params: { name: options.name || result.receipt?.name || String(input.id) } });
                if (input.action === 'settings') setNotice({ key: 'done' });
              } catch (failure) {
                if (isLive(life)) setError({ code: failure?.code || 'request_failed', details: failure?.details, message: failure?.message || String(failure), httpStatus: failure?.httpStatus });
              } finally {
                clearTimeout(timer);
                life.signal.removeEventListener('abort', abort);
                if (isLive(life)) {
                  setPendingCount(n => Math.max(0, n - 1));
                  if (input.action === 'save') {
                    saveIds.current.delete(input.id);
                    setPendingSaves(new Set(saveIds.current));
                  }
                  if (input.action === 'settings') setSettingsSaving(false);
                  if (input.action === 'refresh') setRefreshing(false);
                }
              }
            };
            queue.current = queue.current.then(run, run);
          }
          React.useEffect(() => {
            const life = new AbortController();
            lifecycle.current = life;
            saveIds.current = new Set();
            setPendingSaves(new Set()); setPendingCount(0); setSettingsSaving(false); setRefreshing(false);
            call({ action: 'status' }, { initial: true });
            return () => { life.abort(); if (lifecycle.current === life) lifecycle.current = null; };
          }, []);

          const history = Array.isArray(state?.history) ? state.history : [];
          const day = tab === 'history' ? history.find(d => d.date === date) || history.at(-1) : state?.today;
          const saved = Array.isArray(state?.saved) ? state.saved : [];
          const savedIds = new Set(saved.map(repo => repo.id));
          const categoryId = repo => categoryIds.includes(repo.categoryId) ? repo.categoryId : 'general';
          const sourceCode = value => sourceCodes.includes(value) ? value : 'unknown';
          const allRepos = tab === 'saved' ? saved : Array.isArray(day?.repos) ? day.repos : [];
          const needle = query.trim().toLocaleLowerCase(language);
          const repos = tab === 'saved' ? allRepos.filter(repo => (!category || categoryId(repo) === category) && (!needle || [repo.name, repo.description, repo.summaryZh, repo.language].filter(Boolean).join(' ').toLocaleLowerCase(language).includes(needle))) : allRepos;
          const fmt = n => Number.isFinite(n) ? n.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US') : '—';
          const gain = n => Number.isFinite(n) ? `${n > 0 ? '+' : ''}${fmt(n)}` : t('unknown');
          const dateTime = value => {
            const parsed = new Date(value);
            return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US') : '—';
          };
          const diagnostics = value => value ? h('details', { className: 'sh-diagnostics' }, h('summary', null, t('diagnostics')), h('pre', null, typeof value === 'string' ? value : JSON.stringify(value, null, 2))) : null;
          const errorText = value => t(`error_${['invalid_settings', 'invalid_id', 'not_recommended', 'request_failed', 'http_error', 'collection_failed', 'refresh_timeout', 'invalid_request', 'access_denied'].includes(value?.code) ? value.code : 'request_failed'}`);
          const warningText = detail => {
            const code = detail?.code;
            const params = detail?.params || {};
            if (code === 'leader_unavailable') return t(params.period === 'weekly' ? 'warning_leader_weekly' : 'warning_leader_daily');
            if (code === 'source_failed' || code === 'refresh_timeout') {
              const source = [...sourceCodes, 'repository', 'refresh'].includes(params.source) ? params.source : 'unknown';
              return `${t(`source_${source}`)} · ${t(`warning_${code}`)}`;
            }
            return t(`warning_${['search_incomplete', 'metadata_budget', 'recommendation_shortage', 'growth_unavailable', 'previous_board_retained', 'readme_failed', 'enrichment_failed'].includes(code) ? code : 'legacy'}`, params);
          };
          const warningList = board => Array.isArray(board?.warningDetails) && board.warningDetails.length ? board.warningDetails : (board?.warnings || []).map(message => ({ code: 'legacy', params: { message } }));
          const renderWarning = (detail, key) => h('div', { key }, h('p', null, warningText(detail)), diagnostics(detail?.params && Object.keys(detail.params).length ? detail : detail?.code === 'legacy' ? detail : null));
          const renderError = (value, key, previous = false) => value ? h('div', { key, role: 'alert', className: 'sh-notice' }, h('strong', { className: 'sh-error' }, previous ? t('lastCollectionFailed') : errorText(value)), previous ? h('p', null, t(refreshing ? 'retryingPrevious' : 'previousAvailable')) : null, value.retryAt && Number.isFinite(Date.parse(value.retryAt)) ? h('p', null, t('retryAt', { time: dateTime(value.retryAt) })) : null, ...(Array.isArray(value.details) ? value.details.filter(detail => detail?.code !== 'legacy').map((detail, i) => h('p', { key: i }, warningText(detail))) : []), diagnostics(value)) : null;
          const card = repo => {
            // Old combined README enrichment is not a description translation. Only accept
            // explicit translated-description formats, and take its first (description) line.
            const legacyTranslated = /translat/i.test(repo.summarySource || '') && typeof repo.summary === 'string' ? repo.summary.split(/\r?\n/)[0].trim() : '';
            const summaryZh = typeof repo.summaryZh === 'string' && repo.summaryZh.trim() ? repo.summaryZh.trim() : legacyTranslated;
            const description = typeof repo.description === 'string' ? repo.description : '';
            const translated = language === 'zh' && Boolean(summaryZh);
            const summary = translated ? summaryZh : description;
            const collected = savedIds.has(repo.id);
            const pending = pendingSaves.has(repo.id);
            return h('article', { key: repo.id, className: 'sh-card', 'aria-busy': pending },
              h('div', { className: 'sh-badges' },
                h('span', { className: 'sh-badge' }, t(`source_${sourceCode(repo.sourceCode)}`)),
                h('span', { className: 'sh-badge' }, t(`category_${categoryId(repo)}`)),
                repo.language ? h('span', { className: 'sh-badge' }, repo.language) : null),
              h('h3', null, h('a', { href: repo.url, target: '_blank', rel: 'noopener noreferrer' }, repo.name)),
              h('p', { className: 'sh-summary' }, language === 'zh' && !translated && description ? h('span', { className: 'sh-fallback' }, t('fallback')) : null, summary || t('noDescription')),
              translated && description && summary !== description ? h('details', { className: 'sh-muted' }, h('summary', null, t('original')), h('p', { className: 'sh-summary' }, description)) : null,
              h('div', { className: 'sh-stats' }, h('div', { className: 'sh-stat' }, h('span', { className: 'sh-muted' }, t('stars')), h('strong', { className: 'sh-number' }, `★ ${fmt(repo.stars)}`)), ...[['daily', repo.dailyGain], ['weekly', repo.weeklyGain]].filter(([, n]) => Number.isFinite(n)).map(([label, n]) => h('div', { key: label, className: 'sh-stat' }, h('span', { className: 'sh-muted' }, t(label)), h('strong', { className: 'sh-gain' }, gain(n))))),
              h('div', { className: 'sh-foot' }, h('a', { href: repo.url, target: '_blank', rel: 'noopener noreferrer', className: 'sh-muted' }, t('read')), h('button', { className: `sh-btn ${collected ? 'sh-saved' : 'sh-primary'}`, disabled: pending || collected, onClick: () => call({ action: 'save', id: repo.id }, { name: repo.name }) }, pending ? t('saving') : collected ? `✓ ${t('collected')}` : t('save'))));
          };
          const validation = {};
          const parsedSettings = {};
          for (const key of settingKeys) {
            const raw = draft[key] ?? '';
            const value = /^\d+$/.test(raw) ? Number(raw) : NaN;
            if (!Number.isSafeInteger(value) || value < 0 || value > settingMax(key)) validation[key] = t('validationRange', { min: 0, max: fmt(settingMax(key)) });
            else parsedSettings[key] = value;
          }
          if (!validation.classicMin && !validation.preferredMin && parsedSettings.preferredMin < parsedSettings.classicMin) validation.preferredMin = t('validationPreferred');
          const dirty = settingKeys.some(key => (draft[key] ?? '') !== String(state?.settings?.[key] ?? ''));
          const hasValidation = Object.keys(validation).length > 0;
          const collectionPath = state?.collectionPath || '';
          const pathView = () => h('div', { className: 'sh-path' }, h('strong', null, t('collection')),
            collectionPath ? h('code', { tabIndex: 0 }, collectionPath) : h('span', null, t('pathUnavailable')),
            h('button', { type: 'button', className: 'sh-btn', disabled: !collectionPath, onClick: async () => {
              const life = lifecycle.current;
              try { await navigator.clipboard.writeText(collectionPath); if (isLive(life)) setCopyState('copied'); }
              catch { if (isLive(life)) setCopyState('copyFailed'); }
            } }, t('copy')),
            copyState ? h('span', { role: copyState === 'copyFailed' ? 'alert' : 'status', className: `sh-path-note ${copyState === 'copyFailed' ? 'sh-error' : 'sh-success'}` }, t(copyState)) : null);
          const tabs = ['today', 'history', 'saved', 'settings'];
          const activateTab = key => { setTab(key); setNotice(null); };
          const tabId = key => `${instanceId}-tab-${key}`;
          const panelId = key => `${instanceId}-panel-${key}`;
          const panel = key => {
            if (!state) return null;
            if (key === 'settings') return h('form', { className: 'sh-form', noValidate: true, onSubmit: event => {
              event.preventDefault();
              if (busy || !dirty || hasValidation) return;
              call({ action: 'settings', settings: parsedSettings });
            } }, h('p', { className: 'sh-muted' }, t('configNote')), ...settingKeys.map(field => {
              const id = `${instanceId}-setting-${field}`;
              return h('div', { className: 'sh-field', key: field }, h('label', { htmlFor: id }, t(field)),
                h('div', { className: 'sh-field-control' }, h('input', { id, className: 'sh-input', type: 'text', inputMode: 'numeric', required: true, value: draft[field] ?? '', 'aria-invalid': Boolean(validation[field]), 'aria-describedby': validation[field] ? `${id}-error` : undefined,
                  onChange: event => { const raw = event.target.value; draftVersion.current += 1; setDraft(previous => ({ ...previous, [field]: raw })); } })),
                validation[field] ? h('span', { id: `${id}-error`, className: 'sh-field-error' }, validation[field]) : null);
            }), h('span', { className: 'sh-muted', role: 'status' }, hasValidation ? t('validationCount', { count: Object.keys(validation).length }) : t(dirty ? 'unsaved' : 'unchanged')),
              h('button', { className: 'sh-btn sh-primary', disabled: busy || !dirty || hasValidation, type: 'submit' }, t(settingsSaving ? 'settingsSaving' : 'submit')), pathView());
            return h(React.Fragment, null,
              key === 'history' ? h('div', { className: 'sh-history', 'aria-label': t('history') }, ...history.slice().reverse().map(board => h('button', { key: board.date, className: 'sh-btn', 'aria-pressed': day?.date === board.date, onClick: () => setDate(board.date) }, board.date))) : null,
              key === 'saved' ? h('div', { className: 'sh-filters' },
                h('label', { className: 'sh-filter' }, t('search'), h('input', { className: 'sh-input', type: 'search', value: query, placeholder: t('searchPlaceholder'), onChange: event => setQuery(event.target.value) })),
                h('label', { className: 'sh-filter' }, t('categoryFilter'), h('select', { className: 'sh-input', value: category, onChange: event => setCategory(event.target.value) }, h('option', { value: '' }, t('allCategories')), ...categoryIds.map(id => h('option', { value: id, key: id }, t(`category_${id}`))))),
                query || category ? h('button', { className: 'sh-btn', onClick: () => { setQuery(''); setCategory(''); } }, t('clearFilters')) : null) : null,
              h('div', { className: 'sh-sectionTitle' }, h('h2', null, key === 'saved' ? t('saved') : day?.date || t('today')), h('span', { className: 'sh-muted', 'aria-live': 'polite' }, `${repos.length} ${language === 'en' && repos.length === 1 ? 'project' : t('count')}`)),
              key !== 'saved' && repos.some(repo => !Number.isFinite(repo.dailyGain) || !Number.isFinite(repo.weeklyGain)) ? h('div', { className: 'sh-status' }, h('strong', null, t('observing')), h('span', { className: 'sh-muted' }, t('observingNote'))) : null,
              key !== 'saved' ? renderError(state.lastError, 'previous-collection', true) : null,
              repos.length ? h('div', { className: 'sh-grid' }, ...repos.map(card)) : h('div', { className: 'sh-empty' }, t(key === 'saved' ? saved.length && (query || category) ? 'noMatches' : 'noSaved' : key === 'history' ? 'noHistory' : 'empty'), key === 'saved' && (query || category) ? h('p', null, h('button', { className: 'sh-btn', onClick: () => { setQuery(''); setCategory(''); } }, t('clearFilters'))) : null),
              key !== 'saved' ? h('details', { className: 'sh-detail' }, h('summary', null, t('more')), h('p', null, t('boundary')),
                ...warningList(day).map((detail, index) => renderWarning(detail, `warning-${index}`)),
                ...repos.map(repo => h('div', { key: repo.id }, h('p', null, `${repo.name} · ${t(`reason_${sourceCode(repo.reasonCode || repo.sourceCode)}`)}`), !sourceCodes.includes(repo.reasonCode) && repo.reason ? diagnostics({ reason: repo.reason }) : null)),
                ...Object.entries(day?.leaders || {}).filter(([, leader]) => leader).map(([period, leader]) => h('div', { key: period }, h('p', null, `${t(`leader_${sourceCode(leader.labelCode)}`)}: ${leader.repo?.name || '—'}`), !sourceCodes.includes(leader.labelCode) && leader.label ? diagnostics({ label: leader.label }) : null)),
                day?.generatedAt ? h('p', null, `${t('generated')}: ${dateTime(day.generatedAt)}`) : null) : pathView());
          };
          return h('section', { className: 'sh-page', lang: language }, h('style', null, css), h('div', { className: 'sh-wrap' },
            h('header', { className: 'sh-header' }, h('div', { className: 'sh-brand' }, h(Icon, { size: 38 }), h('div', null, h('h1', null, t('title')), h('p', { className: 'sh-sub' }, t('subtitle')))), h('button', { className: 'sh-btn', disabled: busy, onClick: () => call({ action: 'refresh', force: true }) }, t(busy ? 'busy' : 'refresh'))),
            h('nav', { className: 'sh-nav', role: 'tablist', 'aria-label': t('title') }, ...tabs.map(key => h('button', {
              className: 'sh-tab', key, id: tabId(key), role: 'tab', tabIndex: tab === key ? 0 : -1, 'aria-selected': tab === key, 'aria-controls': panelId(key), ref: node => { tabRefs.current[key] = node; },
              onClick: () => activateTab(key), onKeyDown: event => {
                const index = tabs.indexOf(key);
                const target = event.key === 'ArrowRight' ? tabs[(index + 1) % tabs.length] : event.key === 'ArrowLeft' ? tabs[(index + tabs.length - 1) % tabs.length] : event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : null;
                if (target) { event.preventDefault(); activateTab(target); tabRefs.current[target]?.focus(); }
              },
            }, t(key), key === 'saved' ? ` · ${saved.length}` : ''))),
            renderError(error),
            notice ? h('div', { role: 'status', className: 'sh-notice sh-success' }, t(notice.key, notice.params)) : null,
            !state ? h('div', { className: 'sh-empty' }, error ? h('button', { className: 'sh-btn', disabled: busy, onClick: () => call({ action: 'status' }, { initial: true }) }, t('retry')) : t('loading')) : null,
            ...tabs.map(key => h('div', { key, id: panelId(key), role: 'tabpanel', 'aria-labelledby': tabId(key), className: 'sh-tabpanel', tabIndex: 0, hidden: tab !== key }, tab === key ? panel(key) : null)),
          ));
        }
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'starharbor', order: 6, label: () => t('title') }, Icon));
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'starharbor' }, Page));
      },
    };
  },
});
