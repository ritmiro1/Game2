const DEFAULT_SETTINGS = Object.freeze({
  autoDiscard: false,
  idleMinutes: 60,
  mutedDomains: [],
});

let sweepInProgress = false;

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get("browserSettings");
  if (!stored.browserSettings) {
    await chrome.storage.local.set({ browserSettings: { ...DEFAULT_SETTINGS } });
  }
  await syncSweepAlarm();
});

chrome.runtime.onStartup.addListener(syncSweepAlarm);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "ladya-tab-cleanup") void discardIdleTabs({ automatic: true });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url && !changeInfo.status) return;
  void applyDomainMute(tab);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return false;

  const task = (async () => {
    switch (message.type) {
      case "dashboard":
        return getDashboard();
      case "restore-session":
        return restoreSession(message.sessionId);
      case "discard-idle":
        return discardIdleTabs({ automatic: false });
      case "toggle-tab-mute":
        return toggleTabMute(Number(message.tabId));
      case "toggle-domain-mute":
        return toggleDomainMute(String(message.hostname || ""));
      case "save-browser-settings":
        return saveBrowserSettings(message.settings || {});
      case "open-chess-window":
        return openChessWindow();
      default:
        throw new Error("Неизвестная команда расширения.");
    }
  })();

  task.then(
    (result) => sendResponse({ ok: true, result }),
    (error) => sendResponse({ ok: false, error: error?.message || "Не удалось выполнить действие." }),
  );
  return true;
});

async function getSettings() {
  const { browserSettings } = await chrome.storage.local.get("browserSettings");
  return { ...DEFAULT_SETTINGS, ...(browserSettings || {}) };
}

async function getDashboard() {
  const [tabs, settings, sessions] = await Promise.all([
    chrome.tabs.query({}),
    getSettings(),
    getRecentSessions(),
  ]);
  const activeTabs = tabs
    .filter((tab) => tab.id != null && !isInternalUrl(tab.url))
    .map((tab) => ({
      id: tab.id,
      title: tab.title || "Без названия",
      url: tab.url || "",
      hostname: hostnameFor(tab.url),
      active: Boolean(tab.active),
      audible: Boolean(tab.audible),
      muted: Boolean(tab.mutedInfo?.muted),
      discarded: Boolean(tab.discarded),
      pinned: Boolean(tab.pinned),
      lastAccessed: Number(tab.lastAccessed || 0),
      windowId: tab.windowId,
    }));

  return {
    tabs: activeTabs,
    recentlyClosed: sessions,
    settings,
    summary: {
      total: activeTabs.length,
      sleeping: activeTabs.filter((tab) => tab.discarded).length,
      audible: activeTabs.filter((tab) => tab.audible).length,
    },
  };
}

async function getRecentSessions() {
  try {
    const entries = await chrome.sessions.getRecentlyClosed({ maxResults: 8 });
    return entries.map((entry) => {
      const tab = entry.tab || entry.window?.tabs?.[0] || {};
      return {
        sessionId: entry.tab?.sessionId || entry.window?.sessionId || "",
        title: tab.title || (entry.window ? "Закрытое окно" : "Закрытая вкладка"),
        url: tab.url || "",
        hostname: hostnameFor(tab.url),
        closedAt: Number(entry.lastModified || 0),
        isWindow: Boolean(entry.window),
      };
    }).filter((entry) => entry.sessionId && !isInternalUrl(entry.url));
  } catch (_error) {
    return [];
  }
}

async function restoreSession(sessionId) {
  try {
    const restored = sessionId
      ? await chrome.sessions.restore(sessionId)
      : await chrome.sessions.restore();
    return { restored: Boolean(restored), title: restored?.tab?.title || restored?.window?.tabs?.[0]?.title || "" };
  } catch (_error) {
    throw new Error("Эта сессия уже недоступна. Обнови список и попробуй ещё раз.");
  }
}

async function discardIdleTabs({ automatic }) {
  if (sweepInProgress) return { discarded: 0, skipped: 0, busy: true };
  sweepInProgress = true;
  try {
    const [tabs, settings] = await Promise.all([chrome.tabs.query({}), getSettings()]);
    if (automatic && !settings.autoDiscard) return { discarded: 0, skipped: 0, disabled: true };

    const threshold = Math.max(15, Number(settings.idleMinutes) || 60) * 60 * 1000;
    const now = Date.now();
    const activeByWindow = new Map(tabs.filter((tab) => tab.active).map((tab) => [tab.windowId, tab.id]));
    let discarded = 0;
    let skipped = 0;

    for (const tab of tabs) {
      const eligible = tab.id != null
        && !tab.active
        && activeByWindow.get(tab.windowId) !== tab.id
        && !tab.pinned
        && !tab.audible
        && tab.autoDiscardable !== false
        && !tab.discarded
        && !isInternalUrl(tab.url)
        && Number(tab.lastAccessed || now) <= now - threshold;
      if (!eligible) {
        skipped += 1;
        continue;
      }
      try {
        const result = await chrome.tabs.discard(tab.id);
        if (result?.discarded) discarded += 1;
      } catch (_error) {
        skipped += 1;
      }
    }
    return { discarded, skipped, busy: false };
  } finally {
    sweepInProgress = false;
  }
}

async function toggleTabMute(tabId) {
  if (!Number.isInteger(tabId)) throw new Error("Не удалось определить вкладку.");
  const tab = await chrome.tabs.get(tabId);
  const updated = await chrome.tabs.update(tabId, { muted: !tab.mutedInfo?.muted });
  return { tabId, muted: Boolean(updated.mutedInfo?.muted) };
}

async function toggleDomainMute(hostname) {
  const cleanHost = normalizeHostname(hostname);
  if (!cleanHost) throw new Error("Не удалось определить сайт этой вкладки.");

  const settings = await getSettings();
  const mutedDomains = new Set((settings.mutedDomains || []).map(normalizeHostname).filter(Boolean));
  const shouldMute = !mutedDomains.has(cleanHost);
  if (shouldMute) mutedDomains.add(cleanHost);
  else mutedDomains.delete(cleanHost);

  await chrome.storage.local.set({ browserSettings: { ...settings, mutedDomains: [...mutedDomains] } });
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.filter((tab) => hostnameFor(tab.url) === cleanHost && tab.id != null)
    .map((tab) => chrome.tabs.update(tab.id, { muted: shouldMute }).catch(() => null)));
  return { hostname: cleanHost, muted: shouldMute };
}

async function applyDomainMute(tab) {
  if (!tab?.id || !tab.url || isInternalUrl(tab.url)) return;
  const hostname = hostnameFor(tab.url);
  if (!hostname) return;
  const settings = await getSettings();
  const muted = (settings.mutedDomains || []).some((domain) => normalizeHostname(domain) === hostname);
  if (muted && !tab.mutedInfo?.muted) {
    await chrome.tabs.update(tab.id, { muted: true }).catch(() => null);
  }
}

async function saveBrowserSettings(partial) {
  const previous = await getSettings();
  const idleMinutes = Math.min(720, Math.max(15, Number(partial.idleMinutes) || previous.idleMinutes));
  const next = {
    ...previous,
    autoDiscard: Boolean(partial.autoDiscard),
    idleMinutes,
  };
  await chrome.storage.local.set({ browserSettings: next });
  await syncSweepAlarm();
  return next;
}

async function syncSweepAlarm() {
  try {
    const settings = await getSettings();
    await chrome.alarms.clear("ladya-tab-cleanup");
    if (settings.autoDiscard) {
      chrome.alarms.create("ladya-tab-cleanup", { periodInMinutes: 15 });
    }
  } catch (_error) {
    // The popup can still perform manual cleanup if alarms are unavailable.
  }
}

async function openChessWindow() {
  const url = chrome.runtime.getURL("chess/index.html");
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((tab) => tab.url === url);
  if (existing?.windowId != null) {
    await chrome.windows.update(existing.windowId, { focused: true });
    await chrome.tabs.update(existing.id, { active: true });
    return { opened: true, existing: true };
  }
  await chrome.windows.create({
    url,
    type: "popup",
    width: 1160,
    height: 820,
    focused: true,
  });
  return { opened: true, existing: false };
}

function hostnameFor(url = "") {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch (_error) {
    return "";
  }
}

function normalizeHostname(value = "") {
  return String(value).toLowerCase().replace(/^www\./, "").replace(/\.$/, "").trim();
}

function isInternalUrl(url = "") {
  return /^(chrome|chrome-extension|edge|about|devtools|view-source):/i.test(url);
}
