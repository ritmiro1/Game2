import { Chess } from "../vendor/chess.js";
import { LocalChessEngine } from "./engine-client.js";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const FILES = "abcdefgh";
const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const PIECE_GLYPHS = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};
const PIECE_NAMES = { p: "пешка", n: "конь", b: "слон", r: "ладья", q: "ферзь", k: "король" };
const PIECE_ACCUSATIVE = { p: "пешку", n: "коня", b: "слона", r: "ладью", q: "ферзя", k: "короля" };
const LEVELS = {
  beginner: { label: "начинающий", skill: 0, depth: 5, randomness: 0.85 },
  casual: { label: "любитель", skill: 4, depth: 6, randomness: 0.58 },
  club: { label: "клубный уровень", skill: 8, depth: 7, randomness: 0.36 },
  strong: { label: "сильный уровень", skill: 13, depth: 9, randomness: 0.17 },
  expert: { label: "экспертный уровень", skill: 20, depth: 10, randomness: 0.05 },
};
const ANNOTATIONS = {
  best: { title: "Лучший ход", symbol: "★", icon: "★", kind: "best" },
  excellent: { title: "Отличный ход", symbol: "!!", icon: "‼", kind: "excellent" },
  good: { title: "Хороший ход", symbol: "!", icon: "✓", kind: "good" },
  inaccuracy: { title: "Неточность", symbol: "?!", icon: "?!", kind: "inaccuracy" },
  mistake: { title: "Ошибка", symbol: "?", icon: "?", kind: "mistake" },
  blunder: { title: "Грубая ошибка", symbol: "??", icon: "‼", kind: "blunder" },
  unknown: { title: "Ход записан", symbol: "·", icon: "·", kind: "unknown" },
};
const DEFAULT_SETTINGS = {
  mode: "coach",
  botLevel: "club",
  playAs: "white",
  boardTheme: "forest",
  pieceStyle: "classic",
  boardSize: 620,
  coordinates: true,
  legalMoves: true,
  annotations: true,
  bestArrow: true,
  threatLines: true,
  comments: true,
  speakComments: true,
  speechRate: 0.95,
  speechVoice: "espeak",
  coachDepth: 9,
};

const $ = (selector) => document.querySelector(selector);
const ui = {
  board: $("#chessboard"),
  boardSurface: $("#board-surface"),
  boardWrap: $("#board-wrap"),
  arrowLines: $("#arrow-lines"),
  evalRail: $(".eval-rail"),
  evalBar: $("#eval-bar"),
  evalBarScore: $("#eval-bar-score"),
  movesList: $("#moves-list"),
  undo: $("#undo-move"),
  redo: $("#redo-move"),
  moveIndexLabel: $("#move-index-label"),
  humanColorLabel: $("#human-color-label"),
  humanAvatar: $("#human-avatar"),
  humanIndicator: $("#human-indicator"),
  botIndicator: $("#bot-indicator"),
  botLevelLabel: $("#bot-level-label"),
  humanMaterial: $("#human-material"),
  botMaterial: $("#bot-material"),
  modeCoach: $("#mode-coach"),
  modeTest: $("#mode-test"),
  botLevel: $("#bot-level"),
  playAs: $("#play-as"),
  startGame: $("#start-game"),
  newGame: $("#new-game"),
  flipBoard: $("#flip-board"),
  closeWindow: $("#close-window"),
  verdictIcon: $("#verdict-icon"),
  verdictTitle: $("#verdict-title"),
  verdictScore: $("#verdict-score"),
  coachComment: $("#coach-comment"),
  coachDetail: $("#coach-detail"),
  coachTags: $("#coach-tags"),
  engineStatus: $("#engine-status"),
  voiceState: $("#voice-state"),
  speakAgain: $("#speak-again"),
  boardTheme: $("#board-theme"),
  pieceStyle: $("#piece-style"),
  boardSize: $("#board-size"),
  boardSizeValue: $("#board-size-value"),
  showCoordinates: $("#show-coordinates"),
  showLegalMoves: $("#show-legal-moves"),
  showAnnotations: $("#show-annotations"),
  showBestArrow: $("#show-best-arrow"),
  showThreatLines: $("#show-threat-lines"),
  showComments: $("#show-comments"),
  speakComments: $("#speak-comments"),
  speechVoice: $("#speech-voice"),
  speechRate: $("#speech-rate"),
  speechRateValue: $("#speech-rate-value"),
  localVoiceNote: $("#local-voice-note"),
  coachDepth: $("#coach-depth"),
  settingsToggle: $("#settings-toggle"),
  settingsBody: $("#settings-body"),
  promotionModal: $("#promotion-modal"),
  promotionOptions: $("#promotion-options"),
  gameoverModal: $("#gameover-modal"),
  gameoverTitle: $("#gameover-title"),
  gameoverCopy: $("#gameover-copy"),
  gameoverEmblem: $("#gameover-emblem"),
  gameoverNew: $("#gameover-new"),
  reviewGame: $("#review-game"),
  boardOverlay: $("#board-overlay"),
  copyPgn: $("#copy-pgn"),
};

let settings = { ...DEFAULT_SETTINGS };
let chess = new Chess();
let engine = new LocalChessEngine();
let engineAvailable = false;
let moves = [];
let cursor = 0;
let mode = "coach";
let userColor = "w";
let orientation = "w";
let selectedSquare = null;
let legalMoves = [];
let busy = false;
let gameStarted = false;
let gameEnded = false;
let reviewRevealed = false;
let pendingPromotion = null;
let currentHint = null;
let currentComment = "";
let analysisCache = new Map();
let localRussianVoices = [];
let ignoreNextClickUntil = 0;
let espeakWorker = null;
let espeakSequence = 0;
let speechGeneration = 0;
let pendingSpeech = new Map();
let audioContext = null;
let audioScheduledUntil = 0;
let activeAudioSources = new Set();
let audioPlaybackQueue = Promise.resolve();

function isExtensionPage() {
  return typeof chrome !== "undefined" && Boolean(chrome.runtime?.getURL);
}

async function loadSettings() {
  let stored = null;
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const data = await chrome.storage.local.get("chessSettings");
      stored = data.chessSettings || null;
    } else {
      stored = JSON.parse(localStorage.getItem("ladya-chess-settings") || "null");
    }
  } catch (_error) {
    stored = null;
  }
  settings = { ...DEFAULT_SETTINGS, ...(stored || {}) };
  if (!(settings.boardTheme in { forest: true, classic: true, ocean: true, sand: true })) settings.boardTheme = "forest";
  if (!(settings.botLevel in LEVELS)) settings.botLevel = "club";
  if (!Number.isFinite(Number(settings.boardSize))) settings.boardSize = 620;
  settings.boardSize = Math.min(700, Math.max(360, Number(settings.boardSize)));
  settings.coachDepth = Math.min(11, Math.max(7, Number(settings.coachDepth) || 9));
  mode = settings.mode === "test" ? "test" : "coach";
  applySettingsToControls();
}

async function saveSettings() {
  settings.mode = mode;
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.set({ chessSettings: settings });
    } else {
      localStorage.setItem("ladya-chess-settings", JSON.stringify(settings));
    }
  } catch (_error) {
    // Local interaction still works if extension storage is temporarily unavailable.
  }
}

function applySettingsToControls() {
  ui.modeCoach.classList.toggle("is-active", mode === "coach");
  ui.modeTest.classList.toggle("is-active", mode === "test");
  ui.modeCoach.setAttribute("aria-pressed", String(mode === "coach"));
  ui.modeTest.setAttribute("aria-pressed", String(mode === "test"));
  ui.botLevel.value = settings.botLevel;
  ui.playAs.value = settings.playAs;
  ui.boardTheme.value = settings.boardTheme;
  ui.pieceStyle.value = settings.pieceStyle;
  ui.boardSize.value = String(settings.boardSize);
  ui.showCoordinates.checked = settings.coordinates;
  ui.showLegalMoves.checked = settings.legalMoves;
  ui.showAnnotations.checked = settings.annotations;
  ui.showBestArrow.checked = settings.bestArrow;
  ui.showThreatLines.checked = settings.threatLines;
  ui.showComments.checked = settings.comments;
  ui.speakComments.checked = settings.speakComments;
  ui.speechRate.value = String(settings.speechRate);
  ui.coachDepth.value = String(settings.coachDepth);
  ui.speechVoice.value = settings.speechVoice || "";
  ui.boardSizeValue.textContent = `${settings.boardSize}px`;
  ui.speechRateValue.textContent = `${Number(settings.speechRate).toFixed(2)}×`;
  applyBoardPreferences();
  updateVoiceUi();
}

function bindEvents() {
  ui.board.addEventListener("click", (event) => {
    if (Date.now() < ignoreNextClickUntil) return;
    const square = event.target.closest("[data-square]");
    if (square) void handleSquare(square.dataset.square);
  });
  ui.board.addEventListener("dragstart", handleDragStart);
  ui.board.addEventListener("dragover", (event) => {
    if (event.target.closest("[data-square]")) event.preventDefault();
  });
  ui.board.addEventListener("drop", handleDrop);
  ui.undo.addEventListener("click", () => void goToPly(cursor - 1));
  ui.redo.addEventListener("click", () => void goToPly(cursor + 1));
  ui.movesList.addEventListener("click", (event) => {
    const token = event.target.closest("[data-ply]");
    if (token) void goToPly(Number(token.dataset.ply));
  });
  ui.modeCoach.addEventListener("click", () => void changeMode("coach"));
  ui.modeTest.addEventListener("click", () => void changeMode("test"));
  ui.botLevel.addEventListener("change", () => {
    settings.botLevel = ui.botLevel.value;
    renderHeader();
    void saveSettings();
  });
  ui.playAs.addEventListener("change", () => {
    settings.playAs = ui.playAs.value;
    void saveSettings();
  });
  ui.startGame.addEventListener("click", () => { unlockAudio(); void startNewGame(); });
  ui.newGame.addEventListener("click", () => { unlockAudio(); void startNewGame(); });
  ui.gameoverNew.addEventListener("click", () => { unlockAudio(); void startNewGame(); });
  ui.flipBoard.addEventListener("click", () => {
    orientation = orientation === "w" ? "b" : "w";
    render();
  });
  ui.closeWindow.addEventListener("click", () => {
    if (isExtensionPage()) window.close();
    else window.location.href = "../popup/popup.html";
  });
  ui.speakAgain.addEventListener("click", () => speakComment(currentComment, true));
  ui.copyPgn.addEventListener("click", () => void copyPgn());
  ui.settingsToggle.addEventListener("click", () => {
    const collapsed = !ui.settingsBody.classList.contains("is-collapsed");
    ui.settingsBody.classList.toggle("is-collapsed", collapsed);
    ui.settingsToggle.textContent = collapsed ? "+" : "−";
    ui.settingsToggle.setAttribute("aria-expanded", String(!collapsed));
  });
  ui.reviewGame.addEventListener("click", () => void reviewCompletedGame());
  ui.promotionOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-promotion]");
    if (!button || !pendingPromotion) return;
    const choice = button.dataset.promotion;
    const pending = pendingPromotion;
    pendingPromotion = null;
    ui.promotionModal.hidden = true;
    void performHumanMove(pending.from, pending.to, choice);
  });

  ui.boardTheme.addEventListener("change", () => updateSetting("boardTheme", ui.boardTheme.value));
  ui.pieceStyle.addEventListener("change", () => updateSetting("pieceStyle", ui.pieceStyle.value));
  ui.boardSize.addEventListener("input", () => {
    settings.boardSize = Number(ui.boardSize.value);
    ui.boardSizeValue.textContent = `${settings.boardSize}px`;
    applyBoardPreferences();
    void saveSettings();
  });
  for (const [element, key] of [
    [ui.showCoordinates, "coordinates"],
    [ui.showLegalMoves, "legalMoves"],
    [ui.showAnnotations, "annotations"],
    [ui.showBestArrow, "bestArrow"],
    [ui.showThreatLines, "threatLines"],
    [ui.showComments, "comments"],
    [ui.speakComments, "speakComments"],
  ]) {
    element.addEventListener("change", () => {
      settings[key] = element.checked;
      if (key === "speakComments" || key === "comments") {
        if (settings.speakComments && settings.comments) unlockAudio();
        else stopSpeech();
      }
      applyBoardPreferences();
      updateVoiceUi();
      render();
      void saveSettings();
    });
  }
  ui.speechRate.addEventListener("input", () => {
    settings.speechRate = Number(ui.speechRate.value);
    ui.speechRateValue.textContent = `${settings.speechRate.toFixed(2)}×`;
    void saveSettings();
  });
  ui.speechVoice.addEventListener("change", () => {
    settings.speechVoice = ui.speechVoice.value;
    updateVoiceUi();
    void saveSettings();
  });
  ui.coachDepth.addEventListener("change", () => {
    settings.coachDepth = Number(ui.coachDepth.value);
    analysisCache.clear();
    void saveSettings();
    if (gameStarted && !busy && mode === "coach") void refreshCurrentAnalysis();
  });
  window.addEventListener("resize", applyBoardPreferences);
  window.addEventListener("beforeunload", () => {
    engine.dispose();
    stopSpeech();
    espeakWorker?.terminate();
    espeakWorker = null;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      ui.promotionModal.hidden = true;
      pendingPromotion = null;
      if (!ui.gameoverModal.hidden) ui.gameoverModal.hidden = true;
    }
    if ((event.altKey || event.ctrlKey || event.metaKey) && event.key === "ArrowLeft") {
      event.preventDefault();
      if (!ui.undo.disabled) void goToPly(cursor - 1);
    }
    if ((event.altKey || event.ctrlKey || event.metaKey) && event.key === "ArrowRight") {
      event.preventDefault();
      if (!ui.redo.disabled) void goToPly(cursor + 1);
    }
  });

  if ("speechSynthesis" in window) {
    window.speechSynthesis.addEventListener?.("voiceschanged", refreshLocalVoices);
    window.speechSynthesis.onvoiceschanged = refreshLocalVoices;
  }
}

function updateSetting(key, value) {
  settings[key] = value;
  applyBoardPreferences();
  render();
  void saveSettings();
}

function applyBoardPreferences() {
  const themes = ["theme-forest", "theme-classic", "theme-ocean", "theme-sand"];
  ui.boardSurface.classList.remove(...themes, "pieces-contrast");
  ui.boardSurface.classList.add(`theme-${settings.boardTheme || "forest"}`);
  if (settings.pieceStyle === "contrast") ui.boardSurface.classList.add("pieces-contrast");
  ui.boardSurface.classList.toggle("coordinates-off", !settings.coordinates);
  const selectedSize = Math.min(700, Math.max(360, Number(settings.boardSize) || 620));
  document.documentElement.style.setProperty("--board-size", `${selectedSize}px`);
}

async function initialize() {
  bindEvents();
  await loadSettings();
  render();
  setEngineStatus("Загружаю локальный движок…", "working");
  try {
    await engine.init();
    engineAvailable = true;
    setEngineStatus("Stockfish готов · локально", "ready");
  } catch (_error) {
    engineAvailable = false;
    setEngineStatus("Движок недоступен · простой бот", "error");
  }
  refreshLocalVoices();
  render();
}

async function changeMode(nextMode) {
  if (mode === nextMode) return;
  stopSpeech();
  mode = nextMode;
  settings.mode = mode;
  if (mode === "test") {
    currentHint = null;
    currentComment = "";
  }
  applySettingsToControls();
  render();
  await saveSettings();
  if (mode === "coach" && gameStarted && !busy && !gameEnded) await refreshCurrentAnalysis();
}

async function startNewGame() {
  if (busy) return;
  stopSpeech();
  busy = true;
  gameStarted = true;
  gameEnded = false;
  reviewRevealed = false;
  ui.gameoverModal.hidden = true;
  ui.promotionModal.hidden = true;
  pendingPromotion = null;
  analysisCache.clear();
  moves = [];
  cursor = 0;
  selectedSquare = null;
  legalMoves = [];
  currentComment = "";
  currentHint = null;
  chess = new Chess(START_FEN);
  const colorChoice = ui.playAs.value || settings.playAs || "white";
  userColor = colorChoice === "random" ? (Math.random() < 0.5 ? "w" : "b") : colorChoice === "black" ? "b" : "w";
  orientation = userColor;
  settings.botLevel = ui.botLevel.value || settings.botLevel;
  settings.playAs = colorChoice;
  settings.mode = mode;
  applySettingsToControls();
  render();
  setEngineStatus(engineAvailable ? "Готовлю позицию…" : "Простой локальный бот", engineAvailable ? "working" : "error");
  await saveSettings();

  try {
    if (!engineAvailable) {
      try {
        await engine.init();
        engineAvailable = true;
      } catch (_error) {
        engineAvailable = false;
      }
    }
    if (engineAvailable) await engine.newGame();
    if (mode === "coach" && engineAvailable) {
      currentHint = await analyzeFen(chess.fen(), Number(settings.coachDepth));
    }
    if (userColor === "b") await playBotTurn();
  } catch (error) {
    setEngineStatus("Использую резервный режим", "error");
    console.warn("Ладья: локальный движок недоступен", error);
    if (userColor === "b" && !moves.length) await playBotTurn();
  } finally {
    busy = false;
    if (engineAvailable) setEngineStatus("Stockfish готов · локально", "ready");
    render();
  }
}

function canHumanMove() {
  return gameStarted && !gameEnded && !busy && cursor === moves.length && chess.turn() === userColor && !chess.isGameOver();
}

async function handleSquare(square) {
  if (!canHumanMove()) return;
  const piece = chess.get(square);
  if (selectedSquare) {
    const candidate = legalMoves.find((move) => move.to === square);
    if (candidate) {
      if (candidate.promotion) {
        showPromotion(selectedSquare, square);
        return;
      }
      await performHumanMove(selectedSquare, square);
      return;
    }
    if (square === selectedSquare) {
      selectedSquare = null;
      legalMoves = [];
      renderBoard();
      return;
    }
  }
  if (piece?.color === userColor) {
    selectedSquare = square;
    legalMoves = chess.moves({ square, verbose: true });
    renderBoard();
    return;
  }
  selectedSquare = null;
  legalMoves = [];
  renderBoard();
}

function handleDragStart(event) {
  const cell = event.target.closest("[data-square]");
  if (!cell || !canHumanMove()) {
    event.preventDefault();
    return;
  }
  const piece = chess.get(cell.dataset.square);
  if (!piece || piece.color !== userColor) {
    event.preventDefault();
    return;
  }
  selectedSquare = cell.dataset.square;
  legalMoves = chess.moves({ square: selectedSquare, verbose: true });
  event.dataTransfer?.setData("text/plain", selectedSquare);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  renderBoard();
}

function handleDrop(event) {
  const target = event.target.closest("[data-square]");
  if (!target || !canHumanMove()) return;
  event.preventDefault();
  const source = event.dataTransfer?.getData("text/plain") || selectedSquare;
  if (!source) return;
  ignoreNextClickUntil = Date.now() + 250;
  const move = chess.moves({ square: source, verbose: true }).find((candidate) => candidate.to === target.dataset.square);
  if (!move) {
    selectedSquare = null;
    legalMoves = [];
    renderBoard();
    return;
  }
  if (move.promotion) showPromotion(source, target.dataset.square);
  else void performHumanMove(source, target.dataset.square);
}

function showPromotion(from, to) {
  pendingPromotion = { from, to };
  const pieces = ["q", "r", "b", "n"];
  ui.promotionOptions.replaceChildren();
  for (const type of pieces) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "promotion-option";
    button.dataset.promotion = type;
    button.textContent = PIECE_GLYPHS[userColor][type];
    button.setAttribute("aria-label", `Превратить пешку в ${PIECE_NAMES[type]}`);
    ui.promotionOptions.append(button);
  }
  ui.promotionModal.hidden = false;
}

async function performHumanMove(from, to, promotion = null) {
  if (!canHumanMove()) return;
  unlockAudio();
  if (cursor < moves.length) moves = moves.slice(0, cursor);
  const beforeFen = chess.fen();
  const mover = chess.turn();
  const beforeHint = currentHint?.fen === beforeFen ? currentHint : null;
  let move;
  try {
    move = chess.move({ from, to, ...(promotion ? { promotion } : {}) });
  } catch (_error) {
    return;
  }
  const record = makeMoveRecord(move, beforeFen, chess.fen(), false);
  moves.push(record);
  cursor = moves.length;
  busy = true;
  selectedSquare = null;
  legalMoves = [];
  currentHint = null;
  render();

  try {
    if (isAnalysisVisible() && mode === "coach") await annotateRecord(record, beforeHint);
    if (finishIfGameOver()) return;
    if (chess.turn() !== userColor) await playBotTurn();
  } catch (error) {
    console.warn("Ладья: ошибка после хода", error);
    if (!record.comment) addFallbackComment(record);
    if (!chess.isGameOver() && chess.turn() !== userColor) await playBotTurn();
  } finally {
    busy = false;
    if (engineAvailable) setEngineStatus("Stockfish готов · локально", "ready");
    render();
  }
}

function makeMoveRecord(move, beforeFen, afterFen, byBot) {
  return {
    ply: moves.length + 1,
    fullmove: Number(beforeFen.split(/\s+/)[5]) || 1,
    mover: move.color,
    isBot: Boolean(byBot),
    san: move.san,
    from: move.from,
    to: move.to,
    uci: `${move.from}${move.to}${move.promotion || ""}`,
    piece: move.piece,
    captured: move.captured || null,
    promotion: move.promotion || null,
    flags: move.flags || "",
    beforeFen,
    afterFen,
    annotation: null,
    comment: "",
    lossCp: null,
    evalWhiteCp: null,
    bestMove: null,
    pvSan: "",
  };
}

async function playBotTurn() {
  if (chess.isGameOver() || chess.turn() === userColor) return;
  const beforeFen = chess.fen();
  const beforeHint = currentHint?.fen === beforeFen ? currentHint : null;
  const profile = LEVELS[settings.botLevel] || LEVELS.club;
  setEngineStatus(`${profile.label} думает…`, "working");
  render();
  let uci = null;

  if (engineAvailable) {
    try {
      const answer = await engine.chooseMove(beforeFen, { depth: profile.depth, skill: profile.skill });
      if (answer?.bestMove && answer.bestMove !== "0000") uci = answer.bestMove;
    } catch (error) {
      engineAvailable = false;
      setEngineStatus("Движок недоступен · простой бот", "error");
      console.warn("Ладья: Stockfish недоступен, включён резервный бот", error);
    }
  }

  let selectedMove = uci ? moveFromUci(chess, uci) : null;
  if (!selectedMove) selectedMove = chooseFallbackMove(profile);
  if (!selectedMove) {
    finishIfGameOver();
    return;
  }

  const botMove = chess.move({
    from: selectedMove.from,
    to: selectedMove.to,
    ...(selectedMove.promotion ? { promotion: selectedMove.promotion } : {}),
  });
  const record = makeMoveRecord(botMove, beforeFen, chess.fen(), true);
  moves.push(record);
  cursor = moves.length;
  currentHint = null;
  render();

  if (mode === "coach" || reviewRevealed) {
    await annotateRecord(record, beforeHint);
  }
  finishIfGameOver();
}

function moveFromUci(game, uci) {
  const match = String(uci).match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/i);
  if (!match) return null;
  const [from, to, promotion] = [match[1].toLowerCase(), match[2].toLowerCase(), match[3]?.toLowerCase()];
  return game.moves({ square: from, verbose: true }).find((move) => move.to === to && (!move.promotion || move.promotion === promotion)) || null;
}

function chooseFallbackMove(profile = LEVELS.club) {
  const legal = chess.moves({ verbose: true });
  if (!legal.length) return null;
  const game = chess;
  const scored = legal.map((move) => {
    let score = 0;
    if (move.captured) score += (VALUES[move.captured] || 0) * 1.8 - (VALUES[move.piece] || 0) * 0.18;
    if (move.promotion) score += 8;
    const file = FILES.indexOf(move.to[0]);
    const rank = Number(move.to[1]) - 1;
    const centerDistance = Math.abs(3.5 - file) + Math.abs(3.5 - rank);
    score += (7 - centerDistance) * 0.16;
    if (move.piece === "n" || move.piece === "b") score += 0.14;
    score += Math.random() * (profile.randomness || 0.3) * 2.4;
    return { move, score };
  }).sort((a, b) => b.score - a.score);
  if (game.moves().length > 12 && profile.skill >= 13 && Math.random() < 0.86) return scored[0].move;
  const poolSize = profile.skill <= 4 ? Math.min(5, scored.length) : profile.skill <= 9 ? Math.min(3, scored.length) : Math.min(2, scored.length);
  return scored[Math.floor(Math.random() * poolSize)].move;
}

async function annotateRecord(record, previousAnalysis = null, { speak = true } = {}) {
  if (!record) return { before: null, after: null };
  const depth = Number(settings.coachDepth) || 9;
  let before = previousAnalysis?.fen === record.beforeFen ? previousAnalysis.analysis : previousAnalysis;
  let after = null;
  if (before && before.fen) before = before.analysis;

  try {
    if (!engineAvailable) throw new Error("Локальный движок недоступен.");
    setEngineStatus("Оцениваю ход…", "working");
    if (!before?.bestMove) before = await analyzeFen(record.beforeFen, depth);
    after = await analyzeFen(record.afterFen, depth);
    annotateFromAnalyses(record, before, after);
    currentHint = { fen: record.afterFen, analysis: after };
    currentComment = record.comment;
    renderCoach();
    renderMoveHistory();
    if (speak && mode === "coach" && settings.speakComments && settings.comments) speakComment(record.comment);
    setEngineStatus("Stockfish готов · локально", "ready");
    return { before, after };
  } catch (error) {
    record.annotation = "unknown";
    record.comment = fallbackComment(record);
    record.lossCp = null;
    currentHint = null;
    currentComment = record.comment;
    renderCoach();
    renderMoveHistory();
    if (speak && mode === "coach" && settings.speakComments && settings.comments) speakComment(record.comment);
    if (engineAvailable) setEngineStatus("Не удалось оценить ход", "error");
    return { before: before || null, after: null, error };
  }
}

function annotateFromAnalyses(record, before, after) {
  const whiteBefore = whiteEvaluation(before, record.beforeFen);
  const whiteAfter = whiteEvaluation(after, record.afterFen);
  const moverSign = record.mover === "w" ? 1 : -1;
  const beforeForMover = whiteBefore * moverSign;
  const afterForMover = whiteAfter * moverSign;
  const loss = Math.max(0, beforeForMover - afterForMover);
  const sameAsBest = normalizeUci(record.uci) === normalizeUci(before.bestMove);
  record.lossCp = loss;
  record.evalWhiteCp = whiteAfter;
  record.bestMove = before.bestMove;
  record.pvSan = formatPvSan(record.beforeFen, before.pv || []);
  record.annotation = classifyMove(sameAsBest, loss);
  record.comment = generateComment(record, before, after, loss);
  currentComment = record.comment;
}

function classifyMove(isBest, lossCp) {
  if (isBest) return "best";
  if (!Number.isFinite(lossCp)) return "unknown";
  if (lossCp <= 14) return "excellent";
  if (lossCp <= 45) return "good";
  if (lossCp <= 100) return "inaccuracy";
  if (lossCp <= 250) return "mistake";
  return "blunder";
}

function generateComment(record, before, after, lossCp) {
  const actor = record.isBot ? "Соперник" : "Ты";
  const action = describeMove(record);
  const score = formatEvaluation(whiteEvaluation(after, record.afterFen));
  const loss = `${(Math.max(0, lossCp) / 100).toFixed(1).replace(".", ",")} пешки`;
  const best = describeUci(record.beforeFen, before.bestMove);
  const reasons = [
    "Смотри, как меняется контроль ключевых полей.",
    "Проверь, какие фигуры получают новые линии.",
    "Сравни этот план с лучшим продолжением движка.",
  ];
  const positionNote = movePositionNote(record);
  let firstSentence = "";
  switch (record.annotation) {
    case "best":
      firstSentence = `Лучший ход. ${actor} ${action}.`;
      break;
    case "excellent":
      firstSentence = `Очень сильный выбор. ${actor} ${action}; разница с лучшим ходом — всего ${loss}.`;
      break;
    case "good":
      firstSentence = `Хороший ход. ${actor} ${action}. Потеря относительно лучшего продолжения — ${loss}.`;
      break;
    case "inaccuracy":
      firstSentence = `Небольшая неточность. ${actor} ${action}. Точнее было ${best}.`;
      break;
    case "mistake":
      firstSentence = `Ошибка. ${actor} ${action}; позиция стала заметно хуже. Лучше было ${best}.`;
      break;
    case "blunder":
      firstSentence = `Грубая ошибка. ${actor} ${action}; оценка резко изменилась. Спасительный вариант — ${best}.`;
      break;
    default:
      firstSentence = `${actor} ${action}. Движок не смог оценить этот ход, но запись партии сохранена.`;
  }
  const scoreSentence = record.annotation === "unknown" ? "" : ` Оценка позиции после хода: ${score}.`;
  const tacticalSentence = positionNote ? ` ${positionNote}` : "";
  const hintSentence = ["inaccuracy", "mistake", "blunder"].includes(record.annotation) && best
    ? ` ${reasons[record.ply % reasons.length]}`
    : "";
  return `${firstSentence}${scoreSentence}${tacticalSentence}${hintSentence}`.trim();
}

function movePositionNote(record) {
  if (record.san?.includes("#")) return "Это мат.";
  if (record.san?.includes("+")) return "Это шах — ответ соперника вынужден.";
  if (record.promotion) return `Пешка превращается в ${PIECE_NAMES[record.promotion]}.`;
  if (record.flags.includes("k") || record.flags.includes("q") || record.san?.startsWith("O-O")) return "Рокировка уводит короля из центра и соединяет ладьи.";
  if (record.captured) return `На доске произошёл размен: взята фигура — ${PIECE_NAMES[record.captured]}.`;
  return "Сравни, какие поля и линии открылись после этого хода.";
}

function describeMove(record) {
  const to = squareSpeech(record.to);
  const from = squareSpeech(record.from);
  if (record.flags.includes("k") || record.flags.includes("q") || record.san?.startsWith("O-O")) {
    return record.san?.includes("O-O-O") ? "делает длинную рокировку" : "делает короткую рокировку";
  }
  if (record.promotion) return `превращает пешку на ${to} в ${PIECE_NAMES[record.promotion]}`;
  if (record.captured) {
    if (record.piece === "p") return `пешкой с ${from} забирает ${PIECE_ACCUSATIVE[record.captured]} на ${to}`;
    return `${PIECE_ACCUSATIVE[record.piece]} с ${from} забирает ${PIECE_ACCUSATIVE[record.captured]} на ${to}`;
  }
  if (record.piece === "p") return `продвигает пешку с ${from} на ${to}`;
  return `переводит ${PIECE_ACCUSATIVE[record.piece]} с ${from} на ${to}`;
}

function describeUci(fen, uci) {
  const match = String(uci || "").match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/i);
  if (!match) return "лучшее продолжение";
  try {
    const temp = new Chess(fen);
    const piece = temp.get(match[1].toLowerCase());
    const name = piece?.type ? PIECE_ACCUSATIVE[piece.type] : "фигуру";
    const from = squareSpeech(match[1].toLowerCase());
    const to = squareSpeech(match[2].toLowerCase());
    if (match[3]) return `превратить пешку на ${to} в ${PIECE_NAMES[match[3].toLowerCase()]}`;
    return `перевести ${name} с ${from} на ${to}`;
  } catch (_error) {
    return "лучшее продолжение";
  }
}

function fallbackComment(record) {
  const actor = record.isBot ? "Соперник" : "Ты";
  return `${actor} ${describeMove(record)}. Ход записан; для полной оценки нужен локальный движок.`;
}

function addFallbackComment(record) {
  record.annotation = "unknown";
  record.comment = fallbackComment(record);
  currentComment = record.comment;
}

async function analyzeFen(fen, depth = settings.coachDepth) {
  const safeDepth = Math.min(11, Math.max(7, Number(depth) || 9));
  const key = `${safeDepth}:20:${fen}`;
  if (analysisCache.has(key)) return analysisCache.get(key);
  if (!engineAvailable) throw new Error("Локальный движок недоступен.");
  const analysis = await engine.analyze(fen, { depth: safeDepth, skill: 20 });
  analysisCache.set(key, analysis);
  if (analysisCache.size > 64) analysisCache.delete(analysisCache.keys().next().value);
  return analysis;
}

async function refreshCurrentAnalysis() {
  if (!gameStarted || gameEnded || busy || mode !== "coach" || !engineAvailable) return;
  busy = true;
  setEngineStatus("Анализирую позицию…", "working");
  try {
    const fen = chess.fen();
    const analysis = await analyzeFen(fen, settings.coachDepth);
    currentHint = { fen, analysis };
  } catch (_error) {
    currentHint = null;
  } finally {
    busy = false;
    setEngineStatus(engineAvailable ? "Stockfish готов · локально" : "Движок недоступен", engineAvailable ? "ready" : "error");
    render();
  }
}

async function goToPly(nextCursor) {
  if (busy || !gameStarted) return;
  const bounded = Math.min(moves.length, Math.max(0, Number(nextCursor) || 0));
  if (bounded === cursor) return;
  const previousCursor = cursor;
  cursor = bounded;
  chess = replayToCursor(cursor);
  selectedSquare = null;
  legalMoves = [];
  gameEnded = cursor === moves.length && chess.isGameOver();
  currentHint = null;
  const selectedMove = cursor ? moves[cursor - 1] : null;
  const actionComment = selectedMove
    ? `${bounded < previousCursor ? "Возвращаемся к" : "Переходим к"} ходу ${selectedMove.ply}. ${selectedMove.comment || fallbackComment(selectedMove)}`
    : "Отмена ходов. Мы вернулись к начальной позиции партии.";
  const feedbackVisible = mode === "coach" || (mode === "test" && reviewRevealed);
  currentComment = feedbackVisible ? actionComment : "";
  ui.gameoverModal.hidden = true;
  render();
  if (feedbackVisible && settings.comments) {
    ui.coachComment.textContent = currentComment;
    if (settings.speakComments) speakComment(currentComment);
  }

  if ((mode === "coach" || reviewRevealed) && engineAvailable && !chess.isGameOver()) {
    const fen = chess.fen();
    const cached = getCachedAnalysis(fen, Number(settings.coachDepth));
    if (cached) {
      currentHint = { fen, analysis: cached };
      render();
    } else if (cursor === moves.length && mode === "coach") {
      await refreshCurrentAnalysis();
    }
  }
  if (gameEnded) showGameOver();
}

function replayToCursor(plies) {
  const replay = new Chess(START_FEN);
  for (const move of moves.slice(0, plies)) {
    try {
      replay.move({ from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) });
    } catch (_error) {
      break;
    }
  }
  return replay;
}

function getCachedAnalysis(fen, depth) {
  return analysisCache.get(`${Math.min(11, Math.max(7, Number(depth) || 9))}:20:${fen}`) || null;
}

async function reviewCompletedGame() {
  if (!gameEnded || busy || !engineAvailable) return;
  reviewRevealed = true;
  ui.gameoverModal.hidden = true;
  busy = true;
  setEngineStatus("Подготавливаю разбор…", "working");
  render();
  try {
    let before = moves.length ? await analyzeFen(moves[0].beforeFen, settings.coachDepth) : null;
    for (let index = 0; index < moves.length; index += 1) {
      const record = moves[index];
      setEngineStatus(`Разбираю ход ${index + 1} из ${moves.length}…`, "working");
      const after = await analyzeFen(record.afterFen, settings.coachDepth);
      if (before && after) annotateFromAnalyses(record, before, after);
      else addFallbackComment(record);
      before = after;
      renderMoveHistory();
    }
    currentComment = moves.at(-1)?.comment || "Партия готова к разбору.";
    currentHint = moves.length ? { fen: chess.fen(), analysis: before } : null;
    render();
    setEngineStatus("Разбор готов · полностью локально", "ready");
  } catch (error) {
    setEngineStatus("Не удалось завершить разбор", "error");
    console.warn("Ладья: разбор партии не завершён", error);
  } finally {
    busy = false;
    render();
  }
}

function finishIfGameOver() {
  if (!gameStarted || !chess.isGameOver()) return false;
  gameEnded = true;
  selectedSquare = null;
  legalMoves = [];
  showGameOver();
  return true;
}

function showGameOver() {
  const result = getResultText();
  ui.gameoverTitle.textContent = result.title;
  ui.gameoverCopy.textContent = result.copy;
  ui.gameoverEmblem.textContent = result.emblem;
  ui.reviewGame.hidden = !(mode === "test" && engineAvailable && moves.length > 0 && !reviewRevealed);
  ui.gameoverModal.hidden = false;
  ui.boardOverlay.innerHTML = `<div class="overlay-message"><strong>${escapeHtml(result.title)}</strong><p>${escapeHtml(result.short)}</p></div>`;
  ui.boardOverlay.hidden = false;
  render();
}

function getResultText() {
  if (chess.isCheckmate()) {
    const winner = chess.turn() === "w" ? "b" : "w";
    const userWon = winner === userColor;
    return userWon
      ? { title: "Мат · победа", copy: "Отличная партия. Если хочешь, разбери ключевые ходы тренера.", short: "Победа за тобой", emblem: "♕" }
      : { title: "Мат", copy: "Партия завершена. Разбор покажет момент, где позиция изменилась.", short: "Партия завершена", emblem: "♚" };
  }
  if (chess.isStalemate()) return { title: "Пат", copy: "Ничья: у стороны, которой ходить, нет легальных ходов и король не под шахом.", short: "Ничья — пат", emblem: "½" };
  if (chess.isInsufficientMaterial()) return { title: "Ничья", copy: "Материала на доске недостаточно для мата.", short: "Ничья — недостаточно материала", emblem: "½" };
  if (chess.isThreefoldRepetition()) return { title: "Ничья", copy: "Позиция повторилась три раза.", short: "Ничья — повторение позиции", emblem: "½" };
  return { title: "Ничья", copy: "Партия завершилась вничью по правилу 50 ходов.", short: "Ничья", emblem: "½" };
}

function render() {
  applyBoardPreferences();
  renderBoard();
  renderHeader();
  renderMoveHistory();
  renderCoach();
  renderEvaluation();
  renderControls();
}

function renderBoard() {
  const board = chess.board();
  const analysisVisible = isAnalysisVisible();
  const legalVisible = settings.legalMoves && canHumanMove() && analysisVisible;
  ui.board.replaceChildren();
  const lastMove = cursor > 0 ? moves[cursor - 1] : null;
  const checkSquare = chess.isCheck() ? findKingSquare(chess.turn()) : null;
  const legalTargets = selectedSquare && legalVisible ? chess.moves({ square: selectedSquare, verbose: true }) : [];
  const legalByTarget = new Map(legalTargets.map((move) => [move.to, move]));

  for (let viewRow = 0; viewRow < 8; viewRow += 1) {
    for (let viewCol = 0; viewCol < 8; viewCol += 1) {
      const boardRow = orientation === "w" ? viewRow : 7 - viewRow;
      const boardCol = orientation === "w" ? viewCol : 7 - viewCol;
      const squareName = `${FILES[boardCol]}${8 - boardRow}`;
      const piece = board[boardRow][boardCol];
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `square ${(viewRow + viewCol) % 2 === 0 ? "dark" : "light"}`;
      cell.dataset.square = squareName;
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `${squareSpeech(squareName)}${piece ? `, ${piece.color === "w" ? "белые" : "чёрные"} ${PIECE_NAMES[piece.type]}` : ""}`);
      cell.disabled = !canHumanMove();
      cell.draggable = Boolean(canHumanMove() && piece?.color === userColor);

      if (selectedSquare === squareName) cell.classList.add("selected");
      if (lastMove && (lastMove.from === squareName || lastMove.to === squareName)) cell.classList.add("last-move");
      if (checkSquare === squareName) cell.classList.add("in-check");
      const targetMove = legalByTarget.get(squareName);
      if (targetMove) {
        cell.classList.add("legal-target");
        if (targetMove.captured) cell.classList.add("legal-capture");
      }

      if (piece) {
        const glyph = document.createElement("span");
        glyph.className = `piece piece-${piece.color === "w" ? "white" : "black"}`;
        glyph.textContent = PIECE_GLYPHS[piece.color][piece.type];
        cell.append(glyph);
      }

      if (settings.coordinates) {
        if (boardCol === 0) {
          const rank = document.createElement("span");
          rank.className = "coord-rank";
          rank.textContent = squareName[1];
          cell.append(rank);
        }
        if (boardRow === 7) {
          const file = document.createElement("span");
          file.className = "coord-file";
          file.textContent = squareName[0];
          cell.append(file);
        }
      }

      if (analysisVisible && settings.annotations && lastMove?.to === squareName && lastMove.annotation) {
        const marker = document.createElement("span");
        marker.className = "move-marker";
        marker.dataset.kind = lastMove.annotation;
        marker.textContent = ANNOTATIONS[lastMove.annotation]?.symbol || "·";
        marker.title = ANNOTATIONS[lastMove.annotation]?.title || "Оценка хода";
        cell.append(marker);
      }
      ui.board.append(cell);
    }
  }
  renderArrows();
  const canShowOverlay = gameEnded && cursor === moves.length;
  ui.boardOverlay.hidden = !canShowOverlay;
}

function renderArrows() {
  ui.arrowLines.replaceChildren();
  const activeHint = isAnalysisVisible() && currentHint?.fen === chess.fen() ? currentHint.analysis : null;
  if (!activeHint || !Array.isArray(activeHint.pv)) return;
  if (settings.bestArrow && activeHint.pv[0]) appendArrow(activeHint.pv[0], "best");
  if (settings.threatLines && activeHint.pv[1]) appendArrow(activeHint.pv[1], "threat");
  if (settings.threatLines && activeHint.pv[2]) appendArrow(activeHint.pv[2], "alt");
}

function appendArrow(uci, kind) {
  const match = String(uci).match(/^([a-h][1-8])([a-h][1-8])/i);
  if (!match) return;
  const start = viewCoordinate(match[1].toLowerCase());
  const end = viewCoordinate(match[2].toLowerCase());
  if (!start || !end) return;
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", String(start.x));
  line.setAttribute("y1", String(start.y));
  line.setAttribute("x2", String(start.x + (end.x - start.x) * 0.78));
  line.setAttribute("y2", String(start.y + (end.y - start.y) * 0.78));
  line.setAttribute("class", `arrow-line ${kind}`);
  ui.arrowLines.append(line);
}

function viewCoordinate(square) {
  const fileIndex = FILES.indexOf(square[0]);
  const rankIndex = Number(square[1]) - 1;
  if (fileIndex < 0 || rankIndex < 0) return null;
  const x = orientation === "w" ? fileIndex + 0.5 : 7 - fileIndex + 0.5;
  const y = orientation === "w" ? 8 - Number(square[1]) + 0.5 : Number(square[1]) - 1 + 0.5;
  return { x, y };
}

function renderMoveHistory() {
  ui.movesList.replaceChildren();
  if (!moves.length) {
    const empty = document.createElement("div");
    empty.className = "moves-empty";
    empty.textContent = "Сделай первый ход — тренер разберёт каждый.";
    ui.movesList.append(empty);
  } else {
    for (let index = 0; index < moves.length; index += 2) {
      const pair = document.createElement("div");
      pair.className = "move-pair";
      const first = moves[index];
      const number = document.createElement("span");
      number.className = "move-number";
      number.textContent = `${first.fullmove}.`;
      pair.append(number);
      appendMoveToken(pair, first, index + 1);
      const second = moves[index + 1];
      if (second) appendMoveToken(pair, second, index + 2);
      ui.movesList.append(pair);
    }
  }
  if (!cursor) ui.moveIndexLabel.textContent = gameStarted ? "Стартовая позиция" : "Партия ещё не началась";
  else {
    const current = moves[cursor - 1];
    ui.moveIndexLabel.textContent = `${current.fullmove}. ${current.san}`;
  }
  ui.undo.disabled = !gameStarted || busy || cursor <= 0;
  ui.redo.disabled = !gameStarted || busy || cursor >= moves.length;
}

function appendMoveToken(parent, move, ply) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "move-token";
  if (ply === cursor) button.classList.add("is-current");
  if (ply > cursor) button.classList.add("is-future");
  button.dataset.ply = String(ply);
  button.textContent = move.san;
  const analysisVisible = isAnalysisVisible();
  const annotation = analysisVisible && settings.annotations ? ANNOTATIONS[move.annotation] : null;
  if (annotation) {
    const badge = document.createElement("span");
    badge.className = `annotation ${annotation.kind}`;
    badge.textContent = annotation.symbol;
    button.append(badge);
    button.title = `${annotation.title}${move.comment ? ` — ${move.comment}` : ""}`;
  } else if (mode === "test" && !reviewRevealed) {
    button.title = "Оценка скрыта до конца партии";
  }
  parent.append(button);
}

function renderHeader() {
  const level = LEVELS[settings.botLevel] || LEVELS.club;
  ui.botLevelLabel.textContent = `Соперник · ${level.label}`;
  ui.humanAvatar.textContent = userColor === "w" ? PIECE_GLYPHS.w.p : PIECE_GLYPHS.b.p;
  const colorText = userColor === "w" ? "Белые" : "Чёрные";
  const turnText = !gameStarted ? "готов к партии" : gameEnded ? "партия завершена" : chess.turn() === userColor && !busy && cursor === moves.length ? "ход за тобой" : "ход соперника";
  ui.humanColorLabel.textContent = `${colorText} · ${turnText}`;
  ui.humanIndicator.textContent = turnText === "ход за тобой" ? "ТВОЙ ХОД" : turnText === "ход соперника" ? "ЖДИ" : "ГОТОВ";
  ui.humanIndicator.classList.toggle("is-active", turnText === "ход за тобой");
  ui.botIndicator.classList.toggle("is-active", gameStarted && !gameEnded && (busy || chess.turn() !== userColor));
  const hideAdvantage = mode === "test" && !reviewRevealed;
  const material = hideAdvantage ? { w: 0, b: 0 } : materialAdvantage();
  ui.humanMaterial.textContent = material[userColor] ? `+${material[userColor].toFixed(1)}` : "";
  const botColor = userColor === "w" ? "b" : "w";
  ui.botMaterial.textContent = material[botColor] ? `+${material[botColor].toFixed(1)}` : "";
}

function materialAdvantage() {
  const board = chess.board();
  let white = 0;
  let black = 0;
  for (const row of board) {
    for (const piece of row) {
      if (!piece) continue;
      if (piece.color === "w") white += VALUES[piece.type] || 0;
      else black += VALUES[piece.type] || 0;
    }
  }
  const diff = white - black;
  return { w: diff > 0.05 ? diff : 0, b: diff < -0.05 ? -diff : 0 };
}

function renderCoach() {
  const analysisVisible = isAnalysisVisible();
  const lastMove = cursor > 0 ? moves[cursor - 1] : null;
  const info = analysisVisible && lastMove?.annotation ? ANNOTATIONS[lastMove.annotation] : null;
  ui.verdictIcon.dataset.kind = info?.kind || "unknown";
  ui.verdictIcon.textContent = mode === "test" && !reviewRevealed ? "◈" : info?.icon || "✦";

  if (mode === "test" && !reviewRevealed) {
    ui.verdictTitle.textContent = "Оценка скрыта";
    ui.verdictScore.textContent = gameStarted ? "После партии можно открыть разбор" : "Во время игры нет подсказок и пометок";
    ui.coachComment.textContent = "Режим проверки себя активен. Тренер не показывает оценки, варианты или линии угроз до завершения партии.";
    ui.coachDetail.hidden = true;
    ui.coachTags.innerHTML = '<span class="coach-tag"><i></i> без подсказок</span><span class="coach-tag muted-tag">ходы записываются локально</span>';
    ui.voiceState.textContent = "без комментариев";
    ui.speakAgain.disabled = true;
    return;
  }

  if (info && lastMove) {
    ui.verdictTitle.textContent = info.title;
    ui.verdictScore.textContent = lastMove.lossCp == null
      ? "Оценка движка недоступна"
      : `Потеря относительно лучшего: ${(lastMove.lossCp / 100).toFixed(1).replace(".", ",")} пешки`;
    ui.coachComment.textContent = settings.comments
      ? (currentComment || lastMove.comment || "Ход записан. Анализирую продолжение…")
      : "Текстовые комментарии отключены. Оценки и визуальные пометки можно настроить ниже.";
    if (lastMove.pvSan) {
      ui.coachDetail.textContent = `Линия движка до хода: ${lastMove.pvSan}`;
      ui.coachDetail.hidden = false;
    } else {
      ui.coachDetail.hidden = true;
    }
    ui.coachTags.innerHTML = `<span class="coach-tag"><i></i> ${escapeHtml(lastMove.isBot ? "ход соперника" : "твой ход")}</span><span class="coach-tag muted-tag">глубина ${Number(settings.coachDepth)}</span>`;
  } else {
    ui.verdictTitle.textContent = gameStarted ? "Жду следующий ход" : "Готов к партии";
    ui.verdictScore.textContent = engineAvailable ? "Локальный анализ Stockfish" : "Резервный бот работает без сети";
    ui.coachComment.textContent = settings.comments
      ? "Сделай ход. Тренер оценит и отметит каждый ход — не только лучший — и объяснит, чем он полезен или опасен."
      : "Комментарии отключены. При желании включи их в настройках ниже.";
    ui.coachDetail.hidden = true;
    ui.coachTags.innerHTML = '<span class="coach-tag"><i></i> каждый ход</span><span class="coach-tag muted-tag">локальный анализ</span>';
  }
    const activeVoice = getSelectedSystemVoice();
    ui.voiceState.textContent = !settings.speakComments ? "голос выключен" : activeVoice ? "локальный голос · вкл." : "eSpeak · офлайн";
    ui.speakAgain.disabled = !currentComment || !settings.comments || !settings.speakComments;
}

function renderEvaluation() {
  const activeHint = isAnalysisVisible() && currentHint?.fen === chess.fen() ? currentHint.analysis : null;
  if (!activeHint) {
    ui.evalRail.hidden = mode === "test" && !reviewRevealed;
    ui.evalBar.style.height = "50%";
    ui.evalBarScore.textContent = "0.0";
    return;
  }
  ui.evalRail.hidden = false;
  const whiteCp = whiteEvaluation(activeHint, chess.fen());
  const normalized = Math.max(-1, Math.min(1, whiteCp / (Math.abs(whiteCp) + 320)));
  const blackHeight = Math.max(5, Math.min(95, 50 - normalized * 45));
  ui.evalBar.style.height = `${blackHeight}%`;
  ui.evalBarScore.textContent = formatEvaluation(whiteCp);
}

function renderControls() {
  const inputAllowed = canHumanMove();
  for (const square of ui.board.querySelectorAll("[data-square]")) {
    square.disabled = !inputAllowed;
    square.draggable = Boolean(inputAllowed && chess.get(square.dataset.square)?.color === userColor);
  }
  ui.startGame.disabled = busy;
  ui.newGame.disabled = busy;
  ui.flipBoard.disabled = busy;
}

function isAnalysisVisible() {
  return mode === "coach" || reviewRevealed;
}

function findKingSquare(color) {
  const board = chess.board();
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = board[row][col];
      if (piece?.color === color && piece.type === "k") return `${FILES[col]}${8 - row}`;
    }
  }
  return null;
}

function squareSpeech(square) {
  if (!square || square.length < 2) return String(square || "");
  const files = { a: "а", b: "бэ", c: "цэ", d: "дэ", e: "е", f: "эф", g: "гэ", h: "аш" };
  return `${files[square[0]] || square[0]} ${square[1]}`;
}

function scoreValue(analysis) {
  if (!analysis) return 0;
  if (Number.isFinite(analysis.mate)) {
    const distance = Math.min(99, Math.abs(analysis.mate));
    return Math.sign(analysis.mate) * (10000 - distance * 100);
  }
  return Number(analysis.scoreCp) || 0;
}

function whiteEvaluation(analysis, fen) {
  const sideToMove = String(fen || "").split(/\s+/)[1] || "w";
  const score = scoreValue(analysis);
  return sideToMove === "w" ? score : -score;
}

function formatEvaluation(whiteCp) {
  if (!Number.isFinite(whiteCp)) return "0.0";
  if (Math.abs(whiteCp) > 9000) return whiteCp > 0 ? "#" : "−#";
  const score = whiteCp / 100;
  if (Math.abs(score) < 0.05) return "0.0";
  return `${score > 0 ? "+" : ""}${score.toFixed(1)}`.replace(".", ",");
}

function formatPvSan(fen, pv) {
  try {
    const line = new Chess(fen);
    const san = [];
    for (const uci of pv.slice(0, 5)) {
      const move = moveFromUci(line, uci);
      if (!move) break;
      san.push(line.move({ from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) }).san);
    }
    return san.join(" ");
  } catch (_error) {
    return "";
  }
}

function normalizeUci(uci) {
  return String(uci || "").trim().toLowerCase();
}

function setEngineStatus(message, state = "") {
  ui.engineStatus.textContent = message;
  ui.engineStatus.classList.remove("is-ready", "is-error", "is-working");
  if (state) ui.engineStatus.classList.add(`is-${state}`);
}

function refreshLocalVoices() {
  localRussianVoices = "speechSynthesis" in window
    ? window.speechSynthesis.getVoices().filter((voice) => voice.localService === true && /^ru(?:-|$)/i.test(voice.lang || ""))
    : [];
  const previous = settings.speechVoice || ui.speechVoice.value || "";
  ui.speechVoice.replaceChildren();
  const automatic = document.createElement("option");
  automatic.value = "";
  automatic.textContent = localRussianVoices.length ? "Автовыбор" : "Автовыбор · eSpeak";
  ui.speechVoice.append(automatic);
  for (const voice of localRussianVoices) {
    const option = document.createElement("option");
    option.value = voice.voiceURI;
    option.textContent = voice.name.length > 28 ? `${voice.name.slice(0, 26)}…` : voice.name;
    ui.speechVoice.append(option);
  }
  const espeak = document.createElement("option");
  espeak.value = "espeak";
  espeak.textContent = "eSpeak · встроенный";
  ui.speechVoice.append(espeak);
  const validPrevious = previous === "espeak" || localRussianVoices.some((voice) => voice.voiceURI === previous);
  ui.speechVoice.value = validPrevious ? previous : "";
  settings.speechVoice = ui.speechVoice.value;
  updateVoiceUi();
}

function getSelectedSystemVoice() {
  if (settings.speechVoice === "espeak") return null;
  if (settings.speechVoice) return localRussianVoices.find((voice) => voice.voiceURI === settings.speechVoice) || null;
  return localRussianVoices[0] || null;
}

function updateVoiceUi() {
  if (!ui.voiceState) return;
  const voice = getSelectedSystemVoice();
  if (!settings.speakComments) ui.voiceState.textContent = "голос выключен";
  else ui.voiceState.textContent = voice ? "локальный голос · вкл." : "eSpeak · офлайн";
  ui.localVoiceNote.textContent = localRussianVoices.length
    ? `Автовыбор использует локальный голос системы; можно выбрать встроенный eSpeak. Найдено голосов: ${localRussianVoices.length}.`
    : "Встроенный русский eSpeak работает без установки голосов и без интернета. Тембр синтетический.";
}

function unlockAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  try {
    if (!audioContext) audioContext = new AudioContextClass();
    if (audioContext.state === "suspended") void audioContext.resume().catch(() => {});
    return audioContext;
  } catch (_error) {
    return null;
  }
}

function speakComment(text, replay = false) {
  if (!text || !settings.comments || !settings.speakComments || (mode === "test" && !reviewRevealed)) return;
  if (replay) stopSpeech();
  const voice = getSelectedSystemVoice();
  const Utterance = window.SpeechSynthesisUtterance || globalThis.SpeechSynthesisUtterance;
  if (voice && "speechSynthesis" in window && Utterance) {
    unlockAudio();
    const utterance = new Utterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang || "ru-RU";
    utterance.rate = Math.min(1.25, Math.max(0.75, Number(settings.speechRate) || 0.95));
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
    return;
  }
  void synthesizeLocally(text).catch((error) => {
    console.warn("Ладья: локальная озвучка недоступна", error);
    ui.voiceState.textContent = "ошибка озвучки";
  });
}

function getEspeakWorker() {
  if (espeakWorker) return espeakWorker;
  const workerUrl = isExtensionPage()
    ? chrome.runtime.getURL("chess/tts-worker.js")
    : new URL("./tts-worker.js", import.meta.url).href;
  espeakWorker = new Worker(workerUrl, { type: "module", name: "ladya-espeak-tts" });
  espeakWorker.addEventListener("message", (event) => handleSpeechMessage(event.data));
  espeakWorker.addEventListener("error", (event) => {
    event.preventDefault?.();
    for (const [id, pending] of pendingSpeech) {
      window.clearTimeout(pending.timeout);
      pending.reject(new Error("Не удалось запустить встроенный голос."));
      pendingSpeech.delete(id);
    }
    espeakWorker?.terminate();
    espeakWorker = null;
  });
  return espeakWorker;
}

function synthesizeLocally(text) {
  unlockAudio();
  const worker = getEspeakWorker();
  const id = ++espeakSequence;
  const generation = speechGeneration;
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pendingSpeech.delete(id);
      reject(new Error("Синтез речи превысил время ожидания."));
    }, 45000);
    pendingSpeech.set(id, { resolve, reject, timeout, generation });
    worker.postMessage({ type: "synthesize", id, text, rate: settings.speechRate });
  });
}

function handleSpeechMessage(message) {
  const pending = pendingSpeech.get(message?.id);
  if (!pending) return;
  pendingSpeech.delete(message.id);
  window.clearTimeout(pending.timeout);
  if (pending.generation !== speechGeneration) {
    pending.resolve(false);
    return;
  }
  if (message.type === "error") {
    pending.reject(new Error(message.error || "Не удалось синтезировать речь."));
    return;
  }
  playLocalAudio(message.audio, pending.generation).then(pending.resolve, pending.reject);
}

function playLocalAudio(audioBuffer, generation) {
  const play = async () => {
    if (generation !== speechGeneration) return false;
    const context = unlockAudio();
    if (!context) throw new Error("Web Audio недоступен в этом браузере.");
    if (context.state === "suspended") await context.resume();
    const decoded = await context.decodeAudioData(audioBuffer.slice(0));
    if (generation !== speechGeneration) return false;
    const source = context.createBufferSource();
    source.buffer = decoded;
    source.connect(context.destination);
    const startAt = Math.max(context.currentTime + 0.015, audioScheduledUntil);
    audioScheduledUntil = startAt + decoded.duration + 0.09;
    activeAudioSources.add(source);
    source.onended = () => {
      activeAudioSources.delete(source);
      source.disconnect();
    };
    source.start(startAt);
    return true;
  };
  const playback = audioPlaybackQueue.then(play, play);
  audioPlaybackQueue = playback.then(() => undefined, () => undefined);
  return playback;
}

function stopSpeech() {
  speechGeneration += 1;
  espeakWorker?.postMessage({ type: "cancel" });
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  for (const source of activeAudioSources) {
    try { source.stop(); } catch (_error) { /* already stopped */ }
  }
  activeAudioSources.clear();
  audioScheduledUntil = audioContext?.currentTime || 0;
  for (const [id, pending] of pendingSpeech) {
    window.clearTimeout(pending.timeout);
    pending.resolve(false);
    pendingSpeech.delete(id);
  }
}

async function copyPgn() {
  if (!moves.length) return;
  const current = replayToCursor(moves.length);
  const pgn = current.pgn({ maxWidth: 80 });
  try {
    await navigator.clipboard.writeText(pgn);
    ui.copyPgn.textContent = "Скопировано";
  } catch (_error) {
    const text = document.createElement("textarea");
    text.value = pgn;
    text.style.position = "fixed";
    text.style.opacity = "0";
    document.body.append(text);
    text.select();
    const copied = document.execCommand("copy");
    text.remove();
    ui.copyPgn.textContent = copied ? "Скопировано" : "Не скопировано";
  }
  window.setTimeout(() => { ui.copyPgn.textContent = "Копировать PGN"; }, 1500);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

initialize();
