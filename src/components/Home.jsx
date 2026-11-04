import React from 'react';
import {
  ArrowRight, Bot, BrainCircuit, ChevronRight, CircleDot, Clock3, Globe2,
  Radio, ShieldCheck, Sparkles, Swords, Trophy, Users,
} from 'lucide-react';
import { FRONTS } from '../../shared/content.js';
import { Glyph, HeroPortrait, RankCrest } from './UI.jsx';

export default function Home({ onLocal, onOnline, onTutorial, onArsenal, leaderboard, stats }) {
  return (
    <main className="home-screen">
      <section className="home-hero">
        <div className="home-hero__art" />
        <div className="home-hero__veil" />
        <div className="home-hero__content">
          <div className="eyebrow"><span className="live-dot" /> СЕЗОН 01 · ГОРОД ПОСЛЕ ТОЧКИ</div>
          <h1>КАЖДОЕ РЕШЕНИЕ<br /><em>ОСТАВЛЯЕТ ЭХО</em></h1>
          <p className="home-hero__lead">
            Тактическая дуэль одновременных приказов. Переписывайте три эпохи,
            предсказывайте соперника и помните: ваш ход вернётся через два раунда.
          </p>
          <div className="home-hero__actions">
            <button className="button button--primary button--large" onClick={onOnline}>
              <Globe2 size={19} /> ВОЙТИ В АРХИВ <ArrowRight size={18} />
            </button>
            <button className="button button--ghost button--large" onClick={onLocal}>
              <Bot size={19} /> ДУЭЛЬ С БОТОМ
            </button>
          </div>
          <div className="home-hero__micro">
            <span><ShieldCheck size={14} /> Боты не подглядывают</span>
            <span><Clock3 size={14} /> Дуэль 8–15 минут</span>
            <span><Sparkles size={14} /> Без случайных эффектов</span>
          </div>
        </div>

        <div className="home-hero__signal" aria-hidden="true">
          <div className="signal-card signal-card--back">
            <span>РАУНД +2</span><strong>ВАШ ПРИКАЗ ВЕРНЁТСЯ</strong>
          </div>
          <div className="signal-card">
            <div className="signal-card__top"><Radio size={15} /> ОБНАРУЖЕНО ЭХО <span>60%</span></div>
            <div className="signal-card__body">
              <Glyph index={1} size={58} />
              <div><small>БУДУЩЕЕ СОБЫТИЕ</small><strong>НАТИСК</strong><span>Раунд 04 · Разлом</span></div>
            </div>
            <div className="signal-card__line"><i /><i /><i /><i /><i /></div>
          </div>
        </div>

        <div className="home-hero__side-label">АРХИВ ВЭЯ / ПОСЛЕДНЯЯ СЕКУНДА / 23:59:59</div>
      </section>

      <section className="home-dashboard">
        <article className="dashboard-panel manifest-panel">
          <div className="panel-heading">
            <div><span className="section-index">01</span><h2>НОВЫЙ ВИД ДУЭЛИ</h2></div>
            <button className="text-button" onClick={onTutorial}>ПРАВИЛА <ChevronRight size={14} /></button>
          </div>
          <p className="panel-intro">Не рефлексы. Не сбор колоды перед матчем. Только ваше чтение ситуации.</p>
          <div className="manifest-steps">
            <div><span>1</span><Swords size={20} /><strong>ВЫБЕРИТЕ ТАЙНО</strong><p>Приказ и эпоха известны только вам.</p></div>
            <div><span>2</span><BrainCircuit size={20} /><strong>РАСКРОЙТЕ ОДНОВРЕМЕННО</strong><p>Темп решит, чья правка сработает первой.</p></div>
            <div><span>3</span><Radio size={20} /><strong>ВСТРЕТЬТЕ ПОСЛЕДСТВИЕ</strong><p>Эхо повторит приказ через два раунда.</p></div>
          </div>
          <button className="inline-link" onClick={onArsenal}>ИССЛЕДОВАТЬ 21 ПРИКАЗ И 4 РЕДАКТОРОВ <ArrowRight size={15} /></button>
        </article>

        <article className="dashboard-panel ranking-panel">
          <div className="panel-heading">
            <div><span className="section-index">02</span><h2>ВЕРХ АРХИВА</h2></div>
            <Trophy size={18} />
          </div>
          <div className="mini-ranking">
            {leaderboard.slice(0, 4).map((player, index) => (
              <div className="mini-ranking__row" key={player.id}>
                <span className="mini-ranking__position">{String(index + 1).padStart(2, '0')}</span>
                <div className={`mini-avatar mini-avatar--${index}`}>{player.name.slice(0, 1)}</div>
                <div className="mini-ranking__name"><strong>{player.name}</strong><span>{player.isBot ? 'АРХИВНОЕ ЭХО · AI' : `${player.wins} ПОБЕД`}</span></div>
                <b>{player.rating}</b>
              </div>
            ))}
            {!leaderboard.length && <div className="ranking-loading"><span /><span /><span /><small>Таблица появится при связи с Архивом</small></div>}
          </div>
          <div className="ranking-note"><CircleDot size={12} /> Рейтинг начисляется только в сетевых дуэлях</div>
        </article>

        <article className="dashboard-panel season-panel">
          <div className="season-panel__image"><HeroPortrait heroId="mirra" /></div>
          <div className="season-panel__content">
            <div className="panel-heading"><div><span className="section-index">03</span><h2>ЛЕТОПИСЬ</h2></div></div>
            <span className="season-panel__chapter">ГЛАВА 01 / ВЭЙ</span>
            <h3>Город, который<br />дожил до точки</h3>
            <p>В 23:59:59 Архив переписал сам себя. Теперь два редактора спорят, какая версия города имеет право на утро.</p>
            <button className="text-button" onClick={onTutorial}>ОТКРЫТЬ ДОСЬЕ <ArrowRight size={14} /></button>
          </div>
        </article>
      </section>

      <section className="epoch-strip">
        {FRONTS.map((front, index) => (
          <div key={front.id} style={{ '--front-color': front.color }}>
            <Glyph index={index} size={42} />
            <span>{front.index}</span>
            <div><strong>{front.name}</strong><small>{front.epithet}</small></div>
          </div>
        ))}
        <div className="epoch-strip__stats">
          <Users size={18} /><strong>{stats.online || 0}</strong><span>В СЕТИ</span>
          <i />
          <Swords size={18} /><strong>{stats.activeDuels || 0}</strong><span>ДУЭЛЕЙ</span>
        </div>
      </section>
    </main>
  );
}
