/// <reference types="vite/client" />

/** The API port (root .env SERVER_PORT), injected by vite.config.ts. Undefined outside Vite, for example in tests. */
declare const __API_PORT__: string | undefined;
