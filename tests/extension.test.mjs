import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { readFile, stat } from "node:fs/promises";
import { test } from "node:test";
import { Chess } from "../extension/vendor/chess.js";

const execFile = promisify(execFileCallback);

const manifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"));

test("extension is MV3 and requests only tab-management permissions", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(new Set(manifest.permissions), new Set(["tabs", "sessions", "storage", "alarms"]));
  assert.equal(manifest.host_permissions, undefined);
  assert.match(manifest.content_security_policy.extension_pages, /wasm-unsafe-eval/);
});

test("offline chess assets and their license notices ship with the extension", async () => {
  for (const file of [
    "../extension/vendor/chess.js",
    "../extension/vendor/CHESS-LICENSE.txt",
    "../extension/vendor/stockfish-19-lite-single.js",
    "../extension/vendor/stockfish-19-lite-single.wasm",
    "../extension/vendor/STOCKFISH-LICENSE.txt",
    "../extension/vendor/espeak/espeak-ng.js",
    "../extension/vendor/espeak/espeak-ng.wasm",
    "../extension/vendor/espeak/ESPEAK-LICENSE.txt",
    "../extension/vendor/espeak/UPSTREAM.txt",
  ]) {
    const info = await stat(new URL(file, import.meta.url));
    assert.ok(info.size > 0, `${file} is empty`);
  }
});

test("local chess rules support legal play and undo/redo history", () => {
  const game = new Chess();
  assert.equal(game.moves().length, 20);
  game.move("e4");
  game.move("e5");
  game.move("Nf3");
  assert.equal(game.history().join(" "), "e4 e5 Nf3");
  assert.equal(game.turn(), "b");
  assert.ok(game.fen().includes("b KQkq"));
  const undone = game.undo();
  assert.equal(undone.san, "Nf3");
  assert.equal(game.turn(), "w");
  game.move({ from: "g1", to: "f3" });
  assert.equal(game.history().at(-1), "Nf3");
});

test("the bundled eSpeak worker synthesizes Russian WAV audio offline", async () => {
  const workerUrl = new URL("../extension/chess/tts-worker.js", import.meta.url).href;
  const script = `
    const handlers = new Map();
    const replies = [];
    globalThis.self = globalThis;
    globalThis.addEventListener = (type, handler) => handlers.set(type, handler);
    globalThis.postMessage = (message) => replies.push(message);
    await import(${JSON.stringify(workerUrl)});
    handlers.get("message")({ data: { type: "synthesize", id: 7, text: "Хороший ход. Конь занимает центр.", rate: 0.95 } });
    const deadline = Date.now() + 30000;
    while (!replies.length && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
    const result = replies[0];
    if (!result || result.type !== "audio") throw new Error(JSON.stringify(result));
    const bytes = new Uint8Array(result.audio);
    const text = (start, end) => new TextDecoder().decode(bytes.slice(start, end));
    if (text(0, 4) !== "RIFF" || text(8, 12) !== "WAVE") throw new Error("Invalid WAV header");
    if (bytes.slice(44).every((sample) => sample === 0)) throw new Error("WAV has no synthesized audio samples");
    console.log(JSON.stringify({ type: result.type, bytes: bytes.length }));
  `;
  const { stdout } = await execFile(process.execPath, ["--input-type=module", "-e", script], {
    cwd: process.cwd(),
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
  const result = JSON.parse(stdout.trim());
  assert.equal(result.type, "audio");
  assert.ok(result.bytes > 1000, "WAV output should contain synthesized speech");
});

test("the chess window includes a no-hints self-test, speech voice and board/threat settings", async () => {
  const html = await readFile(new URL("../extension/chess/index.html", import.meta.url), "utf8");
  for (const id of ["mode-test", "bot-level", "undo-move", "redo-move", "show-annotations", "show-best-arrow", "show-threat-lines", "speak-comments", "speech-voice", "review-game"]) {
    assert.ok(html.includes(`id="${id}"`), `Missing UI control ${id}`);
  }
  assert.match(html, /Встроенный русский голос|русский голос eSpeak|eSpeak/);
});
