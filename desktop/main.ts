import { Webview, SizeHint, unload } from 'webview-bun';
import { buildServerUrl } from './server-config';

const serverUrl = process.env.PALIMPSEST_SERVER_URL || buildServerUrl;
const worker = new Worker(Bun.resolveSync('./worker.ts', import.meta.dir));
let closing = false;

worker.addEventListener('message', (event) => {
  if (closing || !event.data?.port) return;
  const webview = new Webview(false, { width: 1440, height: 920, hint: SizeHint.NONE });
  webview.title = 'ПАЛИМПСЕСТ — Протокол Эха';
  webview.init(`window.palimpsestDesktop=${JSON.stringify({ isDesktop: true, platform: 'win32', serverUrl })};`);
  webview.navigate(`http://127.0.0.1:${event.data.port}/index.html`);
  webview.run();
  closing = true;
  worker.terminate();
  unload();
  process.exit(0);
});

worker.addEventListener('error', (error) => {
  console.error('Не удалось запустить локальный Архив:', error);
  process.exit(1);
});
