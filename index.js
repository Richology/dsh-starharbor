import path from 'node:path';
import { createHarbor } from './core.js';

export const name = 'starharbor';
export const inject = ['connection', 'tools', 'workingDirectory'];

// One application boundary shared by the authenticated UI and the agent tool.
export function apply(ctx, config = {}) {
  const dataDir = path.resolve(config.dataDir || process.env.STARHARBOR_DIR || path.join(ctx.workingDirectory.defaultDirectory, 'StarHarbor'));
  const abort = new AbortController();
  const harbor = createHarbor({ dataDir, enrich: async repo => {
    const translator = ctx.get('translator');
    if (!translator || !repo.description || /[\u4e00-\u9fff]/.test(repo.description)) return {};
    const providers = await translator.availableProviders(abort.signal);
    const provider = providers.find(p => p === 'google' || p === 'bing');
    if (!provider) return {};
    const translated = await translator.translate(translator.resolve({ text: repo.description, targetLanguage: 'zh-CN', provider }), AbortSignal.any([abort.signal, AbortSignal.timeout(12000)]));
    const excerpt = repo.readmeExcerpt?.slice(0, 500);
    const extra = excerpt ? await translator.translate(translator.resolve({ text: excerpt, targetLanguage: 'zh-CN', provider }), AbortSignal.any([abort.signal, AbortSignal.timeout(12000)])) : '';
    const sentences = extra.match(/[^。！？.!?]+[。！？.!?]?/g)?.slice(0, 2).join('').slice(0, 320) || '';
    return { summary: `${translated}${sentences ? `\n${sentences}` : ''}`, summarySource: 'GitHub description + README excerpt · translated' };
  } });
  async function operate(input) {
    if (!input || typeof input !== 'object') throw new Error('Expected an action object');
    switch (input.action) {
      case 'status': return harbor.status();
      case 'refresh': return harbor.refresh({ force: Boolean(input.force) });
      case 'save': {
        if (!Number.isSafeInteger(input.id) || input.id < 1) throw new Error('A positive repository id is required');
        const receipt = await harbor.save(input.id);
        return { ...(await harbor.status()), receipt };
      }
      case 'settings': return harbor.settings(input.settings || {});
      default: throw new Error('Unknown StarHarbor action');
    }
  }
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/starharbor', methods: ['GET', 'POST'], requestBody: 'buffered',
    fetch: async request => {
      try {
        if (request.method === 'POST' && request.headers.get('x-starharbor') !== '1') return Response.json({ error: 'Missing application header' }, { status: 403 });
        const text = request.method === 'POST' ? await request.text() : '';
        if (text.length > 8192) return Response.json({ error: 'Request too large' }, { status: 413 });
        const result = await operate(request.method === 'GET' ? { action: 'status' } : JSON.parse(text));
        return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
      } catch (error) { return Response.json({ error: error.message }, { status: 400, headers: { 'Cache-Control': 'no-store' } }); }
    },
  }));
  ctx.effect(() => ctx.tools.register({
    name: 'starharbor',
    description: 'Read StarHarbor daily GitHub recommendations, refresh candidates, save a recommended repository to the local categorized Markdown collection, or change ranking thresholds. Returns today’s recommendations, the last 7 daily boards, the last 50 saved repositories, total counts and collection path. Growth figures are null without complete observation history.',
    parameters: { type: 'object', properties: {
      action: { type: 'string', enum: ['status', 'refresh', 'save', 'settings'] },
      id: { type: 'integer', description: 'Repository id from status; required for save.' },
      force: { type: 'boolean', description: 'Refresh sources even when today is already generated. Today’s selection remains stable.' },
      settings: { type: 'object', description: 'Fields to update; omitted fields stay unchanged.', properties: {
        dailyMin: { type: 'integer' }, weeklyMin: { type: 'integer' }, classicMin: { type: 'integer' }, preferredMin: { type: 'integer' }, cooldownDays: { type: 'integer' }, hour: { type: 'integer', description: 'Daily generation hour, 0–23 in Asia/Shanghai.' },
      }, additionalProperties: false },
    }, required: ['action'], additionalProperties: false },
    output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    timeoutMs: 180000,
    execute: async input => {
      const result = await operate(input);
      return { ...result, history: result.history?.slice(-7), saved: result.saved?.slice(-50), totals: { history: result.history?.length || 0, saved: result.saved?.length || 0 } };
    },
  }));
  ctx.effect(() => {
    let running = false;
    let nextAttempt = 0;
    let midnightKey = '';
    async function tick() {
      if (running || abort.signal.aborted || Date.now() < nextAttempt) return;
      running = true;
      try {
        const now = new Date();
        const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]));
        const date = `${parts.year}-${parts.month}-${parts.day}`;
        const state = await harbor.status();
        const retryAt = Date.parse(state.lastError?.retryAt || '');
        if (Number.isFinite(retryAt) && retryAt > Date.now()) { nextAttempt = retryAt; return; }
        let result;
        if (parts.hour === '00' && Number(parts.minute) <= 4 && midnightKey !== date) {
          result = await harbor.refresh({ force: true, snapshotOnly: true });
          if (!result.lastError) midnightKey = date;
        } else if (Number(parts.hour) >= state.settings.hour && state.today?.date !== date) result = await harbor.refresh();
        nextAttempt = result?.lastError ? Math.max(Date.now() + 15 * 60000, Date.parse(result.lastError.retryAt || '') || 0) : Date.now() + 60000;
      } catch (error) {
        nextAttempt = Date.now() + 15 * 60000;
        console.warn('StarHarbor scheduled refresh:', error.message);
      } finally { running = false; }
    }
    const timer = setInterval(tick, 60000);
    void tick();
    return () => { clearInterval(timer); abort.abort(); };
  });
}
