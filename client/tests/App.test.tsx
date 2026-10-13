import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import App from '@/App';

test('AC4 and AC6: App renders the Disciplinary Office Monitoring System title', () => {
  const html = renderToStaticMarkup(createElement(App));

  expect(html).toContain('Disciplinary Office Monitoring System');
});
