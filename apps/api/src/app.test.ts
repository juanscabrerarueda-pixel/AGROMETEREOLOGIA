import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import type { AddressInfo } from 'node:net';

async function requestHealth() {
  const app = createApp();
  const server = app.listen(0);
  const address = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${address.port}/health`;

  try {
    const response = await fetch(url);
    const body = await response.json();
    return { status: response.status, body };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('health endpoint', () => {
  it('responds with status ok', async () => {
    const result = await requestHealth();
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ status: 'ok' });
  });
});
