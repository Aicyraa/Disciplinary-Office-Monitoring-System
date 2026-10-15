import { describe, expect, test } from 'vitest';
import { uiZoom } from '@/utils/zoom';

describe('uiZoom (prototype src 2565)', () => {
  test('width / 1536, clamped to 0.8 to 1.3; phones render at 90%', () => {
    expect(uiZoom(1536)).toBe(1);
    expect(uiZoom(1366)).toBe(0.889);
    expect(uiZoom(1000)).toBe(0.8);
    expect(uiZoom(2560)).toBe(1.3);
    expect(uiZoom(390)).toBe(0.9);
    expect(uiZoom(719)).toBe(0.9);
  });
});
