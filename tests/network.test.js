import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { once } from 'node:events';
import WebSocket from 'ws';
import { getLegalActions } from '../shared/engine.js';

let URL;

async function freePort() {
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  probe.close();
  await once(probe, 'close');
  return port;
}

class Client {
  constructor() {
    this.messages = [];
    this.waiters = [];
    this.ws = new WebSocket(URL);
    this.ready = new Promise((resolve, reject) => {
      this.ws.once('open', resolve);
      this.ws.once('error', reject);
    });
    this.ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      this.messages.push(message);
      this.waiters = this.waiters.filter((waiter) => {
        if (waiter.predicate(message)) {
          clearTimeout(waiter.timer);
          waiter.resolve(message);
          return false;
        }
        return true;
      });
    });
  }

  async open(name, token) {
    await this.ready;
    this.send('hello', { name, token });
    return this.waitFor('welcome', 4000);
  }

  send(type, payload = {}) {
    this.ws.send(JSON.stringify({ type, ...payload }));
  }

  waitFor(typeOrPredicate, timeout = 4000) {
    const predicate = typeof typeOrPredicate === 'function' ? typeOrPredicate : (message) => message.type === typeOrPredicate;
    const existing = this.messages.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, timer: null };
      waiter.timer = setTimeout(() => {
        this.waiters = this.waiters.filter((item) => item !== waiter);
        reject(new Error(`Timed out waiting for ${typeOrPredicate}`));
      }, timeout);
      this.waiters.push(waiter);
    });
  }

  close() {
    this.ws.close();
  }
}

test('authoritative online duel: matchmaking, hidden hands, reveal, reconnect and Elo', { timeout: 20000 }, async (t) => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'palimpsest-test-'));
  const port = await freePort();
  URL = `ws://127.0.0.1:${port}/ws`;
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), PALIMPSEST_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  child.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
  child.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server did not start: ${serverLog}`)), 4000);
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('Authority server')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once('error', reject);
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGKILL');
      await exited;
    }
    rmSync(dataDir, { recursive: true, force: true });
  });

  const a = new Client();
  const b = new Client();
  t.after(() => { a.close(); b.close(); });
  const welcomeA = await a.open('ТЕСТ-А');
  const welcomeB = await b.open('ТЕСТ-Б');
  assert.ok(welcomeA.token && welcomeB.token);

  a.send('quick_match', { heroId: 'aria', ranked: true });
  await a.waitFor('queue');
  b.send('quick_match', { heroId: 'vector', ranked: true });
  const startA = await a.waitFor('match_started');
  const startB = await b.waitFor('match_started');
  assert.equal(startA.room.ranked, true);
  assert.equal(startA.state.players[0].hand.length, 5);
  assert.equal(startA.state.players[1].hand.length, 0, 'opponent hand must be hidden');
  assert.equal(startB.state.players[1].hand.length, 5);
  assert.equal(startB.state.players[0].hand.length, 0);

  const actionA = getLegalActions(startA.state, 0)[0];
  const actionB = getLegalActions(startB.state, 1)[0];
  a.send('submit_action', { action: actionA });
  b.send('submit_action', { action: actionB });
  const resolutionA = await a.waitFor('resolution');
  const resolutionB = await b.waitFor('resolution');
  assert.equal(resolutionA.result.actions.length, 2);
  assert.equal(resolutionA.state.round, 2);
  assert.equal(resolutionB.state.round, 2);
  assert.ok(resolutionA.result.events.length > 2);

  // Drop without a leave message, then restore the same guest token.
  b.ws.terminate();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const restored = new Client();
  t.after(() => restored.close());
  await restored.open('ТЕСТ-Б', welcomeB.token);
  const reconnect = await restored.waitFor('reconnected');
  assert.equal(reconnect.room.players[1].connected, true);
  assert.equal(reconnect.state.round, 2);

  a.send('leave_room');
  const finished = await restored.waitFor('match_finished');
  assert.equal(finished.state.winner, 1);
  assert.equal(finished.state.winReason, 'forfeit');
  assert.ok(finished.ratingChanges[1].after > 1000);
  assert.ok(finished.ratingChanges[0].after < 1000);
});
