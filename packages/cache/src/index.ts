export interface Cache<K = string, V = unknown> {
  get(key: K): Promise<V | undefined>;
  set(key: K, value: V, ttlSeconds: number): Promise<void>;
}

export class MemoryCache<K = string, V = unknown> implements Cache<K, V> {
  private store = new Map<K, { value: V; exp: number }>();

  async get(key: K): Promise<V | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.exp <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async set(key: K, value: V, ttlSeconds: number): Promise<void> {
    const exp = Date.now() + Math.max(0, ttlSeconds) * 1000;
    this.store.set(key, { value, exp });
  }
}

export const cacheKey = (params: {
  src: string;
  key: string;
  range: string;
  fields: string[];
}): string => {
  const fields = [...params.fields].sort().join(',');
  return `${params.src}:${params.key}:${params.range}:${fields}`;
};
