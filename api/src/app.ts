import express from 'express';
import type { HealthResponse } from '../../shared/types.js';

export const app = express();

app.get('/health', (_request, response) => {
  const health: HealthResponse = { status: 'ok' };
  response.status(200).json(health);
});
