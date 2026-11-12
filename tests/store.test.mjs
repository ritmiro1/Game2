import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../core/store.mjs';
import { nextOccurrence, validDay } from '../core/domain.mjs';
test('SQLite persists real entities and local index across restarts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lifeos-test-'));
  let s = new Store(join(dir, 'test.sqlite'));
  s.save('notes', { id: 'n', title: 'План ремонта', content: 'Кухня и материалы' });
  assert.equal(s.search('ремон')[0].id, 'n');
  s.close();
  s = new Store(join(dir, 'test.sqlite'));
  assert.equal(s.list('notes').length, 1);
  s.remove('notes', 'n');
  assert.equal(s.search('ремон').length, 0);
  s.close();
  rmSync(dir, { recursive: true });
});
test('validation rejects invalid dates, cycles and cross-type IDs atomically', () => {
  const s = new Store();
  assert.throws(() => s.save('tasks', { title: 'bad', due: '2026-02-31' }));
  s.save('tasks', { id: 'a', title: 'A', dependsOn: ['b'] });
  assert.throws(() => s.save('tasks', { id: 'b', title: 'B', dependsOn: ['a'] }), /цикл/);
  assert.equal(s.list('tasks').length, 1);
  assert.throws(() => s.save('notes', { id: 'a', title: 'Collision' }), /другим типом/);
  s.close();
});
test('recurrence is idempotent and monthly anchor survives February', () => {
  const s = new Store();
  s.save('tasks', { id: 'a', title: 'Every 31st', due: '2026-01-31', recurrence: 'monthly' });
  s.completeTask('a');
  s.completeTask('a');
  assert.equal(s.list('tasks').length, 2);
  const feb = s.list('tasks').find((t) => t.id !== 'a');
  assert.equal(feb.due, '2026-02-28');
  s.completeTask(feb.id);
  assert.ok(s.list('tasks').some((t) => t.due === '2026-03-31'));
  s.close();
});
test('dependencies must finish first', () => {
  const s = new Store();
  s.save('tasks', { id: 'a', title: 'A' });
  s.save('tasks', { id: 'b', title: 'B', dependsOn: ['a'] });
  assert.throws(() => s.completeTask('b'), /Сначала/);
  s.completeTask('a');
  s.completeTask('b');
  assert.equal(s.get('tasks', 'b').status, 'done');
  s.close();
});
test('snapshot import validates before replacing and round-trips', () => {
  const s = new Store(':memory:', { seed: true });
  const snapshot = s.export();
  assert.throws(() => s.import({ ...snapshot, notes: [{ id: 'bad', title: '' }] }));
  assert.equal(s.list('tasks').length, 3);
  const other = new Store();
  other.import(snapshot);
  assert.equal(other.list('notes')[0].title, s.list('notes')[0].title);
  assert.throws(
    () => other.import({ ...snapshot, notes: [...snapshot.notes, { ...snapshot.notes[0] }] }),
    /Повторный/,
  );
  s.close();
  other.close();
});
test('optimistic edit conflict and monotonic revisions', () => {
  const s = new Store();
  const a = s.save('notes', { title: 'One' });
  const b = s.save('notes', { ...a, title: 'Two' });
  assert.notEqual(a.updatedAt, b.updatedAt);
  assert.throws(
    () => s.save('notes', { ...a, title: 'Stale', _expectedUpdatedAt: a.updatedAt }),
    /другом окне/,
  );
  assert.equal(s.get('notes', a.id).title, 'Two');
  s.close();
});
test('weekday and leap year calendar calculations', () => {
  assert.equal(nextOccurrence('2026-11-13', 'weekdays'), '2026-11-16');
  assert.equal(nextOccurrence('2024-01-31', 'monthly'), '2024-02-29');
  assert.equal(validDay('2026-02-29'), false);
  assert.equal(validDay('2024-02-29'), true);
});
test('habit daily marks do not duplicate', () => {
  const s = new Store();
  s.save('habitLogs', { habitId: 'h', day: '2026-11-12', value: 1 });
  s.save('habitLogs', { habitId: 'h', day: '2026-11-12', value: 2 });
  assert.equal(s.list('habitLogs').length, 1);
  assert.equal(s.list('habitLogs')[0].value, 2);
  s.close();
});
test('malformed imported app fields are rejected without corrupting the database', () => {
  const s = new Store(':memory:');
  for (const [type, entity] of [
    ['notes', { title: 'Bad', content: { html: true } }],
    ['tasks', { title: 'Bad', dependsOn: 'not-an-array' }],
    ['events', { title: 'Bad', start: '2026-11-12T12:00:00Z', end: 'invalid' }],
    ['finance', { amount: 10, day: '2026-02-30' }],
    ['sessions', { duration: NaN, day: '2026-11-12' }],
    ['bookmarks', { title: 'Bad', url: 'https://user:password@example.com' }],
  ])
    assert.throws(() => s.save(type, entity));
  assert.throws(() => s.setSetting('bad', undefined));
  assert.equal(s.list('notes').length, 0);
  s.close();
});
test('pending optimistic edits cannot resurrect a deleted record', () => {
  const s = new Store(':memory:');
  const note = s.save('notes', { title: 'Original', content: 'text' });
  s.remove('notes', note.id);
  assert.throws(
    () => s.save('notes', { ...note, content: 'late change', _expectedUpdatedAt: note.updatedAt }),
    /изменена/,
  );
  assert.equal(s.list('notes').length, 0);
  s.close();
});
