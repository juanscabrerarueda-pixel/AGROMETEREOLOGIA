import type { SeriesSchema as SeriesSchemaType } from '@pkg/core/dist/schemas.js';

declare module '@pkg/core/schemas' {
  export const SeriesSchema: SeriesSchemaType;
}
