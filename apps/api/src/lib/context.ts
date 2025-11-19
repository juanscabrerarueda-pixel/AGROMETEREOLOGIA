import { MemoryCache } from '@pkg/cache';
import { OpenMeteoProvider } from '@pkg/meteo-providers';

export const provider = new OpenMeteoProvider();
export const cache = new MemoryCache<string, unknown>();
