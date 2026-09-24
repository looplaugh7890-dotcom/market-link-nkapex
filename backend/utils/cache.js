// Tiny in-process TTL cache with in-flight de-duplication ("single flight"), so a burst of identical
// requests hits MongoDB once. For several server instances swap this for Redis with the same API.
const store = new Map(); // key -> { value, expires }
const inflight = new Map(); // key -> Promise
const MAX_ENTRIES = 500;

const get = (key) => {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return hit.value;
};

const set = (key, value, ttlMs) => {
  if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value);
  store.set(key, { value, expires: Date.now() + ttlMs });
};

// cached('home', 60_000, () => expensiveQuery())
const cached = async (key, ttlMs, loadValue) => {
  const hit = get(key);
  if (hit !== undefined) return hit;
  if (inflight.has(key)) return inflight.get(key);
  const pending = Promise.resolve()
    .then(loadValue)
    .then((value) => {
      set(key, value, ttlMs);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, pending);
  return pending;
};

const clear = (prefix = '') => {
  for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
};

module.exports = { cached, clear };
