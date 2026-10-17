import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Missing root element');
}

createRoot(container).render(createElement(App));

// Installable app (public/sw.js): the shell opens without a connection and shows the offline screen.
// Production builds only, so the dev server's hot reload is never served from a cache.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => console.error(error));
  });
}
