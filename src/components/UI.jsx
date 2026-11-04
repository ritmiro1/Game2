import React from 'react';
import {
  Anchor, BookHeart, Check, ChevronsUp, CircleOff, Crosshair, FlipHorizontal2,
  Gauge, GitBranch, HeartPulse, MoveUpRight, Orbit, RefreshCw, Repeat2, Scissors,
  Shield, ShieldPlus, Snowflake, Sparkles, TriangleAlert, Waves, X, Zap,
  Clock3, Radio, Swords, Wifi, WifiOff,
} from 'lucide-react';
import { CARDS, getHero, getRank } from '../../shared/content.js';

const ORDER_ICONS = {
  Anchor, BookHeart, ChevronsUp, CircleOff, Crosshair, FlipHorizontal2,
  Gauge, GitBranch, HeartPulse, MoveUpRight, Orbit, RefreshCw, Repeat2,
  Scissors, Shield, ShieldPlus, Snowflake, Sparkles, TriangleAlert, Waves, Zap,
};

export function OrderIcon({ cardId, size = 22, ...props }) {
  const Icon = ORDER_ICONS[CARDS[cardId]?.icon] || Sparkles;
  return <Icon size={size} strokeWidth={1.6} {...props} />;
}

export function Logo({ compact = false }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`}>
      <svg className="brand__mark" viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r="17" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="38 9" />
        <circle cx="22" cy="22" r="12" fill="none" stroke="currentColor" strokeWidth="0.7" opacity=".45" />
        <path d="M14 30V14h7.5c5 0 8 2.8 8 8s-3 8-8 8H14Zm4.5-3.5h3c2.4 0 3.6-1.5 3.6-4.5s-1.2-4.5-3.6-4.5h-3v9Z" fill="currentColor" />
        <circle cx="35.5" cy="8.5" r="2.4" fill="#ff806c" />
      </svg>
      <div>
        <span className="brand__name">ПАЛИМПСЕСТ</span>
        {!compact && <span className="brand__sub">ПРОТОКОЛ ЭХА</span>}
      </div>
    </div>
  );
}

export function Glyph({ index = 0, size = 74, className = '' }) {
  const rotations = [0, 30, 60];
  return (
    <svg className={`epoch-glyph ${className}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <g className="epoch-glyph__slow" style={{ transformOrigin: '50px 50px' }}>
        <circle cx="50" cy="50" r="39" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray={index === 1 ? '4 7' : '48 12'} />
        <circle cx="50" cy="50" r="29" fill="none" stroke="currentColor" strokeWidth=".7" opacity=".5" transform={`rotate(${rotations[index]} 50 50)`} strokeDasharray="20 8" />
      </g>
      {index === 0 && <path d="M50 20 69 65H31L50 20Zm0 15L41 56h18L50 35Z" fill="none" stroke="currentColor" strokeWidth="1.4" />}
      {index === 1 && <path d="m55 15-24 35h18l-5 35 27-42H53l2-28Z" fill="none" stroke="currentColor" strokeWidth="1.4" />}
      {index === 2 && <path d="m25 65 8-35 17 19 17-19 8 35H25Zm8-7h34M50 49v27" fill="none" stroke="currentColor" strokeWidth="1.4" />}
      <circle cx="50" cy="50" r="4" fill="currentColor" className="epoch-glyph__core" />
    </svg>
  );
}

export function HeroPortrait({ heroId, className = '', small = false }) {
  const hero = getHero(heroId);
  return (
    <div className={`hero-portrait ${small ? 'hero-portrait--small' : ''} ${className}`} style={{ '--hero-color': hero.color }}>
      <img src={hero.image} alt={`${hero.name}, ${hero.role}`} />
      <div className="hero-portrait__scan" />
      {!small && <span className="hero-portrait__number">{hero.number}</span>}
    </div>
  );
}

export function RankCrest({ rating = 1000, showName = true }) {
  const rank = getRank(rating);
  return (
    <div className="rank-crest" title={`${rank.name} · ${rating}`}>
      <svg viewBox="0 0 40 44" aria-hidden="true">
        <path d="M20 2 36 11v22L20 42 4 33V11L20 2Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="m20 9 9 6v13l-9 7-9-7V15l9-6Z" fill="currentColor" opacity=".12" />
        <path d="M14 27V16h6c4 0 6 2 6 5.5S24 27 20 27h-6Zm4-3h2c1.4 0 2-.6 2-2.5S21.4 19 20 19h-2v5Z" fill="currentColor" />
      </svg>
      {showName && <div><strong>{rank.name}</strong><span>{rating} рейтинга</span></div>}
    </div>
  );
}

export function OrderCard({
  cardId, selected = false, disabled = false, cost, onClick, compact = false, echo = false, style,
}) {
  const card = CARDS[cardId];
  if (!card) return null;
  return (
    <button
      type="button"
      className={`order-card order-card--${card.school.toLowerCase()} ${selected ? 'is-selected' : ''} ${compact ? 'order-card--compact' : ''} ${echo ? 'order-card--echo' : ''}`}
      disabled={disabled}
      onClick={onClick}
      style={style}
      aria-label={`${card.name}. ${card.text}. Стоимость ${cost ?? card.cost}`}
    >
      <span className="order-card__top">
        <span className="order-card__cost">{cost ?? card.cost}</span>
        <span className="order-card__school">{card.school}</span>
        <span className="order-card__tempo" title="Темп: приказ с большим темпом раскрывается раньше"><Clock3 size={11} />{card.tempo}</span>
      </span>
      <span className="order-card__art">
        <span className="order-card__orbit" />
        <OrderIcon cardId={cardId} size={compact ? 22 : 34} />
      </span>
      <strong className="order-card__name">{card.name}</strong>
      {!compact && <span className="order-card__text">{card.text}</span>}
      {echo && <span className="order-card__echo-label">ЭХО · 60%</span>}
      <span className="order-card__corner" />
    </button>
  );
}

export function Modal({ children, onClose, className = '', labelledBy }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && onClose) onClose();
    }}>
      <section className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {onClose && <button className="icon-button modal__close" onClick={onClose} aria-label="Закрыть"><X size={20} /></button>}
        {children}
      </section>
    </div>
  );
}

export function ConnectionBadge({ status, online }) {
  const connected = status === 'online';
  return (
    <div className={`connection-badge ${connected ? 'is-online' : ''}`} title={connected ? 'Связь с Архивом установлена' : 'Локальный режим доступен без сервера'}>
      {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
      <span>{connected ? `АРХИВ · ${online ?? 0} В СЕТИ` : status === 'connecting' ? 'СВЯЗЬ…' : 'ЛОКАЛЬНО'}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon = Radio, title, text, action }) {
  return (
    <div className="empty-state">
      <Icon size={30} strokeWidth={1.2} />
      <strong>{title}</strong>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function CheckLine({ children }) {
  return <li className="check-line"><Check size={15} /> <span>{children}</span></li>;
}

export function ModeIcon({ type, size = 18 }) {
  if (type === 'duel') return <Swords size={size} />;
  if (type === 'online') return <Radio size={size} />;
  return <Sparkles size={size} />;
}
