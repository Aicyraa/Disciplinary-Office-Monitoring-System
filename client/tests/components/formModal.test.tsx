import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { FormModal } from '@/components/feedback';

describe('FormModal', () => {
  const render = (open: boolean) =>
    renderToStaticMarkup(
      <FormModal open={open} icon="add_circle" title="Record violation" subtitle="One line." onClose={() => undefined} footer={<button>Save case</button>}>
        <p>Body</p>
      </FormModal>,
    );

  test('header (chip, title, subtitle, close), scrolling body and a sticky footer on the surface colour', () => {
    const html = render(true);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('>add_circle<');
    expect(html).toContain('>Record violation<');
    expect(html).toContain('>One line.<');
    expect(html).toContain('aria-label="Close"');
    expect(html).toContain('overflow-y-auto');
    expect(html).toContain('bg-surface-2');
    expect(html).toContain('>Save case<');
  });

  test('a bottom sheet with an 18 px top radius on a phone, rendered at the phone zoom', () => {
    const html = render(true);
    expect(html).toContain('rounded-t-[18px]');
    expect(html).toContain('ui-zoom-phone');
  });

  test('renders nothing while closed', () => {
    expect(render(false)).toBe('');
  });
});
