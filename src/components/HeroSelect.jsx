import React, { useState } from 'react';
import { ArrowRight, Bot, Check, Globe2, Lock, Shield, Sparkles, Swords, UserPlus } from 'lucide-react';
import { CARDS, DIFFICULTIES, HEROES } from '../../shared/content.js';
import { HeroPortrait, Modal, OrderCard } from './UI.jsx';

const modeCopy = {
  local: { eyebrow: 'ТРЕНИРОВОЧНЫЙ АРХИВ', title: 'ВЫБЕРИТЕ РЕДАКТОРА', icon: Bot },
  quick: { eyebrow: 'СЕТЕВОЙ ПОИСК', title: 'КЕМ ВЫ ВОЙДЁТЕ В ДУЭЛЬ?', icon: Globe2 },
  create: { eyebrow: 'НОВАЯ КОМНАТА', title: 'ВЫБЕРИТЕ РЕДАКТОРА', icon: UserPlus },
  join: { eyebrow: 'ПОДКЛЮЧЕНИЕ К КОМНАТЕ', title: 'ВАША ВЕРСИЯ ГОТОВА?', icon: Swords },
};

export default function HeroSelect({ setup, onClose, onConfirm }) {
  const [heroId, setHeroId] = useState(localStorage.getItem('palimpsest.hero') || 'aria');
  const [difficulty, setDifficulty] = useState(setup.difficulty || 'analyst');
  const hero = HEROES.find((item) => item.id === heroId);
  const copy = modeCopy[setup.type] || modeCopy.local;
  const ModeIcon = copy.icon;

  const confirm = () => {
    localStorage.setItem('palimpsest.hero', heroId);
    onConfirm(heroId, difficulty);
  };

  return (
    <Modal onClose={onClose} className="hero-select-modal" labelledBy="hero-select-title">
      <div className="hero-select__header">
        <div><span className="eyebrow"><ModeIcon size={14} /> {copy.eyebrow}</span><h2 id="hero-select-title">{copy.title}</h2></div>
        <span className="hero-select__count">04 ДОСТУПНО</span>
      </div>
      <div className="hero-select__body">
        <div className="hero-select__rail">
          {HEROES.map((item) => (
            <button key={item.id} className={`hero-choice ${item.id === heroId ? 'is-active' : ''}`} onClick={() => setHeroId(item.id)} style={{ '--hero-color': item.color }}>
              <HeroPortrait heroId={item.id} small />
              <div><strong>{item.name}</strong><span>{item.role}</span></div>
              {item.id === heroId && <Check size={16} />}
            </button>
          ))}
        </div>

        <div className="hero-select__visual" style={{ '--hero-color': hero.color }}>
          <HeroPortrait heroId={hero.id} />
          <div className="hero-select__visual-caption"><span>{hero.number} / РЕДАКТОР</span><strong>{hero.name}</strong><small>{hero.role}</small></div>
        </div>

        <div className="hero-select__details">
          <span className="eyebrow">ДОСЬЕ / {hero.difficulty}</span>
          <blockquote>{hero.quote}</blockquote>
          <p>{hero.lore}</p>
          <div className="passive-box"><Sparkles size={19} /><div><span>ПАССИВНОЕ СВОЙСТВО</span><strong>{hero.passiveShort}</strong><p>{hero.passive}</p></div></div>
          <div className="hero-stats">
            {Object.entries(hero.stats).map(([name, value]) => <div key={name}><span>{name}</span><i>{Array.from({ length: 5 }, (_, index) => <b key={index} className={index < value ? 'is-filled' : ''} />)}</i></div>)}
          </div>
          <div className="signature-list">
            <span>ПОДПИСЬ / 2 УНИКАЛЬНЫХ ПРИКАЗА</span>
            <div>{hero.signature.map((cardId) => <OrderCard key={cardId} cardId={cardId} compact />)}</div>
          </div>
        </div>
      </div>

      {setup.type === 'local' && (
        <div className="difficulty-picker">
          <div><Bot size={18} /><span>СИЛА ОППОНЕНТА</span></div>
          {DIFFICULTIES.map((item) => (
            <button key={item.id} className={difficulty === item.id ? 'is-active' : ''} onClick={() => setDifficulty(item.id)} title={item.description}>
              <span>{item.level}</span><strong>{item.name}</strong>{difficulty === item.id && <Check size={14} />}
            </button>
          ))}
          <p>{DIFFICULTIES.find((item) => item.id === difficulty)?.description}</p>
        </div>
      )}

      <div className="hero-select__footer">
        <span><Shield size={14} /> Все редакторы доступны сразу. Побеждает мастерство, не прокачка.</span>
        <button className="button button--primary button--large" onClick={confirm}>
          {setup.type === 'local' ? 'НАЧАТЬ ДУЭЛЬ' : setup.type === 'join' ? 'ВОЙТИ В КОМНАТУ' : 'ПОДТВЕРДИТЬ'} <ArrowRight size={18} />
        </button>
      </div>
    </Modal>
  );
}
