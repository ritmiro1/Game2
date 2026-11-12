import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Plus,
  X,
  Search,
  Globe2,
  LockKeyhole,
  BookMarked,
  Download,
  ArrowUpRight,
  ShieldCheck,
  SlidersHorizontal,
  LoaderCircle,
  Clock3,
  RefreshCw,
  Server,
  ChevronDown,
} from 'lucide-react';
import { useLife } from '../state';
import { IconButton, Modal, Empty } from '../components/ui';
import { formatDate, invoke } from '../api';
import type { AppId, NativeTab, SearchResponse, SearchStatus } from '../types';
function asUrl(value: string) {
  try {
    if (/^https?:\/\//i.test(value)) {
      const u = new URL(value);
      return ['http:', 'https:'].includes(u.protocol) ? u.href : null;
    }
    if (!/\s/.test(value) && /^[\p{L}\d-]+(?:\.[\p{L}\d-]+)+(?:[/:?#].*)?$/u.test(value))
      return new URL('https://' + value).href;
  } catch {}
  return null;
}
export function Browser({ active, open }: { active: boolean; open: (app: AppId) => void }) {
  const { data, cap, run, save, notify } = useLife();
  const [address, setAddress] = useState(''),
    [query, setQuery] = useState(''),
    [period, setPeriod] = useState('all'),
    [response, setResponse] = useState<SearchResponse | null>(null),
    [status, setStatus] = useState<SearchStatus | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [tabs, setTabs] = useState<NativeTab[]>([]),
    [nativeId, setNativeId] = useState<string | null>(null),
    [profile, setProfile] = useState('personal'),
    [bookmark, setBookmark] = useState(false),
    [bookmarkTitle, setBookmarkTitle] = useState(''),
    [bookmarkProject, setBookmarkProject] = useState(''),
    [sources, setSources] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null),
    addressRef = useRef<HTMLInputElement>(null),
    requestId = useRef(0);
  const current = tabs.find((t) => t.id === nativeId);
  const sync = useCallback((payload: { tabs: NativeTab[]; activeId: string | null }) => {
    setTabs(payload.tabs);
    setNativeId(payload.activeId || null);
  }, []);
  useEffect(() => {
    if (!window.lifeos) return;
    invoke('browser:state')
      .then(sync)
      .catch(() => {});
    return window.lifeos.on('browser-state', sync);
  }, [sync]);
  useEffect(() => {
    if (current?.url) setAddress(current.url);
  }, [current?.url]);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const s = await invoke<SearchStatus>('searchStatus');
        if (alive) setStatus(s);
      } catch {}
    }
    void load();
    const timer = setInterval(() => {
      void load();
    }, 4000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!window.lifeos) return;
    return window.lifeos.on('browser-shortcut', (key: string) => {
      if (key === 'l') addressRef.current?.select();
      if (key === 't') {
        setNativeId(null);
        setQuery('');
        setAddress('');
        setResponse(null);
      }
      if (key === 'k')
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
      if (key === 'w') setNativeId(null);
    });
  }, []);
  const updateBounds = useCallback(() => {
    if (!cap.nativeBrowser) return;
    const bounds = hostRef.current?.getBoundingClientRect();
    void invoke('browser:bounds', {
      visible: active && !!nativeId && !!bounds && !bookmark && !sources,
      id: nativeId,
      bounds: bounds
        ? {
            x: Math.round(bounds.left),
            y: Math.round(bounds.top),
            width: Math.round(bounds.width),
            height: Math.round(bounds.height),
          }
        : null,
    }).catch(() => {});
  }, [cap.nativeBrowser, active, nativeId, bookmark, sources]);
  useLayoutEffect(() => {
    updateBounds();
    const observer = new ResizeObserver(updateBounds);
    if (hostRef.current) observer.observe(hostRef.current);
    window.addEventListener('resize', updateBounds);
    const timer = setInterval(updateBounds, 120);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateBounds);
      clearInterval(timer);
      if (cap.nativeBrowser) void invoke('browser:bounds', { visible: false }).catch(() => {});
    };
  }, [updateBounds, cap.nativeBrowser]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!active) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        addressRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active]);
  async function doSearch(text: string, p = period) {
    const value = text.trim();
    if (!value) return;
    const id = ++requestId.current;
    setNativeId(null);
    if (cap.nativeBrowser) void run('browser:hide');
    setQuery(value);
    setAddress(value);
    setBusy(true);
    setError('');
    const result = await run<SearchResponse>('webSearch', { query: value, period: p });
    if (id !== requestId.current) return;
    setBusy(false);
    if (result) {
      setResponse(result);
      setStatus(result);
    } else {
      setError('Поиск сейчас недоступен. Проверьте подключение и настройки поискового сервера.');
      setResponse(null);
    }
  }
  async function visit(url: string) {
    if (!cap.nativeBrowser) {
      window.open(url, '_blank', 'noopener,noreferrer');
      notify('Страница открыта в отдельной вкладке. Встроенный браузер доступен в EXE.');
      return;
    }
    const result = await run<{ id: string }>('browser:newTab', { url, profile });
    if (result) setNativeId(result.id);
  }
  async function submit(text: string) {
    const url = asUrl(text);
    if (url) {
      if (current && cap.nativeBrowser) await run('browser:navigate', { id: current.id, url });
      else await visit(url);
    } else await doSearch(text);
  }
  function home() {
    setNativeId(null);
    setAddress(query);
    if (cap.nativeBrowser) void run('browser:hide');
  }
  return (
    <div className="browser-app">
      <div className="browser-tabs">
        <button className={'browser-tab search-tab ' + (!nativeId ? 'active' : '')} onClick={home}>
          <span className="mini-life">L</span>
          <span>Life Search</span>
        </button>
        {tabs.map((tab) => (
          <div key={tab.id} className={'browser-tab ' + (tab.id === nativeId ? 'active' : '')}>
            <button
              onClick={() => {
                setNativeId(tab.id);
                void run('browser:activate', { id: tab.id });
              }}
            >
              {tab.loading ? <LoaderCircle size={13} className="spin" /> : <Globe2 size={13} />}
              <span>{tab.title || 'Новая вкладка'}</span>
            </button>
            <button
              aria-label="Закрыть вкладку"
              onClick={() => {
                void run('browser:closeTab', { id: tab.id });
                if (nativeId === tab.id) home();
              }}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <IconButton
          label="Новый поиск"
          onClick={() => {
            home();
            setQuery('');
            setAddress('');
            setResponse(null);
            addressRef.current?.focus();
          }}
        >
          <Plus size={16} />
        </IconButton>
        <span className="browser-tabs-spacer" />
        <span className="engine-badge">
          <ShieldCheck size={12} />
          {cap.nativeBrowser ? 'CHROMIUM' : 'ВЕБ-ПРЕДПРОСМОТР'}
        </span>
      </div>
      <div className="browser-navigation">
        <IconButton
          label="Назад"
          disabled={!current?.canGoBack}
          onClick={() => {
            void run('browser:back', { id: nativeId });
          }}
        >
          <ArrowLeft size={17} />
        </IconButton>
        <IconButton
          label="Вперёд"
          disabled={!current?.canGoForward}
          onClick={() => {
            void run('browser:forward', { id: nativeId });
          }}
        >
          <ArrowRight size={17} />
        </IconButton>
        <IconButton
          label="Обновить"
          onClick={() => {
            if (nativeId) void run('browser:reload', { id: nativeId });
            else if (query) void doSearch(query);
          }}
        >
          <RotateCw size={16} />
        </IconButton>
        <form
          className="browser-address"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(address);
          }}
        >
          {current?.url.startsWith('https:') ? (
            <LockKeyhole size={13} />
          ) : current ? (
            <Globe2 size={14} />
          ) : (
            <Search size={14} />
          )}
          <input
            ref={addressRef}
            aria-label="Адрес или интернет-запрос"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Найти в интернете или ввести адрес"
          />
          <kbd>Ctrl L</kbd>
        </form>
        <IconButton
          label="Сохранить страницу"
          disabled={!current}
          onClick={() => {
            setBookmarkTitle(current?.title || '');
            setBookmark(true);
          }}
        >
          <BookMarked size={17} />
        </IconButton>
        <IconButton label="Загрузки" onClick={() => open('files')}>
          <Download size={17} />
        </IconButton>
        <select
          className="browser-profile"
          aria-label="Профиль новых вкладок"
          value={profile}
          onChange={(e) => setProfile(e.target.value)}
        >
          <option value="personal">Личный</option>
          <option value="work">Рабочий</option>
          <option value="private">Инкогнито</option>
        </select>
      </div>
      {nativeId ? (
        <div ref={hostRef} className="native-browser-host">
          <div className="native-loading">
            <Globe2 size={30} />
            <p>Страница открывается в изолированном Chromium</p>
            <button className="button secondary" onClick={home}>
              Вернуться к поиску
            </button>
          </div>
        </div>
      ) : (
        <div className="search-content">
          <div className={'search-page ' + (query ? 'with-results' : '')}>
            <div className="search-topline">
              <span>
                <span className="status-dot" />
                ВАШ ПОИСК. ВАШ ИНТЕРНЕТ.
              </span>
              <button className="text-button muted" onClick={() => setSources(true)}>
                <Server size={13} />
                {status?.documents || 0} документов
                <ChevronDown size={12} />
              </button>
            </div>
            <div className="search-hero">
              <div className="search-brand">
                <div className="search-symbol">
                  <span />
                  <span />
                  <span />
                </div>
                <h1>
                  Life<span>Search</span>
                  <sup>preview</sup>
                </h1>
              </div>
              {!query && <p>Любопытство начинается с одного вопроса.</p>}
              <form
                className="search-box"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit(address);
                }}
              >
                <Search size={22} />
                <input
                  aria-label="Поиск в интернете"
                  placeholder="Что вам интересно сегодня?"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
                <button aria-label="Найти в интернете" disabled={busy || !address.trim()}>
                  {busy ? <LoaderCircle size={19} className="spin" /> : <ArrowUpRight size={20} />}
                </button>
              </form>
              {!query && (
                <div className="search-suggestions">
                  <span>Начните с источников индекса</span>
                  {['Visual Studio Code', 'Node.js', 'Electron'].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        void doSearch(s);
                      }}
                    >
                      {s}
                      <ArrowUpRight size={12} />
                    </button>
                  ))}
                </div>
              )}
            </div>
            {query && (
              <>
                <div className="search-filters">
                  <button className="active">
                    <Globe2 size={14} />
                    Веб-результаты
                  </button>
                  <select
                    aria-label="Период публикации"
                    value={period}
                    onChange={(e) => {
                      setPeriod(e.target.value);
                      void doSearch(query, e.target.value);
                    }}
                  >
                    <option value="all">За всё время</option>
                    <option value="day">За сутки</option>
                    <option value="week">За неделю</option>
                    <option value="month">За месяц</option>
                  </select>
                  <button onClick={() => setSources(true)}>
                    <SlidersHorizontal size={14} />
                    Источники
                  </button>
                </div>
                {busy ? (
                  <div className="search-loading">
                    <LoaderCircle size={21} className="spin" />
                    Ищем в собственном веб-индексе…
                  </div>
                ) : error ? (
                  <div className="error-banner">{error}</div>
                ) : (
                  response && (
                    <>
                      <div className="search-result-meta">
                        Найдено: {response.results.length} · Собственный индекс Life Search
                      </div>
                      {response.results.map((result) => (
                        <article className="search-result" key={result.url}>
                          <div className="search-result-domain">
                            <span className="domain-icon small">
                              <Globe2 size={14} />
                            </span>
                            <span>
                              {new URL(result.url).hostname}
                              <small>{new URL(result.url).pathname.slice(0, 100)}</small>
                            </span>
                          </div>
                          <button
                            className="result-title"
                            onClick={() => {
                              void visit(result.url);
                            }}
                          >
                            {result.title}
                            <ArrowUpRight size={16} />
                          </button>
                          <p>{result.snippet}</p>
                          <div className="result-dates">
                            {result.publishedAt && (
                              <span>Опубликовано: {formatDate(result.publishedAt)}</span>
                            )}
                            <span>
                              <Clock3 size={11} />
                              Проверено:{' '}
                              {formatDate(result.lastFetchedAt, {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {result.stale && (
                              <span className="warning-text">Требуется повторная проверка</span>
                            )}
                          </div>
                        </article>
                      ))}
                      {!response.results.length && (
                        <Empty
                          icon={<Search size={28} />}
                          title="В текущем индексе нет совпадений"
                          description="Это не значит, что в интернете ничего нет. Попробуйте другой запрос, обновите источники или расширьте индекс."
                          action={
                            <button className="button secondary" onClick={() => setSources(true)}>
                              Посмотреть источники
                            </button>
                          }
                        />
                      )}
                    </>
                  )
                )}
              </>
            )}
            <div className="search-bottom">
              <div>
                <ShieldCheck size={16} />
                <span>
                  Собственный индекс. Реальные источники.
                  <small>Запросы не перенаправляются в Google или Bing.</small>
                </span>
              </div>
              <button className="text-button" onClick={() => setSources(true)}>
                {status?.busy ? (
                  <>
                    <LoaderCircle size={13} className="spin" />
                    Обновляется индекс
                  </>
                ) : (
                  <>
                    Об индексе
                    <ArrowUpRight size={13} />
                  </>
                )}
              </button>
            </div>
            <div className="search-coverage">
              {status?.coverage ||
                'Пилотный индекс загружается. Охват ограничен подключёнными источниками.'}
            </div>
            {!cap.desktop && (
              <div className="preview-note">
                Веб-предпросмотр: сайты открываются отдельной вкладкой. В EXE используется
                встроенный Chromium.
              </div>
            )}
          </div>
        </div>
      )}
      {sources && (
        <Modal title="Живой индекс Life Search" wide onClose={() => setSources(false)}>
          <div className="source-stats">
            <div>
              <strong>{status?.documents || 0}</strong>
              <span>документов</span>
            </div>
            <div>
              <strong>{status?.sources.length || 0}</strong>
              <span>источников</span>
            </div>
            <div>
              <strong>{status?.busy ? 'Идёт обход' : 'Готов'}</strong>
              <span>{status?.progress || 'Собственный индекс'}</span>
            </div>
          </div>
          <p className="muted-text">{status?.coverage} Дата проверки не равна дате публикации.</p>
          <div className="source-list">
            {status?.sources.map((s) => (
              <div className="source-item" key={s.id}>
                <Globe2 size={17} />
                <div>
                  <strong>{s.title}</strong>
                  <small>{s.url}</small>
                  <span className={s.last_error ? 'warning-text' : 'muted-text'}>
                    {s.last_error ||
                      (s.last_checked
                        ? 'Последняя попытка: ' +
                          formatDate(s.last_checked, {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: 'numeric',
                            month: 'short',
                          })
                        : 'Ещё не проверен')}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="form-footer">
            <button
              className="button secondary"
              disabled={status?.busy}
              onClick={async () => {
                const s = await run<SearchStatus>('crawl');
                if (s) {
                  setStatus(s);
                  notify('Обновление индекса запущено');
                }
              }}
            >
              <RefreshCw size={15} />
              Обновить источники
            </button>
            <button
              className="button primary"
              onClick={() => {
                setSources(false);
                open('settings');
              }}
            >
              Настроить поиск
            </button>
          </div>
        </Modal>
      )}
      {bookmark && current && (
        <Modal title="Сохранить страницу" onClose={() => setBookmark(false)}>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await save('bookmarks', {
                  title: bookmarkTitle,
                  url: current.url,
                  projectId: bookmarkProject || null,
                })
              ) {
                notify('Страница сохранена в материалах');
                setBookmark(false);
              }
            }}
          >
            <label>
              Название
              <input
                required
                value={bookmarkTitle}
                onChange={(e) => setBookmarkTitle(e.target.value)}
              />
            </label>
            <label>
              Адрес
              <input value={current.url} readOnly />
            </label>
            <label>
              Проект
              <select value={bookmarkProject} onChange={(e) => setBookmarkProject(e.target.value)}>
                <option value="">Без проекта</option>
                {data.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <button className="button primary">Сохранить</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
