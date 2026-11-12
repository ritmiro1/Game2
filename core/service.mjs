import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { Store } from './store.mjs';
import { SearchEngine } from './search.mjs';
import { resolvePublicUrl } from './network.mjs';
export function createService(dataDir, { autoCrawl = true, seed = true } = {}) {
  mkdirSync(dataDir, { recursive: true });
  const store = new Store(join(dataDir, 'lifeos.sqlite'), { seed });
  const search = new SearchEngine(join(dataDir, 'web-index.sqlite'), { seed });
  function backup() {
    const dir = join(dataDir, 'backups');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `LifeOS-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    writeFileSync(file + '.tmp', JSON.stringify(store.export(), null, 2), { mode: 0o600 });
    renameSync(file + '.tmp', file);
    store.setSetting('lastBackup', new Date().toISOString());
    return { file, at: new Date().toISOString() };
  }
  async function remote(path, payload) {
    const base = store.getSetting('searchServer');
    if (!base) return null;
    const u = new URL(base);
    if (u.protocol !== 'https:' || u.username || u.password)
      throw new Error('Удалённый поисковый сервер должен использовать HTTPS');
    const target = new URL(path, u.origin);
    const response = await fetch(target, {
      method: payload ? 'POST' : 'GET',
      headers: payload ? { 'content-type': 'application/json' } : {},
      body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Поисковый сервер недоступен: HTTP ' + response.status);
    const result = await response.json();
    return result.data ?? result;
  }
  const actions = {
    state: () => store.state(),
    save: ({ type, entity }) => store.save(type, entity),
    remove: ({ type, id }) => store.remove(type, id),
    complete: ({ id }) => store.completeTask(id),
    settings: ({ key, value }) => {
      if (key === 'searchServer' && value) {
        const u = new URL(value);
        if (u.protocol !== 'https:' || u.username || u.password)
          throw new Error('Нужен HTTPS-адрес сервера');
      }
      return store.setSetting(key, value);
    },
    localSearch: ({ query }) => store.search(query),
    webSearch: async ({ query, period, site }) =>
      (await remote('/api/search', { query, period, site })) ||
      search.query(query, { period, site }),
    searchStatus: async () => (await remote('/api/search/status')) || search.status(),
    crawl: () => {
      if (store.getSetting('searchServer'))
        throw new Error('Обновление удалённого индекса управляется на сервере');
      void search.crawl().catch(() => {});
      return search.status();
    },
    addSource: async ({ title, url }) => {
      await resolvePublicUrl(url);
      return search.addSource(title, url);
    },
    removeSource: ({ id }) => search.removeSource(id),
    export: () => store.export(),
    backup: () => backup(),
    import: ({ snapshot }) => {
      backup();
      return store.import(snapshot);
    },
    capabilities: () => ({
      desktop: false,
      platform: 'web',
      nativeBrowser: false,
      virtualDisplay: false,
    }),
    displays: () => [],
  };
  async function invoke(action, args = {}) {
    if (!Object.hasOwn(actions, action)) throw new Error('Неизвестное действие');
    return actions[action](args || {});
  }
  if (autoCrawl) search.start();
  const timer = setInterval(() => {
    try {
      const last = store.getSetting('lastBackup');
      if (!last || Date.now() - Date.parse(last) > 86400000) backup();
    } catch {}
  }, 3600000);
  timer.unref();
  return {
    store,
    search,
    actions,
    invoke,
    backup,
    async close() {
      clearInterval(timer);
      await search.close();
      store.close();
    },
  };
}
