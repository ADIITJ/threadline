interface ExtensionSettings {
  daemonUrl: string;
  enabled: boolean;
  ignoreIncognito: boolean;
}

const DEFAULT_SETTINGS: ExtensionSettings = {
  daemonUrl: "http://127.0.0.1:47821",
  enabled: true,
  ignoreIncognito: true,
};

const IGNORED_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "about:",
  "moz-extension://",
  "edge://",
];

function shouldIgnoreUrl(url: string): boolean {
  return IGNORED_PREFIXES.some((p) => url.startsWith(p));
}

async function getSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
      resolve(items as ExtensionSettings);
    });
  });
}

async function sendEvent(
  kind: "tab_opened" | "tab_closed" | "tab_updated",
  tab: chrome.tabs.Tab
): Promise<void> {
  if (!tab.url) return;
  if (shouldIgnoreUrl(tab.url)) return;

  const settings = await getSettings();
  if (!settings.enabled) return;
  if (tab.incognito && settings.ignoreIncognito) return;

  const payload = {
    tabId: tab.id ?? 0,
    windowId: tab.windowId ?? 0,
    url: tab.url,
    title: tab.title ?? "",
    kind,
    ts: Date.now(),
    incognito: tab.incognito ?? false,
  };

  try {
    await fetch(`${settings.daemonUrl}/ingest/browser-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Daemon not running — silently ignore
  }
}

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.url) void sendEvent("tab_opened", tab);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    void sendEvent("tab_updated", tab);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    if (tab) void sendEvent("tab_closed", tab);
  });
});

// Store last event time for popup
chrome.tabs.onUpdated.addListener(() => {
  chrome.storage.local.set({ lastEventTs: Date.now() });
});
