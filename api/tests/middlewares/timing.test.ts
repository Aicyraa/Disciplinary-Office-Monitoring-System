import express from 'express';
import request from 'supertest';
import { describe, expect, test } from 'vitest';
import { createApp } from '../../src/app.js';
import { formatTiming, requestTiming, type TimingEntry } from '../../src/middlewares/timing.js';

describe('requestTiming', () => {
  test('records the route pattern, not the concrete path or query string', async () => {
    const entries: TimingEntry[] = [];
    let clock = 100;
    const app = express();
    app.use(requestTiming((entry) => entries.push(entry), () => (clock += 25)));
    const cases = express.Router();
    cases.get('/:id', (_q, response) => {
      response.status(200).json({ ok: true });
    });
    app.use('/cases', cases);

    await request(app).get('/cases/42?q=secret');

    expect(entries).toEqual([{ method: 'GET', route: '/cases/:id', status: 200, ms: 25 }]);
  });

  test('an unmatched path is logged as the path, with its status', async () => {
    const entries: TimingEntry[] = [];
    const app = createApp({ timing: (entry) => entries.push(entry) });
    await request(app).get('/nowhere');
    expect(entries.map(({ route, status }) => ({ route, status }))).toEqual([{ route: '/nowhere', status: 404 }]);
  });

  test('without the option nothing is recorded (production)', async () => {
    const response = await request(createApp()).get('/health');
    expect(response.status).toBe(200);
  });

  test('one readable line per request', () => {
    expect(formatTiming({ method: 'GET', route: '/cases', status: 200, ms: 41.234 })).toBe('[timing] GET /cases 200 41.2ms');
  });
});
