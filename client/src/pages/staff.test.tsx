import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { ReasonForm } from '../components/ReasonForm';
import { availableActions } from './StaffCaseDetail';
import { whoLabel } from './StaffCases';

const matched = { id: '2025-0000001', name: 'Ana Cruz' };

describe('availableActions', () => {
  test('a reported, matched gate case can be validated or rejected', () => {
    expect(availableActions({ status: 'reported', student: matched, submissionRef: 'ref', sanctions: [] })).toEqual([
      'validate',
      'reject',
    ]);
  });

  test('an unmatched report must be linked first; it can still be rejected, never validated', () => {
    const actions = availableActions({ status: 'reported', student: null, submissionRef: 'ref', sanctions: [] });
    expect(actions).toEqual(['link_student', 'reject']);
    expect(actions).not.toContain('validate');
  });

  test('a reported case without a submission reference offers nothing (validate/reject act on submissions)', () => {
    expect(availableActions({ status: 'reported', student: matched, submissionRef: null, sanctions: [] })).toEqual([]);
  });

  test('a validated case can be resolved without a sanction', () => {
    expect(availableActions({ status: 'validated', student: matched, submissionRef: null, sanctions: [] })).toEqual([
      'resolve_without_sanction',
    ]);
  });

  test('for_sanction resolves only when every sanction is completed', () => {
    const base = { status: 'for_sanction' as const, student: matched, submissionRef: null };
    expect(availableActions({ ...base, sanctions: [] })).toEqual([]);
    expect(
      availableActions({ ...base, sanctions: [{ id: 1, sanctionCode: 'S001', type: 'x', status: 'pending_verification', dueDate: '2026-10-20' }] }),
    ).toEqual([]);
    expect(
      availableActions({ ...base, sanctions: [{ id: 1, sanctionCode: 'S001', type: 'x', status: 'completed', dueDate: '2026-10-20' }] }),
    ).toEqual(['resolve']);
  });

  test.each(['resolved', 'rejected'] as const)('%s has no workflow action', (status) => {
    expect(availableActions({ status, student: matched, submissionRef: 'ref', sanctions: [] })).toEqual([]);
  });
});

describe('whoLabel', () => {
  test('shows the matched student', () => {
    expect(whoLabel({ student: matched, claimed: null })).toBe('Ana Cruz (2025-0000001)');
  });

  test('shows what the guard typed, flagged as not matched', () => {
    expect(
      whoLabel({ student: null, claimed: { studentId: '2025-0000009', name: 'Zed', program: null, year: null } }),
    ).toBe('Zed (2025-0000009) · not matched');
  });

  test('falls back when nothing is known', () => {
    expect(whoLabel({ student: null, claimed: null })).toBe('Unknown student');
  });
});

describe('ReasonForm', () => {
  test('renders a labelled required field and submit and cancel buttons', () => {
    const html = renderToStaticMarkup(
      <ReasonForm title="Reject this report" label="Reason (required)" submitLabel="Reject" onSubmit={async () => {}} onCancel={() => {}} />,
    );
    expect(html).toContain('Reject this report');
    expect(html).toContain('Reason (required)');
    expect(html).toContain('<textarea');
    expect(html).toContain('Cancel');
  });
});
