import { useEffect, useState } from 'react';
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Trash2,
  Download,
  FolderOpen,
  Globe2,
  ExternalLink,
  File,
  BookMarked,
} from 'lucide-react';
import { useLife } from '../state';
import { AppHeading, Empty, IconButton, Modal, FilterInput } from '../components/ui';
import { today, formatDate } from '../api';
const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(n);
export function Finance() {
  const { data, save, remove } = useLife();
  const [month, setMonth] = useState(today().slice(0, 7)),
    [modal, setModal] = useState(false),
    [kind, setKind] = useState('expense'),
    [amount, setAmount] = useState(''),
    [title, setTitle] = useState(''),
    [category, setCategory] = useState('Другое'),
    [date, setDate] = useState(today());
  const records = data.finance
    .filter((f) => f.day?.startsWith(month))
    .sort((a, b) => b.day.localeCompare(a.day));
  const income = records.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0),
    expense = records.filter((r) => r.amount < 0).reduce((s, r) => s - r.amount, 0);
  const categories: [string, number][] = Object.entries(
    records
      .filter((r) => r.amount < 0)
      .reduce<Record<string, number>>(
        (a, r) => ({ ...a, [r.category || 'Другое']: (a[r.category || 'Другое'] || 0) - r.amount }),
        {},
      ),
  ).sort((a, b) => b[1] - a[1]);
  function exportCsv() {
    const safe = (s: string) =>
      '"' + (/^[=+@-]/.test(s) ? "'" : '') + s.replaceAll('"', '""') + '"';
    const rows = [
      ['Дата', 'Название', 'Категория', 'Сумма', 'Валюта'],
      ...records.map((r) => [r.day, r.title || '', r.category, String(r.amount), 'RUB']),
    ];
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + rows.map((row) => row.map(safe).join(';')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `LifeOS-finance-${month}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="app-page">
      <AppHeading
        eyebrow="ЯСНОСТЬ В ЦИФРАХ"
        title="Финансы"
        description="Ручной учёт. Без подключения к вашим банкам."
      >
        <input
          className="month-input"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <button className="button secondary" onClick={exportCsv}>
          <Download size={16} />
          CSV
        </button>
        <button className="button primary" onClick={() => setModal(true)}>
          <Plus size={16} />
          Операция
        </button>
      </AppHeading>
      <div className="finance-summary">
        <div className="metric-card">
          <span>
            <Wallet size={17} />
            Разница за месяц
          </span>
          <strong>{money(income - expense)}</strong>
          <small>Доходы минус расходы</small>
        </div>
        <div className="metric-card">
          <span>
            <ArrowDownLeft size={17} />
            Доходы
          </span>
          <strong className="accent-text">{money(income)}</strong>
          <small>По введённым операциям</small>
        </div>
        <div className="metric-card">
          <span>
            <ArrowUpRight size={17} />
            Расходы
          </span>
          <strong>{money(expense)}</strong>
          <small>{records.filter((r) => r.amount < 0).length} операций</small>
        </div>
      </div>
      <div className="finance-body">
        <section className="panel">
          <div className="panel-heading">
            <h3>История операций</h3>
            <span className="tag">{records.length}</span>
          </div>
          {records.map((r) => (
            <div className="transaction-row" key={r.id}>
              <span className={'transaction-icon ' + (r.amount > 0 ? 'income' : '')}>
                {r.amount > 0 ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
              </span>
              <div>
                <strong>{r.title || r.category}</strong>
                <small>
                  {formatDate(r.day)} · {r.category}
                </small>
              </div>
              <b className={r.amount > 0 ? 'accent-text' : ''}>
                {r.amount > 0 ? '+' : ''}
                {money(r.amount)}
              </b>
              <IconButton
                label="Удалить операцию"
                onClick={() => {
                  void remove('finance', r);
                }}
              >
                <Trash2 size={15} />
              </IconButton>
            </div>
          ))}
          {!records.length && (
            <Empty
              icon={<Wallet size={26} />}
              title="Чистый лист"
              description="Добавьте первую операцию. Здесь нет выдуманных доходов и расходов."
            />
          )}
        </section>
        <aside className="panel">
          <div className="panel-heading">
            <h3>На что уходят деньги</h3>
          </div>
          {categories.map(([name, value], i) => (
            <div className="category-row" key={name}>
              <div>
                <span>
                  <i
                    style={{
                      background: ['#b6edbd', '#a9bff4', '#e7bf8e', '#c4afe6', '#d6a49d'][i % 5],
                    }}
                  />
                  {name}
                </span>
                <strong>{money(value)}</strong>
              </div>
              <div className="progress-track">
                <span
                  style={{
                    width: expense ? (value / expense) * 100 + '%' : '0%',
                    background: ['#b6edbd', '#a9bff4', '#e7bf8e', '#c4afe6', '#d6a49d'][i % 5],
                  }}
                />
              </div>
            </div>
          ))}
          {!categories.length && (
            <p className="muted-text">Категории появятся после добавления расходов.</p>
          )}
          <div className="subtle-note">
            Одна валюта: RUB. Это личный учёт, не банковская выписка и не финансовая рекомендация.
          </div>
        </aside>
      </div>
      {modal && (
        <Modal title="Новая операция" onClose={() => setModal(false)}>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await save('finance', {
                  title: title || category,
                  amount: Math.abs(Number(amount)) * (kind === 'expense' ? -1 : 1),
                  category,
                  day: date,
                  currency: 'RUB',
                })
              ) {
                setModal(false);
                setAmount('');
                setTitle('');
              }
            }}
          >
            <div className="segmented">
              <button
                type="button"
                className={kind === 'expense' ? 'active' : ''}
                onClick={() => setKind('expense')}
              >
                Расход
              </button>
              <button
                type="button"
                className={kind === 'income' ? 'active' : ''}
                onClick={() => setKind('income')}
              >
                Доход
              </button>
            </div>
            <div className="form-row">
              <label>
                Сумма, ₽
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label>
                Дата
                <input
                  required
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
            </div>
            <label>
              Название
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например, продукты на неделю"
              />
            </label>
            <label>
              Категория
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {[
                  'Продукты',
                  'Дом',
                  'Транспорт',
                  'Здоровье',
                  'Обучение',
                  'Отдых',
                  'Работа',
                  'Доход',
                  'Другое',
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <button className="button primary" disabled={!amount || Number(amount) <= 0}>
              Сохранить операцию
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
export function Files() {
  const { data, cap, save, remove, run, setting, notify } = useLife();
  const [tab, setTab] = useState('bookmarks'),
    [query, setQuery] = useState(''),
    [modal, setModal] = useState(false),
    [title, setTitle] = useState(''),
    [url, setUrl] = useState(''),
    [project, setProject] = useState(''),
    [downloads, setDownloads] = useState<any[]>([]);
  useEffect(() => {
    if (!window.lifeos) return;
    void run<any[]>('browser:downloads').then((d) => {
      if (d) setDownloads(d);
    });
    return window.lifeos.on('downloads', setDownloads);
  }, [run]);
  const files: any[] = data.settings.materialFiles || [];
  const bookmarks = data.bookmarks.filter((b) =>
    (b.title + ' ' + b.url).toLowerCase().includes(query.toLowerCase()),
  );
  async function pick() {
    const file = await run<any>('file:pick');
    if (file) {
      await setting('materialFiles', [...files.filter((f) => f.path !== file.path), file]);
      notify('Файл добавлен в материалы');
    }
  }
  return (
    <div className="app-page">
      <AppHeading
        eyebrow="СОБРАТЬ И НЕ ПОТЕРЯТЬ"
        title="Материалы"
        description="Полезные ссылки, выбранные файлы и загрузки."
      >
        <button className="button primary" onClick={() => setModal(true)}>
          <Plus size={16} />
          Сохранить ссылку
        </button>
      </AppHeading>
      <div className="toolbar">
        <div className="segmented">
          {[
            ['bookmarks', 'Закладки'],
            ['files', 'Файлы'],
            ['downloads', 'Загрузки'],
          ].map(([id, label]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        <FilterInput value={query} onChange={setQuery} />
      </div>
      {tab === 'bookmarks' &&
        (bookmarks.length ? (
          <div className="bookmarks-grid">
            {bookmarks.map((b) => (
              <div className="bookmark-card" key={b.id}>
                <div className="bookmark-domain">
                  <span className="domain-icon">
                    <Globe2 size={19} />
                  </span>
                  <span>{new URL(b.url).hostname}</span>
                  <IconButton
                    label="Удалить закладку"
                    onClick={() => {
                      void remove('bookmarks', b);
                    }}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </div>
                <h3>{b.title}</h3>
                <p>{b.description || b.url}</p>
                {b.projectId && (
                  <span className="tag">
                    {data.projects.find((p) => p.id === b.projectId)?.title || 'Проект'}
                  </span>
                )}
                <button
                  className="text-button"
                  onClick={() => {
                    if (cap.desktop) void run('browser:openExternal', { url: b.url });
                    else window.open(b.url, '_blank', 'noopener,noreferrer');
                  }}
                >
                  Открыть страницу
                  <ArrowUpRight size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            icon={<BookMarked size={28} />}
            title="Хорошее стоит сохранить"
            description="Добавьте ссылку или сохраните страницу из браузера."
            action={
              <button className="button secondary" onClick={() => setModal(true)}>
                Добавить ссылку
              </button>
            }
          />
        ))}
      {tab === 'files' && (
        <>
          {!cap.desktop && (
            <div className="info-banner">
              <FolderOpen size={18} />
              Выбор локальных файлов доступен в Windows-приложении. Веб-предпросмотр не получает
              доступ к диску.
            </div>
          )}
          <button
            className="button secondary"
            disabled={!cap.desktop}
            onClick={() => {
              void pick();
            }}
          >
            <Plus size={16} />
            Выбрать файл
          </button>
          <div className="file-list">
            {files
              .filter((f) => f.name.toLowerCase().includes(query.toLowerCase()))
              .map((file) => (
                <div className="file-row" key={file.path}>
                  <File size={20} />
                  <div>
                    <strong>{file.name}</strong>
                    <small>{file.path}</small>
                  </div>
                  <IconButton
                    label="Открыть файл"
                    onClick={() => {
                      void run('file:open', { path: file.path });
                    }}
                  >
                    <ExternalLink size={16} />
                  </IconButton>
                  <IconButton
                    label="Убрать из материалов"
                    onClick={() => {
                      void setting(
                        'materialFiles',
                        files.filter((f) => f.path !== file.path),
                      );
                    }}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              ))}
          </div>
          {!files.length && (
            <Empty
              icon={<FolderOpen size={28} />}
              title="Только то, что вы выберете"
              description="LifeOS не сканирует весь компьютер без разрешения."
            />
          )}
        </>
      )}
      {tab === 'downloads' && (
        <>
          {!cap.desktop && (
            <div className="info-banner">
              <Download size={18} />
              Загрузки встроенного Chromium доступны в EXE. Загрузки обычного браузера здесь не
              отображаются.
            </div>
          )}
          {downloads.map((d) => (
            <div className="file-row" key={d.id}>
              <Download size={20} />
              <div>
                <strong>{d.name}</strong>
                <small>
                  {d.state} · {Math.round((d.received || 0) / 1024)} КБ /{' '}
                  {Math.round((d.total || 0) / 1024)} КБ
                </small>
              </div>
              {d.state === 'completed' && (
                <button
                  className="button secondary small"
                  onClick={() => {
                    void run('browser:openDownload', { id: d.id });
                  }}
                >
                  Открыть
                </button>
              )}
            </div>
          ))}
          {!downloads.length && (
            <Empty
              icon={<Download size={28} />}
              title="Загрузок пока нет"
              description="Здесь появятся реальные файлы, скачанные в Life Browser."
            />
          )}
        </>
      )}
      {modal && (
        <Modal title="Сохранить полезное" onClose={() => setModal(false)}>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await save('bookmarks', { title, url, projectId: project || null })) {
                setModal(false);
                setTitle('');
                setUrl('');
              }
            }}
          >
            <label>
              Адрес страницы
              <input
                required
                type="url"
                placeholder="https://…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>
            <label>
              Название
              <input required value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              Проект
              <select value={project} onChange={(e) => setProject(e.target.value)}>
                <option value="">Без проекта</option>
                {data.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <button className="button primary">Сохранить ссылку</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
