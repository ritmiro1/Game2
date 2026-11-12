import test from 'node:test';
import assert from 'node:assert/strict';
import { SearchEngine, parseDocument } from '../core/search.mjs';
import { publicAddress, resolvePublicUrl } from '../core/network.mjs';
const html = (word, date = '2026-11-12T12:00:00Z') =>
  `<html><head><title>${word} launch</title>${date ? `<meta property="article:published_time" content="${date}">` : ''}</head><body><nav>ignore nav</nav><article><h1>${word}</h1><p>Fresh ${word} information for LifeOS.</p></article><script>alert('bad')</script></body></html>`;
test('HTML extraction is text-only and does not invent publication dates', () => {
  const d = parseDocument(html('Orion', null), 'https://example.com/news');
  assert.equal(d.publishedAt, null);
  assert.ok(!d.text.includes('alert'));
  assert.ok(!d.text.includes('ignore nav'));
  assert.ok(d.title.includes('Orion'));
});
test('real index reflects new, updated and removed publications', async () => {
  let word = 'Orion',
    code = 200;
  const fetcher = async (url) => ({
    url,
    status: url.endsWith('robots.txt') ? 404 : code,
    headers: { 'content-type': 'text/html' },
    text: html(word),
  });
  const engine = new SearchEngine(':memory:', { seed: false, delay: 0, fetcher });
  const id = engine.addSource('News', 'https://example.com/news');
  await engine.crawlUrl('https://example.com/news', id);
  assert.equal(engine.query('Orion').results.length, 1);
  word = 'Artemis';
  await engine.crawlUrl('https://example.com/news', id);
  assert.equal(engine.query('Orion').results.length, 0);
  assert.equal(engine.query('Artemis').results.length, 1);
  code = 410;
  await engine.crawlUrl('https://example.com/news', id);
  assert.equal(engine.query('Artemis').results.length, 0);
  await engine.close();
});
test('robots disallow prevents document fetch', async () => {
  let pages = 0;
  const e = new SearchEngine(':memory:', {
    seed: false,
    fetcher: async (url) => {
      if (!url.endsWith('robots.txt')) pages++;
      return { url, status: 200, headers: {}, text: 'User-agent: *\nDisallow: /private' };
    },
  });
  await assert.rejects(e.crawlUrl('https://example.com/private/a', 'x'), /robots/);
  assert.equal(pages, 0);
  await e.close();
});
test('unavailable robots fails closed', async () => {
  const e = new SearchEngine(':memory:', {
    seed: false,
    fetcher: async (url) => ({ url, status: 503, headers: {}, text: '' }),
  });
  await assert.rejects(e.crawlUrl('https://example.com/a', 'x'), /robots/);
  await e.close();
});
test('search handles operators safely and filters source', async () => {
  const e = new SearchEngine(':memory:', { seed: false });
  e.index(parseDocument(html('Orion'), 'https://one.example/news'));
  e.index(parseDocument(html('Orion'), 'https://two.example/news'));
  assert.equal(e.query('Orion site:one.example').results.length, 1);
  assert.doesNotThrow(() => e.query('" OR NEAR ( DROP TABLE --'));
  assert.equal(e.query('   ').results.length, 0);
  await e.close();
});
test('last fetch is not substituted for unknown publication date', async () => {
  const e = new SearchEngine(':memory:', { seed: false });
  e.index(parseDocument(html('Orion', null), 'https://example.com/a'));
  const d = e.query('Orion').results[0];
  assert.equal(d.publishedAt, null);
  assert.ok(d.lastFetchedAt);
  assert.equal(e.query('Orion', { period: 'day' }).results.length, 0);
  await e.close();
});
test('SSRF rejects loopback, IPv6 mapped loopback, private and mixed DNS', async () => {
  for (const address of [
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '::1',
    '::ffff:127.0.0.1',
    '224.0.0.1',
  ])
    assert.equal(publicAddress(address), false);
  assert.equal(publicAddress('8.8.8.8'), true);
  for (const url of [
    'http://localhost',
    'http://127.1',
    'http://0x7f000001',
    'http://[::1]',
    'file:///etc/passwd',
    'https://a:b@example.com',
    'http://8.8.8.8:22',
  ])
    await assert.rejects(resolvePublicUrl(url));
  await assert.rejects(
    resolvePublicUrl('https://example.com', {
      lookupFn: async () => [
        { address: '8.8.8.8', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ],
    }),
  );
});
test('RSS, Atom, sitemap discovery extracts real same-origin URLs', async () => {
  const { parseFeed } = await import('../core/search.mjs');
  assert.deepEqual(
    parseFeed(
      '<rss><channel><item><link>https://example.com/fresh</link></item><item><link>http://127.0.0.1/private</link></item></channel></rss>',
      'https://example.com/feed.xml',
    ),
    ['https://example.com/fresh'],
  );
  assert.deepEqual(
    parseFeed(
      '<feed><entry><link rel="alternate" href="/news"/></entry></feed>',
      'https://example.com/feed',
    ),
    ['https://example.com/news'],
  );
  assert.deepEqual(
    parseFeed(
      '<urlset><url><loc>https://example.com/a</loc></url></urlset>',
      'https://example.com/sitemap.xml',
    ),
    ['https://example.com/a'],
  );
});
test('feed crawl discovers new documents and never fabricates full page metadata', async () => {
  const e = new SearchEngine(':memory:', {
    seed: false,
    delay: 0,
    fetcher: async (url) =>
      url.endsWith('robots.txt')
        ? { url, status: 404, headers: {}, text: '' }
        : url.endsWith('feed.xml')
          ? {
              url,
              status: 200,
              headers: { 'content-type': 'application/rss+xml' },
              text: '<rss><channel><item><link>https://example.com/news/fresh</link></item></channel></rss>',
            }
          : {
              url,
              status: 200,
              headers: { 'content-type': 'text/html' },
              text: html('FreshDiscovery'),
            },
  });
  e.addSource('feed', 'https://example.com/news/feed.xml');
  await e.crawl();
  assert.equal(e.query('FreshDiscovery').results.length, 1);
  await e.close();
});
