import { describe, expect, test } from 'vitest';
import { FOCUSABLE, INITIAL_FOCUS } from '@/components/feedback/useDialogFocus';

describe('dialog focus selectors', () => {
  test('the first thing focused is a marked element, else a text field, and never a file input', () => {
    expect(INITIAL_FOCUS).toContain('[data-autofocus]');
    expect(INITIAL_FOCUS).toContain('textarea');
    expect(INITIAL_FOCUS).toContain('input:not([type="hidden"]):not([type="file"])');
  });

  test('anything taken out of the tab order is not a tab stop', () => {
    for (const part of FOCUSABLE.split(', ')) {
      expect(part).toContain(':not([tabindex="-1"])');
      expect(part).toContain(':not([disabled])');
    }
  });
});
