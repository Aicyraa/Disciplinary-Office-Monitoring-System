import { describe, expect, test } from 'vitest';
import { noticeProblem } from './Notices';

const ok = { title: 'Uniform week', message: 'Inspection Oct 12 to 17.', instructions: '', expiresOn: '' };

describe('noticeProblem', () => {
  test('a title and a message are enough', () => {
    expect(noticeProblem(ok, '2026-10-12')).toBeNull();
  });

  test('says what is missing or wrong', () => {
    expect(noticeProblem({ ...ok, title: ' ' }, '2026-10-12')).toMatch(/title/i);
    expect(noticeProblem({ ...ok, title: 'x'.repeat(121) }, '2026-10-12')).toMatch(/120/);
    expect(noticeProblem({ ...ok, message: '' }, '2026-10-12')).toMatch(/message/i);
    expect(noticeProblem({ ...ok, instructions: 'x'.repeat(1001) }, '2026-10-12')).toMatch(/1000/);
  });

  test('an expiry must be today or later', () => {
    expect(noticeProblem({ ...ok, expiresOn: '2026-10-12' }, '2026-10-12')).toBeNull();
    expect(noticeProblem({ ...ok, expiresOn: '2026-10-11' }, '2026-10-12')).toMatch(/past/i);
  });
});
