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
try {
  await page.goto(base);
  await page.getByRole('heading', { name: /Добрый|Доброе|Тихой/ }).waitFor();
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/desktop.png' });
  await page.locator('.desktop-app-card').filter({ hasText: 'От идеи до результата' }).click();
  await page.getByRole('heading', { name: 'Задачи', exact: true, level: 1 }).waitFor();
  const input = page.getByPlaceholder('Быстро добавить задачу…');
  await input.fill(prefix + ' задача');
  await input.press('Enter');
  const row = page.locator('.task-row').filter({ hasText: prefix + ' задача' });
  await row.waitFor();
  await row.getByRole('button', { name: 'Завершить задачу', exact: true }).click();
  await page.getByRole('button', { name: 'Готово', exact: true }).click();
  await row.waitFor();
  assert.ok(
    (await rpc('state')).tasks.some((t) => t.title === prefix + ' задача' && t.status === 'done'),
  );
  console.log('PASS: UI creates and completes persisted tasks');
  await page.getByRole('button', { name: 'Заметки', exact: true }).click();
  await page.getByRole('button', { name: 'Новая заметка', exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('.note-title')?.value === 'Новая заметка',
  );
  await page
    .getByRole('textbox', { name: 'Название заметки', exact: true })
    .fill(prefix + ' заметка');
  await page
    .getByRole('textbox', { name: 'Текст заметки', exact: true })
    .fill('# Реальная запись\n\nСохранение после ввода. <script>throw 1</script>');
  await page.waitForFunction(
    async (title) => {
      const r = await fetch('/api/rpc', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'state' }),
      });
      const j = await r.json();
      return j.data.notes.some((n) => n.title === title && n.content.includes('Реальная запись'));
    },
    prefix + ' заметка',
    { timeout: 15000, polling: 300 },
  );
  await page.getByRole('button', { name: 'Предпросмотр', exact: true }).click();
  await page.locator('.markdown').getByRole('heading', { name: 'Реальная запись' }).waitFor();
  console.log('PASS: autosaved notes and safe Markdown');
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Текст заметки', exact: true })
    .fill('Последние изменения перед переключением');
  await page.locator('.note-item').filter({ hasText: 'Добро пожаловать' }).click();
  await page.waitForFunction(async (title) => {
    const res = await fetch('/api/rpc', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'state' }),
    });
    return (await res.json()).data.notes.some(
      (n) => n.title === title && n.content === 'Последние изменения перед переключением',
    );
  }, prefix + ' заметка');
  console.log('PASS: immediate note switch flushes pending edits');
  await page.getByRole('button', { name: 'Задачи', exact: true }).click();
  await page.getByRole('button', { name: 'Новая задача', exact: true }).click();
  await page
    .getByPlaceholder('Название задачи', { exact: true })
    .pressSequentially(prefix + ' modal', { delay: 10 });
  assert.equal(
    await page.getByPlaceholder('Название задачи', { exact: true }).inputValue(),
    prefix + ' modal',
  );
  await page.keyboard.press('Escape');
  console.log('PASS: modal retains focus while typing');

  await page.getByRole('button', { name: 'Life Browser', exact: true }).click();
  await page.getByRole('heading', { name: /LifeSearch/ }).waitFor();
  await page.getByRole('textbox', { name: 'Поиск в интернете', exact: true }).fill('Node');
  await page.getByRole('button', { name: 'Найти в интернете', exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('.search-result-meta,.empty-state,.error-banner') !== null,
  );
  assert.ok(!(await page.locator('iframe').count()));
  await page.screenshot({ path: 'test-results/browser.png' });
  console.log('PASS: own web search UI (no iframe / external search redirect)');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByRole('button', { name: 'Экран и Windows', exact: true }).click();
  await page
    .getByText('Виртуальный драйвер не устанавливается автоматически.', { exact: true })
    .waitFor();
  console.log('PASS: display limitations explicitly shown');
  await page.keyboard.press('Control+k');
  await page.getByRole('dialog', { name: 'Ваше пространство' }).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  console.log('PASS: command launcher and keyboard dismissal');
  assert.deepEqual(errors, []);
  console.log('PASS: no uncaught renderer errors');
  await rpc('settings', { key: 'desktopLayout', value: [] });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole('heading', { name: /Добрый|Доброе|Тихой/ }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: 'test-results/mobile.png' });
  console.log('PASS: mobile desktop has no horizontal document overflow');
} catch (error) {
  console.log('DIAGNOSTIC markdown:', await page.locator('.markdown').allTextContents());
  console.log(
    'DIAGNOSTIC editors:',
    await page.locator('.note-body').evaluateAll((nodes) => nodes.map((n) => n.value)),
  );
  await page.screenshot({ path: 'test-results/failure.png' });
  throw error;
} finally {
  const current = await rpc('state');
  for (const type of ['tasks', 'notes'])
    for (const e of current[type])
      if (e.title.startsWith(prefix)) {
        const previous = original[type].find((p) => p.id === e.id);
        if (previous) await rpc('save', { type, entity: previous });
        else await rpc('remove', { type, id: e.id });
      }
  await rpc('settings', { key: 'desktopLayout', value: original.settings.desktopLayout || [] });
  await browser.close();
}
