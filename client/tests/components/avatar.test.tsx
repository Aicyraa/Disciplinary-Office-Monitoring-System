import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { Avatar } from '@/components/ui/Avatar';

describe('Avatar', () => {
  test('without a picture it shows the initials', () => {
    const html = renderToStaticMarkup(<Avatar firstName="Ana" lastName="Cruz" url={null} className="size-8" />);
    expect(html).toContain('>AC<');
    expect(html).not.toContain('<img');
    expect(html).toContain('aria-hidden="true"');
  });

  test('with a picture it shows the image (decorative, no alt text) instead of the initials', () => {
    const html = renderToStaticMarkup(<Avatar firstName="Ana" lastName="Cruz" url="https://files.example/a.png" />);
    expect(html).toContain('<img src="https://files.example/a.png" alt=""');
    expect(html).not.toContain('>AC<');
  });
});
