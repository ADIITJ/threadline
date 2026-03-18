export {};
const DEFAULT = {
  daemonUrl: "http://127.0.0.1:47821",
  enabled: true,
  ignoreIncognito: true,
};

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

chrome.storage.sync.get(DEFAULT, (items) => {
  el<HTMLInputElement>("daemonUrl").value = items.daemonUrl as string;
  el<HTMLInputElement>("enabled").checked = items.enabled as boolean;
  el<HTMLInputElement>("ignoreIncognito").checked = items.ignoreIncognito as boolean;
});

el("save").addEventListener("click", () => {
  const settings = {
    daemonUrl: el<HTMLInputElement>("daemonUrl").value.trim() || DEFAULT.daemonUrl,
    enabled: el<HTMLInputElement>("enabled").checked,
    ignoreIncognito: el<HTMLInputElement>("ignoreIncognito").checked,
  };
  chrome.storage.sync.set(settings, () => {
    const status = el("status");
    status.style.display = "block";
    setTimeout(() => {
      status.style.display = "none";
    }, 2000);
  });
});
