import { useCallback, useEffect, useRef, useState } from 'react';

const desktopConfig = typeof window !== 'undefined' ? window.palimpsestDesktop : null;
const configuredUrl = import.meta.env.VITE_SERVER_URL || desktopConfig?.serverUrl || '';

export const HTTP_BASE = configuredUrl
  ? configuredUrl.replace(/^ws/, 'http').replace(/\/ws\/?$/, '').replace(/\/$/, '')
  : '';

function websocketUrl() {
  if (configuredUrl) return configuredUrl.startsWith('ws') ? configuredUrl : `ws${configuredUrl.replace(/^http/, '')}/ws`;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

async function fetchJson(path) {
  const response = await fetch(`${HTTP_BASE}${path}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export function useNetwork() {
  const [status, setStatus] = useState('connecting');
  const [profile, setProfile] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [stats, setStats] = useState({ online: 0, activeDuels: 0, openRooms: 0, games: 0, registered: 0 });
  const [rooms, setRooms] = useState([]);
  const [queue, setQueue] = useState({ active: false });
  const [queueCounts, setQueueCounts] = useState({ ranked: 0, casual: 0 });
  const [room, setRoom] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [seat, setSeat] = useState(0);
  const [resolution, setResolution] = useState(null);
  const [ratingChanges, setRatingChanges] = useState(null);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [notice, setNotice] = useState(null);
  const [matchNonce, setMatchNonce] = useState(0);
  const socketRef = useRef(null);
  const reconnectRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const mountedRef = useRef(true);
  const tokenRef = useRef(localStorage.getItem('palimpsest.token'));
  const nameRef = useRef(localStorage.getItem('palimpsest.name') || '');

  const refreshData = useCallback(async () => {
    try {
      const [statsData, leaderboardData, roomsData] = await Promise.all([
        fetchJson('/api/stats'), fetchJson('/api/leaderboard'), fetchJson('/api/lobby'),
      ]);
      if (!mountedRef.current) return;
      setStats(statsData);
      setLeaderboard(leaderboardData.ranking || []);
      setRooms(roomsData.rooms || []);
    } catch {
      // WebSocket status is the user-facing source of truth; offline mode remains available.
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let closedByEffect = false;

    const connect = () => {
      if (!mountedRef.current || closedByEffect) return;
      setStatus(reconnectAttempts.current ? 'reconnecting' : 'connecting');
      let ws;
      try {
        ws = new WebSocket(websocketUrl());
      } catch {
        setStatus('offline');
        reconnectRef.current = setTimeout(connect, 3000);
        return;
      }
      socketRef.current = ws;

      ws.onopen = () => {
        reconnectAttempts.current = 0;
        setStatus('online');
        ws.send(JSON.stringify({ type: 'hello', token: tokenRef.current, name: nameRef.current || undefined }));
        refreshData();
      };

      ws.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message.serverTime) setServerTimeOffset(message.serverTime - Date.now());
        switch (message.type) {
          case 'welcome':
            tokenRef.current = message.token;
            localStorage.setItem('palimpsest.token', message.token);
            setProfile(message.profile);
            break;
          case 'profile':
            setProfile(message.profile);
            break;
          case 'lobby':
            setRooms(message.rooms || []);
            setQueueCounts(message.queues || { ranked: 0, casual: 0 });
            setStats((current) => ({ ...current, online: message.online }));
            break;
          case 'queue':
            setQueue(message.active ? { active: true, ranked: message.ranked, startedAt: message.startedAt } : { active: false });
            break;
          case 'match_started':
            setRoom(message.room);
            setGameState(message.state);
            setSeat(message.you);
            setResolution(null);
            setRatingChanges(null);
            setQueue({ active: false });
            setMatchNonce((value) => value + 1);
            break;
          case 'resolution':
            setRoom(message.room);
            setGameState(message.state);
            setSeat(message.you);
            setResolution(message.result);
            setRatingChanges(message.ratingChanges);
            if (message.state?.winner !== null) refreshData();
            break;
          case 'match_finished':
            setRoom(message.room);
            setGameState(message.state);
            setResolution(message.result);
            setRatingChanges(message.ratingChanges);
            refreshData();
            break;
          case 'room_state':
          case 'opponent_ready':
          case 'reconnected':
          case 'emote':
            setRoom(message.room);
            if (message.state) setGameState(message.state);
            if (typeof message.you === 'number') setSeat(message.you);
            if (message.type === 'reconnected') {
              setResolution(message.result);
              setRatingChanges(message.ratingChanges);
              setMatchNonce((value) => value + 1);
            } else if (message.room?.phase === 'select' && !message.result) {
              setResolution(null);
            }
            break;
          case 'action_accepted':
            break;
          case 'left_room':
          case 'room_closed':
            setRoom(null);
            setGameState(null);
            setResolution(null);
            setRatingChanges(null);
            break;
          case 'error':
            setNotice({ id: Date.now(), text: message.message });
            break;
          case 'session_replaced':
            setNotice({ id: Date.now(), text: message.message });
            break;
          default:
            break;
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current || closedByEffect) return;
        setStatus('offline');
        setQueue({ active: false });
        const delay = Math.min(12_000, 900 * 2 ** Math.min(4, reconnectAttempts.current));
        reconnectAttempts.current += 1;
        reconnectRef.current = setTimeout(connect, delay);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    refreshData();
    const refreshTimer = setInterval(refreshData, 20_000);
    return () => {
      mountedRef.current = false;
      closedByEffect = true;
      clearTimeout(reconnectRef.current);
      clearInterval(refreshTimer);
      socketRef.current?.close();
    };
  }, [refreshData]);

  const send = useCallback((type, payload = {}) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      setNotice({ id: Date.now(), text: 'Нет связи с Архивом. Дуэль с ботом доступна локально.' });
      return false;
    }
    socketRef.current.send(JSON.stringify({ type, ...payload }));
    return true;
  }, []);

  const setName = useCallback((name) => {
    const clean = String(name).trim().slice(0, 18);
    if (!clean) return;
    nameRef.current = clean;
    localStorage.setItem('palimpsest.name', clean);
    setProfile((current) => current ? { ...current, name: clean } : current);
    send('set_name', { name: clean });
  }, [send]);

  const leaveRoom = useCallback(() => {
    send('leave_room');
    setRoom(null);
    setGameState(null);
    setResolution(null);
    setRatingChanges(null);
  }, [send]);

  return {
    status, profile, leaderboard, stats, rooms, queue, queueCounts, room, gameState,
    seat, resolution, ratingChanges, serverTimeOffset, notice, matchNonce,
    send, setName, leaveRoom, refreshData, clearNotice: () => setNotice(null),
  };
}
