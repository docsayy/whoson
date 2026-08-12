type CacheEntry<T> = {
  value?: T;
  expiresAt: number;
  pending?: Promise<T>;
};

export type DataAccessDiagnostics = {
  startedAt: string;
  serverLoads: number;
  cacheHits: number;
  cacheMisses: number;
  writesAttempted: number;
  writesSkipped: number;
  activeListeners: number;
  listenerStarts: number;
  persistedEntries: number;
  keys: Array<{
    key: string;
    hasValue: boolean;
    pending: boolean;
    expiresAt: number;
  }>;
};

const cache = new Map<string, CacheEntry<unknown>>();
const startedAt = new Date().toISOString();
const counters = {
  serverLoads: 0,
  cacheHits: 0,
  cacheMisses: 0,
  writesAttempted: 0,
  writesSkipped: 0,
  activeListeners: 0,
  listenerStarts: 0,
};

const CACHE_EVENT = "whoson:data-cache-updated";
const STORAGE_PREFIX = "whoson-cache:v2:";
const SESSION_REFRESH_PREFIX = "whoson-refreshed:";

const PERSISTED_PREFIXES = [
  "monthly-schedule:",
  "block-assignments:",
  "lectures:",
  "residents:",
  "attendings:",
  "rotations:",
  "services:",
  "academic-blocks:",
  "attending-schedule:",
  "public-whos-on:",
];

function canPersist(key: string) {
  return PERSISTED_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function emitChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CACHE_EVENT));
  }
}

function storageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`;
}

function hydrateEntry<T>(key: string): CacheEntry<T> | undefined {
  const memory = cache.get(key) as CacheEntry<T> | undefined;
  if (memory) return memory;
  if (typeof window === "undefined" || !canPersist(key)) return undefined;

  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { value: T; expiresAt: number };
    if (!parsed || !("value" in parsed) || typeof parsed.expiresAt !== "number") {
      window.localStorage.removeItem(storageKey(key));
      return undefined;
    }
    const entry: CacheEntry<T> = {
      value: parsed.value,
      expiresAt: parsed.expiresAt,
    };
    cache.set(key, entry);
    return entry;
  } catch {
    try { window.localStorage.removeItem(storageKey(key)); } catch { /* ignore */ }
    return undefined;
  }
}

function persistEntry<T>(key: string, value: T, expiresAt: number) {
  if (typeof window === "undefined" || !canPersist(key)) return;
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify({ value, expiresAt }));
  } catch (error) {
    // Storage can be unavailable in private mode or full. Memory caching still works.
    console.warn("WhosOn local cache could not be saved.", error);
  }
}

export async function readThroughCache<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number,
  force = false
): Promise<T> {
  const now = Date.now();
  const existing = hydrateEntry<T>(key);

  if (!force && existing?.value !== undefined && existing.expiresAt > now) {
    counters.cacheHits += 1;
    emitChange();
    return existing.value;
  }

  if (!force && existing?.pending) {
    counters.cacheHits += 1;
    emitChange();
    return existing.pending;
  }

  counters.cacheMisses += 1;
  const pending = loader()
    .then((value) => {
      counters.serverLoads += 1;
      const expiresAt = Date.now() + ttlMs;
      cache.set(key, { value, expiresAt });
      persistEntry(key, value, expiresAt);
      emitChange();
      return value;
    })
    .catch((error) => {
      // Keep stale cached data available when the device is offline or quota is unavailable.
      if (existing?.value !== undefined) {
        cache.set(key, { value: existing.value, expiresAt: existing.expiresAt });
      } else {
        cache.delete(key);
      }
      emitChange();
      throw error;
    });

  cache.set(key, {
    value: existing?.value,
    expiresAt: existing?.expiresAt || 0,
    pending,
  });
  emitChange();
  return pending;
}

/** Returns cached data even when it is stale, so pages can render immediately. */
export function getCachedValue<T>(key: string): T | undefined {
  return hydrateEntry<T>(key)?.value;
}

export function setCachedValue<T>(key: string, value: T, ttlMs: number) {
  const expiresAt = Date.now() + ttlMs;
  cache.set(key, { value, expiresAt });
  persistEntry(key, value, expiresAt);
  emitChange();
}

export function invalidateCachedValue(key: string) {
  cache.delete(key);
  if (typeof window !== "undefined") {
    try { window.localStorage.removeItem(storageKey(key)); } catch { /* ignore */ }
  }
  emitChange();
}

export function invalidateCachedPrefix(prefix: string) {
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
  if (typeof window !== "undefined") {
    try {
      for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
        const key = window.localStorage.key(index);
        if (key?.startsWith(`${STORAGE_PREFIX}${prefix}`)) {
          window.localStorage.removeItem(key);
        }
      }
    } catch { /* ignore */ }
  }
  emitChange();
}

/**
 * Returns true only once per browser tab for a logical dataset. This lets a
 * page paint from persistent cache immediately, then refresh quietly once,
 * without re-reading Firestore every time the user navigates back to the page.
 */
export function shouldRefreshThisSession(key: string) {
  if (typeof window === "undefined") return true;
  const sessionKey = `${SESSION_REFRESH_PREFIX}${key}`;
  try {
    if (window.sessionStorage.getItem(sessionKey)) return false;
    window.sessionStorage.setItem(sessionKey, "1");
  } catch {
    return true;
  }
  return true;
}

export function noteWrite(skipped = false) {
  if (skipped) counters.writesSkipped += 1;
  else counters.writesAttempted += 1;
  emitChange();
}

export function registerActiveListener() {
  counters.activeListeners += 1;
  counters.listenerStarts += 1;
  emitChange();
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    counters.activeListeners = Math.max(0, counters.activeListeners - 1);
    emitChange();
  };
}

export function getDataAccessDiagnostics(): DataAccessDiagnostics {
  let persistedEntries = 0;
  if (typeof window !== "undefined") {
    try {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        if (window.localStorage.key(index)?.startsWith(STORAGE_PREFIX)) persistedEntries += 1;
      }
    } catch { /* ignore */ }
  }

  return {
    startedAt,
    ...counters,
    persistedEntries,
    keys: Array.from(cache.entries())
      .map(([key, entry]) => ({
        key,
        hasValue: entry.value !== undefined,
        pending: Boolean(entry.pending),
        expiresAt: entry.expiresAt,
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  };
}

export function subscribeToDataAccessDiagnostics(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(CACHE_EVENT, listener);
  return () => window.removeEventListener(CACHE_EVENT, listener);
}

export function stableJson(value: unknown) {
  return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
}

export function valuesEqual(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const CACHE_TTL = {
  reference: 7 * 24 * 60 * 60 * 1000,
  schedule: 7 * 24 * 60 * 60 * 1000,
  public: 24 * 60 * 60 * 1000,
  userProfile: 5 * 60 * 1000,
  lectures: 24 * 60 * 60 * 1000,
};
