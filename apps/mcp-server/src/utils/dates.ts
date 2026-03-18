export function nowMs(): number {
  return Date.now();
}

export function daysAgo(n: number): number {
  return Date.now() - n * 24 * 60 * 60 * 1000;
}

export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function formatTs(ts: number): string {
  return new Date(ts).toISOString();
}
