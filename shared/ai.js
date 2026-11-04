import { CARDS, CONTROL_LIMIT } from './content.js';
import { getLegalActions, isGameOver, resolveRound } from './engine.js';

const orientedControl = (state, front, playerIndex) => front.control * (playerIndex === 0 ? 1 : -1);

export function evaluateState(state, playerIndex) {
  if (isGameOver(state)) {
    if (state.winner === 'draw') return 0;
    return state.winner === playerIndex ? 100000 - state.round : -100000 + state.round;
  }
  const opponentIndex = 1 - playerIndex;
  const me = state.players[playerIndex];
  const opponent = state.players[opponentIndex];
  let score = (me.hp - opponent.hp) * 8;
  score += (me.captures - opponent.captures) * 240;
  score += (me.energy - opponent.energy) * 1.8;
  score += (me.damageDealt - opponent.damageDealt) * 0.12;

  for (const front of state.fronts) {
    if (front.owner === playerIndex) score += 80;
    else if (front.owner === opponentIndex) score -= 80;
    else {
      const control = orientedControl(state, front, playerIndex);
      score += control * 7;
      if (control > 0) score += (control / CONTROL_LIMIT) ** 3 * 20;
      if (control < 0) score -= (Math.abs(control) / CONTROL_LIMIT) ** 3 * 20;
    }
  }

  for (const echo of state.echoes) {
    const card = CARDS[echo.cardId];
    const ownerIsMe = echo.owner === playerIndex;
    let value = (card.damage || 0) * 1.2 + (card.shift || 0) * 2 + (card.shield || 0) + (card.heal || 0);
    if (echo.target !== null && state.fronts[echo.target]?.owner === null) {
      const control = orientedControl(state, state.fronts[echo.target], echo.owner);
      if (control >= 3) value += 8;
    }
    value /= Math.max(1, echo.dueRound - state.round + 0.5);
    score += ownerIsMe ? value * 1.4 : -value * 1.4;
  }
  return score;
}

function actionHeuristic(state, playerIndex, action) {
  const card = CARDS[action.cardId];
  const me = state.players[playerIndex];
  const opponent = state.players[1 - playerIndex];
  let score = 0;
  score += (card.damage || 0) * 2.1;
  score += (card.shield || 0) * (me.hp <= 10 ? 1.8 : 1.05);
  score += (card.heal || 0) * (me.maxHp - me.hp >= 3 ? 1.6 : 0.25);
  score += (card.gain || 0) * (me.energy <= 3 ? 1.4 : 0.45);
  score -= (card.selfDamage || 0) * (me.hp <= 7 ? 4 : 0.8);
  score -= card.cost * 0.22;
  score += card.tempo * 0.08;
  if (card.executeDamage && opponent.hp <= 14) score += 7;
  if ((card.damage || 0) >= opponent.hp) score += 80;
  if (card.eraseEnemy || card.delayEnemy || card.stealEnemy) {
    const enemyEchoes = state.echoes.filter((echo) => echo.owner !== playerIndex);
    score += enemyEchoes.length ? 5 + Math.min(6, enemyEchoes.length * 2) : -2;
  }
  if (card.duplicateSelf || card.accelerateSelf) {
    score += state.echoes.some((echo) => echo.owner === playerIndex) ? 6 : -2;
  }
  if (card.weaken && (opponent.handCount ?? opponent.hand.length) > 0) score += 2;
  if (card.thorns && me.hp < opponent.hp) score += 3;

  if (action.target !== null && action.target !== undefined) {
    const front = state.fronts[action.target];
    if (front && front.owner === null) {
      const control = orientedControl(state, front, playerIndex);
      const shift = card.shift || 0;
      score += shift * (2 + Math.max(0, control) * 0.65);
      if (control < 0) score += shift * (1 + Math.abs(control) * 0.4);
      if (control + shift >= CONTROL_LIMIT) score += 90;
      if (control <= -4) score += 7;
    }
  }

  // Opponent modelling: visible schools and preferred eras slightly update the prior.
  const history = state.history || [];
  const recent = history.slice(-6);
  if (recent.length) {
    const sameSchool = recent.filter((entry) => CARDS[entry.actions[playerIndex]?.cardId]?.school === card.school).length;
    score += sameSchool * 0.12;
  }
  return score;
}

function rankedActions(state, playerIndex, limit = Infinity) {
  return getLegalActions(state, playerIndex)
    .map((action) => ({ action, base: actionHeuristic(state, playerIndex, action) }))
    .sort((a, b) => b.base - a.base)
    .slice(0, limit);
}

function distribution(state, playerIndex, limit) {
  const ranked = rankedActions(state, playerIndex, limit);
  if (!ranked.length) return [];
  const baseline = ranked[ranked.length - 1].base;
  const weighted = ranked.map((entry) => ({
    ...entry,
    weight: Math.exp(Math.max(-8, Math.min(8, (entry.base - baseline) / 9))) + 0.02,
  }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  return weighted.map((entry) => ({ ...entry, weight: entry.weight / total }));
}

function roundPair(state, ownAction, opponentAction, playerIndex) {
  const actions = playerIndex === 0 ? [ownAction, opponentAction] : [opponentAction, ownAction];
  return resolveRound(state, actions).state;
}

function expectedReplyValue(state, playerIndex, depth = 1) {
  if (isGameOver(state)) return evaluateState(state, playerIndex);
  const own = rankedActions(state, playerIndex, depth > 1 ? 5 : 7);
  const opponents = distribution(state, 1 - playerIndex, depth > 1 ? 5 : 8);
  if (!own.length || !opponents.length) return evaluateState(state, playerIndex);
  let best = -Infinity;
  for (const ownEntry of own) {
    let expected = 0;
    let worst = Infinity;
    for (const opponentEntry of opponents) {
      const next = roundPair(state, ownEntry.action, opponentEntry.action, playerIndex);
      const value = evaluateState(next, playerIndex);
      expected += value * opponentEntry.weight;
      worst = Math.min(worst, value);
    }
    const value = expected * 0.82 + worst * 0.18 + ownEntry.base * 0.08;
    if (value > best) best = value;
  }
  return best;
}

/**
 * Chooses simultaneously, without accepting the opponent's pending action.
 * The only inputs are public state, the bot's own hand and previous revealed rounds.
 */
export function chooseBotAction(state, playerIndex = 1, difficulty = 'analyst') {
  const own = rankedActions(state, playerIndex);
  if (!own.length) throw new Error('У бота нет доступных приказов');
  if (difficulty === 'reader') {
    const pool = own.slice(0, Math.min(5, own.length));
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return { action: pick.action, confidence: 0.35, considered: pool.length };
  }

  const hard = difficulty === 'oracle';
  const opponents = distribution(state, 1 - playerIndex, hard ? 12 : 8);
  const candidates = own.slice(0, hard ? 16 : 11);
  const firstPass = [];

  for (const ownEntry of candidates) {
    let expected = 0;
    let worst = Infinity;
    let best = -Infinity;
    for (const opponentEntry of opponents) {
      const next = roundPair(state, ownEntry.action, opponentEntry.action, playerIndex);
      const value = evaluateState(next, playerIndex);
      expected += value * opponentEntry.weight;
      worst = Math.min(worst, value);
      best = Math.max(best, value);
    }
    const caution = meIsBehind(state, playerIndex) ? 0.24 : 0.14;
    const score = expected * (1 - caution) + worst * caution + ownEntry.base * 0.12;
    firstPass.push({ ...ownEntry, score, expected, worst, best });
  }
  firstPass.sort((a, b) => b.score - a.score);

  if (!hard) {
    const noise = () => (Math.random() - 0.5) * 7;
    const selected = firstPass
      .map((entry) => ({ ...entry, noisyScore: entry.score + noise() }))
      .sort((a, b) => b.noisyScore - a.noisyScore)[0];
    return {
      action: selected.action,
      confidence: Math.max(0.45, Math.min(0.9, 0.62 + (selected.best - selected.worst) / 1000)),
      considered: firstPass.length * opponents.length,
    };
  }

  const deepCandidates = firstPass.slice(0, Math.min(4, firstPass.length));
  for (const candidate of deepCandidates) {
    let future = 0;
    for (const opponentEntry of opponents.slice(0, 7)) {
      const next = roundPair(state, candidate.action, opponentEntry.action, playerIndex);
      future += expectedReplyValue(next, playerIndex, 2) * (opponentEntry.weight / opponents.slice(0, 7).reduce((sum, item) => sum + item.weight, 0));
    }
    candidate.score = candidate.score * 0.7 + future * 0.3;
  }
  deepCandidates.sort((a, b) => b.score - a.score);
  const selected = deepCandidates[0];
  const margin = selected.score - (deepCandidates[1]?.score ?? selected.score - 1);
  return {
    action: selected.action,
    confidence: Math.max(0.55, Math.min(0.97, 0.72 + margin / 150)),
    considered: firstPass.length * opponents.length + deepCandidates.length * 7 * 25,
  };
}

function meIsBehind(state, playerIndex) {
  const me = state.players[playerIndex];
  const opponent = state.players[1 - playerIndex];
  return me.hp + me.captures * 12 < opponent.hp + opponent.captures * 12;
}

export function chooseTimeoutAction(state, playerIndex) {
  const ranked = rankedActions(state, playerIndex, 4);
  if (!ranked.length) throw new Error('Нет доступных приказов для автоматического выбора');
  return ranked[Math.floor(Math.random() * Math.min(2, ranked.length))].action;
}
