import { once } from 'node:events';
import { createServer } from 'node:http';
import { expect, test } from 'vitest';
import { app } from '../src/app.js';

test('AC2 and AC6: GET /health returns 200 and the ok status without a database', async () => {
  const server = createServer(app);

  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Expected a TCP address for the test server');
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/health`, {
      signal: AbortSignal.timeout(2000),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  }
});
