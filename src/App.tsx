import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Grid2X2,
  Search,
  Bell,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
  Plus,
  Minus,
  Maximize2,
  Minimize2,
  X,
  Check,
  ArrowRight,
  Clock3,
  NotebookPen,
  Timer,
  CheckCheck,
  Settings2,
  LoaderCircle,
  ShieldCheck,
  FolderKanban,
  ExternalLink,
} from 'lucide-react';
import { useLife } from './state';
import { invoke, today, formatDate } from './api';
import { APPS, appMeta } from './apps/meta';
import { IconButton, Modal, Empty, AppHeading, QuickInput } from './components/ui';
import { Tasks, Notes, TaskCheck, TaskEditor } from './apps/TasksNotes';
import { Calendar, Habits } from './apps/CalendarHabits';
import { Projects, Focus } from './apps/ProjectsFocus';
import { Finance, Files } from './apps/FinanceFiles';
import { Browser } from './apps/Browser';
import { Settings } from './apps/Settings';
import type { AppId, WindowState } from './types';
const spaces = [
  { id: 'personal', name: 'Личное', color: 'sage' },
  { id: 'work', name: 'Работа', color: 'blue' },
  { id: 'study', name: 'Учёба', color: 'lavender' },
];
function Wallpaper() {
  return (
    <div className="wallpaper" aria-hidden="true">
      <div className="wallpaper-glow" />
      <svg className="landscape" viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="land" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#82ad8a" stopOpacity=".03" />
            <stop offset="1" stopColor="#9cc0a3" stopOpacity=".17" />
          </linearGradient>
          <radialGradient id="sun">
            <stop stopColor="#d6edb4" stopOpacity=".16" />
            <stop offset="1" stopColor="#bddeaf" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="1080" cy="170" r="260" fill="url(#sun)" />
        {Array.from({ length: 17 }, (_, i) => (
          <path
            key={i}
            d={`M ${460 + i * 8} 960 C ${140 + i * 20} ${650 - i * 9}, ${980 + i * 4} ${480 - i * 12}, ${850 + i * 8} ${215 - i * 9} S ${1220 + i * 10} ${-70 + i * 5}, 1520 ${-90 + i * 16}`}
            fill="none"
            stroke="#b4d2aa"
            strokeWidth={i % 4 === 0 ? '1.2' : '.7'}
            opacity={0.06 + i * 0.006}
          />
        ))}
        <path d="M700 940C300 650 1050 530 870 210S1220-70 1520-30V940Z" fill="url(#land)" />
      </svg>
      <div className="wallpaper-grain" />
    </div>
  );
}
function Desktop({
  open,
  clock,
  onTask,
}: {
  open: (id: AppId) => void;
  clock: Date;
  onTask: () => void;
}) {
  const { data, cap } = useLife();
  const tasks = data.tasks
      .filter((t) => t.status !== 'done' && (t.due === today() || t.priority === 'high'))
      .slice(0, 3),
    done = data.tasks.filter(
      (t) => t.status === 'done' && t.completedAt?.startsWith(today()),
    ).length;
  const upcoming = data.events
    .filter((e) => Date.parse(e.end) > Date.now())
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
  return (
    <div className="desktop-home">
      <div className="desktop-greeting">
        <div className="desktop-eyebrow">
          <span className="status-dot" />
          МЕСТО, ГДЕ ВСЁ СКЛАДЫВАЕТСЯ
        </div>
        <h1>
          {clock.getHours() < 6
            ? 'Тихой ночи'
            : clock.getHours() < 12
              ? 'Доброе утро'
              : clock.getHours() < 18
                ? 'Добрый день'
                : 'Добрый вечер'}
          <span>
            {data.settings.profile?.name && data.settings.profile.name !== 'Друг'
              ? ', ' + data.settings.profile.name
              : '.'}
          </span>
        </h1>
        <p>Меньше переключений. Больше пространства для жизни.</p>
        <div className="desktop-date">
          <span>{formatDate(today(), { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <i />
          Ваше личное пространство
        </div>
      </div>
      <div className="desktop-main-grid">
        <section className="desktop-app-section">
          <div className="section-title-row">
            <h2>Ваши приложения</h2>
            <button className="text-button" onClick={() => open('settings')}>
              Настроить
              <Settings2 size={13} />
            </button>
          </div>
          <div className="desktop-app-grid">
            {APPS.filter((a) =>
              [
                'browser',
                'tasks',
                'notes',
                'calendar',
                'projects',
                'habits',
                'focus',
                'files',
              ].includes(a.id),
            ).map((app) => {
              const Icon = app.icon;
              return (
                <button className="desktop-app-card" key={app.id} onClick={() => open(app.id)}>
                  <div className="app-card-icon-row">
                    <span className={'app-icon ' + app.color}>
                      <Icon size={24} strokeWidth={1.7} />
                    </span>
                    <ArrowUpRight size={15} />
                  </div>
                  <h3>{app.name}</h3>
                  <p>{app.description}</p>
                </button>
              );
            })}
          </div>
          <div
            className="desktop-quick-note"
            onClick={() => open('notes')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') open('notes');
            }}
          >
            <span className="app-icon amber">
              <NotebookPen size={20} />
            </span>
            <div>
              <strong>Мысль пришла? Дайте ей место.</strong>
              <p>Заметки, которые всегда под рукой.</p>
            </div>
            <ArrowUpRight size={18} />
          </div>
          <div className="desktop-bottom-note">
            <ShieldCheck size={14} />
            <span>Личные данные на устройстве</span>
            <i />
            LifeOS 0.1 preview
          </div>
        </section>
        <aside className="desktop-widgets">
          <section className="day-widget">
            <div className="widget-label">
              <span>СЕЙЧАС — ХОРОШЕЕ ВРЕМЯ</span>
              <Sun size={16} />
            </div>
            <div className="desktop-clock">
              {clock.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <p>{formatDate(today(), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <div className="widget-divider" />
            <div className="next-event-label">
              <span className="status-dot" />
              {upcoming ? 'БЛИЖАЙШЕЕ СОБЫТИЕ' : 'ВРЕМЯ ДЛЯ СЕБЯ'}
            </div>
            <h3>{upcoming?.title || 'В расписании есть воздух'}</h3>
            <span className="next-event-time">
              {upcoming
                ? formatDate(upcoming.start, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Выберите, чему посвятить этот момент'}
            </span>
            <button className="widget-link" onClick={() => open('calendar')}>
              Открыть календарь
              <ArrowUpRight size={14} />
            </button>
          </section>
          <section className="today-widget">
            <div className="widget-heading">
              <h3>Главное на сегодня</h3>
              <button aria-label="Добавить задачу" onClick={onTask}>
                <Plus size={16} />
              </button>
            </div>
            {tasks.map((task) => (
              <div className="mini-task" key={task.id}>
                <TaskCheck task={task} />
                <span>{task.title}</span>
              </div>
            ))}
            {!tasks.length && (
              <p className="widget-empty">Задайте один приоритет. Остальное подождёт.</p>
            )}
            <div className="widget-progress">
              <span>{done} завершено сегодня</span>
              <button onClick={() => open('tasks')} aria-label="Все задачи">
                <ArrowRight size={15} />
              </button>
            </div>
          </section>
          <button className="focus-widget" onClick={() => open('focus')}>
            <span className="focus-widget-icon">
              <Timer size={22} />
            </span>
            <div>
              <strong>
                {data.settings.activeFocus ? 'Фокус-сессия активна' : 'Побыть в фокусе'}
              </strong>
              <p>Одно дело. Всё внимание.</p>
            </div>
            <ArrowUpRight size={17} />
          </button>
        </aside>
      </div>
      <div className="desktop-mode-note">
        <span className="status-dot" />
        {cap.desktop
          ? 'Настольная среда Windows · дисплеи в настройках'
          : 'Интерактивный веб-предпросмотр · встроенный Chromium и дисплеи доступны в EXE'}
      </div>
    </div>
  );
}
function Today({ open }: { open: (id: AppId) => void }) {
  const { data, save } = useLife();
  const tasks = data.tasks.filter((t) => t.due === today() && t.status !== 'done'),
    events = data.events
      .filter((e) => e.start?.slice(0, 10) === today())
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  return (
    <div className="app-page">
      <AppHeading
        eyebrow={formatDate(today(), {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).toUpperCase()}
        title="Соберите свой день"
        description="Не всё сразу. Только то, что действительно важно."
      />
      <div className="today-layout">
        <section className="panel">
          <div className="panel-heading">
            <h3>
              <CheckCheck size={17} />
              Приоритеты
            </h3>
            <button className="text-button" onClick={() => open('tasks')}>
              Все задачи
              <ArrowUpRight size={14} />
            </button>
          </div>
          <QuickInput
            placeholder="Что важно сделать сегодня?"
            onSubmit={(title) =>
              save('tasks', { title, due: today(), status: 'todo', priority: 'normal' })
            }
          />
          {tasks.map((t) => (
            <div className="task-row" key={t.id}>
              <TaskCheck task={t} />
              <span className="task-main">{t.title}</span>
            </div>
          ))}
          {!tasks.length && (
            <Empty
              title="Время выбрать главное"
              description="Добавьте один приоритет на сегодня."
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h3>
              <Clock3 size={17} />
              Расписание
            </h3>
            <button className="text-button" onClick={() => open('calendar')}>
              Календарь
              <ArrowUpRight size={14} />
            </button>
          </div>
          {events.map((e) => (
            <div className="agenda-event" key={e.id}>
              <span>{formatDate(e.start, { hour: '2-digit', minute: '2-digit' })}</span>
              <strong>{e.title}</strong>
            </div>
          ))}
          {!events.length && (
            <Empty
              icon={<Sun size={24} />}
              title="Есть свободное время"
              description="Оставить его свободным — тоже хороший план."
            />
          )}
          <button className="button secondary full" onClick={() => open('focus')}>
            <Timer size={16} />
            Начать фокус-сессию
          </button>
        </section>
      </div>
      <div className="today-insight">
        <span className="app-icon lavender">
          <FolderKanban size={22} />
        </span>
        <div>
          <h3>Маленькие шаги складываются</h3>
          <p>
            {data.tasks.filter((t) => t.status === 'done').length} завершённых задач ·{' '}
            {data.notes.length} заметок · {data.projects.length} проектов. Это ваши реальные записи,
            без выдуманных показателей продуктивности.
          </p>
        </div>
      </div>
    </div>
  );
}
function Launcher({ onClose, open }: { onClose: () => void; open: (id: AppId) => void }) {
  const { data, run } = useLife();
  const [query, setQuery] = useState(''),
    [results, setResults] = useState<any[]>([]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) void run<any[]>('localSearch', { query }).then((r) => setResults(r || []));
      else setResults([]);
    }, 180);
    return () => clearTimeout(timer);
  }, [query, run]);
  const apps = APPS.filter((a) =>
    (a.name + ' ' + a.description).toLowerCase().includes(query.toLowerCase()),
  );
  const typeToApp: Record<string, AppId> = {
    tasks: 'tasks',
    notes: 'notes',
    events: 'calendar',
    projects: 'projects',
    habits: 'habits',
    bookmarks: 'files',
    journal: 'journal',
  };
  return (
    <Modal title="Ваше пространство" wide onClose={onClose}>
      <div className="command-search">
        <Search size={20} />
        <input
          autoFocus
          placeholder="Приложения, заметки, задачи…"
          aria-label="Локальный поиск и приложения"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <kbd>ESC</kbd>
      </div>
      <p className="command-caption">
        ПРИЛОЖЕНИЯ <span>Для поиска в интернете откройте Life Browser</span>
      </p>
      <div className="launcher-grid">
        {apps.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              onClick={() => {
                open(a.id);
                onClose();
              }}
            >
              <span className={'app-icon ' + a.color}>
                <Icon size={22} />
              </span>
              <span>
                {a.name}
                <small>{a.description}</small>
              </span>
            </button>
          );
        })}
      </div>
      {data.launchers.length > 0 && (
        <>
          <p className="command-caption">WINDOWS-ПРОГРАММЫ</p>
          {data.launchers.map((l) => (
            <button
              className="launcher-external"
              key={l.id}
              onClick={() => {
                void run('launcher:run', { id: l.id });
                onClose();
              }}
            >
              <ExternalLink size={16} />
              {l.title}
            </button>
          ))}
        </>
      )}
      {results.length > 0 && (
        <>
          <p className="command-caption">ЛИЧНЫЕ ДАННЫЕ</p>
          <div className="local-results">
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  open(typeToApp[r.type] || 'today');
                  onClose();
                }}
              >
                <Search size={15} />
                <span>
                  {r.title}
                  <small>{r.snippet}</small>
                </span>
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
export function App() {
  const { data, cap, loading, error, toasts, setting, save, notify, refresh } = useLife();
  const [clock, setClock] = useState(new Date()),
    [space, setSpace] = useState('personal'),
    [windows, setWindows] = useState<WindowState[]>([]),
    [launcher, setLauncher] = useState(false),
    [notifications, setNotifications] = useState(false),
    [spaceMenu, setSpaceMenu] = useState(false),
    [quickTask, setQuickTask] = useState(false);
  const loaded = useRef(false),
    stage = useRef<HTMLElement>(null),
    finished = useRef(new Set<string>());
  const windowsRef = useRef(windows);
  windowsRef.current = windows;
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!loading && !loaded.current) {
      loaded.current = true;
      const saved = data.settings.desktopLayout;
      if (Array.isArray(saved))
        setWindows(
          saved
            .filter((w: any) => APPS.some((a) => a.id === w.id))
            .slice(0, 12)
            .map((w: any, i: number) => ({ ...w, z: i + 1 })),
        );
      setSpace(data.settings.activeWorkspace || 'personal');
    }
  }, [loading, data.settings]);
  useEffect(() => {
    if (!loaded.current) return;
    const timer = setTimeout(() => {
      void setting('desktopLayout', windows);
    }, 900);
    return () => clearTimeout(timer);
  }, [windows, setting]);
  useEffect(() => {
    const session = data.settings.activeFocus;
    if (
      !session ||
      session.status !== 'running' ||
      session.endsAt > Date.now() ||
      finished.current.has(session.id)
    )
      return;
    finished.current.add(session.id);
    void (async () => {
      const result = await save('sessions', {
        id: session.id,
        title: 'Фокус-сессия',
        duration: session.duration,
        taskId: session.taskId,
        day: today(),
        completed: true,
      });
      if (result) {
        await setting('activeFocus', null);
        notify('Фокус-сессия завершена. Время для небольшого перерыва.');
        if (cap.desktop)
          void invoke('notify', {
            title: 'Фокус завершён',
            body: 'Выделенное время сохранено. Сделайте небольшой перерыв.',
          }).catch(() => {});
      } else finished.current.delete(session.id);
    })();
  }, [clock, data.settings.activeFocus, save, setting, notify, cap.desktop]);
  useEffect(() => {
    if (!window.lifeos) return;
    return window.lifeos.on('prepare-close', async () => {
      const pending: Promise<unknown>[] = [];
      window.dispatchEvent(new CustomEvent('lifeos:flush', { detail: { pending } }));
      const results = await Promise.allSettled(pending);
      if (results.some((r) => r.status === 'rejected' || r.value === null)) {
        notify('Не удалось сохранить черновик. Окно оставлено открытым.', true);
        await invoke('window:cancelClose');
        return;
      }
      await setting('desktopLayout', windowsRef.current);
      await invoke('window:readyToClose');
    });
  }, [setting, notify]);
  const top = windows
    .filter((w) => w.workspace === space && !w.minimized)
    .sort((a, b) => b.z - a.z)[0]?.id;
  const focus = useCallback(
    (id: AppId) =>
      setWindows((ws) =>
        ws.map((w) =>
          w.id === id
            ? { ...w, minimized: false, z: Math.max(0, ...ws.map((item) => item.z)) + 1 }
            : w,
        ),
      ),
    [],
  );
  const open = useCallback(
    (id: AppId) => {
      setWindows((ws) => {
        const old = ws.find((w) => w.id === id);
        if (old)
          return ws.map((w) =>
            w.id === id
              ? {
                  ...w,
                  workspace: space,
                  minimized: false,
                  z: Math.max(0, ...ws.map((item) => item.z)) + 1,
                }
              : w,
          );
        const rect = stage.current?.getBoundingClientRect();
        return [
          ...ws,
          {
            id,
            workspace: space,
            x: 28,
            y: 24,
            width: Math.min(1080, (rect?.width || 1100) - 60),
            height: Math.min(700, (rect?.height || 760) - 110),
            maximized: true,
            minimized: false,
            z: Math.max(0, ...ws.map((item) => item.z)) + 1,
          },
        ];
      });
      setSpaceMenu(false);
    },
    [space],
  );
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setLauncher((v) => !v);
      }
      if (e.key === 'Escape') setSpaceMenu(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  function changeWindow(id: AppId, patch: Partial<WindowState>) {
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  }
  function drag(e: React.PointerEvent, w: WindowState, resize = false) {
    if ((e.target as HTMLElement).closest('button') && !resize) return;
    if (w.maximized && !resize) return;
    e.preventDefault();
    const startX = e.clientX,
      startY = e.clientY;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    focus(w.id);
    const move = (ev: PointerEvent) => {
      const rect = stage.current?.getBoundingClientRect();
      const dx = ev.clientX - startX,
        dy = ev.clientY - startY;
      if (resize)
        changeWindow(w.id, {
          width: Math.max(580, Math.min((rect?.width || 1400) - w.x, w.width + dx)),
          height: Math.max(380, Math.min((rect?.height || 900) - w.y - 70, w.height + dy)),
        });
      else
        changeWindow(w.id, {
          x: Math.max(0, Math.min((rect?.width || 1400) - 160, w.x + dx)),
          y: Math.max(0, Math.min((rect?.height || 900) - 130, w.y + dy)),
        });
    };
    const end = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', end);
      target.removeEventListener('pointercancel', end);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
  }
  function renderApp(w: WindowState) {
    switch (w.id) {
      case 'today':
        return <Today open={open} />;
      case 'tasks':
        return <Tasks />;
      case 'notes':
        return <Notes />;
      case 'journal':
        return <Notes journal />;
      case 'calendar':
        return <Calendar />;
      case 'habits':
        return <Habits />;
      case 'projects':
        return <Projects open={open} />;
      case 'focus':
        return <Focus />;
      case 'finance':
        return <Finance />;
      case 'files':
        return <Files />;
      case 'settings':
        return <Settings />;
      case 'browser':
        return (
          <Browser
            active={
              top === 'browser' &&
              !launcher &&
              !notifications &&
              !quickTask &&
              !w.minimized &&
              w.workspace === space
            }
            open={open}
          />
        );
    }
  }
  const pending = data.tasks.filter((t) => t.status !== 'done' && t.due && t.due <= today());
  if (loading)
    return (
      <div className="splash">
        <div className="brand-mark large">
          L<span />
        </div>
        <h1>LifeOS</h1>
        <p>Готовим ваше пространство</p>
        <LoaderCircle size={20} className="spin" />
      </div>
    );
  if (error)
    return (
      <div className="fatal">
        <div className="brand-mark">
          L<span />
        </div>
        <h1>Не удалось загрузить данные</h1>
        <p>{error}</p>
        <button
          className="button primary"
          onClick={() => {
            void refresh();
          }}
        >
          Повторить подключение
        </button>
        <p>Сервис данных должен быть запущен. Ложные данные не подставляются.</p>
      </div>
    );
  return (
    <div className="os-shell">
      <header className="systembar">
        <button
          className="system-brand"
          onClick={() =>
            setWindows((ws) =>
              ws.map((w) => (w.workspace === space ? { ...w, minimized: true } : w)),
            )
          }
        >
          <div className="brand-mark">
            L<span />
          </div>
          <strong>LifeOS</strong>
          <span className="version-badge">PREVIEW</span>
        </button>
        <div className="system-workspace">
          <button onClick={() => setSpaceMenu(!spaceMenu)}>
            <span
              className={'workspace-dot ' + (spaces.find((s) => s.id === space)?.color || 'sage')}
            />
            {spaces.find((s) => s.id === space)?.name || 'Личное'}
            <ChevronDown size={12} />
          </button>
          {spaceMenu && (
            <div className="workspace-menu">
              {spaces.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSpace(s.id);
                    setSpaceMenu(false);
                    void setting('activeWorkspace', s.id);
                  }}
                >
                  <span className={'workspace-dot ' + s.color} />
                  {s.name}
                  {s.id === space && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="system-search" onClick={() => setLauncher(true)}>
          <Search size={14} />
          <span>Поиск и команды</span>
          <kbd>Ctrl K</kbd>
        </button>
        <div className="system-right">
          {data.settings.activeFocus && (
            <button className="system-focus" onClick={() => open('focus')}>
              <Timer size={13} />
              {data.settings.activeFocus.status === 'running' ? 'В фокусе' : 'Пауза'}
            </button>
          )}
          <span className="system-mode">
            <Monitor size={13} />
            {cap.desktop ? 'Desktop' : 'Web preview'}
          </span>
          <IconButton
            label="Переключить тему"
            onClick={() => {
              void setting('profile', {
                ...data.settings.profile,
                theme: data.settings.profile?.theme === 'light' ? 'dark' : 'light',
              });
            }}
          >
            {data.settings.profile?.theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </IconButton>
          <button
            className="notification-button icon-button"
            aria-label="Уведомления"
            onClick={() => setNotifications(true)}
          >
            <Bell size={16} />
            {pending.length > 0 && <i />}
          </button>
          <span className="system-time">
            {clock.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button className="avatar" aria-label="Профиль" onClick={() => open('settings')}>
            {(data.settings.profile?.name || 'L').slice(0, 1).toUpperCase()}
          </button>
        </div>
      </header>
      <aside className="side-rail">
        <button
          className={'rail-button home ' + (!top ? 'active' : '')}
          title="Рабочий стол"
          aria-label="Рабочий стол"
          onClick={() =>
            setWindows((ws) =>
              ws.map((w) => (w.workspace === space ? { ...w, minimized: true } : w)),
            )
          }
        >
          <Grid2X2 size={21} />
        </button>
        <div className="rail-divider" />
        {APPS.filter((a) =>
          ['today', 'browser', 'tasks', 'notes', 'calendar', 'projects'].includes(a.id),
        ).map((a) => {
          const Icon = a.icon;
          return (
            <button
              className={'rail-button ' + (top === a.id ? 'active' : '')}
              key={a.id}
              title={a.name}
              aria-label={a.name}
              onClick={() => open(a.id)}
            >
              <Icon size={20} strokeWidth={1.65} />
              {windows.some((w) => w.id === a.id) && <i />}
            </button>
          );
        })}
        <button
          className="rail-button"
          title="Все приложения"
          aria-label="Все приложения"
          onClick={() => setLauncher(true)}
        >
          <Plus size={20} />
        </button>
        <div className="rail-bottom">
          <button
            className="rail-button"
            title="Настройки"
            aria-label="Настройки"
            onClick={() => open('settings')}
          >
            <Settings2 size={20} />
          </button>
          <span className="rail-vertical-label">YOUR SPACE</span>
        </div>
      </aside>
      <main className="desktop-stage" ref={stage}>
        <Wallpaper />
        <Desktop open={open} clock={clock} onTask={() => setQuickTask(true)} />
        {windows.map((w) => {
          const a = appMeta(w.id),
            Icon = a.icon;
          const hidden = w.workspace !== space || w.minimized;
          return (
            <section
              key={w.id}
              className={
                'desktop-window ' +
                (w.maximized ? 'maximized ' : '') +
                (top === w.id ? 'focused' : '')
              }
              style={{
                display: hidden ? 'none' : undefined,
                left: w.maximized ? undefined : w.x,
                top: w.maximized ? undefined : w.y,
                width: w.maximized ? undefined : w.width,
                height: w.maximized ? undefined : w.height,
                zIndex: w.z,
              }}
              onPointerDown={() => {
                if (top !== w.id) focus(w.id);
              }}
              aria-label={a.name}
            >
              <div
                className="window-titlebar"
                onPointerDown={(e) => drag(e, w)}
                onDoubleClick={() => changeWindow(w.id, { maximized: !w.maximized })}
              >
                <div>
                  <span className={'window-app-icon ' + a.color}>
                    <Icon size={15} />
                  </span>
                  <strong>{a.name}</strong>
                  <span className="window-subtitle">
                    {w.id === 'browser'
                      ? 'Интернет, который ближе'
                      : spaces.find((s) => s.id === space)?.name}
                  </span>
                </div>
                <div className="window-controls">
                  <IconButton
                    label="Свернуть"
                    onClick={() => changeWindow(w.id, { minimized: true })}
                  >
                    <Minus size={14} />
                  </IconButton>
                  <IconButton
                    label={w.maximized ? 'Восстановить окно' : 'Развернуть'}
                    onClick={() => changeWindow(w.id, { maximized: !w.maximized })}
                  >
                    {w.maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  </IconButton>
                  <IconButton
                    label="Закрыть приложение"
                    className="close"
                    onClick={() => setWindows((ws) => ws.filter((x) => x.id !== w.id))}
                  >
                    <X size={15} />
                  </IconButton>
                </div>
              </div>
              <div className="window-body">{renderApp(w)}</div>
              {!w.maximized && (
                <div
                  className="resize-handle"
                  onPointerDown={(e) => drag(e, w, true)}
                  role="separator"
                  aria-label="Изменить размер"
                />
              )}
            </section>
          );
        })}
        <nav className="desktop-dock" aria-label="Панель приложений">
          <button
            className="dock-launcher"
            title="Все приложения"
            aria-label="Открыть приложения"
            onClick={() => setLauncher(true)}
          >
            <Grid2X2 size={23} />
          </button>
          <span className="dock-divider" />
          {APPS.filter((a) =>
            ['browser', 'tasks', 'notes', 'calendar', 'projects', 'focus'].includes(a.id),
          ).map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                className={'dock-item ' + (top === a.id ? 'active' : '')}
                onClick={() => {
                  const existing = windows.find((w) => w.id === a.id);
                  if (existing && top === a.id) changeWindow(a.id, { minimized: true });
                  else open(a.id);
                }}
                title={a.name}
                aria-label={'Открыть ' + a.name}
              >
                <span className={'app-icon ' + a.color}>
                  <Icon size={23} strokeWidth={1.8} />
                </span>
                <span className="dock-tooltip">{a.name}</span>
                {windows.some((w) => w.id === a.id) && <i />}
              </button>
            );
          })}
          <span className="dock-divider" />
          <button
            className="dock-item"
            onClick={() => open('settings')}
            title="Настройки"
            aria-label="Открыть настройки"
          >
            <span className="app-icon neutral">
              <Settings2 size={23} strokeWidth={1.8} />
            </span>
          </button>
        </nav>
      </main>
      {launcher && <Launcher open={open} onClose={() => setLauncher(false)} />}{' '}
      {notifications && (
        <Modal title="Сейчас важно" onClose={() => setNotifications(false)}>
          {pending.length ? (
            pending.map((t) => (
              <div className="task-row" key={t.id}>
                <TaskCheck task={t} />
                <span>
                  {t.title}
                  <small>{t.due === today() ? 'Сегодня' : formatDate(t.due)}</small>
                </span>
              </div>
            ))
          ) : (
            <Empty
              icon={<Bell size={25} />}
              title="Ничего срочного"
              description="Можно спокойно заняться своим."
            />
          )}
          <div className="subtle-note">
            Локальные напоминания. При закрытом приложении фоновые уведомления не гарантируются.
          </div>
        </Modal>
      )}
      {quickTask && <TaskEditor onClose={() => setQuickTask(false)} />}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={'toast ' + (t.error ? 'error' : '')}>
            <span>{t.error ? <InfoIcon /> : <Check size={16} />}</span>
            <p>{t.text}</p>
            {t.action && <button onClick={t.action}>{t.actionLabel}</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
function InfoIcon() {
  return <span>!</span>;
}
