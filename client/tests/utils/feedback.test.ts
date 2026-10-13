import { describe, expect, test } from 'vitest';
import { TOAST_MS, canConfirm, modalTone, toastDuration } from '@/utils/feedback';

describe('modalTone (UI-POLISH-SPEC 4.3, src 3438)', () => {
  test('danger: warning icon on a pink circle and a red confirm', () => {
    expect(modalTone('danger')).toEqual({ icon: 'warning', circle: 'bg-danger-soft text-danger', button: 'dangerSolid' });
  });
  test('ok: task_alt on green and a green confirm', () => {
    expect(modalTone('ok')).toEqual({ icon: 'task_alt', circle: 'bg-success-soft text-success', button: 'success' });
  });
  test('primary: help on blue and the primary confirm', () => {
    expect(modalTone('primary')).toEqual({ icon: 'help', circle: 'bg-info-soft text-primary', button: 'primary' });
  });
});

describe('canConfirm', () => {
  test('a required reason must have text (spaces do not count)', () => {
    expect(canConfirm({ reasonRequired: true, reason: '' })).toBe(false);
    expect(canConfirm({ reasonRequired: true, reason: '   ' })).toBe(false);
    expect(canConfirm({ reasonRequired: true, reason: 'Unsigned letter' })).toBe(true);
  });
  test('no reason, or an optional one: always ready', () => {
    expect(canConfirm({ reasonRequired: false, reason: '' })).toBe(true);
  });
});

describe('toastDuration', () => {
  test('confirmations close after 4.2 s like the source; errors stay until dismissed', () => {
    expect(TOAST_MS).toBe(4200);
    expect(toastDuration('success')).toBe(4200);
    expect(toastDuration('info')).toBe(4200);
    expect(toastDuration('error')).toBeNull();
  });
});
