import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BookOpen, Bot, Check, ChevronRight, CircleDot, Clock3, Copy,
  Flag, Hourglass, Info, Layers3, LoaderCircle, MessageCircle, Radio, RotateCcw,
  Send, Shield, Sparkles, Swords, TimerReset, Trophy, Volume2, VolumeX, X, Zap,
} from 'lucide-react';
import {
  CARDS, CONTROL_LIMIT, DIFFICULTIES, FRONTS, TURN_SECONDS, getHero,
} from '../../shared/content.js';
import {
  chooseBotAction,
} from '../../shared/ai.js';
import {
  clone, createGame, describeResult, getCardCost, isGameOver, resolveRound,
} from '../../shared/engine.js';
import { playSound } from '../lib/sound.js';
import { Glyph, HeroPortrait, Logo, Modal, OrderCard, OrderIcon } from './UI.jsx';

const EMOTES = ['Я видел это Эхо.', 'Хорошая правка.', 'Ты уверен?', 'Впечатляет.', 'Ошибка в строке…', 'Ещё одну!'];

function eventText(event, names) {
  const name = (index) => names[index] || `Игрок ${index + 1}`;
  const card = CARDS[event.cardId]?.name;
  switch (event.type) {
    case 'play': return `${name(event.player)}: «${card}»`;
    case 'echo': return `Эхо ${name(event.player)}: «${card}»`;
    case 'damage': return `${name(event.player)} получает ${event.amount} урона`;
    case 'absorb': return `Щит поглощает ${event.amount} урона`;
    case 'shield': return `${name(event.player)} получает ${event.amount} щита`;
    case 'heal': return `${name(event.player)} восстанавливает ${event.amount} Целостности`;
    case 'control': return `${FRONTS[event.front]?.name}: сдвиг ${event.amount}`;
    case 'capture': return `${name(event.player)} фиксирует эпоху ${FRONTS[event.front]?.name}`;
    case 'thorns': return `Зеркало возвращает ${event.amount} урона`;
    case 'thornsUp': return `Острие зеркала готово ответить`;
    case 'weaken': return `Приказ ${name(event.player)} ослаблен`;
    case 'weakened': return `Нуль-поле снижает силу приказа`;
    case 'echoShift': {
      const labels = { erase: 'стёрто', accelerate: 'ускорено', delay: 'отложено', duplicate: 'скопировано', steal: 'переписано' };
      return `Эхо «${card}» ${labels[event.kind] || 'изменено'}`;
    }
    case 'gameover': return 'Архив фиксирует итог дуэли';
    default: return null;
  }
}

function applyPresentationEvent(input, event) {
  const state = clone(input);
  const player = Number.isInteger(event.player) ? state.players[event.player] : null;
  switch (event.type) {
    case 'spend':
    case 'energy':
    case 'regen':
      if (player) player.energy = event.energy;
      break;
    case 'damage':
    case 'thorns':
      if (player) player.hp = event.hp;
      break;
    case 'heal':
      if (player) player.hp = event.hp;
      break;
    case 'shield':
    case 'absorb':
      if (player) player.shield = event.shield;
      break;
    case 'thornsUp':
      if (player) player.thorns = event.amount;
      break;
    case 'weaken':
      if (player) player.weaken = event.amount;
      break;
    case 'weakened':
      if (player) player.weaken = 0;
      break;
    case 'control':
      if (state.fronts[event.front]) state.fronts[event.front].control = event.control;
      break;
    case 'capture':
      if (state.fronts[event.front]) {
        state.fronts[event.front].owner = event.player;
        state.players[event.player].captures += 1;
      }
      break;
    case 'echoShift': {
      const existing = state.echoes.find((echo) => echo.id === event.echoId);
      if (event.kind === 'erase') state.echoes = state.echoes.filter((echo) => echo.id !== event.echoId);
      else if (event.kind === 'duplicate' && !existing) {
        state.echoes.push({ id: event.echoId, owner: event.owner, cardId: event.cardId, target: event.target, dueRound: event.dueRound });
      } else if (existing) {
        existing.dueRound = event.dueRound;
        if (event.kind === 'steal') existing.owner = event.owner;
      }
      break;
    }
    default:
      break;
  }
  return state;
}

function PlayerBar({ state, playerIndex, meta, active, isYou, event }) {
  const player = state.players[playerIndex];
  const hero = getHero(meta.heroId || player.heroId);
  const handCount = player.handCount ?? player.hand.length;
  return (
    <div className={`duel-player-bar ${active ? 'is-active' : ''} ${isYou ? 'is-you' : ''}`} style={{ '--hero-color': hero.color }}>
      <HeroPortrait heroId={hero.id} small />
      <div className="duel-player-bar__identity"><span>{isYou ? 'ВАША ВЕРСИЯ' : meta.bot ? 'АРХИВНОЕ ЭХО · AI' : meta.connected === false ? 'СВЯЗЬ ПОТЕРЯНА' : 'ОППОНЕНТ'}</span><strong>{meta.name}</strong><small>{hero.name} · {hero.passiveShort}</small></div>
      <div className="duel-player-bar__resources">
        <div className="integrity"><span><HeartGlyph /> ЦЕЛОСТНОСТЬ</span><strong>{player.hp}<small>/{player.maxHp}</small></strong><i><b style={{ width: `${(player.hp / player.maxHp) * 100}%` }} /></i></div>
        <div className="energy-pips" title={`Заряд: ${player.energy}/${player.maxEnergy}`}><Zap size={13} />{Array.from({ length: player.maxEnergy }, (_, index) => <i key={index} className={index < player.energy ? 'is-filled' : ''} />)}<strong>{player.energy}</strong></div>
      </div>
      <div className="duel-player-bar__status">
        {player.shield > 0 && <span className="status-chip"><Shield size={13} />{player.shield}</span>}
        {player.thorns > 0 && <span className="status-chip status-chip--violet"><Sparkles size={13} />{player.thorns}</span>}
        {player.weaken > 0 && <span className="status-chip status-chip--danger"><X size={13} />{player.weaken}</span>}
        <span className="capture-pips" title="Захваченные эпохи"><i className={player.captures >= 1 ? 'is-filled' : ''} /><i className={player.captures >= 2 ? 'is-filled' : ''} /></span>
        <span className="hand-count"><Layers3 size={13} /> {handCount}</span>
      </div>
      {event && ['damage', 'heal', 'thorns'].includes(event.type) && event.player === playerIndex && <span key={event.key} className={`combat-float combat-float--${event.type}`}>{event.type === 'heal' ? '+' : '−'}{event.amount}</span>}
    </div>
  );
}

function HeartGlyph() {
  return <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M10 17S2 12.5 2 7.2C2 2.5 8 1.5 10 5c2-3.5 8-2.5 8 2.2C18 12.5 10 17 10 17Z" stroke="currentColor" strokeWidth="1.3" /></svg>;
}

function EchoColumn({ state, playerIndex, title, isYou }) {
  const echoes = state.echoes.filter((echo) => echo.owner === playerIndex).sort((a, b) => a.dueRound - b.dueRound || a.id - b.id);
  return (
    <div className={`echo-column ${isYou ? 'is-you' : ''}`}>
      <div className="echo-column__title"><span>{title}</span><small>{echoes.length} В ЛЕНТЕ</small></div>
      {echoes.map((echo) => {
        const card = CARDS[echo.cardId];
        const rounds = Math.max(0, echo.dueRound - state.round);
        return (
          <div className={`echo-entry ${rounds === 0 ? 'is-due' : ''}`} key={echo.id}>
            <div className="echo-entry__icon"><OrderIcon cardId={echo.cardId} size={17} /></div>
            <div><strong>{card.name}</strong><span>{echo.target !== null ? FRONTS[echo.target]?.name : 'БЕЗ ЦЕЛИ'} · 60%</span></div>
            <b>{rounds === 0 ? 'СЕЙЧАС' : `+${rounds}`}</b>
          </div>
        );
      })}
      {!echoes.length && <div className="echo-column__empty"><Radio size={17} /><span>Будущих Эхов нет</span></div>}
    </div>
  );
}

function FrontCard({ front, index, state, you, selected, targeted, active, onClick, names }) {
  const oriented = front.control * (you === 0 ? 1 : -1);
  const percent = ((oriented + CONTROL_LIMIT) / (CONTROL_LIMIT * 2)) * 100;
  const owner = front.owner;
  return (
    <button
      className={`front-card ${selected ? 'is-selected' : ''} ${targeted ? 'is-targetable' : ''} ${active ? 'is-resolving' : ''} ${owner !== null ? 'is-captured' : ''}`}
      style={{ '--front-color': FRONTS[index].color, '--marker': `${percent}%` }}
      onClick={onClick} disabled={owner !== null}
    >
      <div className="front-card__top"><span>{FRONTS[index].index} / ЭПОХА</span><span>{owner === null ? 'НЕСТАБИЛЬНА' : 'ЗАФИКСИРОВАНА'}</span></div>
      <Glyph index={index} size={78} />
      <div className="front-card__name"><strong>{FRONTS[index].name}</strong><span>{FRONTS[index].epithet}</span></div>
      <div className="control-scale">
        <div className="control-scale__labels"><span>−6</span><span>КОНТРОЛЬ</span><span>+6</span></div>
        <div className="control-scale__track"><i className="control-scale__enemy" /><i className="control-scale__yours" /><b style={{ left: `${percent}%` }}><span /></b></div>
        <div className="control-scale__value">{owner === null ? <span>{oriented === 0 ? 'НЕЙТРАЛЬНО' : `${oriented > 0 ? 'ВАШ' : 'ВРАГ'} · ${oriented > 0 ? '+' : ''}${oriented}`}</span> : <strong>{owner === you ? 'ВАША ПРАВКА' : 'ЧУЖАЯ ПРАВКА'}</strong>}</div>
      </div>
      {owner !== null && <div className="front-card__captured"><Check size={17} /><span>{names[owner]}</span></div>}
      {targeted && owner === null && <div className="front-card__target">ВЫБРАТЬ ЦЕЛЬЮ</div>}
    </button>
  );
}

function TurnTimer({ deadline, offset }) {
  const [remaining, setRemaining] = useState(TURN_SECONDS);
  useEffect(() => {
    if (!deadline) return;
    const update = () => setRemaining(Math.max(0, Math.ceil((deadline - (Date.now() + offset)) / 1000)));
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [deadline, offset]);
  if (!deadline) return <div className="turn-timer turn-timer--infinite"><Hourglass size={18} /><span>БЕЗ ЛИМИТА</span></div>;
  const angle = Math.max(0, Math.min(1, remaining / TURN_SECONDS));
  return (
    <div className={`turn-timer ${remaining <= 10 ? 'is-urgent' : ''}`}>
      <svg viewBox="0 0 42 42"><circle cx="21" cy="21" r="17" /><circle cx="21" cy="21" r="17" pathLength="1" strokeDasharray={`${angle} 1`} /></svg>
      <strong>{remaining}</strong><span>СЕКУНД</span>
    </div>
  );
}

export default function DuelView({
  state, resolution, room = null, you = 0, playersMeta, onAction, onLeave,
  onRematch, onEmote, onAnimationComplete, serverTimeOffset = 0, ratingChanges = null,
  local = false, botThinking = false,
}) {
  const [visualState, setVisualState] = useState(state);
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(0);
  const [submitted, setSubmitted] = useState(null);
  const [running, setRunning] = useState(false);
  const [activeEvent, setActiveEvent] = useState(null);
  const [eventLog, setEventLog] = useState([]);
  const [showReveal, setShowReveal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showEmotes, setShowEmotes] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [resultReady, setResultReady] = useState(false);
  const stateRef = useRef(state);
  const visualRef = useRef(state);
  const runningRef = useRef(false);
  const animationRef = useRef(0);
  const timersRef = useRef([]);
  const names = playersMeta.map((meta, index) => index === you ? 'Вы' : meta.name);
  const opponent = 1 - you;
  const selectedDefinition = selectedCard ? CARDS[selectedCard] : null;
  const currentPhase = room?.phase || (running || botThinking ? 'reveal' : 'select');

  useEffect(() => {
    stateRef.current = state;
    if (!runningRef.current) {
      visualRef.current = state;
      setVisualState(state);
    }
    if (!isGameOver(state) && state.history.length === 0) {
      setResultReady(false);
      setEventLog([]);
      setSubmitted(null);
      setSelectedCard(null);
    }
  }, [state]);

  useEffect(() => () => {
    animationRef.current += 1;
    timersRef.current.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!resolution?.events) return;
    const token = ++animationRef.current;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    runningRef.current = true;
    setRunning(true);
    setResultReady(false);
    setShowReveal(Boolean(resolution.actions));
    setActiveEvent(null);
    let base = visualRef.current;
    if (resolution.actions) {
      // Both cards are revealed before any number moves.
      base = clone(base);
      visualRef.current = base;
      setVisualState(base);
    }
    playSound('commit');
    const events = resolution.events.filter((event) => event.type !== 'round');
    let index = 0;
    const step = () => {
      if (token !== animationRef.current) return;
      if (index === 0) setShowReveal(false);
      if (index >= events.length) {
        const finalState = stateRef.current;
        visualRef.current = finalState;
        setVisualState(finalState);
        runningRef.current = false;
        setRunning(false);
        setActiveEvent(null);
        setSubmitted(null);
        setSelectedCard(null);
        setResultReady(isGameOver(finalState));
        onAnimationComplete?.();
        return;
      }
      const event = { ...events[index], key: `${Date.now()}-${index}` };
      setActiveEvent(event);
      const text = eventText(event, names);
      if (text) setEventLog((log) => [...log.slice(-12), { id: event.key, text, type: event.type }]);
      const nextVisual = applyPresentationEvent(visualRef.current, event);
      visualRef.current = nextVisual;
      setVisualState(nextVisual);
      if (['damage', 'thorns'].includes(event.type)) playSound('damage');
      else if (['shield', 'absorb'].includes(event.type)) playSound('shield');
      else if (event.type === 'echo') playSound('echo');
      else if (event.type === 'control') playSound('control');
      else if (event.type === 'capture') playSound('capture');
      else if (event.type === 'heal') playSound('heal');
      const delay = ['play', 'echo'].includes(event.type) ? 310 : event.type === 'capture' ? 470 : event.type === 'gameover' ? 500 : ['spend', 'regen', 'energy'].includes(event.type) ? 65 : 165;
      index += 1;
      timersRef.current.push(setTimeout(step, delay));
    };
    timersRef.current.push(setTimeout(step, resolution.actions ? 720 : 200));
    // New server snapshots must not interrupt an already running visual sequence.
    // A new resolution invalidates it through animationRef; unmount cleanup lives above.
    // names intentionally captured at reveal; player identities cannot change mid-round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolution]);

  const canAct = currentPhase === 'select' && !running && !submitted && !isGameOver(state) && (!room || room.players[you]?.connected !== false);

  useEffect(() => {
    if (selectedCard && visualState.players[you].hand.includes(selectedCard)) return;
    setSelectedCard(null);
  }, [visualState.players, selectedCard, you]);

  useEffect(() => {
    if (visualState.fronts[selectedTarget]?.owner !== null) {
      const firstOpen = visualState.fronts.findIndex((front) => front.owner === null);
      if (firstOpen >= 0) setSelectedTarget(firstOpen);
    }
  }, [visualState.fronts, selectedTarget]);

  const commit = useCallback(() => {
    if (!selectedCard || !canAct) return;
    const definition = CARDS[selectedCard];
    const cost = getCardCost(state, you, selectedCard);
    if (cost > state.players[you].energy) return;
    if (definition.targeted && state.fronts[selectedTarget]?.owner !== null) return;
    const action = { cardId: selectedCard, target: definition.targeted ? selectedTarget : null };
    setSubmitted(action);
    playSound('commit');
    const accepted = onAction(action);
    if (accepted === false) setSubmitted(null);
  }, [selectedCard, canAct, state, you, selectedTarget, onAction]);

  useEffect(() => {
    const onKey = (event) => {
      if (['INPUT', 'TEXTAREA'].includes(event.target.tagName) || showHelp || confirmLeave) return;
      const index = Number(event.key) - 1;
      if (index >= 0 && index < 5) {
        const cardId = visualState.players[you].hand[index];
        if (cardId && getCardCost(state, you, cardId) <= state.players[you].energy && canAct) {
          setSelectedCard(cardId);
          playSound('select');
        }
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        commit();
      }
      if (event.key === 'Escape') setSelectedCard(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visualState.players, state, you, canAct, commit, showHelp, confirmLeave]);

  const result = describeResult(state, you);
  const ownRating = ratingChanges?.[you];
  const opponentReady = room ? room.players[opponent]?.ready : botThinking || running;

  return (
    <main className="duel-screen">
      <div className="duel-ambient"><span /><span /><span /></div>
      <header className="duel-topbar">
        <button className="icon-button" onClick={() => setConfirmLeave(true)} title="Покинуть дуэль"><ArrowLeft size={19} /></button>
        <Logo compact />
        <div className="duel-topbar__mode"><span className="live-dot" />{local ? 'ТРЕНИРОВОЧНЫЙ АРХИВ' : room?.ranked ? 'РЕЙТИНГОВАЯ ДУЭЛЬ' : 'СВОБОДНАЯ ДУЭЛЬ'}<i />СЕЗОН 01</div>
        <div className="duel-topbar__round"><span>РАУНД</span><strong>{String(visualState.round).padStart(2, '0')}<small> / {visualState.maxRounds}</small></strong></div>
        <TurnTimer deadline={currentPhase === 'select' ? room?.deadline : null} offset={serverTimeOffset} />
        <button className="icon-button" onClick={() => setShowHelp(true)} title="Правила"><Info size={19} /></button>
      </header>

      <div className="duel-layout">
        <aside className="chronology-panel">
          <div className="chronology-panel__heading"><Radio size={16} /><div><strong>ЛЕНТА ПРИЧИННОСТИ</strong><span>ОТКРЫТАЯ ИНФОРМАЦИЯ</span></div></div>
          <div className="initiative-box"><span>ИНИЦИАТИВА ПРИ РАВНОМ ТЕМПЕ</span><strong><Sparkles size={14} /> {visualState.initiative === you ? 'У ВАС' : 'У ОППОНЕНТА'}</strong><small>В следующем раунде перейдёт сопернику</small></div>
          <EchoColumn state={visualState} playerIndex={opponent} title="ЭХО ОППОНЕНТА" />
          <EchoColumn state={visualState} playerIndex={you} title="ВАШЕ ЭХО" isYou />
          <div className="battle-log">
            <div className="battle-log__title"><BookOpen size={14} /> ЖУРНАЛ ПРАВОК</div>
            <div className="battle-log__entries">
              {[...eventLog].reverse().slice(0, 7).map((entry) => <div key={entry.id} className={`log-${entry.type}`}><i />{entry.text}</div>)}
              {!eventLog.length && <p>Первые записи появятся после раскрытия приказов.</p>}
            </div>
          </div>
        </aside>

        <section className="duel-board">
          <div className="duel-players">
            <PlayerBar state={visualState} playerIndex={opponent} meta={playersMeta[opponent]} active={activeEvent?.player === opponent} event={activeEvent} />
            <div className="versus-sigil"><span /><Swords size={19} /><span /></div>
            <PlayerBar state={visualState} playerIndex={you} meta={playersMeta[you]} active={activeEvent?.player === you} event={activeEvent} isYou />
          </div>

          <div className="board-caption"><span>ОБЩАЯ ЛИНИЯ ВРЕМЕНИ</span><div><i /> ВАШ КОНТРОЛЬ <b /> КОНТРОЛЬ ОППОНЕНТА</div></div>
          <div className="fronts-grid">
            {visualState.fronts.map((front, index) => <FrontCard key={front.id} front={front} index={index} state={visualState} you={you} names={names} selected={selectedTarget === index && selectedDefinition?.targeted} targeted={Boolean(selectedDefinition?.targeted && canAct)} active={activeEvent?.front === index} onClick={() => { setSelectedTarget(index); playSound('select'); }} />)}
          </div>

          <div className={`resolution-banner ${activeEvent ? 'is-visible' : ''}`} aria-live="polite">
            {activeEvent && ['play', 'echo'].includes(activeEvent.type) ? <><OrderIcon cardId={activeEvent.cardId} size={20} /><div><span>{activeEvent.type === 'echo' ? 'ЭХО РАЗРЕШАЕТСЯ' : `${names[activeEvent.player]} РАСКРЫВАЕТ`}</span><strong>{CARDS[activeEvent.cardId]?.name}</strong></div></> : activeEvent ? <><CircleDot size={18} /><div><strong>{eventText(activeEvent, names)}</strong></div></> : <><Radio size={17} /><span>Линия стабильна. Архив ждёт вашу правку.</span></>}
          </div>

          <div className="hand-heading"><div><span>ВАША РУКА</span><small>КЛАВИШИ 1–5 · ENTER — ПОДТВЕРДИТЬ</small></div><span>{visualState.players[you].deckCount ?? visualState.players[you].deck.length} В КОЛОДЕ</span></div>
          <div className="duel-hand">
            {visualState.players[you].hand.map((cardId, index) => {
              const cost = getCardCost(state, you, cardId);
              return <div className="duel-hand__slot" key={`${cardId}-${index}`}><span className="hand-hotkey">{index + 1}</span><OrderCard cardId={cardId} cost={cost} selected={selectedCard === cardId} disabled={!canAct || cost > state.players[you].energy} onClick={() => { setSelectedCard(cardId); playSound('select'); }} /></div>;
            })}
          </div>
          <div className="energy-note"><Zap size={12} /> В конце раунда вы получаете +2 заряда. Щиты и Острие зеркала сгорают.</div>
        </section>

        <aside className="action-panel">
          <div className="action-panel__heading"><span>ПАНЕЛЬ ПРАВКИ</span><small>{currentPhase === 'select' ? 'ОЖИДАЕТ ВВОДА' : 'АРХИВ ОБРАБАТЫВАЕТ'}</small></div>
          {selectedDefinition ? (
            <div className="selected-order">
              <div className="selected-order__title"><OrderIcon cardId={selectedCard} size={27} /><div><span>{selectedDefinition.school} · Темп {selectedDefinition.tempo}</span><strong>{selectedDefinition.name}</strong></div><b>{getCardCost(state, you, selectedCard)}<small>ЗАРЯД</small></b></div>
              <p>{selectedDefinition.text}</p>
              {selectedDefinition.targeted && <div className="target-picker"><span>ЦЕЛЬ / ЭПОХА</span><div>{FRONTS.map((front, index) => <button key={front.id} disabled={state.fronts[index].owner !== null} className={selectedTarget === index ? 'is-active' : ''} onClick={() => setSelectedTarget(index)}>{front.index}<small>{front.name}</small></button>)}</div></div>}
              <div className="echo-preview"><Radio size={18} /><div><span>ПОСЛЕДСТВИЕ · РАУНД {Math.min(state.maxRounds, state.round + 2)}</span><strong>Эхо «{selectedDefinition.name}»</strong><p>Повторит числовые эффекты с силой 60%{selectedDefinition.targeted ? ` в эпохе ${FRONTS[selectedTarget].name}` : ''}.</p></div></div>
              <button className="button button--primary commit-button" disabled={!canAct || getCardCost(state, you, selectedCard) > state.players[you].energy} onClick={commit}><span>{submitted ? 'ПРИКАЗ ПРИНЯТ' : 'ПОДТВЕРДИТЬ ПРАВКУ'}</span>{submitted ? <Check size={19} /> : <ChevronRight size={19} />}</button>
            </div>
          ) : (
            <div className="action-empty"><div className="action-empty__glyph"><Sparkles size={30} /></div><strong>ВЫБЕРИТЕ ПРИКАЗ</strong><p>Нажмите на карту в руке. Для атаки или сдвига затем выберите эпоху.</p><div><span>1</span> Изучите будущие Эхи</div><div><span>2</span> Предположите ответ врага</div><div><span>3</span> Оставьте свой след</div></div>
          )}

          <div className={`opponent-readiness ${opponentReady ? 'is-ready' : ''}`}>
            {botThinking && !running ? <LoaderCircle className="spin" size={17} /> : opponentReady ? <Check size={17} /> : <Clock3 size={17} />}
            <div><strong>{botThinking && !running ? 'ОРАКУЛ СТРОИТ РАЗВИЛКИ' : submitted ? opponentReady ? 'ОБЕ ВЕРСИИ ПРИНЯТЫ' : 'ОППОНЕНТ ЕЩЁ ВЫБИРАЕТ' : opponentReady ? 'ОППОНЕНТ ГОТОВ' : 'СКРЫТЫЙ ВЫБОР'}</strong><span>{submitted ? 'Ваш приказ заблокирован до раскрытия' : 'Карта и цель останутся тайной'}</span></div>
          </div>

          <div className="emote-control">
            <button className="button button--ghost" onClick={() => setShowEmotes((value) => !value)}><MessageCircle size={16} /> СИГНАЛЫ</button>
            {showEmotes && <div className="emote-menu">{EMOTES.map((emote) => <button key={emote} onClick={() => { onEmote?.(emote); setShowEmotes(false); if (local) setEventLog((log) => [...log, { id: Date.now(), text: `Вы: ${emote}`, type: 'emote' }]); }}>{emote}<Send size={12} /></button>)}</div>}
          </div>
          {room?.chat?.length > 0 && <div className="last-emote"><span>{room.chat[room.chat.length - 1].name}</span>«{room.chat[room.chat.length - 1].text}»</div>}
          <div className="action-panel__tip"><Info size={14} /><p>При равном Темпе первым действует владелец инициативы. Она меняется каждый раунд.</p></div>
        </aside>
      </div>

      {showReveal && resolution?.actions && (
        <div className="reveal-overlay">
          <div className="reveal-overlay__label">ОДНОВРЕМЕННОЕ РАСКРЫТИЕ</div>
          <div className="reveal-overlay__cards">
            {[opponent, you].map((playerIndex) => <div key={playerIndex}><span>{names[playerIndex]}</span><OrderCard cardId={resolution.actions[playerIndex].cardId} compact /><strong>{resolution.actions[playerIndex].target !== null ? FRONTS[resolution.actions[playerIndex].target]?.name : 'БЕЗ ЦЕЛИ'}</strong></div>)}
          </div>
        </div>
      )}

      {resultReady && result && (
        <Modal className={`result-modal ${result.won ? 'is-victory' : ''}`} labelledBy="result-title">
          <div className="result-modal__halo"><Trophy size={37} /></div>
          <span className="eyebrow">ДУЭЛЬ ЗАВЕРШЕНА · РАУНД {state.round}</span>
          <h2 id="result-title">{result.title}</h2>
          <p>{result.subtitle}</p>
          <div className="result-score">
            {[opponent, you].map((index) => <div key={index} className={state.winner === index ? 'is-winner' : ''}><HeroPortrait heroId={playersMeta[index].heroId} small /><span>{playersMeta[index].name}</span><strong>{state.players[index].captures} <small>ЭПОХ</small></strong><b>{state.players[index].hp} <small>ЦЕЛ.</small></b></div>)}
          </div>
          {ownRating && <div className="rating-change"><span>РЕЙТИНГ АРХИВА</span><strong>{ownRating.before} <ArrowLeft size={16} /> {ownRating.after}</strong><b className={ownRating.delta >= 0 ? 'positive' : 'negative'}>{ownRating.delta >= 0 ? '+' : ''}{ownRating.delta}</b></div>}
          {local && <div className="rating-change rating-change--local"><Bot size={17} /><span>Тренировка завершена. Онлайн-рейтинг не изменился.</span></div>}
          <div className="result-modal__actions">
            <button className="button button--primary" onClick={onRematch}><RotateCcw size={17} /> {room?.players?.[opponent]?.rematch ? 'СОПЕРНИК ЖДЁТ' : 'ЕЩЁ ОДНА ДУЭЛЬ'}</button>
            <button className="button button--ghost" onClick={onLeave}>ВЕРНУТЬСЯ В АРХИВ</button>
          </div>
        </Modal>
      )}

      {showHelp && (
        <Modal onClose={() => setShowHelp(false)} className="duel-help-modal" labelledBy="duel-help-title">
          <span className="eyebrow">КРАТКАЯ СПРАВКА</span><h2 id="duel-help-title">КАК ПРИНЯТЬ ПРАВКУ</h2>
          <div className="duel-help-grid"><div><Swords size={20} /><strong>1. ВЫБОР</strong><p>Оба игрока тайно выбирают карту. Больший Темп разрешается раньше.</p></div><div><Radio size={20} /><strong>2. ЭХО</strong><p>Через два раунда карта бесплатно повторяет числа с силой 60%.</p></div><div><Sparkles size={20} /><strong>3. ПОБЕДА</strong><p>Захватите две эпохи или сотрите 28 Целостности соперника.</p></div><div><Shield size={20} /><strong>4. ЗАЩИТА</strong><p>Щит живёт один раунд. Захват эпохи наносит 4 урона.</p></div></div>
          <button className="button button--primary" onClick={() => setShowHelp(false)}>ПОНЯТНО</button>
        </Modal>
      )}

      {confirmLeave && (
        <Modal onClose={() => setConfirmLeave(false)} className="confirm-modal" labelledBy="leave-title">
          <Flag size={28} /><h2 id="leave-title">ПОКИНУТЬ ДУЭЛЬ?</h2><p>{!local && !isGameOver(state) ? 'В сетевой дуэли выход будет засчитан как поражение.' : 'Текущая тренировка будет потеряна.'}</p>
          <div><button className="button button--danger" onClick={onLeave}>ПОКИНУТЬ</button><button className="button button--ghost" onClick={() => setConfirmLeave(false)}>ОСТАТЬСЯ</button></div>
        </Modal>
      )}
    </main>
  );
}

export function LocalDuel({ config, profile, onLeave, onRematch }) {
  const opponentHero = { aria: 'vector', vector: 'mirra', mirra: 'null', null: 'aria' }[config.heroId] || 'vector';
  const [game, setGame] = useState(() => createGame({ heroes: [config.heroId, opponentHero], seed: `${Date.now()}-${Math.random()}` }));
  const [resolution, setResolution] = useState(null);
  const [botThinking, setBotThinking] = useState(false);
  const timerRef = useRef(null);
  const gameRef = useRef(game);
  gameRef.current = game;
  const difficulty = DIFFICULTIES.find((item) => item.id === config.difficulty) || DIFFICULTIES[1];
  const playersMeta = [
    { name: profile?.name || 'ВЫ', heroId: config.heroId, connected: true },
    { name: difficulty.name.toUpperCase(), heroId: opponentHero, bot: true, connected: true },
  ];

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleAction = (action) => {
    if (botThinking || resolution || isGameOver(gameRef.current)) return false;
    setBotThinking(true);
    timerRef.current = setTimeout(() => {
      try {
        // Deliberately computed from public state alone: `action` is never passed to the bot.
        const bot = chooseBotAction(gameRef.current, 1, config.difficulty);
        const result = resolveRound(gameRef.current, [action, bot.action]);
        setGame(result.state);
        setResolution({ actions: result.actions, events: result.events });
      } catch (error) {
        console.error(error);
        setBotThinking(false);
      }
    }, config.difficulty === 'oracle' ? 480 : 650);
    return true;
  };

  const reset = () => {
    clearTimeout(timerRef.current);
    setGame(createGame({ heroes: [config.heroId, opponentHero], seed: `${Date.now()}-${Math.random()}` }));
    setResolution(null);
    setBotThinking(false);
    onRematch?.();
  };

  return <DuelView state={game} resolution={resolution} you={0} playersMeta={playersMeta} onAction={handleAction} onLeave={onLeave} onRematch={reset} local botThinking={botThinking && !resolution} onAnimationComplete={() => { setBotThinking(false); setResolution(null); }} />;
}
