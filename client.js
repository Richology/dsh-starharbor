window.__ModuleLoader__.load({
  id: 'dsh-starharbor',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const dictionaries = {
      zh: { title: 'StarHarbor 星港', subtitle: '每天 5 个值得收藏的 GitHub 项目', today: '今日推荐', history: '往日发现', saved: '已收藏', settings: '推荐设置', refresh: '更新数据', busy: '正在处理…', save: '收藏到 Markdown', collected: '已收藏', empty: '还没有推荐，点击「更新数据」开始发现。', noSaved: '看到感兴趣的项目时，点击卡片上的收藏按钮。', stars: '累计 Star', daily: '昨日净增', weekly: '近 7 日净增', unknown: '未积累完整数据', original: '仓库原始简介', observed: '数据时间', source: '来源', leaders: '候选榜首', boundary: '榜单来自已采集候选，非全 GitHub 排名。Trending 是趋势来源；完整自然日快照积累前，不显示昨日或周净增长。', collection: '收藏保存位置', configNote: '每天按北京时间生成。DSH 关闭时暂停采集；重新打开后补当日推荐。更新门槛从下一次生成开始生效。', dailyMin: '日趋势最低 Star', weeklyMin: '周趋势最低 Star', classicMin: '经典项目最低 Star', preferredMin: '经典项目优先 Star', cooldownDays: '重复推荐间隔（天）', hour: '每日生成时间（北京时间 / 小时）', submit: '保存设置', done: '设置已保存', read: '在 GitHub 查看 ↗', count: '个项目', latest: '今日', more: '排名与数据说明', noHistory: '每日推荐将自动留在这里。', savedNotice: '已写入收藏文件', loading: '正在读取星港…', inactive: '最近一年未更新', error: '操作失败', archive: '发现记录', generated: '生成时间', observing: '正在积累涨星数据', observingNote: '当前结合 Trending 与累计 Star 推荐；完整观测后展示净增。' },
      en: { title: 'StarHarbor', subtitle: 'Five GitHub projects worth keeping, every day', today: 'Today', history: 'History', saved: 'Collection', settings: 'Settings', refresh: 'Refresh data', busy: 'Working…', save: 'Save to Markdown', collected: 'Saved', empty: 'No discoveries yet. Refresh data to get started.', noSaved: 'Save a project from its discovery card to start your collection.', stars: 'Total stars', daily: 'Yesterday’s net gain', weekly: '7-day net gain', unknown: 'Incomplete history', original: 'Original description', observed: 'Observed', source: 'Source', leaders: 'Candidate leaders', boundary: 'Rankings cover observed candidates, not all GitHub. Trending is a discovery source; calendar-day gains require complete boundary snapshots.', collection: 'Collection file', configNote: 'Generated daily in Asia/Shanghai. Collection pauses when DSH is closed; the next launch catches up today’s picks. New thresholds apply to the next selection.', dailyMin: 'Daily minimum stars', weeklyMin: 'Weekly minimum stars', classicMin: 'Classic minimum stars', preferredMin: 'Classic preferred stars', cooldownDays: 'Recommendation cooldown (days)', hour: 'Generation hour (Asia/Shanghai)', submit: 'Save settings', done: 'Settings saved', read: 'View on GitHub ↗', count: 'projects', latest: 'Today', more: 'Ranking methodology', noHistory: 'Daily discoveries will appear here.', savedNotice: 'Written to collection', loading: 'Loading StarHarbor…', inactive: 'No updates in a year', error: 'Action failed', archive: 'Discovery archive', generated: 'Generated', observing: 'Building growth history', observingNote: 'Picks currently combine Trending and total stars. Net gains appear after complete observations.' },
    };
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
.sh-field{display:grid;grid-template-columns:minmax(0,250px) minmax(96px,160px);align-items:center;gap:18px;font-size:15px}
.sh-input{font-size:16px;width:100%;min-width:0;font-variant-numeric:tabular-nums}
.sh-form>.sh-btn{justify-self:start;min-width:160px;margin-top:4px}
.sh-path{margin:22px 0 0;max-width:100%;overflow-wrap:anywhere;font-size:14px;color:var(--dsw-alias-label-secondary)}
.sh-path strong{display:block;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;margin-bottom:6px}
.sh-path code{font-size:13px;white-space:normal;overflow-wrap:anywhere}
.sh-history{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px}
.sh-empty{padding:36px 24px;border:1px dashed var(--dsw-alias-border-l2);border-radius:12px;font-size:15px;color:var(--dsw-alias-label-secondary)}
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
          React.useSyncExternalStore(fn => ctx.locale.subscribe(fn), () => ctx.locale.getSnapshot());
          const [state, setState] = React.useState(null);
          const [tab, setTab] = React.useState('today');
          const [date, setDate] = React.useState('');
          const [busy, setBusy] = React.useState(false);
          const [error, setError] = React.useState('');
          const [notice, setNotice] = React.useState('');
          const [draft, setDraft] = React.useState({});
          const mounted = React.useRef(true);
          async function call(input) {
            setBusy(true); setError(''); setNotice('');
            try {
              const response = await fetch('/api/starharbor', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-StarHarbor': '1' }, body: JSON.stringify(input) });
              const result = await response.json();
              if (!response.ok || result.error) throw new Error(result.error || `${response.status}`);
              if (mounted.current) { setState(result); setDraft(result.settings || {}); if (input.action === 'save') setNotice(t('savedNotice')); if (input.action === 'settings') setNotice(t('done')); }
            } catch (e) { if (mounted.current) setError(e.message); }
            finally { if (mounted.current) setBusy(false); }
          }
          React.useEffect(() => {
            mounted.current = true;
            const controller = new AbortController();
            fetch('/api/starharbor', { signal: controller.signal, credentials: 'same-origin' }).then(async response => { const data = await response.json(); if (!response.ok || data.error) throw new Error(data.error || String(response.status)); if (mounted.current) { setState(data); setDraft(data.settings || {}); } }).catch(e => { if (!controller.signal.aborted && mounted.current) setError(e.message); });
            return () => { mounted.current = false; controller.abort(); };
          }, []);
          const history = Array.isArray(state?.history) ? state.history : [];
          const day = tab === 'history' ? history.find(d => d.date === date) || history.at(-1) : state?.today;
          const saved = state?.saved || [];
          const savedIds = new Set(saved.map(r => r.id));
          const repos = tab === 'saved' ? saved : day?.repos || [];
          const fmt = n => Number.isFinite(n) ? n.toLocaleString() : '—';
          const gain = n => Number.isFinite(n) ? `${n > 0 ? '+' : ''}${fmt(n)}` : t('unknown');
          const card = repo => h('article', { key: repo.id, className: 'sh-card' },
            h('div', { className: 'sh-badges' }, ...[repo.source, repo.category].filter(Boolean).map((label, i) => h('span', { className: 'sh-badge', key: i }, label))),
            h('h3', null, h('a', { href: repo.url, target: '_blank', rel: 'noopener noreferrer' }, repo.name)),
            h('p', { className: 'sh-summary' }, repo.summarySource === 'original' ? repo.description || repo.summary : repo.summary || repo.description),
            repo.summarySource !== 'original' && repo.summary && repo.description && repo.summary !== repo.description ? h('details', { className: 'sh-muted' }, h('summary', null, t('original')), repo.description) : null,
            h('div', { className: 'sh-stats' }, h('div', { className: 'sh-stat' }, h('span', { className: 'sh-muted' }, t('stars')), h('strong', { className: 'sh-number' }, `★ ${fmt(repo.stars)}`)), ...[['daily', repo.dailyGain], ['weekly', repo.weeklyGain]].filter(([, n]) => Number.isFinite(n)).map(([label, n]) => h('div', { key: label, className: 'sh-stat' }, h('span', { className: 'sh-muted' }, t(label)), h('strong', { className: 'sh-gain' }, gain(n))))),
            h('div', { className: 'sh-foot' }, h('a', { href: repo.url, target: '_blank', rel: 'noopener noreferrer', className: 'sh-muted' }, t('read')), h('button', { className: `sh-btn ${savedIds.has(repo.id) ? '' : 'sh-primary'}`, disabled: busy || savedIds.has(repo.id), onClick: () => call({ action: 'save', id: repo.id }) }, t(savedIds.has(repo.id) ? 'collected' : 'save'))));
          return h('section', { className: 'sh-page' }, h('style', null, css), h('div', { className: 'sh-wrap' },
            h('header', { className: 'sh-header' }, h('div', { className: 'sh-brand' }, h(Icon, { size: 38 }), h('div', null, h('h1', null, t('title')), h('p', { className: 'sh-sub' }, t('subtitle')))), h('button', { className: 'sh-btn', disabled: busy, onClick: () => call({ action: 'refresh', force: true }) }, t(busy ? 'busy' : 'refresh'))),
            h('nav', { className: 'sh-nav', role: 'tablist' }, ...['today', 'history', 'saved', 'settings'].map(key => h('button', { className: 'sh-tab', key, role: 'tab', 'aria-selected': tab === key, onClick: () => { setTab(key); setNotice(''); } }, t(key), key === 'saved' ? ` · ${saved.length}` : ''))),
            error ? h('div', { role: 'alert', className: 'sh-notice sh-error' }, `${t('error')}: ${error}`) : null,
            notice ? h('div', { role: 'status', className: 'sh-notice sh-success' }, notice) : null,
            !state ? h('div', { className: 'sh-empty' }, t('loading')) : null,
            tab === 'settings' && state ? h('form', { className: 'sh-form', onSubmit: e => { e.preventDefault(); call({ action: 'settings', settings: draft }); } }, h('p', { className: 'sh-muted' }, t('configNote')), ...['dailyMin', 'weeklyMin', 'classicMin', 'preferredMin', 'cooldownDays', 'hour'].map(key => h('label', { className: 'sh-field', key }, t(key), h('input', { className: 'sh-input', type: 'number', min: 0, max: key === 'hour' ? 23 : key === 'cooldownDays' ? 365 : 10000000, required: true, value: draft[key] ?? '', onChange: e => setDraft({ ...draft, [key]: Number(e.target.value) }) }))), h('button', { className: 'sh-btn sh-primary', disabled: busy, type: 'submit' }, t('submit')), h('div', { className: 'sh-path' }, h('strong', null, t('collection')), h('code', null, state.collectionPath))) : null,
            tab !== 'settings' && state ? h(React.Fragment, null,
              tab === 'history' ? h('div', { className: 'sh-history' }, ...history.slice().reverse().map(d => h('button', { key: d.date, className: 'sh-btn', onClick: () => setDate(d.date) }, d.date))) : null,
              h('div', { className: 'sh-sectionTitle' }, h('h2', null, tab === 'saved' ? t('saved') : day?.date || t('today')), h('span', { className: 'sh-muted' }, `${repos.length} ${t('count')}`)),
              tab !== 'saved' && repos.some(r => r.dailyGain === null || r.weeklyGain === null) ? h('div', { className: 'sh-status' }, h('strong', null, t('observing')), h('span', { className: 'sh-muted' }, t('observingNote'))) : null,
              state.lastError ? h('div', { className: 'sh-notice sh-error', role: 'alert' }, state.lastError.message || String(state.lastError)) : null,
              repos.length ? h('div', { className: 'sh-grid' }, ...repos.map(card)) : h('div', { className: 'sh-empty' }, t(tab === 'saved' ? 'noSaved' : tab === 'history' ? 'noHistory' : 'empty')),
              tab !== 'saved' ? h('details', { className: 'sh-detail' }, h('summary', null, t('more')), h('p', null, t('boundary')), ...(day?.warnings || []).map((warning, i) => h('p', { key: `warning-${i}` }, warning)), ...repos.map(repo => h('p', { key: repo.id }, `${repo.name} · ${repo.reason}`)), ...Object.values(day?.leaders || {}).filter(Boolean).map((leader, i) => h('p', { key: i }, `${leader.label || ''}: ${leader.repo?.name || '—'}`)), day?.generatedAt ? h('p', null, `${t('generated')}: ${new Date(day.generatedAt).toLocaleString()}`) : null) : h('div', { className: 'sh-path' }, h('strong', null, t('collection')), h('code', null, state.collectionPath)),
            ) : null,
          ));
        }
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'starharbor', order: 6, label: () => t('title') }, Icon));
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'starharbor' }, Page));
      },
    };
  },
});
