/**
 * Global collector stats registry.
 * Collectors record events here; the health tool reads it.
 * Lightweight in-memory map — no persistence needed.
 */
export interface CollectorStats {
  enabled: boolean;
  eventCount: number;
  lastEventTs: number | null;
  lastError: string | null;
  details: Record<string, unknown>;
}

const registry = new Map<string, CollectorStats>();

export function registerCollector(name: string, enabled: boolean): void {
  if (!registry.has(name)) {
    registry.set(name, {
      enabled,
      eventCount: 0,
      lastEventTs: null,
      lastError: null,
      details: {},
    });
  } else {
    const s = registry.get(name);
    if (!s) return;
    s.enabled = enabled;
  }
}

export function recordEvent(name: string, detail?: Record<string, unknown>): void {
  const s = registry.get(name);
  if (!s) return;
  s.eventCount++;
  s.lastEventTs = Date.now();
  if (detail) s.details = { ...s.details, ...detail };
}

export function recordError(name: string, err: unknown): void {
  const s = registry.get(name);
  if (!s) return;
  s.lastError = String(err);
}

export function getAll(): Record<string, CollectorStats> {
  return Object.fromEntries(registry.entries());
}
