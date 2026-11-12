import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import chromium from '@sparticuz/chromium';
import { chromium as playwright } from 'playwright-core';
const base = process.env.LIFEOS_TEST_URL || 'http://127.0.0.1:3000';
const libs = resolve('node_modules/.cache/chromium-libs');
if (process.platform === 'linux' && !existsSync(join(libs, 'lib/libnspr4.so'))) {
  await mkdir(libs, { recursive: true });
  const tar = join(libs, 'libs.tar');
  await writeFile(
    tar,
    brotliDecompressSync(await readFile('node_modules/@sparticuz/chromium/bin/al2023.tar.br')),
  );
  execFileSync('tar', ['-xf', tar, '-C', libs]);
}
process.env.LD_LIBRARY_PATH =
  join(libs, 'lib') + (process.env.LD_LIBRARY_PATH ? ':' + process.env.LD_LIBRARY_PATH : '');
async function rpc(action, args = {}) {
  const res = await fetch(base + '/api/rpc', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, args }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}
const original = await rpc('state');
const prefix = 'UI-test-' + Date.now();
const browser = await playwright.launch({
  executablePath: process.env.CHROME_PATH || (await chromium.executablePath()),
  args: chromium.args.filter(
    (a) => !a.includes('disable-web-security') && !a.includes('allow-running-insecure-content'),
  ),
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } }),
  page = await context.newPage(),
  errors = [];
page.setDefaultTimeout(12000);
page.on('pageerror', (e) => errors.push(e.message));
let focusId = null;
try {
  await page.goto(base);
  await page.getByRole('heading', { name: /Добрый|Доброе|Тихой/ }).waitFor();
  async function openApp(name) {
    await page.keyboard.press('Control+k');
    const m = page.getByRole('dialog', { name: 'Ваше пространство' });
    await m.getByRole('textbox', { name: 'Локальный поиск и приложения' }).fill(name);
    await m.locator('.launcher-grid button').first().click();
  }
  await openApp('Проекты');
  await page.getByRole('button', { name: 'Новый проект', exact: true }).click();
  await page.getByLabel('Название проекта', { exact: true }).fill(prefix + ' проект');
  await page
    .getByLabel('Что хочется получить?', { exact: true })
    .fill('Сквозная проверка связанной задачи');
  await page.getByRole('button', { name: 'Создать проект', exact: true }).click();
  await page
    .locator('.project-card')
    .filter({ hasText: prefix + ' проект' })
    .click();
  const quick = page.getByPlaceholder('Следующий шаг проекта…');
  await quick.fill(prefix + ' шаг');
  await quick.press('Enter');
  const tr = page.locator('.task-row').filter({ hasText: prefix + ' шаг' });
  await tr.getByRole('button', { name: 'Завершить задачу' }).click();
  await page.getByText('1/1', { exact: true }).waitFor();
  const state = await rpc('state'),
    project = state.projects.find((p) => p.title === prefix + ' проект');
  assert.ok(
    state.tasks.some(
      (t) => t.title === prefix + ' шаг' && t.projectId === project.id && t.status === 'done',
    ),
  );
  console.log('PASS: project creation, linked task and actual completion counts');
  await openApp('Привычки');
  await page.getByRole('button', { name: 'Новая привычка', exact: true }).click();
  await page.getByPlaceholder('Например, читать 15 минут').fill(prefix + ' привычка');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Добавить привычку', exact: true })
    .click();
  const habitRow = page.locator('.habit-row').filter({ hasText: prefix + ' привычка' });
  await habitRow.locator('.habit-days button').last().click();
  await habitRow.getByText('1 отметок за всё время', { exact: true }).waitFor();
  const hs = await rpc('state'),
    habit = hs.habits.find((h) => h.title === prefix + ' привычка');
  assert.equal(hs.habitLogs.filter((l) => l.habitId === habit.id).length, 1);
  console.log('PASS: habit creation and real persisted daily mark');
  await openApp('Календарь');
  await page.getByRole('button', { name: 'Событие', exact: true }).click();
  const em = page.getByRole('dialog', { name: 'Новое событие' });
  await em.getByLabel('Название', { exact: true }).fill(prefix + ' событие');
  await em.getByRole('button', { name: 'Сохранить событие', exact: true }).click();
  await em.waitFor({ state: 'hidden' });
  assert.ok((await rpc('state')).events.some((e) => e.title === prefix + ' событие'));
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'ICS', exact: true }).click();
  const download = await dl;
  await download.saveAs('test-results/calendar.ics');
  assert.ok(
    (await readFile('test-results/calendar.ics', 'utf8')).includes(
      'SUMMARY:' + prefix + ' событие',
    ),
  );
  console.log('PASS: calendar save and actual ICS file export');
  await openApp('Финансы');
  await page.getByRole('button', { name: 'Операция', exact: true }).click();
  const fm = page.getByRole('dialog', { name: 'Новая операция' });
  await fm.getByLabel('Сумма, ₽', { exact: true }).fill('1234.56');
  await fm.getByLabel('Название', { exact: true }).fill(prefix + ' расход');
  await fm.getByRole('button', { name: 'Сохранить операцию', exact: true }).click();
  await fm.waitFor({ state: 'hidden' });
  assert.equal(
    (await rpc('state')).finance.find((f) => f.title === prefix + ' расход').amount,
    -1234.56,
  );
  const cd = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  await (await cd).saveAs('test-results/finance.csv');
  assert.ok((await readFile('test-results/finance.csv', 'utf8')).includes('1234.56'));
  console.log('PASS: finance decimal persistence and CSV download');
  if (!original.settings.activeFocus) {
    await openApp('Фокус');
    await page.getByRole('button', { name: 'Начать фокус', exact: true }).click();
    await page.getByRole('button', { name: 'Пауза', exact: true }).waitFor();
    focusId = (await rpc('state')).settings.activeFocus.id;
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'Пауза', exact: true }).click();
    await page.getByRole('button', { name: 'Продолжить', exact: true }).waitFor();
    assert.equal((await rpc('state')).settings.activeFocus.status, 'paused');
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await page
      .getByRole('button', { name: 'Завершить и сохранить прошедшее время', exact: true })
      .click();
    await page.getByRole('button', { name: 'Начать фокус', exact: true }).waitFor();
    assert.equal((await rpc('state')).settings.activeFocus, null);
    console.log('PASS: focus start/pause/resume/finish persists state');
  }
  assert.deepEqual(errors, []);
  console.log('PASS: all additional workflows without renderer exceptions');
} catch (error) {
  await page.screenshot({ path: 'test-results/extended-failure.png' });
  throw error;
} finally {
  const state = await rpc('state');
  const habitIds = state.habits.filter((h) => h.title.startsWith(prefix)).map((h) => h.id);
  for (const type of [
    'tasks',
    'notes',
    'events',
    'habitLogs',
    'habits',
    'projects',
    'finance',
    'sessions',
  ])
    for (const e of state[type])
      if (
        e.title?.includes(prefix) ||
        (type === 'habitLogs' && habitIds.includes(e.habitId)) ||
        (type === 'sessions' && e.id === focusId)
      )
        await rpc('remove', { type, id: e.id });
  await rpc('settings', { key: 'activeFocus', value: original.settings.activeFocus || null });
  await rpc('settings', { key: 'desktopLayout', value: original.settings.desktopLayout || [] });
  await browser.close();
}
