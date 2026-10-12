import { describe, expect, test } from 'vitest';
import { MAX_FILE_BYTES, addDays, checkSelection, formatSize, manilaToday, progressPercent, uploadButtonLabel } from './files';

const file = (name: string, size = 1024) => ({ name, size });

describe('checkSelection', () => {
  test('accepts PDF and DOCX files within the limits', () => {
    expect(checkSelection([file('a.pdf'), file('B.DOCX')], 0)).toBeNull();
  });

  test('needs at least one file', () => {
    expect(checkSelection([], 0)).toMatch(/at least one/i);
  });

  test('counts files already attached toward the limit of five', () => {
    const three = [file('a.pdf'), file('b.pdf'), file('c.pdf')];
    expect(checkSelection(three, 2)).toBeNull();
    expect(checkSelection(three, 3)).toMatch(/at most 5/);
  });

  test.each([
    ['photo.png', 1024, /only PDF or DOCX/],
    ['notes.txt', 1024, /only PDF or DOCX/],
    ['empty.pdf', 0, /empty/],
    ['huge.pdf', MAX_FILE_BYTES + 1, /larger than 10 MB/],
  ])('rejects %s', (name, size, pattern) => {
    expect(checkSelection([file(name, size)], 0)).toMatch(pattern);
  });

  test('exactly 10 MB is fine', () => {
    expect(checkSelection([file('edge.pdf', MAX_FILE_BYTES)], 0)).toBeNull();
  });
});

describe('formatSize', () => {
  test.each([
    [512, '512 B'],
    [2048, '2.0 KB'],
    [5 * 1024 * 1024, '5.0 MB'],
  ])('%i bytes', (bytes, label) => {
    expect(formatSize(bytes)).toBe(label);
  });
});

describe('dates', () => {
  test('addDays crosses month and year ends without time zone drift', () => {
    expect(addDays('2026-10-12', 14)).toBe('2026-10-26');
    expect(addDays('2026-12-25', 14)).toBe('2027-01-08');
    expect(addDays('2028-02-20', 10)).toBe('2028-03-01');
  });

  test('manilaToday rolls over at Manila midnight', () => {
    expect(manilaToday(new Date('2026-10-11T15:59:00Z'))).toBe('2026-10-11');
    expect(manilaToday(new Date('2026-10-11T16:00:00Z'))).toBe('2026-10-12');
  });
});

describe('progressPercent', () => {
  test('whole percent of bytes sent, capped at 100, null when the total is unknown', () => {
    expect(progressPercent(0, 200)).toBe(0);
    expect(progressPercent(50, 200)).toBe(25);
    expect(progressPercent(199, 200)).toBe(99);
    expect(progressPercent(250, 200)).toBe(100);
    expect(progressPercent(10, undefined)).toBeNull();
    expect(progressPercent(10, 0)).toBeNull();
  });
});

describe('uploadButtonLabel', () => {
  test('tells the student what pressing the button will do', () => {
    expect(uploadButtonLabel({ count: 0, busy: false, percent: null })).toBe('Add a file to submit');
    expect(uploadButtonLabel({ count: 1, busy: false, percent: null })).toBe('Upload 1 file');
    expect(uploadButtonLabel({ count: 3, busy: false, percent: null })).toBe('Upload 3 files');
  });

  test('while uploading it shows the percentage, then Processing once every byte is sent', () => {
    expect(uploadButtonLabel({ count: 2, busy: true, percent: null })).toBe('Uploading…');
    expect(uploadButtonLabel({ count: 2, busy: true, percent: 40 })).toBe('Uploading… 40%');
    expect(uploadButtonLabel({ count: 2, busy: true, percent: 100 })).toBe('Processing…');
  });
});
