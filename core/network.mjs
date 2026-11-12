import { lookup } from 'node:dns/promises';
import { Agent, fetch } from 'undici';
import ipaddr from 'ipaddr.js';
export function publicAddress(address) {
  try {
    let ip = ipaddr.parse(address);
    if (ip.kind() === 'ipv6' && ip.isIPv4MappedAddress()) ip = ip.toIPv4Address();
    return ip.range() === 'unicast';
  } catch {
    return false;
  }
}
export async function resolvePublicUrl(input, { lookupFn = lookup } = {}) {
  const url = new URL(input);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !['80', '443'].includes(url.port))
  )
    throw new Error('Разрешены только публичные HTTP(S)-адреса без авторизации');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local'))
    throw new Error('Локальные адреса запрещены');
  const records = ipaddr.isValid(host)
    ? [{ address: host, family: ipaddr.parse(host).kind() === 'ipv6' ? 6 : 4 }]
    : await lookupFn(host, { all: true });
  if (!records.length || records.some((r) => !publicAddress(r.address)))
    throw new Error('Адрес ведёт в непубличную сеть');
  url.hash = '';
  return { url, records };
}
export async function publicFetch(
  input,
  { headers = {}, maxBytes = 1_500_000, timeout = 12000, redirects = 4, beforeFetch = null } = {},
) {
  let target = input;
  for (let i = 0; i <= redirects; i++) {
    const { url, records } = await resolvePublicUrl(target);
    if (beforeFetch && !(await beforeFetch(url.href)))
      throw new Error('Перенаправление запрещено правилами обхода');
    const agent = new Agent({
      connect: {
        lookup: (_hostname, options, callback) => {
          if (options?.all) callback(null, records);
          else callback(null, records[0].address, records[0].family);
        },
      },
    });
    try {
      const response = await fetch(url, {
        dispatcher: agent,
        redirect: 'manual',
        signal: AbortSignal.timeout(timeout),
        headers: {
          'user-agent': 'LifeOSBot/0.1 (+https://github.com/ritmiro1/Game2)',
          accept: 'text/html,application/atom+xml,application/rss+xml,text/plain;q=0.8',
          ...headers,
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) throw new Error('Перенаправление без адреса');
        target = new URL(location, url).href;
        continue;
      }
      const length = Number(response.headers.get('content-length') || 0);
      if (length > maxBytes) {
        await response.body?.cancel();
        throw new Error('Документ превышает лимит');
      }
      const reader = response.body?.getReader();
      let size = 0;
      const chunks = [];
      if (reader)
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > maxBytes) {
            await reader.cancel();
            throw new Error('Документ превышает лимит');
          }
          chunks.push(value);
        }
      return {
        url: url.href,
        status: response.status,
        headers: Object.fromEntries(response.headers),
        text: Buffer.concat(chunks).toString('utf8'),
      };
    } finally {
      await agent.close();
    }
  }
  throw new Error('Слишком много перенаправлений');
}
