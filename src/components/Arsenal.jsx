import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Clock3, Layers3, Radio, Sparkles, Swords } from 'lucide-react';
import { CARDS, HEROES } from '../../shared/content.js';
import { HeroPortrait, OrderCard, OrderIcon } from './UI.jsx';

export default function Arsenal({ onBack, onPlay }) {
  const [tab, setTab] = useState('orders');
  const [school, setSchool] = useState('Все');
  const [selectedCard, setSelectedCard] = useState('pulse');
  const cards = useMemo(() => Object.values(CARDS).filter((card) => school === 'Все' || card.school === school), [school]);
  const detail = CARDS[selectedCard];

  return (
    <main className="arsenal-screen page-shell">
      <div className="page-title-row">
        <div>
          <button className="text-button page-back" onClick={onBack}><ArrowLeft size={15} /> ГЛАВНАЯ</button>
          <div className="eyebrow">АРХИВ ИНСТРУМЕНТОВ / ПОЛНЫЙ ДОСТУП</div>
          <h1>АРСЕНАЛ РЕДАКТОРА</h1>
          <p>Все инструменты открыты с первой секунды. Никаких боевых пропусков и платных преимуществ.</p>
        </div>
        <div className="content-counters"><div><strong>21</strong><span>ПРИКАЗ</span></div><div><strong>04</strong><span>РЕДАКТОРА</span></div><div><strong>03</strong><span>ЭПОХИ</span></div></div>
      </div>
      <div className="arsenal-tabs">
        <button className={tab === 'orders' ? 'is-active' : ''} onClick={() => setTab('orders')}><Layers3 size={17} /> ПРИКАЗЫ</button>
        <button className={tab === 'heroes' ? 'is-active' : ''} onClick={() => setTab('heroes')}><Sparkles size={17} /> РЕДАКТОРЫ</button>
      </div>

      {tab === 'orders' ? (
        <div className="arsenal-layout">
          <section>
            <div className="filter-row">
              {['Все', 'Импульс', 'Оплот', 'Правка'].map((item) => <button key={item} className={school === item ? 'is-active' : ''} onClick={() => setSchool(item)}>{item}<span>{item === 'Все' ? Object.keys(CARDS).length : Object.values(CARDS).filter((card) => card.school === item).length}</span></button>)}
              <p>Нажмите на приказ, чтобы открыть аннотацию</p>
            </div>
            <div className="arsenal-cards-grid">
              {cards.map((card) => <div key={card.id} onMouseEnter={() => setSelectedCard(card.id)}><OrderCard cardId={card.id} selected={selectedCard === card.id} onClick={() => setSelectedCard(card.id)} /></div>)}
            </div>
          </section>
          <aside className="order-dossier">
            <span className="eyebrow">АННОТАЦИЯ / {detail.rarity}</span>
            <div className={`order-dossier__icon order-card--${detail.school.toLowerCase()}`}><OrderIcon cardId={detail.id} size={48} /></div>
            <h2>{detail.name}</h2>
            <span className="order-dossier__school">{detail.school}</span>
            <p className="order-dossier__text">{detail.text}</p>
            <div className="order-dossier__numbers"><div><strong>{detail.cost}</strong><span>ЗАРЯД</span></div><div><strong>{detail.tempo}</strong><span>ТЕМП</span></div><div><strong>60%</strong><span>СИЛА ЭХА</span></div></div>
            <div className="order-dossier__rules">
              <div><Clock3 size={16} /><p><strong>Темп</strong> определяет порядок раскрытия. При равенстве первым действует владелец инициативы.</p></div>
              <div><Radio size={16} /><p><strong>Эхо</strong> повторяет числовые эффекты через два раунда. Особый текст не повторяется.</p></div>
            </div>
            <blockquote>{detail.flavor}</blockquote>
            <button className="button button--primary" onClick={onPlay}>ИСПЫТАТЬ В ДУЭЛИ <ArrowRight size={16} /></button>
          </aside>
        </div>
      ) : (
        <div className="heroes-archive">
          {HEROES.map((hero) => (
            <article className="hero-archive-card" key={hero.id} style={{ '--hero-color': hero.color }}>
              <HeroPortrait heroId={hero.id} />
              <div className="hero-archive-card__content">
                <span className="eyebrow">{hero.number} / {hero.role}</span>
                <h2>{hero.name}</h2>
                <blockquote>{hero.quote}</blockquote>
                <p>{hero.lore}</p>
                <div className="passive-box"><Sparkles size={17} /><div><span>{hero.passiveShort}</span><p>{hero.passive}</p></div></div>
                <div className="hero-archive-card__signatures">{hero.signature.map((cardId) => <OrderCard key={cardId} cardId={cardId} compact />)}</div>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="arsenal-footer-note"><BookOpen size={15} /> Общая основа: 13 приказов. Подпись редактора добавляет ещё 2. В каждой дуэли колода содержит 15 приказов.</div>
    </main>
  );
}
