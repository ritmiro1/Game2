import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, CONTROL_LIMIT, MAX_HP } from '../shared/content.js';
import {
  createGame, getCardCost, getLegalActions, isGameOver, resolveRound, sanitizeState, validateAction,
} from '../shared/engine.js';
import { chooseBotAction } from '../shared/ai.js';

function prepare(state, hands = [['pulse', 'well', 'barrier', 'sweep', 'spark'], ['barrier', 'well', 'pulse', 'sweep', 'spark']]) {
  state.players.forEach((player, index) => {
    player.hand = [...hands[index]];
    player.deck = ['lance', 'surge', 'leech', 'stasis', 'loop'];
    player.discard = [];
    player.energy = 10;
    player.hp = MAX_HP;
    player.shield = 0;
    player.thorns = 0;
    player.weaken = 0;
  });
  return state;
}

test('new duel is deterministic and deals five cards from a fifteen-card deck', () => {
  const a = createGame({ seed: 'same-seed', heroes: ['aria', 'vector'] });
  const b = createGame({ seed: 'same-seed', heroes: ['aria', 'vector'] });
  assert.deepEqual(a, b);
  for (const player of a.players) {
    assert.equal(player.hand.length, 5);
    assert.equal(player.deck.length, 10);
    assert.equal(player.hand.length + player.deck.length, 15);
  }
});

test('legal actions include open targets and respect energy', () => {
  const state = createGame({ seed: 2 });
  prepare(state);
  state.players[0].energy = 0;
  const actions = getLegalActions(state, 0);
  assert.ok(actions.some((action) => action.cardId === 'spark' && action.target === 2));
  assert.ok(actions.some((action) => action.cardId === 'well' && action.target === null));
  assert.ok(!actions.some((action) => action.cardId === 'pulse'));
  assert.equal(validateAction(state, 0, { cardId: 'pulse', target: 0 }).valid, false);
});

test('tempo resolves barrier before pulse and shield absorbs damage', () => {
  const state = prepare(createGame({ seed: 3, heroes: ['vector', 'vector'] }));
  const result = resolveRound(state, [{ cardId: 'pulse', target: 0 }, { cardId: 'barrier', target: null }]);
  const plays = result.events.filter((event) => event.type === 'play');
  assert.equal(plays[0].cardId, 'barrier');
  assert.equal(plays[1].cardId, 'pulse');
  assert.equal(result.state.players[1].hp, MAX_HP);
  assert.equal(result.events.find((event) => event.type === 'absorb').amount, 3);
});

test('an order schedules a visible echo which repeats two rounds later', () => {
  let state = prepare(createGame({ seed: 4, heroes: ['vector', 'vector'] }));
  let result = resolveRound(state, [{ cardId: 'pulse', target: 0 }, { cardId: 'well', target: null }]);
  state = result.state;
  assert.equal(state.round, 2);
  assert.ok(state.echoes.some((echo) => echo.owner === 0 && echo.cardId === 'pulse' && echo.dueRound === 3));
  prepare(state);
  result = resolveRound(state, [{ cardId: 'well', target: null }, { cardId: 'well', target: null }]);
  state = prepare(result.state);
  const hpBefore = state.players[1].hp;
  result = resolveRound(state, [{ cardId: 'well', target: null }, { cardId: 'well', target: null }]);
  const pulseEcho = result.events.find((event) => event.type === 'echo' && event.cardId === 'pulse' && event.player === 0);
  assert.ok(pulseEcho, 'pulse echo should resolve at round three');
  assert.ok(result.state.players[1].hp < hpBefore);
  assert.ok(!result.state.echoes.some((echo) => echo.dueRound <= 3));
});

test('capturing an epoch locks it and deals capture damage', () => {
  const state = prepare(createGame({ seed: 5, heroes: ['vector', 'aria'] }));
  state.fronts[0].control = CONTROL_LIMIT - 1;
  const result = resolveRound(state, [{ cardId: 'sweep', target: 0 }, { cardId: 'well', target: null }]);
  assert.equal(result.state.fronts[0].owner, 0);
  assert.equal(result.state.players[0].captures, 1);
  assert.equal(result.state.players[1].hp, MAX_HP - 6);
  assert.ok(result.events.some((event) => event.type === 'capture' && event.front === 0));
});

test('two captured epochs win immediately', () => {
  const state = prepare(createGame({ seed: 6, heroes: ['vector', 'aria'] }));
  state.fronts[0].owner = 0;
  state.fronts[0].control = CONTROL_LIMIT;
  state.players[0].captures = 1;
  state.fronts[1].control = CONTROL_LIMIT - 1;
  const result = resolveRound(state, [{ cardId: 'sweep', target: 1 }, { cardId: 'well', target: null }]);
  assert.equal(result.state.winner, 0);
  assert.equal(result.state.winReason, 'epochs');
  assert.ok(isGameOver(result.state));
});

test('Null discount applies only on each fourth round', () => {
  const state = createGame({ heroes: ['null', 'aria'], seed: 7 });
  state.round = 3;
  assert.equal(getCardCost(state, 0, 'surge'), CARDS.surge.cost);
  state.round = 4;
  assert.equal(getCardCost(state, 0, 'surge'), CARDS.surge.cost - 1);
  assert.equal(getCardCost(state, 0, 'spark'), 0);
});

test('sanitized network state hides hand and deck order', () => {
  const state = createGame({ seed: 8 });
  const safe = sanitizeState(state, 0);
  assert.equal(safe.players[0].hand.length, 5);
  assert.equal(safe.players[1].hand.length, 0);
  assert.equal(safe.players[1].handCount, 5);
  assert.equal(safe.players[0].deck.length, 0);
  assert.equal(safe.players[0].deckCount, 10);
  assert.equal(safe.rng, 0);
});

test('all bot levels choose legal actions without mutating visible state', () => {
  for (const difficulty of ['reader', 'analyst', 'oracle']) {
    const state = createGame({ seed: `bot-${difficulty}`, heroes: ['aria', 'mirra'] });
    const before = JSON.stringify(state);
    const choice = chooseBotAction(state, 1, difficulty);
    assert.ok(getLegalActions(state, 1).some((action) => action.cardId === choice.action.cardId && action.target === choice.action.target));
    assert.equal(JSON.stringify(state), before);
    assert.ok(choice.considered > 0);
  }
});

test('one hundred automated duels always terminate with valid state', () => {
  for (let gameIndex = 0; gameIndex < 100; gameIndex += 1) {
    let state = createGame({ seed: `stress-${gameIndex}`, heroes: [['aria', 'vector', 'mirra', 'null'][gameIndex % 4], ['null', 'mirra', 'vector', 'aria'][gameIndex % 4]] });
    let turns = 0;
    while (!isGameOver(state) && turns < 21) {
      const legal = [getLegalActions(state, 0), getLegalActions(state, 1)];
      assert.ok(legal[0].length && legal[1].length);
      const actions = legal.map((actions) => actions[Math.floor(Math.random() * actions.length)]);
      state = resolveRound(state, actions).state;
      turns += 1;
      for (const player of state.players) {
        assert.ok(player.hp >= 0 && player.hp <= player.maxHp);
        assert.ok(player.energy >= 0 && player.energy <= player.maxEnergy);
        assert.equal(player.hand.length, 5);
      }
      for (const front of state.fronts) assert.ok(Math.abs(front.control) <= CONTROL_LIMIT);
    }
    assert.ok(isGameOver(state), `game ${gameIndex} did not terminate`);
    assert.ok(state.round <= 20);
  }
});
