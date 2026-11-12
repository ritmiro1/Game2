import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
test('search-only HTTP server enforces admin scope, origin and genuine empty results', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lifeos-api-'));
  const child = spawn(process.execPath, ['server/index.mjs', '--search-only'], {
    env: {
      ...process.env,
      PORT: '0',
      LIFEOS_DATA_DIR: dir,
      LIFEOS_AUTO_CRAWL: '0',
      LIFEOS_ADMIN_TOKEN: 'integration-test-only-token',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('API startup timeout')), 10000);
    child.stdout.on('data', (b) => {
      out += b;
      const m = out.match(/listening on 0.0.0.0:(\d+)/);
      if (m) {
        clearTimeout(timeout);
        resolve(m[1]);
      }
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error('API exited ' + code));
    });
  });
  const base = 'http://127.0.0.1:' + port;
  async function rpc(action, args = {}, headers = {}) {
    return fetch(base + '/api/rpc', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ action, args }),
    });
  }
  try {
    assert.equal((await fetch(base + '/healthz')).status, 200);
    assert.equal((await rpc('state')).status, 403);
    assert.equal(
      (await rpc('state', {}, { authorization: 'Bearer integration-test-only-token' })).status,
      403,
    );
    assert.equal((await rpc('crawl')).status, 403);
    assert.equal(
      (await rpc('webSearch', { query: 'actual query' }, { origin: 'https://evil.example' }))
        .status,
      403,
    );
    const r = await rpc('webSearch', { query: 'unindexed-query' });
    const j = await r.json();
    assert.equal(r.status, 200);
    assert.equal(j.data.results.length, 0);
    assert.equal(j.data.mode, 'independent');
    const bad = await rpc(
      'addSource',
      { url: 'http://127.0.0.1/private' },
      { authorization: 'Bearer integration-test-only-token' },
    );
    assert.equal(bad.status, 400);
  } finally {
    child.kill('SIGTERM');
    await once(child, 'exit');
    rmSync(dir, { recursive: true, force: true });
  }
});
