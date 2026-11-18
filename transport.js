import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BlockList, isIP } from 'node:net';
import { EnvHttpProxyAgent, ProxyAgent } from 'undici';

const execute = promisify(execFile);

// macOS exposes manual system proxies separately from the shell environment.
// Read only network proxy settings; never alter the OS or the process dispatcher.
export function macProxyFor(text, target) {
  const url = new URL(target);
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host === '[::1]' || /^127\./.test(host)) return null;
  const value = key => text.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, 'm'))?.[1].trim();
  const exceptions = text.match(/ExceptionsList\s*:\s*<array>\s*\{([^}]*)\}/)?.[1] || '';
  for (const match of exceptions.matchAll(/\d+\s*:\s*([^\s]+)/g)) {
    const entry = match[1].toLowerCase();
    if (entry.includes('/')) {
      const address = host.replace(/^\[|\]$/g, '');
      const family = isIP(address);
      if (family) {
        const [network, prefix] = entry.split('/');
        try {
          const list = new BlockList();
          const type = family === 6 ? 'ipv6' : 'ipv4';
          list.addSubnet(network, Number(prefix), type);
          if (list.check(address, type)) return null;
        } catch { /* Ignore malformed OS exception entries. */ }
      }
      continue;
    }
    const suffix = entry.replace(/^\*?\./, '');
    if (entry === '*' || host === suffix || host.endsWith(`.${suffix}`)) return null;
  }
  if (value('ExcludeSimpleHostnames') === '1' && !host.includes('.')) return null;
  const prefix = url.protocol === 'https:' ? 'HTTPS' : 'HTTP';
  if (value(`${prefix}Enable`) !== '1') return null;
  const proxyHost = value(`${prefix}Proxy`);
  const port = Number(value(`${prefix}Port`));
  if (!proxyHost || !/^[\w.:[\]-]+$/.test(proxyHost) || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  const normalizedHost = proxyHost.includes(':') && !proxyHost.startsWith('[') ? `[${proxyHost}]` : proxyHost;
  return `http://${normalizedHost}:${port}`;
}

export function createFeedTransport({ env = process.env, platform = process.platform, fetchImpl = globalThis.fetch, readSystemProxy = async signal => (await execute('/usr/sbin/scutil', ['--proxy'], { timeout: 1500, maxBuffer: 32768, signal })).stdout, makeEnvAgent = options => new EnvHttpProxyAgent(options), makeProxyAgent = uri => new ProxyAgent({ uri, connect: { timeout: 5000 } }) } = {}) {
  const agents = new Map();
  let disposed = false;
  const explicit = ['http_proxy', 'HTTP_PROXY', 'https_proxy', 'HTTPS_PROXY', 'all_proxy', 'ALL_PROXY'].some(key => Boolean(env[key]));
  let envAgent;
  const getEnvAgent = () => envAgent ||= makeEnvAgent({
    httpProxy: env.http_proxy || env.HTTP_PROXY || env.all_proxy || env.ALL_PROXY || '',
    httpsProxy: env.https_proxy || env.HTTPS_PROXY || env.all_proxy || env.ALL_PROXY || env.http_proxy || env.HTTP_PROXY || '',
    noProxy: env.no_proxy ?? env.NO_PROXY ?? '',
    connect: { timeout: 5000 },
  });
  return {
    async fetch(url, options = {}) {
      if (disposed) throw new Error('Feed transport is closed');
      options.signal?.throwIfAborted();
      let dispatcher;
      if (explicit) dispatcher = getEnvAgent();
      else if (platform === 'darwin') {
        let text;
        try { text = await readSystemProxy(options.signal); }
        catch (error) {
          options.signal?.throwIfAborted();
          // Missing scutil/OS lookup failure does not prevent ordinary direct use.
          if (error?.name === 'AbortError') throw error;
        }
        options.signal?.throwIfAborted();
        if (disposed) throw new Error('Feed transport is closed');
        const uri = text ? macProxyFor(text, url) : null;
        if (uri) {
          dispatcher = agents.get(uri);
          if (!dispatcher) {
            const noProxy = env.no_proxy ?? env.NO_PROXY ?? '';
            dispatcher = noProxy ? makeEnvAgent({ httpProxy: uri, httpsProxy: uri, noProxy, connect: { timeout: 5000 } }) : makeProxyAgent(uri);
            agents.set(uri, dispatcher);
          }
        }
      }
      options.signal?.throwIfAborted();
      if (disposed) throw new Error('Feed transport is closed');
      // Respect an explicit proxy: a failed proxied request must not bypass it.
      return fetchImpl(url, { ...options, ...(dispatcher ? { dispatcher } : {}) });
    },
    async close() {
      disposed = true;
      await Promise.allSettled([...agents.values(), ...(envAgent ? [envAgent] : [])].map(agent => agent.destroy()));
      agents.clear();
    },
  };
}
