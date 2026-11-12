import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  COLLECTIONS,
  validateEntity,
  detectDependencyCycle,
  nextOccurrence,
  isoDay,
} from './domain.mjs';
export class Store {
  constructor(path = ':memory:', { seed = false } = {}) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS entities(id TEXT PRIMARY KEY, type TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS entities_type ON entities(type);
      CREATE TABLE IF NOT EXISTS preferences(key TEXT PRIMARY KEY, value TEXT NOT NULL CHECK(json_valid(value)));
      CREATE VIRTUAL TABLE IF NOT EXISTS local_search USING fts5(id UNINDEXED,type UNINDEXED,title,body,tokenize='unicode61 remove_diacritics 2');
      PRAGMA user_version=1;`);
    if (seed && !this.getSetting('initialized')) this.seed();
  }
  list(type) {
    if (!COLLECTIONS.includes(type)) throw new Error('Неизвестный тип');
    return this.db
      .prepare('SELECT payload FROM entities WHERE type=? ORDER BY updated_at DESC')
      .all(type)
      .map((row) => JSON.parse(row.payload));
  }
  get(type, id) {
    const row = this.db.prepare('SELECT payload FROM entities WHERE type=? AND id=?').get(type, id);
    return row ? JSON.parse(row.payload) : null;
  }
  save(type, input) {
    return this.transaction(() => this._save(type, input));
  }
  _save(type, input) {
    const entity = validateEntity(type, input);
    const existingType = this.db.prepare('SELECT type FROM entities WHERE id=?').get(entity.id);
    if (existingType && existingType.type !== type)
      throw new Error('Идентификатор уже используется другим типом записи');
    const previous = this.get(type, entity.id);
    if (input._expectedUpdatedAt && previous && previous.updatedAt !== input._expectedUpdatedAt)
      throw new Error('Запись изменена в другом окне. Обновите данные.');
    delete entity._expectedUpdatedAt;
    if (type === 'tasks') {
      const tasks = this.list('tasks').filter((t) => t.id !== entity.id);
      if (detectDependencyCycle([...tasks, entity])) throw new Error('Обнаружен цикл зависимостей');
    }
    if (type === 'habitLogs') {
      const old = this.list(type).find(
        (x) => x.habitId === entity.habitId && x.day === entity.day && x.id !== entity.id,
      );
      if (old) entity.id = old.id;
    }
    const now = new Date(
      Math.max(Date.now(), previous?.updatedAt ? Date.parse(previous.updatedAt) + 1 : 0),
    ).toISOString();
    entity.createdAt = previous?.createdAt || now;
    entity.updatedAt = now;
    this.db
      .prepare(
        'INSERT INTO entities VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at',
      )
      .run(entity.id, type, JSON.stringify(entity), entity.createdAt, now);
    this.db.prepare('DELETE FROM local_search WHERE id=?').run(entity.id);
    this.db
      .prepare('INSERT INTO local_search(id,type,title,body) VALUES(?,?,?,?)')
      .run(
        entity.id,
        type,
        entity.title || '',
        [entity.content, entity.description, entity.tags?.join(' ')].filter(Boolean).join(' '),
      );
    return entity;
  }
  remove(type, id) {
    return this.transaction(() => {
      const before = this.get(type, id);
      if (!before) return false;
      this.db.prepare('DELETE FROM entities WHERE type=? AND id=?').run(type, id);
      this.db.prepare('DELETE FROM local_search WHERE id=?').run(id);
      return true;
    });
  }
  completeTask(id) {
    return this.transaction(() => {
      const task = this.get('tasks', id);
      if (!task) throw new Error('Задача не найдена');
      if (task.status === 'done') return task;
      const incomplete = (task.dependsOn || []).some(
        (dep) => this.get('tasks', dep)?.status !== 'done',
      );
      if (incomplete) throw new Error('Сначала завершите связанные задачи');
      const done = this._save('tasks', {
        ...task,
        status: 'done',
        completedAt: new Date().toISOString(),
      });
      if (task.recurrence && task.recurrence !== 'none') {
        const anchor = task.recurrenceAnchor || Number((task.due || isoDay()).slice(8));
        const due = nextOccurrence(task.due || isoDay(), task.recurrence, anchor);
        const origin = task.originId || task.id;
        if (!this.list('tasks').some((t) => t.originId === origin && t.due === due))
          this._save('tasks', {
            ...task,
            id: randomUUID(),
            originId: origin,
            recurrenceAnchor: anchor,
            status: 'todo',
            due,
            completedAt: null,
            createdAt: null,
          });
      }
      return done;
    });
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  setSetting(key, value) {
    if (typeof key !== 'string' || key.length > 100 || JSON.stringify(value).length > 1_000_000)
      throw new Error('Некорректная настройка');
    this.db
      .prepare('INSERT OR REPLACE INTO preferences VALUES(?,?)')
      .run(key, JSON.stringify(value));
    return value;
  }
  getSetting(key) {
    const r = this.db.prepare('SELECT value FROM preferences WHERE key=?').get(key);
    return r ? JSON.parse(r.value) : null;
  }
  state() {
    const entities = Object.fromEntries(COLLECTIONS.map((type) => [type, this.list(type)]));
    return {
      ...entities,
      settings: Object.fromEntries(
        this.db
          .prepare('SELECT * FROM preferences')
          .all()
          .map((r) => [r.key, JSON.parse(r.value)]),
      ),
    };
  }
  search(query) {
    const terms = (String(query).match(/[\p{L}\p{N}]+/gu) || []).slice(0, 12);
    if (!terms.length) return [];
    const match = terms.map((t) => '"' + t.replaceAll('"', '') + '"*').join(' AND ');
    return this.db
      .prepare(
        'SELECT id,type,title,substr(body,1,160) AS snippet FROM local_search WHERE local_search MATCH ? ORDER BY rank LIMIT 30',
      )
      .all(match);
  }
  export() {
    return { format: 'lifeos', version: 1, exportedAt: new Date().toISOString(), ...this.state() };
  }
  import(snapshot) {
    if (snapshot?.format !== 'lifeos' || snapshot.version !== 1)
      throw new Error('Неизвестный формат резервной копии');
    const all = [];
    for (const type of COLLECTIONS) {
      if (!Array.isArray(snapshot[type]) || snapshot[type].length > 50000)
        throw new Error('Повреждённый список: ' + type);
      for (const e of snapshot[type]) all.push([type, validateEntity(type, e)]);
    }
    if (detectDependencyCycle(all.filter(([t]) => t === 'tasks').map(([, e]) => e)))
      throw new Error('Циклические зависимости в копии');
    const ids = new Set();
    for (const [, e] of all) {
      if (ids.has(e.id)) throw new Error('Повторный идентификатор в копии');
      ids.add(e.id);
    }
    return this.transaction(() => {
      this.db.exec('DELETE FROM entities; DELETE FROM local_search; DELETE FROM preferences;');
      for (const [type, e] of all) this._save(type, e);
      for (const [key, val] of Object.entries(snapshot.settings || {})) this.setSetting(key, val);
      return all.length;
    });
  }
  seed() {
    this.save('notes', {
      id: 'welcome-note',
      title: 'Добро пожаловать в ваше пространство',
      content:
        '# Это ваша LifeOS\n\nЗдесь можно собирать мысли, планировать день и работать с интернетом.\n\n• Все личные записи хранятся локально в SQLite.\n• Поиск в браузере обращается к собственному веб-индексу.\n• Веб-предпросмотр не создаёт монитор — для этого нужен Windows-компонент.\n\nЭто стартовая заметка. Её можно изменить или удалить.',
      tags: ['Начало'],
    });
    for (const [i, title] of [
      'Осмотреть рабочий стол',
      'Создать свою первую заметку',
      'Попробовать Life Search',
    ].entries())
      this.save('tasks', {
        id: 'welcome-task-' + i,
        title,
        status: 'todo',
        priority: i === 0 ? 'high' : 'normal',
        due: isoDay(),
        onboarding: true,
      });
    this.setSetting('profile', { name: 'Друг', accent: 'sage', theme: 'dark' });
    this.setSetting('initialized', true);
  }
  close() {
    this.db.close();
  }
}
