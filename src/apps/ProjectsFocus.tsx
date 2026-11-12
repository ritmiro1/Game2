import { useState } from 'react';
import {
  Plus,
  FolderKanban,
  ArrowLeft,
  ArrowUpRight,
  Trash2,
  CheckCheck,
  NotebookPen,
  Globe2,
  Play,
  Pause,
  RotateCcw,
  Timer,
  ChevronRight,
} from 'lucide-react';
import { useLife } from '../state';
import { AppHeading, Empty, IconButton, Modal, QuickInput } from '../components/ui';
import { TaskCheck, TaskEditor } from './TasksNotes';
import { formatDate, today } from '../api';
import type { AppId, Entity } from '../types';
export function Projects({ open }: { open: (id: AppId) => void }) {
  const { data, save, remove } = useLife();
  const [selected, setSelected] = useState<string | null>(null),
    [modal, setModal] = useState(false),
    [title, setTitle] = useState(''),
    [description, setDescription] = useState(''),
    [color, setColor] = useState('sage'),
    [taskEditor, setTaskEditor] = useState<Entity | null | undefined>(undefined);
  const project = data.projects.find((p) => p.id === selected);
  const tasks = data.tasks.filter((t) => t.projectId === selected);
  return (
    <div className="app-page">
      {project ? (
        <>
          <button className="back-button" onClick={() => setSelected(null)}>
            <ArrowLeft size={15} />
            Все проекты
          </button>
          <AppHeading
            eyebrow="РАБОЧЕЕ ПРОСТРАНСТВО ПРОЕКТА"
            title={project.title}
            description={project.description}
          >
            <IconButton
              label="Удалить проект"
              onClick={async () => {
                await remove('projects', project);
                setSelected(null);
              }}
            >
              <Trash2 size={17} />
            </IconButton>
            <button className="button primary" onClick={() => setTaskEditor(null)}>
              <Plus size={16} />
              Задача
            </button>
          </AppHeading>
          <div className="project-detail-grid">
            <section className="panel">
              <div className="panel-heading">
                <h3>
                  <CheckCheck size={16} />
                  Задачи проекта
                </h3>
                <span className="tag">
                  {tasks.filter((t) => t.status === 'done').length}/{tasks.length}
                </span>
              </div>
              <QuickInput
                placeholder="Следующий шаг проекта…"
                onSubmit={(title) =>
                  save('tasks', { title, status: 'todo', projectId: project.id })
                }
              />
              {tasks.map((task) => (
                <div className={'task-row ' + (task.status === 'done' ? 'done' : '')} key={task.id}>
                  <TaskCheck task={task} />
                  <button className="task-main" onClick={() => setTaskEditor(task)}>
                    {task.title}
                  </button>
                </div>
              ))}
              {!tasks.length && (
                <Empty title="Какой первый шаг?" description="Достаточно одной небольшой задачи." />
              )}
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h3>
                  <Globe2 size={16} />
                  Материалы
                </h3>
              </div>
              {data.bookmarks
                .filter((b) => b.projectId === project.id)
                .map((b) => (
                  <a
                    className="material-link"
                    href={b.url}
                    target="_blank"
                    rel="noreferrer"
                    key={b.id}
                  >
                    <Globe2 size={16} />
                    <span>
                      {b.title}
                      <small>{new URL(b.url).hostname}</small>
                    </span>
                    <ArrowUpRight size={16} />
                  </a>
                ))}
              <p className="muted-text">
                Сохраняйте страницы из Life Browser с привязкой к этому проекту.
              </p>
              <button className="button secondary" onClick={() => open('browser')}>
                <Globe2 size={16} />
                Открыть браузер
              </button>
              <hr />
              <h3>
                <NotebookPen size={16} />
                Связанные заметки
              </h3>
              {data.notes
                .filter((n) => n.projectId === project.id)
                .map((n) => (
                  <button key={n.id} className="material-link" onClick={() => open('notes')}>
                    {n.title}
                    <ChevronRight size={14} />
                  </button>
                ))}
              <button
                className="add-inline"
                onClick={async () => {
                  const n = await save('notes', {
                    title: 'Заметки: ' + project.title,
                    content: '',
                    projectId: project.id,
                  });
                  if (n) open('notes');
                }}
              >
                <Plus size={15} />
                Добавить заметку проекта
              </button>
            </section>
          </div>
        </>
      ) : (
        <>
          <AppHeading
            eyebrow="СВЯЗАТЬ ВСЁ В ОДНО ЦЕЛОЕ"
            title="Проекты"
            description="Задачи, материалы и мысли вокруг одной цели."
          >
            <button className="button primary" onClick={() => setModal(true)}>
              <Plus size={16} />
              Новый проект
            </button>
          </AppHeading>
          <div className="project-grid">
            {data.projects.map((p) => {
              const pt = data.tasks.filter((t) => t.projectId === p.id),
                done = pt.filter((t) => t.status === 'done').length,
                progress = pt.length ? Math.round((done / pt.length) * 100) : 0;
              return (
                <button className="project-card" key={p.id} onClick={() => setSelected(p.id)}>
                  <div className="project-card-top">
                    <span className={'app-icon ' + (p.color || 'sage')}>
                      <FolderKanban size={23} />
                    </span>
                    <ArrowUpRight size={18} />
                  </div>
                  <h2>{p.title}</h2>
                  <p>{p.description || 'Большое начинается с одного шага.'}</p>
                  <div className="project-progress">
                    <span>
                      Завершено {done} из {pt.length}
                    </span>
                    <strong>{progress}%</strong>
                  </div>
                  <div className="progress-track">
                    <span style={{ width: progress + '%' }} />
                  </div>
                  <small>Создан {formatDate(p.createdAt)}</small>
                </button>
              );
            })}
            <button className="project-card add-project" onClick={() => setModal(true)}>
              <span>
                <Plus size={25} />
              </span>
              <h3>Новое направление</h3>
              <p>Дайте идее своё пространство</p>
            </button>
          </div>
          {!data.projects.length && (
            <div className="subtle-note">
              Здесь появятся ваши реальные проекты. Начните с работы, обучения или личной идеи.
            </div>
          )}
        </>
      )}
      {modal && (
        <Modal title="Дать идее пространство" onClose={() => setModal(false)}>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await save('projects', { title, description, color, status: 'active' })) {
                setModal(false);
                setTitle('');
                setDescription('');
              }
            }}
          >
            <label>
              Название проекта
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например, новая глава"
              />
            </label>
            <label>
              Что хочется получить?
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label>
              Цвет
              <select value={color} onChange={(e) => setColor(e.target.value)}>
                <option value="sage">Шалфей</option>
                <option value="blue">Небо</option>
                <option value="lavender">Лаванда</option>
                <option value="coral">Коралл</option>
                <option value="amber">Песок</option>
              </select>
            </label>
            <button className="button primary" disabled={!title.trim()}>
              Создать проект
            </button>
          </form>
        </Modal>
      )}
      {taskEditor !== undefined && (
        <TaskEditor
          task={taskEditor || undefined}
          projectId={project?.id}
          onClose={() => setTaskEditor(undefined)}
        />
      )}
    </div>
  );
}
export function Focus() {
  const { data, setting, save } = useLife();
  const active = data.settings.activeFocus;
  const [duration, setDuration] = useState(25),
    [taskId, setTaskId] = useState(''),
    [tick, setTick] = useState(Date.now());
  // The root shell records completion even when this window is closed.
  const remain = active
    ? active.status === 'running'
      ? Math.max(0, Math.ceil((active.endsAt - tick) / 1000))
      : active.remaining
    : duration * 60;
  const minutes = String(Math.floor(remain / 60)).padStart(2, '0'),
    seconds = String(remain % 60).padStart(2, '0');
  const totalToday = data.sessions
    .filter((s) => s.day === today())
    .reduce((sum, s) => sum + (s.duration || 0), 0);
  return (
    <FocusTicker onTick={setTick}>
      <div className="app-page focus-page">
        <AppHeading
          eyebrow="ОДНО ДЕЛО. ВСЁ ВНИМАНИЕ."
          title="Фокус"
          description="Освободите немного пространства для глубокой работы."
        />
        <div className="focus-center">
          <div className="focus-label">
            <span className="status-dot" />
            {active?.status === 'running'
              ? 'Время для важного'
              : active
                ? 'Пауза — это нормально'
                : 'Ваш тихий режим'}
          </div>
          <div className={'focus-clock ' + (active?.status === 'running' ? 'running' : '')}>
            <div className="focus-orbit" />
            <span>
              {minutes}
              <em>:</em>
              {seconds}
            </span>
          </div>
          <p>Не нужно успевать всё. Начните с одного.</p>
          <div className="duration-options">
            {[15, 25, 45, 60].map((n) => (
              <button
                key={n}
                disabled={!!active}
                className={duration === n ? 'active' : ''}
                onClick={() => setDuration(n)}
              >
                {n} мин
              </button>
            ))}
          </div>
          <select
            className="focus-task"
            value={active?.taskId || taskId}
            disabled={!!active}
            onChange={(e) => setTaskId(e.target.value)}
          >
            <option value="">Свободная фокус-сессия</option>
            {data.tasks
              .filter((t) => t.status !== 'done')
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
          </select>
          <div className="focus-actions">
            <button
              className="button primary large"
              onClick={() => {
                if (!active)
                  void setting('activeFocus', {
                    id: crypto.randomUUID(),
                    duration: duration * 60,
                    remaining: duration * 60,
                    endsAt: Date.now() + duration * 60000,
                    status: 'running',
                    taskId,
                  });
                else if (active.status === 'running')
                  void setting('activeFocus', { ...active, status: 'paused', remaining: remain });
                else
                  void setting('activeFocus', {
                    ...active,
                    status: 'running',
                    endsAt: Date.now() + active.remaining * 1000,
                  });
              }}
            >
              {active?.status === 'running' ? <Pause size={18} /> : <Play size={18} />}{' '}
              {active?.status === 'running' ? 'Пауза' : active ? 'Продолжить' : 'Начать фокус'}
            </button>
            {active && (
              <IconButton
                label="Завершить и сохранить прошедшее время"
                onClick={async () => {
                  const elapsed = active.duration - remain;
                  if (elapsed > 0)
                    await save('sessions', {
                      id: active.id,
                      title: 'Фокус-сессия',
                      duration: elapsed,
                      taskId: active.taskId,
                      day: today(),
                      completed: false,
                    });
                  await setting('activeFocus', null);
                }}
              >
                <RotateCcw size={19} />
              </IconButton>
            )}
          </div>
          <div className="focus-stats">
            <div>
              <strong>{Math.round(totalToday / 60)}</strong>
              <span>минут сегодня</span>
            </div>
            <div>
              <strong>{data.sessions.filter((s) => s.day === today()).length}</strong>
              <span>сессий сегодня</span>
            </div>
            <div>
              <strong>{data.sessions.length}</strong>
              <span>за всё время</span>
            </div>
          </div>
          <div className="subtle-note">
            <Timer size={13} />
            Таймер работает, пока запущена LifeOS. Другие программы Windows не блокируются.
          </div>
        </div>
      </div>
    </FocusTicker>
  );
}
import { useEffect } from 'react';
import type { ReactNode } from 'react';
function FocusTicker({ children, onTick }: { children: ReactNode; onTick: (n: number) => void }) {
  useEffect(() => {
    const id = setInterval(() => onTick(Date.now()), 500);
    return () => clearInterval(id);
  }, [onTick]);
  return children;
}
