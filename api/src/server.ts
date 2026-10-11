import { app } from './app.js';

const port = Number(process.env.SERVER_PORT ?? process.env.PORT ?? 3000);
const server = app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});

server.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close();
    server.closeAllConnections();
  });
}
