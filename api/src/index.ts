import express from 'express';
import { buildApp } from './server.js';

// Vercel entrypoint (vercel.json, service "api"). The service sees the original public path, so the API is
// mounted under `/api` here; `server.ts` run directly (dev, `npm start`) serves the same app at the root.
// No listener and no delivery sweep timer run on Vercel (see the VERCEL guard in server.ts).
const root = express();
root.use('/api', buildApp().app);

export default root;
