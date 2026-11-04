import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Bot, Check, Copy, DoorOpen, Globe2, KeyRound, LoaderCircle,
  Lock, Plus, Radio, RefreshCw, Search, Shield, Sparkles, Swords, Trophy, UserRound,
  Users, X,
} from 'lucide-react';
import { getHero } from '../../shared/content.js';
import { EmptyState, HeroPortrait, RankCrest } from './UI.jsx';

function QueueTimer({ startedAt }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const update = () => setSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  return <span>{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span>;
}

export default function Lobby({
  network, onBack, onQuick, onCreate, onJoin, onCancelQueue, onLocal, onLeaveRoom, onCopyCode,
}) {
  const [code, setCode] = useState('');
  const [tab, setTab] = useState('rooms');
  const { profile, stats, leaderboard, rooms, queue, queueCounts, room, status } = network;
  const waiting = room?.phase === 'waiting';

  return (
    <main className="lobby-screen page-shell">
      <div className="page-title-row">
        <div>
          <button className="text-button page-back" onClick={onBack}><ArrowLeft size={15} /> ГЛАВНАЯ</button>
          <div className="eyebrow">ОБЩИЙ АРХИВ / СЕЗОН 01</div>
          <h1>СЕТЕВЫЕ ДУЭЛИ</h1>
          <p>Одинаковые правила. Скрытые приказы. Только решения определяют рейтинг.</p>
        </div>
        <div className="lobby-presence">
          <span className={status === 'online' ? 'is-online' : ''}><Radio size={15} /> {status === 'online' ? 'СВЯЗЬ СТАБИЛЬНА' : 'НЕТ СВЯЗИ'}</span>
          <div><strong>{stats.online || 0}</strong><small>в Архиве</small></div>
          <div><strong>{stats.activeDuels || 0}</strong><small>дуэлей сейчас</small></div>
        </div>
      </div>

      {queue.active && (
        <section className="queue-banner">
          <div className="queue-radar"><span /><span /><Search size={26} /></div>
          <div><span className="eyebrow">{queue.ranked ? 'РЕЙТИНГОВЫЙ ПОИСК' : 'ОБЫЧНЫЙ ПОИСК'}</span><h2>СВЕРЯЕМ ВАШУ ВЕРСИЮ…</h2><p>Архив ищет живого редактора. Ожидание <QueueTimer startedAt={queue.startedAt || Date.now()} /></p></div>
          <div className="queue-banner__count"><span>В ОЧЕРЕДИ</span><strong>{queueCounts[queue.ranked ? 'ranked' : 'casual'] || 1}</strong></div>
          <button className="button button--ghost" onClick={onLocal}><Bot size={17} /> ТРЕНИРОВКА</button>
          <button className="icon-button" onClick={onCancelQueue} title="Отменить поиск"><X size={20} /></button>
        </section>
      )}

      {waiting && (
        <section className="queue-banner queue-banner--room">
          <div className="queue-radar"><span /><span /><DoorOpen size={26} /></div>
          <div><span className="eyebrow">ПРИВАТНАЯ КОМНАТА СОЗДАНА</span><h2>КОД: {room.code}</h2><p>Передайте код второму редактору. Комната ожидает подключения.</p></div>
          <button className="button button--primary" onClick={() => onCopyCode(room.code)}><Copy size={17} /> КОПИРОВАТЬ КОД</button>
          <button className="icon-button" onClick={onLeaveRoom} title="Закрыть комнату"><X size={20} /></button>
        </section>
      )}

      <div className="lobby-grid">
        <div className="lobby-main">
          <section className="matchmaking-grid">
            <article className="match-card match-card--ranked">
              <div className="match-card__glow" />
              <div className="match-card__icon"><Trophy size={24} /></div>
              <span className="eyebrow">СОРЕВНОВАТЕЛЬНЫЙ РЕЖИМ</span>
              <h2>РЕЙТИНГОВАЯ ДУЭЛЬ</h2>
              <p>Соперник из общей очереди. Победа меняет вашу позицию в мировом Архиве.</p>
              <div className="match-card__meta"><span><Users size={14} /> {queueCounts.ranked} в очереди</span><span>45 сек / ход</span></div>
              <button className="button button--primary" disabled={status !== 'online' || queue.active || waiting} onClick={() => onQuick(true)}>
                НАЙТИ СОПЕРНИКА <ArrowRight size={17} />
              </button>
            </article>
            <article className="match-card">
              <div className="match-card__icon"><Swords size={24} /></div>
              <span className="eyebrow">БЕЗ ВЛИЯНИЯ НА РЕЙТИНГ</span>
              <h2>СВОБОДНАЯ ДУЭЛЬ</h2>
              <p>Проверьте нового редактора или спокойно освойте Эхо против живого соперника.</p>
              <div className="match-card__meta"><span><Users size={14} /> {queueCounts.casual} в очереди</span><span>Elo отключён</span></div>
              <button className="button button--outline" disabled={status !== 'online' || queue.active || waiting} onClick={() => onQuick(false)}>
                БЫСТРАЯ ИГРА <ArrowRight size={17} />
              </button>
            </article>
          </section>

          <section className="lobby-panel custom-panel">
            <div className="panel-tabs">
              <button className={tab === 'rooms' ? 'is-active' : ''} onClick={() => setTab('rooms')}><DoorOpen size={16} /> ОТКРЫТЫЕ КОМНАТЫ <span>{rooms.length}</span></button>
              <button className={tab === 'private' ? 'is-active' : ''} onClick={() => setTab('private')}><KeyRound size={16} /> ПО КОДУ</button>
              <button className="icon-button panel-tabs__refresh" onClick={network.refreshData} title="Обновить"><RefreshCw size={16} /></button>
            </div>
            {tab === 'rooms' ? (
              <div className="room-list">
                {rooms.map((item) => (
                  <div className="room-row" key={item.id}>
                    <HeroPortrait heroId={item.heroId} small />
                    <div><strong>{item.host.name}</strong><span>Свободная дуэль · {getHero(item.heroId).name}</span></div>
                    <span className="room-row__code">{item.code}</span>
                    <span className="room-row__rating">{item.host.rating} <small>ELO</small></span>
                    <button className="button button--small button--outline" onClick={() => onJoin({ roomId: item.id })}>ВОЙТИ</button>
                  </div>
                ))}
                {!rooms.length && (
                  <EmptyState
                    icon={DoorOpen}
                    title="Пока тихо"
                    text={status === 'online' ? 'Открытых комнат нет. Создайте свою или начните быстрый поиск.' : 'Архив недоступен. Открытые комнаты появятся после восстановления связи.'}
                    action={<button className="button button--small button--outline" disabled={status !== 'online'} onClick={() => onCreate(false)}><Plus size={15} /> СОЗДАТЬ КОМНАТУ</button>}
                  />
                )}
              </div>
            ) : (
              <div className="private-room-controls">
                <div><Lock size={22} /><div><strong>СОЗДАТЬ ПРИВАТНЫЙ АРХИВ</strong><p>Ссылка не нужна: соперник введёт шестизначный код.</p></div></div>
                <button className="button button--outline" disabled={status !== 'online'} onClick={() => onCreate(true)}><Plus size={16} /> СОЗДАТЬ</button>
                <span className="private-room-controls__divider">ИЛИ</span>
                <label><span>КОД КОМНАТЫ</span><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="НАПРИМЕР, X7K2PQ" maxLength={6} /></label>
                <button className="button button--primary" disabled={code.length !== 6 || status !== 'online'} onClick={() => onJoin({ code })}>ПОДКЛЮЧИТЬСЯ</button>
              </div>
            )}
          </section>
        </div>

        <aside className="lobby-sidebar">
          <section className="profile-card">
            <div className="profile-card__top"><div className="profile-avatar"><UserRound size={25} /></div><div><span>ВАШ ПРОФИЛЬ</span><strong>{profile?.name || 'ГОСТЕВОЙ РЕДАКТОР'}</strong></div><span className="profile-card__season">S01</span></div>
            <RankCrest rating={profile?.rating ?? 1000} />
            <div className="profile-card__stats">
              <div><strong>{profile?.wins || 0}</strong><span>ПОБЕД</span></div>
              <div><strong>{profile?.losses || 0}</strong><span>ПОРАЖЕНИЙ</span></div>
              <div><strong>{profile?.games ? Math.round((profile.wins / profile.games) * 100) : 0}%</strong><span>ВИНРЕЙТ</span></div>
            </div>
            <div className="calibration"><span>Калибровка: {Math.min(5, profile?.games || 0)}/5 рейтинговых дуэлей</span><i><b style={{ width: `${Math.min(100, ((profile?.games || 0) / 5) * 100)}%` }} /></i></div>
          </section>

          <section className="leaderboard-card">
            <div className="panel-heading"><div><span className="section-index">ТОП</span><h2>ЛИДЕРЫ АРХИВА</h2></div><Trophy size={17} /></div>
            <div className="leaderboard-list">
              {leaderboard.slice(0, 8).map((player, index) => (
                <div className={`leaderboard-row ${player.id === profile?.id ? 'is-you' : ''}`} key={player.id}>
                  <span className="leaderboard-row__pos">{String(index + 1).padStart(2, '0')}</span>
                  <div><strong>{player.name}</strong><span>{player.isBot ? 'КАЛИБРОВОЧНЫЙ AI' : `${player.wins} побед · ${player.games} игр`}</span></div>
                  <b>{player.rating}</b>
                </div>
              ))}
              {!leaderboard.length && <p className="muted-copy">Нет связи с рейтинговым Архивом.</p>}
            </div>
            <div className="leaderboard-card__legend"><Shield size={12} /> AI помечены и не участвуют в поиске людей</div>
          </section>

          <button className="training-card" onClick={onLocal}>
            <div><Bot size={22} /><span>НЕТ ЖИВОГО СОПЕРНИКА?</span></div>
            <strong>ИСПЫТАЙТЕ ОРАКУЛА</strong>
            <p>Двухходовой поиск и модель ваших привычек. Рейтинг не изменится.</p>
            <span className="inline-link">ТРЕНИРОВОЧНАЯ ДУЭЛЬ <ArrowRight size={14} /></span>
          </button>
        </aside>
      </div>
    </main>
  );
}
