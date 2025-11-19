export class MemoryCache {
    constructor() {
        this.store = new Map();
    }
    async get(key) {
        const entry = this.store.get(key);
        if (!entry)
            return undefined;
        if (entry.exp <= Date.now()) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value;
    }
    async set(key, value, ttlSeconds) {
        const exp = Date.now() + Math.max(0, ttlSeconds) * 1000;
        this.store.set(key, { value, exp });
    }
}
export const cacheKey = (params) => {
    const fields = [...params.fields].sort().join(',');
    return `${params.src}:${params.key}:${params.range}:${fields}`;
};
//# sourceMappingURL=index.js.map