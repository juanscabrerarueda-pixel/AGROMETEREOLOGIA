export interface Cache<K = string, V = unknown> {
    get(key: K): Promise<V | undefined>;
    set(key: K, value: V, ttlSeconds: number): Promise<void>;
}
export declare class MemoryCache<K = string, V = unknown> implements Cache<K, V> {
    private store;
    get(key: K): Promise<V | undefined>;
    set(key: K, value: V, ttlSeconds: number): Promise<void>;
}
export declare const cacheKey: (params: {
    src: string;
    key: string;
    range: string;
    fields: string[];
}) => string;
