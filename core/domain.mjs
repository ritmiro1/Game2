import { randomUUID } from 'node:crypto';
export const COLLECTIONS = ['tasks','notes','events','habits','habitLogs','projects','bookmarks','finance','sessions','journal','launchers'];
export function isoDay(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function validDay(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10) === value; }
export function nextOccurrence(day, recurrence, anchorDay = null) {
  if (!validDay(day)) throw new Error('Некорректная дата повторения');
  const d = new Date(day+'T12:00:00Z');
  if (recurrence === 'monthly') { const original = anchorDay || d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+1); const last = new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate(); d.setUTCDate(Math.min(original,last)); }
  else { d.setUTCDate(d.getUTCDate()+(recurrence === 'weekly' ? 7 : 1)); if (recurrence === 'weekdays') while ([0,6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate()+1); }
  return d.toISOString().slice(0,10);
}
export function validateEntity(type, input) {
  if (!COLLECTIONS.includes(type)) throw new Error('Неизвестный тип данных');
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Некорректная запись');
  if (JSON.stringify(input).length > 500_000) throw new Error('Запись слишком большая');
  const entity = {...input, id: input.id || randomUUID()};
  if (typeof entity.id !== 'string' || !/^[\w-]{1,100}$/.test(entity.id)) throw new Error('Некорректный идентификатор');
  if (['tasks','notes','events','habits','projects','bookmarks','journal','launchers'].includes(type)) {
    if (typeof entity.title !== 'string' || !entity.title.trim()) throw new Error('Введите название');
    entity.title = entity.title.trim().slice(0,400);
  }
  if (type === 'tasks') {
    if (!['todo','doing','done'].includes(entity.status || 'todo')) throw new Error('Неизвестный статус');
    entity.status ||= 'todo';
    if (entity.due && !validDay(entity.due)) throw new Error('Некорректный срок');
    if (entity.recurrence && !['none','daily','weekdays','weekly','monthly'].includes(entity.recurrence)) throw new Error('Неизвестное повторение');
    if (Array.isArray(entity.dependsOn) && entity.dependsOn.includes(entity.id)) throw new Error('Задача не может зависеть от себя');
  }
  if (type === 'events') {
    if (!entity.start || Number.isNaN(Date.parse(entity.start))) throw new Error('Некорректное начало события');
    if (entity.end && Date.parse(entity.end) <= Date.parse(entity.start)) throw new Error('Окончание должно быть позже начала');
  }
  if (type === 'finance' && (!Number.isFinite(entity.amount) || entity.amount === 0)) throw new Error('Введите ненулевую сумму');
  if (type === 'habitLogs' && (!entity.habitId || !validDay(entity.day))) throw new Error('Некорректная отметка привычки');
  if (type === 'bookmarks') { const url = new URL(entity.url); if (!['https:','http:'].includes(url.protocol)) throw new Error('Нужна HTTP(S)-ссылка'); }
  return entity;
}
export function detectDependencyCycle(tasks) {
  const edges = new Map(tasks.map(t=>[t.id, t.dependsOn || []])); const seen = new Set(), active = new Set();
  function visit(id) { if (active.has(id)) return true; if (seen.has(id)) return false; active.add(id); for (const edge of edges.get(id)||[]) if (visit(edge)) return true; active.delete(id); seen.add(id); return false; }
  return tasks.some(t=>visit(t.id));
}
