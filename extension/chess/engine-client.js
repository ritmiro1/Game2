export class LocalChessEngine {
  constructor() {
    this.worker = null;
    this.readyPromise = null;
    this.resolveReady = null;
    this.rejectReady = null;
    this.readyTimeout = 0;
    this.readyWaiters = [];
    this.search = null;
    this.currentSkill = null;
    this.failed = null;
    this.lines = [];
  }

  get ready() {
    return Boolean(this.worker && !this.failed && this.readyPromise);
  }

  async init() {
    if (this.failed) throw this.failed;
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
      this.readyTimeout = window.setTimeout(() => {
        this.fail(new Error("Локальный движок не ответил вовремя."));
      }, 25000);
    });

    try {
      const scriptUrl = typeof chrome !== "undefined" && chrome.runtime?.getURL
        ? chrome.runtime.getURL("vendor/stockfish-19-lite-single.js")
        : new URL("../vendor/stockfish-19-lite-single.js", import.meta.url).href;
      this.worker = new Worker(scriptUrl, { name: "ladya-stockfish" });
      this.worker.addEventListener("message", (event) => this.handleLine(String(event.data || "").trim()));
      this.worker.addEventListener("error", (event) => {
        event.preventDefault?.();
        this.fail(new Error("Не удалось запустить локальный шахматный движок."));
      });
      this.worker.postMessage("uci");
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error("Не удалось создать шахматный движок."));
    }
    return this.readyPromise;
  }

  handleLine(line) {
    if (!line) return;
    this.lines.push(line);
    if (this.lines.length > 120) this.lines.shift();

    // Some engine builds stream several UCI tokens in one worker message.
    if (line.includes("uciok")) {
      window.clearTimeout(this.readyTimeout);
      this.readyTimeout = 0;
      this.resolveReady?.(true);
      this.resolveReady = null;
      this.rejectReady = null;
    }

    if (line.includes("readyok")) {
      const waiter = this.readyWaiters.shift();
      waiter?.resolve();
    }

    if (line.includes("info depth ") && this.search) {
      const info = parseInfo(line);
      if (info && (!this.search.info || info.depth >= this.search.info.depth)) {
        this.search.info = info;
      }
    }

    if (line.includes("bestmove ") && this.search) {
      const search = this.search;
      this.search = null;
      window.clearTimeout(search.timeout);
      const match = line.match(/bestmove\s+(\S+)(?:\s+ponder\s+(\S+))?/);
      search.resolve({
        bestMove: match?.[1] || "0000",
        ponder: match?.[2] || null,
        ...(search.info || {}),
        raw: line,
      });
    }
  }

  async sync() {
    await this.init();
    const readyPromise = new Promise((resolve, reject) => {
      const waiter = { resolve, reject, timeout: 0 };
      waiter.timeout = window.setTimeout(() => {
        const index = this.readyWaiters.indexOf(waiter);
        if (index >= 0) this.readyWaiters.splice(index, 1);
        reject(new Error("Движок не завершил подготовку позиции."));
      }, 10000);
      const originalResolve = waiter.resolve;
      waiter.resolve = () => {
        window.clearTimeout(waiter.timeout);
        originalResolve();
      };
      this.readyWaiters.push(waiter);
    });
    this.worker.postMessage("isready");
    return readyPromise;
  }

  async analyze(fen, { depth = 9, skill = 20 } = {}) {
    await this.init();
    if (this.search) throw new Error("Движок уже анализирует другую позицию.");
    const normalizedSkill = Math.min(20, Math.max(0, Math.round(skill)));
    if (this.currentSkill !== normalizedSkill) {
      this.worker.postMessage(`setoption name Skill Level value ${normalizedSkill}`);
      this.currentSkill = normalizedSkill;
    }
    await this.sync();
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.worker.postMessage("stop");
        const search = this.search;
        this.search = null;
        search?.reject(new Error("Анализ превысил отведённое время."));
      }, 30000);
      this.search = { resolve, reject, info: null, timeout };
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go depth ${Math.min(16, Math.max(4, Math.round(depth)))}`);
    });
  }

  async chooseMove(fen, { depth = 8, skill = 7 } = {}) {
    return this.analyze(fen, { depth, skill });
  }

  async newGame() {
    if (!this.worker || this.failed) return;
    await this.init();
    this.worker.postMessage("ucinewgame");
    await this.sync();
    this.currentSkill = null;
  }

  stop() {
    if (!this.search) return;
    const search = this.search;
    this.search = null;
    window.clearTimeout(search.timeout);
    this.worker.postMessage("stop");
    search.reject(new Error("Анализ остановлен."));
  }

  dispose() {
    window.clearTimeout(this.readyTimeout);
    if (this.search) {
      window.clearTimeout(this.search.timeout);
      this.search.reject(new Error("Движок закрыт."));
      this.search = null;
    }
    for (const waiter of this.readyWaiters.splice(0)) {
      window.clearTimeout(waiter.timeout);
      waiter.reject(new Error("Движок закрыт."));
    }
    try {
      this.worker?.postMessage("quit");
      this.worker?.terminate();
    } catch (_error) {
      // Worker may already have exited.
    }
    this.worker = null;
  }

  fail(error) {
    if (this.failed) return;
    this.failed = error instanceof Error ? error : new Error(String(error));
    window.clearTimeout(this.readyTimeout);
    this.rejectReady?.(this.failed);
    this.resolveReady = null;
    this.rejectReady = null;
    if (this.search) {
      window.clearTimeout(this.search.timeout);
      this.search.reject(this.failed);
      this.search = null;
    }
    for (const waiter of this.readyWaiters.splice(0)) {
      window.clearTimeout(waiter.timeout);
      waiter.reject(this.failed);
    }
  }
}

function parseInfo(line) {
  if (!line.includes(" score ")) return null;
  const depth = Number(line.match(/\bdepth\s+(\d+)/)?.[1] || 0);
  const cp = line.match(/\bscore\s+cp\s+(-?\d+)/);
  const mate = line.match(/\bscore\s+mate\s+(-?\d+)/);
  const pv = line.match(/\bpv\s+(.+)$/)?.[1]?.trim().split(/\s+/) || [];
  return {
    depth,
    scoreCp: cp ? Number(cp[1]) : null,
    mate: mate ? Number(mate[1]) : null,
    pv,
  };
}
