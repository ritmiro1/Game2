import React, { useEffect, useState } from 'react';
import { BookOpen, Bot, Check, Globe2, Home, Layers3, Radio, Settings2, Swords, UserRound, Volume2, VolumeX, X } from 'lucide-react';
import { useNetwork } from './lib/network.js';
import { setSoundEnabled, playSound } from './lib/sound.js';
import { ConnectionBadge, Logo, Modal, RankCrest } from './components/UI.jsx';
import HomeScreen from './components/Home.jsx';
import Lobby from './components/Lobby.jsx';
import HeroSelect from './components/HeroSelect.jsx';
import Arsenal from './components/Arsenal.jsx';
import Tutorial from './components/Tutorial.jsx';
import DuelView, { LocalDuel } from './components/Duel.jsx';

export default function App() {
  const network = useNetwork();
  const [screen, setScreen] = useState('home');
  const [previousScreen, setPreviousScreen] = useState('home');
  const [setup, setSetup] = useState(null);
  const [localConfig, setLocalConfig] = useState(null);
  const [activeMode, setActiveMode] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [sound, setSound] = useState(localStorage.getItem('palimpsest.sound') !== 'off');
  const [toast, setToast] = useState(null);

  useEffect(() => setSoundEnabled(sound), [sound]);
  useEffect(() => {
    if (!network.matchNonce || !network.gameState || !network.room) return;
    setActiveMode('online');
    setScreen('duel');
    setSetup(null);
  }, [network.matchNonce]);
  useEffect(() => {
    if (network.notice) {
      setToast(network.notice);
      network.clearNotice();
    }
  }, [network.notice]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  const navigate = (next) => {
    setPreviousScreen(screen === 'duel' ? 'home' : screen);
    setScreen(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const openSetup = (config) => setSetup(config);
  const notify = (text) => setToast({ id: Date.now(), text });

  const confirmSetup = (heroId, difficulty) => {
    playSound('commit');
    if (setup.type === 'local') {
      setLocalConfig({ heroId, difficulty, nonce: Date.now() });
      setActiveMode('local');
      setScreen('duel');
    } else if (setup.type === 'quick') {
      network.send('quick_match', { heroId, ranked: setup.ranked });
      setScreen('lobby');
    } else if (setup.type === 'create') {
      network.send('create_room', { heroId, private: setup.private });
      setScreen('lobby');
    } else if (setup.type === 'join') {
      network.send('join_room', { heroId, code: setup.code, roomId: setup.roomId });
      setScreen('lobby');
    }
    setSetup(null);
  };

  const leaveDuel = () => {
    if (activeMode === 'online') network.leaveRoom();
    setActiveMode(null);
    setScreen(activeMode === 'online' ? 'lobby' : 'home');
  };

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      notify(`Код ${code} скопирован`);
    } catch {
      notify(`Код комнаты: ${code}`);
    }
  };

  const onlinePlayers = network.room?.players?.map((player) => ({
    name: player.name, heroId: player.heroId, connected: player.connected, rating: player.rating,
  }));

  return (
    <div className={`app ${screen === 'duel' ? 'app--duel' : ''}`}>
      {screen !== 'duel' && (
        <header className="app-header">
          <button className="brand-button" onClick={() => navigate('home')}><Logo /></button>
          <nav className="main-nav">
            <button className={screen === 'home' ? 'is-active' : ''} onClick={() => navigate('home')}><Home size={15} /> ГЛАВНАЯ</button>
            <button className={screen === 'lobby' ? 'is-active' : ''} onClick={() => navigate('lobby')}><Globe2 size={15} /> СЕТЕВЫЕ ДУЭЛИ</button>
            <button className={screen === 'arsenal' ? 'is-active' : ''} onClick={() => navigate('arsenal')}><Layers3 size={15} /> АРСЕНАЛ</button>
            <button className={screen === 'tutorial' ? 'is-active' : ''} onClick={() => navigate('tutorial')}><BookOpen size={15} /> АКАДЕМИЯ</button>
          </nav>
          <div className="app-header__right">
            <ConnectionBadge status={network.status} online={network.stats.online} />
            <button className="icon-button" title={sound ? 'Выключить звук' : 'Включить звук'} onClick={() => { setSound((value) => !value); playSound('select'); }}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
            <button className="header-profile" onClick={() => { setNameDraft(network.profile?.name || ''); setProfileOpen(true); }}><span className="header-profile__avatar"><UserRound size={17} /></span><div><strong>{network.profile?.name || 'РЕДАКТОР'}</strong><span>{network.profile?.rating ?? 1000} ELO</span></div><Settings2 size={14} /></button>
          </div>
        </header>
      )}

      {screen === 'home' && <HomeScreen onLocal={() => openSetup({ type: 'local' })} onOnline={() => navigate('lobby')} onTutorial={() => navigate('tutorial')} onArsenal={() => navigate('arsenal')} leaderboard={network.leaderboard} stats={network.stats} />}
      {screen === 'lobby' && <Lobby network={network} onBack={() => navigate('home')} onQuick={(ranked) => openSetup({ type: 'quick', ranked })} onCreate={(isPrivate) => openSetup({ type: 'create', private: isPrivate })} onJoin={(config) => openSetup({ type: 'join', ...config })} onCancelQueue={() => network.send('cancel_queue')} onLocal={() => { if (network.queue.active) network.send('cancel_queue'); openSetup({ type: 'local' }); }} onLeaveRoom={network.leaveRoom} onCopyCode={copyCode} />}
      {screen === 'arsenal' && <Arsenal onBack={() => navigate('home')} onPlay={() => openSetup({ type: 'local' })} />}
      {screen === 'tutorial' && <Tutorial onBack={() => navigate('home')} onTraining={() => openSetup({ type: 'local', difficulty: 'reader' })} />}
      {screen === 'duel' && activeMode === 'local' && localConfig && <LocalDuel key={localConfig.nonce} config={localConfig} profile={network.profile} onLeave={leaveDuel} />}
      {screen === 'duel' && activeMode === 'online' && network.gameState && network.room && onlinePlayers?.length === 2 && (
        <DuelView
          state={network.gameState}
          resolution={network.resolution}
          room={network.room}
          you={network.seat}
          playersMeta={onlinePlayers}
          onAction={(action) => network.send('submit_action', { action })}
          onLeave={leaveDuel}
          onRematch={() => network.send('rematch')}
          onEmote={(text) => network.send('emote', { text })}
          serverTimeOffset={network.serverTimeOffset}
          ratingChanges={network.ratingChanges}
        />
      )}

      {screen !== 'duel' && <footer className="app-footer"><Logo compact /><span>ОРИГИНАЛЬНАЯ ТАКТИЧЕСКАЯ ДУЭЛЬ · v1.0</span><div><i /> ВСЕ РЕШЕНИЯ ОСТАВЛЯЮТ СЛЕД</div></footer>}

      {setup && <HeroSelect setup={setup} onClose={() => setSetup(null)} onConfirm={confirmSetup} />}

      {profileOpen && (
        <Modal onClose={() => setProfileOpen(false)} className="profile-modal" labelledBy="profile-title">
          <span className="eyebrow">ЛИЧНОЕ ДОСЬЕ / S01</span><h2 id="profile-title">ПРОФИЛЬ РЕДАКТОРА</h2>
          <RankCrest rating={network.profile?.rating ?? 1000} />
          <label className="field-label"><span>ПОЗЫВНОЙ В АРХИВЕ</span><input value={nameDraft} onChange={(event) => setNameDraft(event.target.value.slice(0, 18))} maxLength={18} placeholder="ВАШЕ ИМЯ" /></label>
          <p className="field-hint">Гостевой профиль привязан к этому устройству. Токен восстановления хранится только локально.</p>
          <div className="profile-modal__stats"><div><strong>{network.profile?.games || 0}</strong><span>ДУЭЛЕЙ</span></div><div><strong>{network.profile?.wins || 0}</strong><span>ПОБЕД</span></div><div><strong>{network.profile?.bestRating || 1000}</strong><span>ЛУЧШИЙ ELO</span></div></div>
          <button className="button button--primary" disabled={!nameDraft.trim()} onClick={() => { network.setName(nameDraft); setProfileOpen(false); notify('Профиль обновлён'); }}><Check size={17} /> СОХРАНИТЬ</button>
        </Modal>
      )}

      {toast && <div className="toast" key={toast.id}><Radio size={17} /><span>{toast.text}</span><button onClick={() => setToast(null)}><X size={15} /></button></div>}
    </div>
  );
}
