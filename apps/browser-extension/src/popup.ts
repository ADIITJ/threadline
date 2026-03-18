export {};
const DEFAULT_URL = "http://127.0.0.1:47821";

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function formatAge(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

async function checkDaemon(daemonUrl: string): Promise<boolean> {
  try {
    const resp = await fetch(`${daemonUrl}/health`, { signal: AbortSignal.timeout(1500) });
    return resp.ok;
  } catch {
    return false;
  }
}

chrome.storage.sync.get({ daemonUrl: DEFAULT_URL }, async (items) => {
  const daemonUrl = items.daemonUrl as string;
  const connected = await checkDaemon(daemonUrl);

  const dot = el("dot");
  const statusText = el("statusText");

  if (connected) {
    dot.classList.add("connected");
    statusText.textContent = "Daemon connected";
  } else {
    dot.classList.add("disconnected");
    statusText.textContent = "Daemon not running";
  }

  chrome.storage.local.get({ lastEventTs: null }, (local) => {
    const ts = local.lastEventTs as number | null;
    if (ts) {
      el("lastEvent").textContent = `Last event: ${formatAge(ts)}`;
    }
  });
});

el("optionsLink").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
