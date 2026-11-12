import { useEffect, useRef, useState } from 'react';
import {
  UserRound,
  Monitor,
  Search,
  Database,
  Info,
  Sun,
  Moon,
  Laptop,
  Check,
  Download,
  Upload,
  Archive,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Globe2,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { useLife } from '../state';
import { AppHeading, IconButton, Modal } from '../components/ui';
import { downloadJson, formatDate, invoke, readableError } from '../api';
import type { DisplayInfo, SearchStatus } from '../types';
export function Settings() {
  const { data, cap, setting, run, refresh, notify } = useLife();
  const [section, setSection] = useState('profile'),
    [name, setName] = useState(data.settings.profile?.name || 'Друг'),
    [server, setServer] = useState(data.settings.searchServer || ''),
    [displays, setDisplays] = useState<DisplayInfo[]>([]),
    [status, setStatus] = useState<SearchStatus | null>(null),
    [sourceTitle, setSourceTitle] = useState(''),
    [sourceUrl, setSourceUrl] = useState(''),
    [importData, setImportData] = useState<any>(null),
    [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const profile = data.settings.profile || {};
  async function loadStatus() {
    const s = await run<SearchStatus>('searchStatus');
    if (s) setStatus(s);
  }
  useEffect(() => {
    void invoke<DisplayInfo[]>('displays')
      .then(setDisplays)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (section === 'search') void loadStatus();
  }, [section]);
  const items = [
    ['profile', 'Личное пространство', UserRound],
    ['display', 'Экран и Windows', Monitor],
    ['search', 'Поисковая система', Search],
    ['data', 'Данные и копии', Database],
    ['about', 'О LifeOS', Info],
  ] as const;
  return (
    <div className="settings-layout">
      <aside className="settings-sidebar">
        <h2>Настройки</h2>
        {items.map(([id, title, Icon]) => (
          <button
            key={id}
            className={section === id ? 'active' : ''}
            onClick={() => setSection(id)}
          >
            <Icon size={17} />
            {title}
          </button>
        ))}
        <div className="sidebar-footnote">Сделайте это пространство своим.</div>
      </aside>
      <div className="settings-content">
        {section === 'profile' && (
          <>
            <AppHeading
              eyebrow="ПО ВАШИМ ПРАВИЛАМ"
              title="Личное пространство"
              description="Немного настроек, чтобы почувствовать себя дома."
            />
            <section className="settings-section">
              <h3>Как к вам обращаться?</h3>
              <div className="profile-edit">
                <div className="avatar large">{name.slice(0, 1).toUpperCase() || 'L'}</div>
                <input
                  aria-label="Ваше имя"
                  maxLength={50}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button
                  className="button secondary"
                  onClick={() => {
                    void setting('profile', { ...profile, name: name.trim() || 'Друг' });
                    notify('Имя сохранено');
                  }}
                >
                  Сохранить
                </button>
              </div>
            </section>
            <section className="settings-section">
              <h3>Настроение интерфейса</h3>
              <div className="theme-options">
                {[
                  ['dark', 'Вечер', Moon],
                  ['light', 'Утро', Sun],
                ].map(([id, label, Icon]) => {
                  const I = Icon as typeof Moon;
                  return (
                    <button
                      className={'theme-choice ' + (profile.theme === id ? 'active' : '')}
                      key={id as string}
                      onClick={() => {
                        void setting('profile', { ...profile, theme: id });
                      }}
                    >
                      <span className={'theme-preview ' + id}>
                        <i />
                        <i />
                        <i />
                      </span>
                      <span>
                        <I size={15} />
                        {label as string}
                        {profile.theme === id && <Check size={14} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="settings-section">
              <h3>Акцентный цвет</h3>
              <div className="accent-options">
                {[
                  ['sage', 'Шалфей', '#b6edbd'],
                  ['blue', 'Небо', '#a9c6f5'],
                  ['lavender', 'Лаванда', '#c9b7ee'],
                  ['amber', 'Песок', '#e5c49d'],
                ].map(([id, label, color]) => (
                  <button
                    key={id}
                    className={profile.accent === id ? 'active' : ''}
                    onClick={() => {
                      void setting('profile', { ...profile, accent: id });
                    }}
                  >
                    <span style={{ background: color }}>
                      {profile.accent === id && <Check size={15} />}
                    </span>
                    {label}
                  </button>
                ))}
              </div>
            </section>
            <section className="settings-section">
              <h3>Рабочая среда</h3>
              <p>
                Локальные профили и пространства не являются отдельными Windows-учётными записями.
                Данные доступны процессам с правами вашего пользователя.
              </p>
            </section>
          </>
        )}
        {section === 'display' && (
          <>
            <AppHeading
              eyebrow="РЕАЛЬНЫЕ ВОЗМОЖНОСТИ СИСТЕМЫ"
              title="Экран и Windows"
              description="Без имитации дополнительного монитора."
            />
            <div className="display-illustration">
              <div>
                <Monitor size={70} strokeWidth={1} />
                <span>Физический дисплей</span>
              </div>
              <span>+</span>
              <div className="virtual">
                <Monitor size={70} strokeWidth={1} />
                <span>LifeOS Virtual Display</span>
              </div>
            </div>
            <div className="info-banner">
              <ShieldCheck size={20} />
              <span>
                <strong>Виртуальный драйвер не устанавливается автоматически.</strong>
                <br />В preview включён экспериментальный проект на IddCx. Production-подпись и
                аппаратные испытания ещё не выполнены. Обычное окно не считается вторым монитором.
              </span>
            </div>
            <section className="settings-section">
              <h3>Обнаруженные дисплеи</h3>
              {!cap.desktop ? (
                <p>
                  Браузерный предпросмотр не может перечислять системные дисплеи. Эти действия
                  доступны в Windows EXE.
                </p>
              ) : (
                displays.map((d) => (
                  <div className="display-row" key={d.id}>
                    <Monitor size={23} />
                    <div>
                      <strong>
                        {d.label || 'Дисплей ' + d.id}
                        {d.primary ? ' · Основной' : ''}
                      </strong>
                      <small>
                        {d.bounds.width} × {d.bounds.height} · масштаб{' '}
                        {Math.round(d.scaleFactor * 100)}%
                        {d.virtual ? ' · LifeOS Virtual Display' : ''}
                      </small>
                    </div>
                    <button
                      className="button secondary small"
                      onClick={() => {
                        void run('display:move', { id: d.id });
                      }}
                    >
                      Открыть здесь
                    </button>
                    {!d.primary && (
                      <button
                        className="button secondary small"
                        onClick={() => {
                          void run('display:viewer', { id: d.id });
                        }}
                      >
                        Viewer
                      </button>
                    )}
                  </div>
                ))
              )}
              <div className="form-footer">
                <button
                  className="button secondary"
                  disabled={!cap.desktop}
                  onClick={async () => {
                    const list = await run<DisplayInfo[]>('displays');
                    if (list) setDisplays(list);
                  }}
                >
                  <RefreshCw size={15} />
                  Проверить дисплеи
                </button>
                <button
                  className="button secondary"
                  disabled={!cap.desktop}
                  onClick={() => {
                    void run('display:sources');
                  }}
                >
                  <FolderOpen size={15} />
                  Исходники драйвера
                </button>
              </div>
            </section>
            <section className="settings-section">
              <h3>Режим окна</h3>
              <button
                className="button secondary"
                disabled={!cap.desktop}
                onClick={() => {
                  void run('window:fullscreen');
                }}
              >
                <Laptop size={16} />
                Переключить полный экран
              </button>
              <p>
                Полный экран использует существующий монитор. Это не установка виртуального дисплея.
              </p>
            </section>
            <section className="settings-section">
              <h3>Windows-программы</h3>
              <p>
                Добавляйте только знакомые EXE. Программы запускаются обычными окнами Windows, без
                повышенных прав и без обещания встроить любое окно в LifeOS.
              </p>
              <button
                className="button secondary"
                disabled={cap.platform !== 'win32'}
                onClick={async () => {
                  const result = await run('launcher:add');
                  if (result) {
                    await refresh();
                    notify('Программа добавлена в меню приложений');
                  }
                }}
              >
                <Plus size={16} />
                Добавить Windows-программу
              </button>
              {data.launchers.map((l) => (
                <div className="file-row" key={l.id}>
                  <ExternalLink size={17} />
                  <div>
                    <strong>{l.title}</strong>
                    <small>{l.path}</small>
                  </div>
                  <button
                    className="button small secondary"
                    onClick={() => {
                      void run('launcher:run', { id: l.id });
                    }}
                  >
                    Запустить
                  </button>
                </div>
              ))}
            </section>
          </>
        )}
        {section === 'search' && (
          <>
            <AppHeading
              eyebrow="LIFE SEARCH"
              title="Свой интернет-поиск"
              description="Собственные обходчик, индекс и ранжирование. Не выдача чужого поисковика."
            />
            <section className="settings-section">
              <h3>Где работает индекс</h3>
              <p>
                По умолчанию работает встроенный локальный backend. Он обновляется, пока запущена
                LifeOS. Для постоянного обновления настройте собственный сервер из этого
                репозитория.
              </p>
              <label className="form-label">
                Сервер Life Search, HTTPS
                <input
                  type="url"
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  placeholder="Пусто — встроенный локальный индекс"
                />
              </label>
              <button
                className="button secondary"
                onClick={async () => {
                  const result = await run('settings', {
                    key: 'searchServer',
                    value: server.trim(),
                  });
                  if (result !== null) {
                    await refresh();
                    notify('Настройка сервера сохранена');
                    await loadStatus();
                  }
                }}
              >
                Сохранить подключение
              </button>
              <p className="field-help">
                На сервер отправляется веб-запрос, но не ваши заметки, файлы или cookies. Google /
                Bing API не используются.
              </p>
            </section>
            <section className="settings-section">
              <div className="section-title-row">
                <h3>Источники · {status?.documents || 0} документов</h3>
                <button
                  className="button secondary small"
                  onClick={async () => {
                    await run('crawl');
                    await loadStatus();
                  }}
                  disabled={status?.busy || !!data.settings.searchServer}
                >
                  <RefreshCw size={14} />
                  {status?.busy ? 'Обновляется…' : 'Обновить'}
                </button>
              </div>
              <p>{status?.coverage}</p>
              {status?.sources.map((s) => (
                <div className="source-item" key={s.id}>
                  <Globe2 size={17} />
                  <div>
                    <strong>{s.title}</strong>
                    <small>{s.url}</small>
                    {s.last_error && <span className="warning-text">{s.last_error}</span>}
                  </div>
                  <IconButton
                    label="Удалить источник из локального индекса"
                    disabled={!!data.settings.searchServer}
                    onClick={async () => {
                      await run('removeSource', { id: s.id });
                      await loadStatus();
                    }}
                  >
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              ))}
              <form
                className="form-stack source-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setAdding(true);
                  const result = await run('addSource', { title: sourceTitle, url: sourceUrl });
                  setAdding(false);
                  if (result) {
                    setSourceTitle('');
                    setSourceUrl('');
                    await loadStatus();
                    notify('Источник добавлен. Запустите обновление.');
                  }
                }}
              >
                <label>
                  Публичная страница или раздел
                  <input
                    required
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://example.org/news/"
                  />
                </label>
                <label>
                  Название
                  <input
                    value={sourceTitle}
                    onChange={(e) => setSourceTitle(e.target.value)}
                    placeholder="По желанию"
                  />
                </label>
                <button
                  className="button secondary"
                  disabled={adding || !!data.settings.searchServer}
                >
                  <Plus size={15} />
                  {adding ? 'Проверка адреса…' : 'Добавить источник'}
                </button>
              </form>
              <p className="field-help">
                Только публичные HTTP(S)-источники. Обход уважает robots.txt и ограничивает
                нагрузку. Для удалённого backend источники меняются через защищённое admin API.
              </p>
            </section>
          </>
        )}
        {section === 'data' && (
          <>
            <AppHeading
              eyebrow="ВАШИ ДАННЫЕ ОСТАЮТСЯ ВАШИМИ"
              title="Данные и копии"
              description="SQLite, открытый экспорт и резервное восстановление."
            />
            <section className="settings-section">
              <h3>Экспорт всего пространства</h3>
              <p>
                Задачи, заметки, события и настройки в JSON. Браузерные cookies и пароли в архив не
                включаются. Файлы, на которые ссылаются материалы, также не копируются.
              </p>
              <button
                className="button primary"
                onClick={async () => {
                  const snapshot = await run('export');
                  if (snapshot)
                    downloadJson(
                      snapshot,
                      'LifeOS-backup-' + new Date().toISOString().slice(0, 10) + '.json',
                    );
                }}
              >
                <Download size={16} />
                Скачать резервную копию
              </button>
            </section>
            <section className="settings-section">
              <h3>Локальная резервная копия</h3>
              <p>
                Последняя:{' '}
                {data.settings.lastBackup
                  ? formatDate(data.settings.lastBackup, {
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Ещё не создана'}
                . При работающем приложении выполняется ежедневная проверка.
              </p>
              <button
                className="button secondary"
                onClick={async () => {
                  const result = await run<any>('backup');
                  if (result) {
                    await refresh();
                    notify('Копия создана: ' + result.file);
                  }
                }}
              >
                <Archive size={16} />
                Создать копию сейчас
              </button>
            </section>
            <section className="settings-section">
              <h3>Восстановить из JSON</h3>
              <p>
                Восстановление заменит текущие записи. Перед ним автоматически создаётся резервная
                копия. Импортируйте только знакомые файлы.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    if (file.size > 10_000_000) throw new Error('Файл больше 10 МБ');
                    setImportData(JSON.parse(await file.text()));
                  } catch (error) {
                    notify(readableError(error), true);
                  }
                  e.target.value = '';
                }}
              />
              <button className="button secondary" onClick={() => fileRef.current?.click()}>
                <Upload size={16} />
                Выбрать резервную копию
              </button>
            </section>
            <section className="settings-section">
              <h3>Честно о защите</h3>
              <p>
                В этой preview база личных данных не зашифрована. Защиту устройства обеспечивает
                ваша Windows-учётная запись и шифрование диска, если оно включено. Не храните здесь
                пароли и критичные секреты.
              </p>
            </section>
          </>
        )}
        {section === 'about' && (
          <>
            <AppHeading
              eyebrow="МЕНЬШЕ ПЕРЕКЛЮЧЕНИЙ. БОЛЬШЕ ЖИЗНИ."
              title="LifeOS"
              description="Личное цифровое пространство · 0.1.0 preview"
            />
            <div className="about-brand">
              <div className="brand-mark large">
                L<span />
              </div>
              <h2>
                Важное заслуживает
                <br />
                своего пространства.
              </h2>
            </div>
            <section className="settings-section">
              <h3>Не просто красивые экраны</h3>
              <p>
                Локальные приложения, изолированный Chromium и собственный веб-индекс. Этот выпуск —
                предварительная версия, не новая самостоятельная ОС и не поисковик с охватом всего
                интернета.
              </p>
              <p>
                Виртуальный дисплей остаётся экспериментальным компонентом. Подписанный
                production-драйвер и аппаратная совместимость в этом выпуске не заявлены.
              </p>
              <a
                className="button secondary"
                href="https://github.com/ritmiro1/Game2"
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={16} />
                Исходный код и документация
              </a>
            </section>
            <section className="settings-section">
              <h3>Системные сведения</h3>
              <p>
                Режим: {cap.desktop ? 'Настольное приложение' : 'Веб-предпросмотр'} · Платформа:{' '}
                {cap.platform}
                <br />
                Личные данные: SQLite · Поиск: независимый индекс · Лицензия: MIT
              </p>
            </section>
          </>
        )}
        {importData && (
          <Modal title="Заменить текущие данные?" onClose={() => setImportData(null)}>
            <p className="muted-text">
              Будет создана автоматическая копия, затем записи заменятся содержимым выбранного
              файла.
            </p>
            <div className="form-footer">
              <button className="button ghost" onClick={() => setImportData(null)}>
                Отмена
              </button>
              <button
                className="button primary"
                onClick={async () => {
                  const result = await run('import', { snapshot: importData });
                  if (result !== null) {
                    await refresh();
                    setImportData(null);
                    notify('Данные восстановлены');
                  }
                }}
              >
                Восстановить
              </button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}
