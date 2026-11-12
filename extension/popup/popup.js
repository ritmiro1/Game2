const DEFAULT_SETTINGS = { autoDiscard: false, idleMinutes: 60, mutedDomains: [] };
const EXTENSION_API = typeof chrome !== "undefined" && Boolean(chrome.runtime?.sendMessage);
let dashboard = { tabs: [], recentlyClosed: [], settings: { ...DEFAULT_SETTINGS }, summary: { total: 0, sleeping: 0, audible: 0 } };
let toastTimer = 0;

const $ = (selector) => document.querySelector(selector);
const elements = {
  openChess: $("#open-chess"),
  statTabs: $("#stat-tabs"),
  statSleeping: $("#stat-sleeping"),
  statAudible: $("#stat-audible"),
  recentList: $("#recent-list"),
  restoreLast: $("#restore-last"),
  autoDiscard: $("#auto-discard"),
  idleMinutes: $("#idle-minutes"),
  discardNow: $("#discard-now"),
  soundCount: $("#sound-count"),
  tabList: $("#tab-list"),
  toast: $("#toast"),
};

function send(message) {
  if (!EXTENSION_API) return Promise.resolve(mockMessage(message));
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) return reject(new Error(runtimeError.message));
      if (!response?.ok) return reject(new Error(response?.error || "Не удалось выполнить действие."));
      resolve(response.result);
    });
  });
}

async function mockMessage(message) {
  const stored = JSON.parse(localStorage.getItem("ladya-browser-settings") || "null") || { ...DEFAULT_SETTINGS };
  if (message.type === "dashboard") return mockDashboard(stored);
  if (message.type === "open-chess-window") {
    window.location.href = "../chess/index.html";
    return { opened: true };
  }
  if (message.type === "save-browser-settings") {
    const next = { ...stored, ...message.settings };
    localStorage.setItem("ladya-browser-settings", JSON.stringify(next));
    return next;
  }
  if (message.type === "discard-idle") return { discarded: 2, skipped: 3 };
  if (message.type === "restore-session") return { restored: true };
  if (message.type === "toggle-tab-mute") {
    const tab = dashboard.tabs.find((entry) => entry.id === Number(message.tabId));
    const mutedIds = new Set(JSON.parse(localStorage.getItem("ladya-muted-demo-tabs") || "[]").map(Number));
    if (tab) {
      tab.muted = !tab.muted;
      if (tab.muted) mutedIds.add(tab.id);
      else mutedIds.delete(tab.id);
      localStorage.setItem("ladya-muted-demo-tabs", JSON.stringify([...mutedIds]));
    }
    return { muted: tab?.muted || false };
  }
  if (message.type === "toggle-domain-mute") {
    const domains = new Set(stored.mutedDomains || []);
    const isMuted = !domains.has(message.hostname);
    if (isMuted) domains.add(message.hostname);
    else domains.delete(message.hostname);
    localStorage.setItem("ladya-browser-settings", JSON.stringify({ ...stored, mutedDomains: [...domains] }));
    return { muted: isMuted };
  }
  return {};
}

function mockDashboard(settings) {
  const sampleHost = window.location.hostname || "example.org";
  const tabs = [
    { id: 1, title: "Плейлист для сосредоточенной работы", url: `https://${sampleHost}/music`, hostname: sampleHost, active: true, audible: true, muted: false, discarded: false, pinned: false, lastAccessed: Date.now() },
    { id: 2, title: "План на неделю — документы", url: "https://docs.example.org/plan", hostname: "docs.example.org", active: false, audible: false, muted: false, discarded: false, pinned: false, lastAccessed: Date.now() - 8 * 60 * 60 * 1000 },
    { id: 3, title: "Шахматная тактика: связка", url: "https://chess.example.org/puzzle", hostname: "chess.example.org", active: false, audible: false, muted: false, discarded: true, pinned: false, lastAccessed: Date.now() - 24 * 60 * 60 * 1000 },
  ];
  const mutedDemoTabs = new Set(JSON.parse(localStorage.getItem("ladya-muted-demo-tabs") || "[]").map(Number));
  for (const tab of tabs) {
    if ((settings.mutedDomains || []).includes(tab.hostname) || mutedDemoTabs.has(tab.id)) tab.muted = true;
  }
  dashboard.tabs = tabs;
  return {
    tabs,
    recentlyClosed: [
      { sessionId: "demo-session-1", title: "Разбор дебюта: Итальянская партия", hostname: "chess.example.org", url: "https://chess.example.org/opening" },
      { sessionId: "demo-session-2", title: "Исследование — заметки к проекту", hostname: "notes.example.org", url: "https://notes.example.org" },
    ],
    settings,
    summary: { total: tabs.length, sleeping: tabs.filter((tab) => tab.discarded).length, audible: tabs.filter((tab) => tab.audible).length },
  };
}

function toast(message, isError = false) {
  elements.toast.textContent = message;
  elements.toast.classList.toggle("is-error", isError);
  elements.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2500);
}

function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function titleForHost(hostname, title) {
  return title || hostname || "Закрытая страница";
}

function render() {
  const settings = { ...DEFAULT_SETTINGS, ...(dashboard.settings || {}) };
  elements.statTabs.textContent = String(dashboard.summary?.total ?? dashboard.tabs.length);
  elements.statSleeping.textContent = String(dashboard.summary?.sleeping ?? dashboard.tabs.filter((tab) => tab.discarded).length);
  elements.statAudible.textContent = String(dashboard.summary?.audible ?? dashboard.tabs.filter((tab) => tab.audible).length);
  elements.autoDiscard.checked = Boolean(settings.autoDiscard);
  elements.idleMinutes.value = String(settings.idleMinutes || 60);

  renderRecent();
  renderTabs(settings);
}

function renderRecent() {
  const recent = dashboard.recentlyClosed || [];
  elements.restoreLast.disabled = recent.length === 0;
  if (!recent.length) {
    elements.recentList.innerHTML = '<div class="empty-state">Пока нечего восстанавливать. Закрытые вкладки появятся здесь.</div>';
    return;
  }
  elements.recentList.innerHTML = recent.slice(0, 3).map((entry) => {
    const label = entry.hostname || (entry.isWindow ? "окно" : "страница");
    const initial = (entry.hostname || entry.title || "Л").trim().charAt(0).toUpperCase();
    return `<div class="recent-row">
      <span class="favicon-letter" aria-hidden="true">${safeText(initial)}</span>
      <div class="recent-meta"><div class="recent-title" title="${safeText(entry.title)}">${safeText(titleForHost(entry.hostname, entry.title))}</div><div class="recent-host">${safeText(label)}</div></div>
      <button class="restore-item" type="button" data-restore="${safeText(entry.sessionId)}" aria-label="Восстановить ${safeText(entry.title)}" title="Восстановить">↗</button>
    </div>`;
  }).join("");
}

function renderTabs(settings) {
  const tabs = [...dashboard.tabs].sort((a, b) => Number(b.audible) - Number(a.audible) || Number(b.active) - Number(a.active) || b.lastAccessed - a.lastAccessed).slice(0, 6);
  elements.soundCount.textContent = String(dashboard.summary?.audible ?? dashboard.tabs.filter((tab) => tab.audible).length);
  if (!tabs.length) {
    elements.tabList.innerHTML = '<div class="empty-state">Открытые вкладки появятся здесь.</div>';
    return;
  }
  const mutedDomains = new Set((settings.mutedDomains || []).map((host) => String(host).replace(/^www\./, "")));
  elements.tabList.innerHTML = tabs.map((tab) => {
    const domainMuted = tab.hostname && mutedDomains.has(tab.hostname);
    const icon = tab.audible && !tab.muted ? "♫" : tab.muted ? "♪̸" : "♪";
    return `<div class="tab-row">
      <span class="tab-sound-icon ${tab.muted ? "is-muted" : ""}" aria-hidden="true">${icon}</span>
      <div class="tab-info"><div class="tab-title" title="${safeText(tab.title)}">${safeText(tab.title)}</div><div class="tab-subtitle"><span>${safeText(tab.hostname || "локальная страница")}</span>${tab.active ? '<span class="active-label">· сейчас</span>' : ""}${tab.discarded ? '<span>· спит</span>' : ""}</div></div>
      <button class="mute-button" type="button" data-mute-tab="${Number(tab.id)}" aria-label="${tab.muted ? "Включить" : "Заглушить"} звук вкладки">${tab.muted ? "Включить" : "Тихо"}</button>
      ${tab.hostname ? `<button class="site-button ${domainMuted ? "is-muted" : ""}" type="button" data-mute-site="${safeText(tab.hostname)}" aria-label="${domainMuted ? "Включить звук сайта" : "Заглушить сайт"}" title="${domainMuted ? "Снять заглушение сайта" : "Заглушить все вкладки этого сайта"}">${domainMuted ? "Сайт тихий" : "Сайт"}</button>` : ""}
    </div>`;
  }).join("");
}

async function refresh() {
  try {
    dashboard = await send({ type: "dashboard" });
    render();
  } catch (error) {
    toast(error.message || "Не удалось загрузить данные вкладок.", true);
  }
}

async function restore(sessionId) {
  try {
    await send({ type: "restore-session", sessionId });
    toast("Вкладка восстановлена.");
    window.setTimeout(refresh, 450);
  } catch (error) {
    toast(error.message, true);
    window.setTimeout(refresh, 250);
  }
}

async function saveSettings() {
  const settings = {
    autoDiscard: elements.autoDiscard.checked,
    idleMinutes: Number(elements.idleMinutes.value),
  };
  try {
    dashboard.settings = await send({ type: "save-browser-settings", settings });
    toast(settings.autoDiscard ? "Автоматическая очистка включена." : "Автоматическая очистка выключена.");
  } catch (error) {
    toast(error.message, true);
  }
}

function bindEvents() {
  elements.openChess.addEventListener("click", async () => {
    try {
      await send({ type: "open-chess-window" });
      if (!EXTENSION_API) return;
      window.close();
    } catch (error) {
      toast(error.message, true);
    }
  });

  elements.restoreLast.addEventListener("click", () => {
    const first = dashboard.recentlyClosed?.[0];
    if (first) void restore(first.sessionId);
  });
  elements.recentList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-restore]");
    if (button) void restore(button.dataset.restore);
  });
  elements.autoDiscard.addEventListener("change", saveSettings);
  elements.idleMinutes.addEventListener("change", saveSettings);
  elements.discardNow.addEventListener("click", async () => {
    elements.discardNow.disabled = true;
    elements.discardNow.innerHTML = "<span>◌</span> Проверяю вкладки…";
    try {
      const result = await send({ type: "discard-idle" });
      const count = Number(result.discarded || 0);
      toast(count ? `В режим сна переведено: ${count}. Активные и звучащие вкладки оставлены.` : "Подходящих старых вкладок нет — активные и звучащие защищены.");
      await refresh();
    } catch (error) {
      toast(error.message, true);
    } finally {
      elements.discardNow.disabled = false;
      elements.discardNow.innerHTML = "<span>⏾</span> Перевести старые вкладки в сон";
    }
  });
  elements.tabList.addEventListener("click", async (event) => {
    const tabButton = event.target.closest("[data-mute-tab]");
    const siteButton = event.target.closest("[data-mute-site]");
    try {
      if (tabButton) {
        const result = await send({ type: "toggle-tab-mute", tabId: Number(tabButton.dataset.muteTab) });
        toast(result.muted ? "Вкладка заглушена." : "Звук вкладки включён.");
      } else if (siteButton) {
        const result = await send({ type: "toggle-domain-mute", hostname: siteButton.dataset.muteSite });
        toast(result.muted ? `Звук сайта ${siteButton.dataset.muteSite} отключён.` : `Звук сайта ${siteButton.dataset.muteSite} включён.`);
      } else return;
      await refresh();
    } catch (error) {
      toast(error.message, true);
    }
  });
}

bindEvents();
void refresh();
