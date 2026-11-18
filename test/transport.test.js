import test from 'node:test';
import assert from 'node:assert/strict';
import { macProxyFor, createFeedTransport } from '../transport.js';

const RAW = 'https://raw.githubusercontent.com/Richology/dsh-starharbor/data/latest.json';
const systemProxy = (extra = '') => `<dictionary> {
  HTTPEnable : 1
  HTTPProxy : http-proxy.example
  HTTPPort : 8080
  HTTPSEnable : 1
  HTTPSProxy : 127.0.0.1
  HTTPSPort : 7897
  ${extra}
}`;

function fixture(overrides = {}) {
  const calls = { fetch: [], read: [], env: [], proxy: [] };
  const agent = kind => ({ kind, destroyed: 0, async destroy() { this.destroyed++; } });
  const transport = createFeedTransport({
    env: {}, platform: 'darwin',
    readSystemProxy: async signal => { calls.read.push(signal); return systemProxy(); },
    fetchImpl: async (url, options) => { calls.fetch.push({ url, options }); return new Response('feed'); },
    makeEnvAgent: options => { const value = agent('env'); calls.env.push({ options, agent: value }); return value; },
    makeProxyAgent: uri => { const value = agent('system'); calls.proxy.push({ uri, agent: value }); return value; },
    ...overrides,
  });
  return { transport, calls };
}

test('macOS manual proxies select protocol, normalize IPv6, and reject invalid settings', async t => {
  const cases = [
    ['HTTPS manual proxy', systemProxy(), RAW, 'http://127.0.0.1:7897'],
    ['HTTP manual proxy', systemProxy(), 'http://example.com/feed', 'http://http-proxy.example:8080'],
    ['disabled HTTPS', systemProxy().replace('HTTPSEnable : 1', 'HTTPSEnable : 0'), RAW, null],
    ['no settings', '<dictionary> {}', RAW, null],
    ['unbracketed IPv6', systemProxy().replace('HTTPSProxy : 127.0.0.1', 'HTTPSProxy : ::1'), RAW, 'http://[::1]:7897'],
    ['bracketed IPv6', systemProxy().replace('HTTPSProxy : 127.0.0.1', 'HTTPSProxy : [::1]'), RAW, 'http://[::1]:7897'],
    ['zero port', systemProxy().replace('HTTPSPort : 7897', 'HTTPSPort : 0'), RAW, null],
    ['excessive port', systemProxy().replace('HTTPSPort : 7897', 'HTTPSPort : 65536'), RAW, null],
    ['fractional port', systemProxy().replace('HTTPSPort : 7897', 'HTTPSPort : 1.5'), RAW, null],
    ['invalid host', systemProxy().replace('HTTPSProxy : 127.0.0.1', 'HTTPSProxy : user:secret@proxy.example'), RAW, null],
  ];
  for (const [name, text, url, expected] of cases) {
    await t.test(name, () => assert.equal(macProxyFor(text, url), expected));
  }
});

test('macOS hostname exceptions and loopback bypass only matching destinations', async t => {
  const exceptions = systemProxy('ExceptionsList : <array> {\n 0 : *.example.com\n 1 : internal.test\n }');
  for (const host of ['example.com', 'sub.example.com', 'internal.test', 'child.internal.test', 'localhost', '127.0.0.1', '[::1]']) {
    await t.test(host, () => assert.equal(macProxyFor(exceptions, `https://${host}/feed`), null));
  }
  assert.equal(macProxyFor(exceptions, 'https://notexample.com/feed'), 'http://127.0.0.1:7897');
  assert.equal(macProxyFor(systemProxy('ExceptionsList : <array> { 0 : * }'), RAW), null);
  assert.equal(macProxyFor(systemProxy('ExcludeSimpleHostnames : 1'), 'https://intranet/feed'), null);
  assert.equal(macProxyFor(systemProxy('ExcludeSimpleHostnames : 1'), RAW), 'http://127.0.0.1:7897');
});

test('macOS CIDR exceptions bypass IPv4 and IPv6 literals only inside the subnet', () => {
  const text = systemProxy('ExceptionsList : <array> {\n 0 : 192.168.0.0/16\n 1 : fd00::/8\n 2 : malformed/999\n }');
  assert.equal(macProxyFor(text, 'https://192.168.12.34/feed'), null);
  assert.equal(macProxyFor(text, 'https://[fd12::1234]/feed'), null);
  assert.equal(macProxyFor(text, 'https://192.169.12.34/feed'), 'http://127.0.0.1:7897');
  assert.equal(macProxyFor(text, 'https://[2606:50c0:8000::154]/feed'), 'http://127.0.0.1:7897');
  assert.equal(macProxyFor(text, RAW), 'http://127.0.0.1:7897');
});

test('NO_PROXY without explicit proxy env is passed to the discovered system proxy agent', async () => {
  const { transport, calls } = fixture({ env: { NO_PROXY: 'localhost,.example.com' } });
  await transport.fetch(RAW);
  assert.equal(calls.read.length, 1);
  assert.equal(calls.proxy.length, 0);
  assert.deepEqual(calls.env[0].options, {
    httpProxy: 'http://127.0.0.1:7897', httpsProxy: 'http://127.0.0.1:7897',
    noProxy: 'localhost,.example.com', connect: { timeout: 5000 },
  });
  assert.equal(calls.fetch[0].options.dispatcher, calls.env[0].agent);
  await transport.close();
  assert.equal(calls.env[0].agent.destroyed, 1);
});

test('system proxy requests preserve cancellation and options, reuse an agent, and destroy it on close', async () => {
  const { transport, calls } = fixture();
  const controller = new AbortController();
  const headers = { Accept: 'application/json' };
  const result = await transport.fetch(RAW, { signal: controller.signal, headers, redirect: 'error', credentials: 'omit' });
  assert.equal(await result.text(), 'feed');
  await transport.fetch(RAW);
  assert.equal(calls.proxy.length, 1);
  assert.equal(calls.proxy[0].uri, 'http://127.0.0.1:7897');
  assert.equal(calls.read[0], controller.signal);
  assert.equal(calls.fetch[0].url, RAW);
  assert.equal(calls.fetch[0].options.signal, controller.signal);
  assert.equal(calls.fetch[0].options.headers, headers);
  assert.equal(calls.fetch[0].options.redirect, 'error');
  assert.equal(calls.fetch[0].options.credentials, 'omit');
  assert.equal(calls.fetch[0].options.dispatcher, calls.proxy[0].agent);
  assert.equal(calls.fetch[1].options.dispatcher, calls.proxy[0].agent);
  await transport.close();
  assert.equal(calls.proxy[0].agent.destroyed, 1);
  await assert.rejects(transport.fetch(RAW), /Feed transport is closed/);
  assert.equal(calls.fetch.length, 2);
});

test('explicit environment proxy wins over system and preserves lowercase precedence and no_proxy', async () => {
  const { transport, calls } = fixture({ env: {
    http_proxy: 'http://lower-http.example:8080', HTTP_PROXY: 'http://upper-http.example:8081',
    https_proxy: 'http://lower-https.example:8443', HTTPS_PROXY: 'http://upper-https.example:8444',
    all_proxy: 'http://all.example:8000', no_proxy: 'localhost,.example.com', NO_PROXY: '*',
  } });
  await transport.fetch(RAW);
  await transport.fetch('https://example.com/feed');
  assert.equal(calls.read.length, 0);
  assert.equal(calls.proxy.length, 0);
  assert.equal(calls.env.length, 1);
  assert.deepEqual(calls.env[0].options, {
    httpProxy: 'http://lower-http.example:8080', httpsProxy: 'http://lower-https.example:8443',
    noProxy: 'localhost,.example.com', connect: { timeout: 5000 },
  });
  assert.equal(calls.fetch[0].options.dispatcher, calls.env[0].agent);
  await transport.close();
  assert.equal(calls.env[0].agent.destroyed, 1);
});

test('environment ALL_PROXY and HTTP_PROXY fallbacks and empty lowercase no_proxy are explicit', async t => {
  const cases = [
    [{ ALL_PROXY: 'http://all.example:8080', NO_PROXY: 'localhost' }, 'http://all.example:8080', 'http://all.example:8080', 'localhost'],
    [{ HTTP_PROXY: 'http://http.example:8080' }, 'http://http.example:8080', 'http://http.example:8080', ''],
    [{ HTTPS_PROXY: 'http://https.example:8080', no_proxy: '', NO_PROXY: '*' }, '', 'http://https.example:8080', ''],
  ];
  for (const [env, httpProxy, httpsProxy, noProxy] of cases) {
    await t.test(Object.keys(env).join(','), async () => {
      const { transport, calls } = fixture({ env, platform: 'win32' });
      await transport.fetch(RAW);
      assert.deepEqual(calls.env[0].options, { httpProxy, httpsProxy, noProxy, connect: { timeout: 5000 } });
      assert.equal(calls.read.length, 0);
      await transport.close();
    });
  }
});

test('no proxy, non-macOS, or failed system lookup leaves direct fetch available', async t => {
  for (const [name, overrides] of [
    ['disabled system proxy', { readSystemProxy: async () => '<dictionary> {}' }],
    ['missing scutil', { readSystemProxy: async () => { throw Object.assign(new Error('not found'), { code: 'ENOENT' }); } }],
    ['Linux', { platform: 'linux' }],
    ['Windows', { platform: 'win32' }],
  ]) {
    await t.test(name, async () => {
      const { transport, calls } = fixture(overrides);
      await transport.fetch(RAW);
      assert.equal(Object.hasOwn(calls.fetch[0].options, 'dispatcher'), false);
      assert.equal(calls.proxy.length, 0);
      assert.equal(calls.env.length, 0);
      if (overrides.platform) assert.equal(calls.read.length, 0);
      await transport.close();
    });
  }
});

test('already canceled requests never inspect the system or start fetch', async () => {
  const { transport, calls } = fixture();
  const reason = new Error('request canceled');
  const signal = AbortSignal.abort(reason);
  await assert.rejects(transport.fetch(RAW, { signal }), error => error === reason);
  assert.equal(calls.read.length, 0);
  assert.equal(calls.fetch.length, 0);
  await transport.close();
});

test('cancellation during system lookup does not fall through to a direct request', async () => {
  const controller = new AbortController();
  const reason = new Error('canceled during lookup');
  const { transport, calls } = fixture({ readSystemProxy: async signal => {
    assert.equal(signal, controller.signal);
    controller.abort(reason);
    throw reason;
  } });
  await assert.rejects(transport.fetch(RAW, { signal: controller.signal }), error => error === reason);
  assert.equal(calls.fetch.length, 0);
  await transport.close();
});

test('closing during system lookup prevents a late request and cleans up any created agent', async () => {
  let finishLookup;
  const { transport, calls } = fixture({ readSystemProxy: () => new Promise(resolve => { finishLookup = resolve; }) });
  const pending = transport.fetch(RAW);
  await transport.close();
  finishLookup(systemProxy());
  await assert.rejects(pending, /Feed transport is closed/);
  assert.equal(calls.fetch.length, 0);
  // A lookup completion after close must not leak a newly created dispatcher.
  assert.ok(calls.proxy.every(({ agent }) => agent.destroyed === 1));
});

test('explicit proxy failure is returned without a direct retry', async t => {
  for (const [name, env] of [['system proxy', {}], ['environment proxy', { HTTPS_PROXY: 'http://proxy.example:8080' }]]) {
    await t.test(name, async () => {
      const error = Object.assign(new Error('proxy unavailable'), { code: 'ECONNREFUSED' });
      const seen = [];
      const { transport } = fixture({ env, fetchImpl: async (url, options) => { seen.push(options); throw error; } });
      await assert.rejects(transport.fetch(RAW), value => value === error);
      assert.equal(seen.length, 1);
      assert.ok(seen[0].dispatcher);
      await transport.close();
    });
  }
});
