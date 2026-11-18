import path from 'node:path';
import { createHarbor } from './core.js';

export const name = 'starharbor';
export const inject = ['connection', 'tools', 'workingDirectory'];
export const DEFAULT_FEED_URL = 'https://raw.githubusercontent.com/Richology/dsh-starharbor/data/latest.json';

// Translate the repository description without turning README banners into a summary.
export async function translateDescription(repo, translator, lifecycleSignal) {
  if (!repo.description) return {};
  if (/[\u4e00-\u9fff]/.test(repo.description)) return { summaryZh: repo.description, summary: repo.description, summarySource: 'original' };
  if (!translator) return {};
  const signal = AbortSignal.any([lifecycleSignal, AbortSignal.timeout(12000)]);
  const providers = await translator.availableProviders(signal);
  const provider = providers.find(p => p === 'google' || p === 'bing');
  if (!provider) return {};
  const translated = await translator.translate(translator.resolve({ text: repo.description, targetLanguage: 'zh-CN', provider }), signal);
  if (typeof translated !== 'string' || !translated.trim()) return {};
  return { summaryZh: translated.trim(), summary: translated.trim(), summarySource: 'translated_description' };
}

// One application boundary shared by the authenticated UI and the agent tool.
export function apply(ctx, config = {}) {
  const dataDir = path.resolve(config.dataDir || process.env.STARHARBOR_DIR || path.join(ctx.workingDirectory.defaultDirectory, 'StarHarbor'));
  const abort = new AbortController();
  const harbor = createHarbor({ dataDir, signal: abort.signal, feedUrl: config.feedUrl || process.env.STARHARBOR_FEED_URL || DEFAULT_FEED_URL });
  async function operate(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw Object.assign(new Error('Expected an action object'), { code: 'invalid_request' });
    switch (input.action) {
      case 'status': return harbor.status();
      case 'refresh': return harbor.refresh({ force: Boolean(input.force) });
      case 'save': {
        if (!Number.isSafeInteger(input.id) || input.id < 1) throw Object.assign(new Error('A positive repository id is required'), { code: 'invalid_id' });
        let receipt;
        try { receipt = await harbor.save(input.id); }
        catch (error) {
          if (!error.code && /已有推荐/.test(error.message)) error.code = 'not_recommended';
          throw error;
        }
        return { ...(await harbor.status()), receipt };
      }
      case 'settings': {
        try { return await harbor.settings(Object.hasOwn(input, 'settings') ? input.settings : {}); }
        catch (error) {
          if (error instanceof TypeError || error instanceof RangeError) error.code = 'invalid_settings';
          throw error;
        }
      }
      default: throw Object.assign(new Error('Unknown StarHarbor action'), { code: 'invalid_request' });
    }
  }
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/starharbor', methods: ['GET', 'POST'], requestBody: 'buffered',
    fetch: async request => {
      try {
        if (request.method === 'POST' && request.headers.get('x-starharbor') !== '1') return Response.json({ error: 'Missing application header', code: 'access_denied' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
        const text = request.method === 'POST' ? await request.text() : '';
        if (text.length > 8192) return Response.json({ error: 'Request too large', code: 'invalid_request' }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
        const result = await operate(request.method === 'GET' ? { action: 'status' } : JSON.parse(text));
        return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
      } catch (error) {
        const allowed = ['invalid_request', 'invalid_id', 'invalid_settings', 'not_recommended'];
        const code = error instanceof SyntaxError ? 'invalid_request' : allowed.includes(error.code) ? error.code : 'request_failed';
        return Response.json({ error: error.message, code }, { status: code === 'request_failed' ? 500 : 400, headers: { 'Cache-Control': 'no-store' } });
      }
    },
  }));
  ctx.effect(() => ctx.tools.register({
    name: 'starharbor',
    description: 'Read StarHarbor daily GitHub recommendations and cloud feed freshness, synchronize public candidates, save a recommended repository to local categorized Markdown, or change local ranking thresholds. Returns today, last 7 boards, last 50 saved repos, totals and collection path. Collections and preferences stay local; growth is null without complete observations.',
    parameters: { type: 'object', properties: {
      action: { type: 'string', enum: ['status', 'refresh', 'save', 'settings'] },
      id: { type: 'integer', description: 'Repository id from status; required for save.' },
      force: { type: 'boolean', description: 'Synchronize the cloud feed now, bypassing the hourly check. May generate a board before the chosen hour; an existing same-day selection stays stable.' },
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
    async function tick() {
      if (running || abort.signal.aborted || Date.now() < nextAttempt) return;
      running = true;
      try {
        const now = new Date();
        const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]));
        const date = `${parts.year}-${parts.month}-${parts.day}`;
        const state = await harbor.status();
        const syncDue = !state.feed?.nextSyncAt || Date.parse(state.feed.nextSyncAt) <= Date.now();
        const boardDue = Number(parts.hour) >= state.settings.hour && state.today?.date !== date;
        // Synchronize on startup/hourly, and use a cached current-day feed at the user's chosen hour.
        // Midnight observations are collected by the cloud workflow, even while DSH is closed.
        let result;
        if (syncDue || boardDue) result = await harbor.refresh();
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
