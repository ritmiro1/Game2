import {
  BASE_DECK, CARDS, CONTROL_LIMIT, ECHO_DELAY, ECHO_SCALE, FRONTS,
  MAX_ENERGY, MAX_HP, MAX_ROUNDS, getDeck, getHero,
} from './content.js';

export const clone = (value) => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const asSeed = (seed) => {
  if (typeof seed === 'number' && Number.isFinite(seed)) return (seed >>> 0) || 0x9e3779b9;
  const text = String(seed ?? Date.now());
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 0x9e3779b9;
};

function random(state) {
  let x = state.rng >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state.rng = x >>> 0;
  return (state.rng >>> 0) / 4294967296;
}

function shuffle(state, list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random(state) * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function draw(state, playerIndex, count = 1) {
  const player = state.players[playerIndex];
  for (let n = 0; n < count; n += 1) {
    if (player.deck.length === 0 && player.discard.length > 0) {
      player.deck = shuffle(state, player.discard.splice(0));
    }
    if (player.deck.length === 0) return;
    player.hand.push(player.deck.pop());
  }
}

export function createGame({ seed = Date.now(), heroes = ['aria', 'vector'] } = {}) {
  const initialSeed = asSeed(seed);
  const state = {
    version: 1,
    seed: initialSeed,
    rng: initialSeed,
    round: 1,
    maxRounds: MAX_ROUNDS,
    initiative: 0,
    players: heroes.map((heroId) => ({
      heroId: getHero(heroId).id,
      hp: MAX_HP,
      maxHp: MAX_HP,
      energy: 4,
      maxEnergy: MAX_ENERGY,
      shield: 0,
      thorns: 0,
      weaken: 0,
      hand: [],
      deck: [],
      discard: [],
      captures: 0,
      damageDealt: 0,
    })),
    fronts: FRONTS.map((front) => ({ id: front.id, control: 0, owner: null })),
    echoes: [],
    echoSerial: 1,
    history: [],
    winner: null,
    winReason: null,
  };
  state.initiative = random(state) < 0.5 ? 0 : 1;
  for (let playerIndex = 0; playerIndex < 2; playerIndex += 1) {
    state.players[playerIndex].deck = shuffle(state, getDeck(heroes[playerIndex]));
    draw(state, playerIndex, 5);
  }
  return state;
}

export function getCardCost(state, playerIndex, cardId, echo = false) {
  const card = CARDS[cardId];
  if (!card) return Infinity;
  if (echo) return 0;
  const discount = state.players[playerIndex]?.heroId === 'null' && state.round % 4 === 0 ? 1 : 0;
  return Math.max(0, card.cost - discount);
}

export function isGameOver(state) {
  return state.winner !== null;
}

export function getLegalActions(state, playerIndex) {
  if (!state || isGameOver(state) || !state.players[playerIndex]) return [];
  const player = state.players[playerIndex];
  const actions = [];
  const openTargets = state.fronts.map((front, index) => (front.owner === null ? index : null)).filter((index) => index !== null);
  const uniqueCards = [...new Set(player.hand)];
  for (const cardId of uniqueCards) {
    const card = CARDS[cardId];
    if (!card || getCardCost(state, playerIndex, cardId) > player.energy) continue;
    if (card.targeted && openTargets.length > 0) {
      for (const target of openTargets) actions.push({ cardId, target });
    } else {
      actions.push({ cardId, target: null });
    }
  }
  return actions;
}

export function validateAction(state, playerIndex, action) {
  if (!action || typeof action.cardId !== 'string') return { valid: false, reason: 'Приказ не выбран' };
  const legal = getLegalActions(state, playerIndex).some((candidate) => (
    candidate.cardId === action.cardId && candidate.target === (action.target ?? null)
  ));
  return legal ? { valid: true } : { valid: false, reason: 'Приказ недоступен: проверьте заряд, руку и эпоху' };
}

const scaled = (value, echo) => {
  if (!value) return 0;
  return echo ? Math.max(1, Math.round(value * ECHO_SCALE)) : value;
};

function pushDamage(events, player, amount, hp, source, extra = {}) {
  if (amount <= 0) return;
  events.push({ type: 'damage', player, amount, hp, source, ...extra });
}

function checkEnd(state, events) {
  const dead = state.players.map((player) => player.hp <= 0);
  if (dead[0] || dead[1]) {
    if (dead[0] && dead[1]) state.winner = 'draw';
    else state.winner = dead[0] ? 1 : 0;
    state.winReason = 'integrity';
    events.push({ type: 'gameover', winner: state.winner, reason: state.winReason });
    return true;
  }
  for (let playerIndex = 0; playerIndex < 2; playerIndex += 1) {
    if (state.players[playerIndex].captures >= 2) {
      state.winner = playerIndex;
      state.winReason = 'epochs';
      events.push({ type: 'gameover', winner: playerIndex, reason: 'epochs' });
      return true;
    }
  }
  return false;
}

function damagePlayer(state, targetIndex, rawAmount, {
  pierce = 0, sourceIndex = null, source = 'card', events, thorns = true, ignoreShield = false,
}) {
  const target = state.players[targetIndex];
  let amount = Math.max(0, Math.round(rawAmount));
  if (amount <= 0 || target.hp <= 0) return 0;

  if (target.vulnerable > 0 && source === 'card') {
    amount += target.vulnerable;
    target.vulnerable = 0;
  }

  let hpDamage = amount;
  if (!ignoreShield && target.shield > 0) {
    const bypass = Math.min(Math.max(0, pierce), amount);
    const blockable = amount - bypass;
    const absorbed = Math.min(target.shield, blockable);
    target.shield -= absorbed;
    hpDamage = bypass + blockable - absorbed;
    if (absorbed > 0) events.push({ type: 'absorb', player: targetIndex, amount: absorbed, shield: target.shield });
  }
  hpDamage = Math.max(0, Math.min(target.hp, hpDamage));
  target.hp -= hpDamage;
  if (sourceIndex !== null && sourceIndex !== targetIndex) {
    state.players[sourceIndex].damageDealt += hpDamage;
  }
  pushDamage(events, targetIndex, hpDamage, target.hp, source);

  if (thorns && sourceIndex !== null && sourceIndex !== targetIndex && amount > 0 && target.thorns > 0 && state.players[sourceIndex].hp > 0) {
    const attacker = state.players[sourceIndex];
    const retaliation = Math.min(attacker.hp, target.thorns);
    attacker.hp -= retaliation;
    events.push({ type: 'thorns', player: sourceIndex, amount: retaliation, hp: attacker.hp });
  }
  return hpDamage;
}

function moveEcho(events, echo, owner, kind) {
  events.push({
    type: 'echoShift', kind, owner, echoId: echo.id, cardId: echo.cardId,
    target: echo.target, dueRound: echo.dueRound,
  });
}

function nearestEcho(state, owner) {
  return state.echoes
    .filter((echo) => echo.owner === owner)
    .sort((a, b) => a.dueRound - b.dueRound || a.id - b.id)[0] || null;
}

function applyCard(state, playerIndex, action, events, { echo = false } = {}) {
  const player = state.players[playerIndex];
  const opponentIndex = 1 - playerIndex;
  const opponent = state.players[opponentIndex];
  const card = CARDS[action.cardId];
  if (!card || player.hp <= 0) return;

  let reduction = 0;
  if (!echo && player.weaken > 0) {
    reduction = player.weaken;
    player.weaken = 0;
    events.push({ type: 'weakened', player: playerIndex, amount: reduction });
  }
  const numeric = (key) => Math.max(0, scaled(card[key] || 0, echo) - (['damage', 'shield', 'shift', 'heal'].includes(key) ? reduction : 0));

  events.push({
    type: echo ? 'echo' : 'play', player: playerIndex, cardId: card.id,
    target: action.target ?? null, round: state.round,
  });

  let shield = numeric('shield');
  if (!echo && shield > 0 && player.heroId === 'aria') shield += 1;
  if (shield > 0) {
    player.shield += shield;
    events.push({ type: 'shield', player: playerIndex, amount: shield, shield: player.shield });
  }

  const gain = numeric('gain');
  if (gain > 0) {
    const before = player.energy;
    player.energy = Math.min(player.maxEnergy, player.energy + gain);
    events.push({ type: 'energy', player: playerIndex, amount: player.energy - before, energy: player.energy });
  }

  const healing = numeric('heal');
  if (healing > 0) {
    const before = player.hp;
    player.hp = Math.min(player.maxHp, player.hp + healing);
    events.push({ type: 'heal', player: playerIndex, amount: player.hp - before, hp: player.hp });
  }

  let damage = numeric('damage');
  if (card.executeDamage && opponent.hp <= 14) damage = Math.max(0, scaled(card.executeDamage, echo) - reduction);
  if (damage > 0) {
    damagePlayer(state, opponentIndex, damage, {
      pierce: scaled(card.pierce || 0, echo), sourceIndex: playerIndex,
      source: echo ? 'echo' : 'card', events,
    });
  }

  const selfDamage = scaled(card.selfDamage || 0, echo);
  if (selfDamage > 0) {
    damagePlayer(state, playerIndex, selfDamage, {
      sourceIndex: playerIndex, source: 'recoil', events, thorns: false, ignoreShield: true,
    });
  }

  let shift = numeric('shift');
  if (echo && shift > 0 && player.heroId === 'mirra') shift += 1;
  const targetIndex = action.target;
  if (shift > 0 && Number.isInteger(targetIndex) && state.fronts[targetIndex]?.owner === null) {
    const front = state.fronts[targetIndex];
    const direction = playerIndex === 0 ? 1 : -1;
    const requested = shift * direction;
    const before = front.control;
    front.control = Math.max(-CONTROL_LIMIT, Math.min(CONTROL_LIMIT, front.control + requested));
    const delta = front.control - before;
    events.push({ type: 'control', player: playerIndex, front: targetIndex, amount: Math.abs(delta), delta, control: front.control });
    if (Math.abs(front.control) >= CONTROL_LIMIT) {
      front.owner = playerIndex;
      player.captures += 1;
      events.push({ type: 'capture', player: playerIndex, front: targetIndex });
      const captureDamage = 4 + (player.heroId === 'vector' ? 2 : 0);
      damagePlayer(state, opponentIndex, captureDamage, {
        sourceIndex: playerIndex, source: 'capture', events, thorns: false,
      });
    }
  }

  // Special text is deliberately not repeated by an Echo. Only numeric effects return.
  if (!echo) {
    if (card.eraseEnemy) {
      const targetEcho = nearestEcho(state, opponentIndex);
      if (targetEcho) {
        state.echoes = state.echoes.filter((item) => item.id !== targetEcho.id);
        moveEcho(events, targetEcho, opponentIndex, 'erase');
      }
    }
    if (card.accelerateSelf) {
      const targetEcho = nearestEcho(state, playerIndex);
      if (targetEcho && targetEcho.dueRound > state.round + 1) {
        targetEcho.dueRound -= 1;
        moveEcho(events, targetEcho, playerIndex, 'accelerate');
      }
    }
    if (card.delayEnemy) {
      const targetEcho = nearestEcho(state, opponentIndex);
      if (targetEcho) {
        targetEcho.dueRound += 1;
        moveEcho(events, targetEcho, opponentIndex, 'delay');
      }
    }
    if (card.duplicateSelf) {
      const targetEcho = nearestEcho(state, playerIndex);
      if (targetEcho) {
        const copy = { ...targetEcho, id: state.echoSerial++, copy: true };
        state.echoes.push(copy);
        moveEcho(events, copy, playerIndex, 'duplicate');
      }
    }
    if (card.stealEnemy) {
      const targetEcho = nearestEcho(state, opponentIndex);
      if (targetEcho) {
        targetEcho.owner = playerIndex;
        targetEcho.stolen = true;
        moveEcho(events, targetEcho, playerIndex, 'steal');
      }
    }
    if (card.thorns) {
      player.thorns = Math.max(player.thorns, card.thorns);
      events.push({ type: 'thornsUp', player: playerIndex, amount: card.thorns });
    }
    if (card.weaken) {
      opponent.weaken = Math.max(opponent.weaken, card.weaken);
      events.push({ type: 'weaken', player: opponentIndex, amount: card.weaken });
    }
  }
}

function adjudicate(state, events) {
  const scores = state.players.map((player, playerIndex) => {
    const direction = playerIndex === 0 ? 1 : -1;
    const control = state.fronts.reduce((sum, front) => sum + (front.owner === null ? front.control * direction : 0), 0);
    return player.captures * 1000 + player.hp * 10 + control * 3 + player.damageDealt * 0.1;
  });
  if (Math.abs(scores[0] - scores[1]) < 0.001) state.winner = 'draw';
  else state.winner = scores[0] > scores[1] ? 0 : 1;
  state.winReason = 'margin';
  events.push({ type: 'gameover', winner: state.winner, reason: 'margin', scores });
}

export function resolveRound(inputState, actions) {
  if (!inputState || isGameOver(inputState)) throw new Error('Дуэль уже завершена');
  for (let playerIndex = 0; playerIndex < 2; playerIndex += 1) {
    const validation = validateAction(inputState, playerIndex, actions[playerIndex]);
    if (!validation.valid) throw new Error(`Игрок ${playerIndex + 1}: ${validation.reason}`);
  }

  const state = clone(inputState);
  const events = [{ type: 'round', round: state.round }];
  const playedCards = [actions[0].cardId, actions[1].cardId];

  for (let playerIndex = 0; playerIndex < 2; playerIndex += 1) {
    const player = state.players[playerIndex];
    player.shield = 0;
    player.thorns = 0;
    const cost = getCardCost(state, playerIndex, actions[playerIndex].cardId);
    player.energy -= cost;
    const handIndex = player.hand.indexOf(actions[playerIndex].cardId);
    player.hand.splice(handIndex, 1);
    events.push({ type: 'spend', player: playerIndex, amount: cost, energy: player.energy });
  }

  const due = state.echoes.filter((echo) => echo.dueRound <= state.round);
  state.echoes = state.echoes.filter((echo) => echo.dueRound > state.round);
  due.sort((a, b) => {
    if (a.owner !== b.owner) return a.owner === state.initiative ? -1 : 1;
    return a.id - b.id;
  });
  for (const echo of due) {
    applyCard(state, echo.owner, echo, events, { echo: true });
    if (checkEnd(state, events)) break;
  }

  if (!isGameOver(state)) {
    const order = [0, 1].sort((a, b) => {
      const tempoDifference = CARDS[actions[b].cardId].tempo - CARDS[actions[a].cardId].tempo;
      if (tempoDifference) return tempoDifference;
      return a === state.initiative ? -1 : 1;
    });
    for (const playerIndex of order) {
      applyCard(state, playerIndex, actions[playerIndex], events);
      if (checkEnd(state, events)) break;
    }
  }

  if (!isGameOver(state)) {
    for (let playerIndex = 0; playerIndex < 2; playerIndex += 1) {
      state.echoes.push({
        id: state.echoSerial++, owner: playerIndex, cardId: actions[playerIndex].cardId,
        target: actions[playerIndex].target ?? null, dueRound: state.round + ECHO_DELAY,
      });
    }
  }

  for (let playerIndex = 0; playerIndex < 2; playerIndex += 1) {
    const player = state.players[playerIndex];
    draw(state, playerIndex, Math.max(0, 5 - player.hand.length));
    player.discard.push(playedCards[playerIndex]);
    if (!isGameOver(state)) {
      const before = player.energy;
      player.energy = Math.min(player.maxEnergy, player.energy + 2);
      events.push({ type: 'regen', player: playerIndex, amount: player.energy - before, energy: player.energy });
    }
  }

  state.history.push({
    round: state.round,
    actions: clone(actions),
    initiative: state.initiative,
  });

  if (!isGameOver(state)) {
    if (state.round >= state.maxRounds) adjudicate(state, events);
    else {
      state.round += 1;
      state.initiative = 1 - state.initiative;
    }
  }
  return { state, events, actions: clone(actions) };
}

export function sanitizeState(state, viewerIndex) {
  const safe = clone(state);
  safe.rng = 0;
  safe.seed = 0;
  safe.players = safe.players.map((player, index) => {
    const handCount = player.hand.length;
    const deckCount = player.deck.length;
    return {
      ...player,
      hand: index === viewerIndex ? player.hand : [],
      deck: [],
      handCount,
      deckCount,
      discard: [...player.discard],
    };
  });
  return safe;
}

export function describeResult(state, playerIndex = 0) {
  if (!isGameOver(state)) return null;
  if (state.winner === 'draw') return { draw: true, title: 'НИЧЬЯ', subtitle: 'Обе версии города остались незавершёнными' };
  const won = state.winner === playerIndex;
  const reasons = {
    integrity: won ? 'Целостность оппонента стёрта' : 'Ваша Целостность стёрта',
    epochs: won ? 'Две эпохи приняли вашу правку' : 'Две эпохи приняли чужую правку',
    margin: won ? 'Преимущество по итогам двадцатого раунда' : 'Оппонент удержал преимущество',
    forfeit: won ? 'Оппонент покинул свою версию города' : 'Вы покинули линию дуэли',
  };
  return {
    draw: false, won, title: won ? 'ПРАВКА ПРИНЯТА' : 'ВЕРСИЯ УТРАЧЕНА',
    subtitle: reasons[state.winReason] || 'Дуэль завершена',
  };
}

export { BASE_DECK };
