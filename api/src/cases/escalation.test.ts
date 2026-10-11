import { describe, expect, test } from 'vitest';
import { countedMinors, escalationThreshold, planEscalations, type EscalationCandidate } from './escalation.js';

let nextId = 1;
/** Build a candidate; days offsets case_date so ordering is explicit. */
function make(overrides: Partial<EscalationCandidate> & { day?: number } = {}): EscalationCandidate {
  const { day = 1, ...rest } = overrides;
  return {
    caseId: nextId++,
    caseDate: new Date(Date.UTC(2026, 8, day, 2)),
    status: 'validated',
    severity: 'Minor',
    isEscalated: false,
    ...rest,
  };
}

describe('escalationThreshold', () => {
  test('is 3 (SPEC decision: 3 minors of any kind)', () => {
    expect(escalationThreshold()).toBe(3);
  });
});

describe('countedMinors', () => {
  test('counts validated, for_sanction and resolved Minor cases that are not escalated', () => {
    const cases = [
      make({ status: 'validated' }),
      make({ status: 'for_sanction' }),
      make({ status: 'resolved' }),
    ];
    expect(countedMinors(cases)).toHaveLength(3);
  });

  test.each(['reported', 'rejected'] as const)('does not count a %s case', (status) => {
    expect(countedMinors([make({ status })])).toEqual([]);
  });

  test('does not count Major cases or minors already escalated', () => {
    expect(countedMinors([make({ severity: 'Major' }), make({ isEscalated: true })])).toEqual([]);
  });

  test('orders by case_date, then by case id', () => {
    const late = make({ day: 5 });
    const earlyHighId = make({ day: 2 });
    const earlyLowId = make({ day: 2 });
    earlyLowId.caseId = earlyHighId.caseId - 1;
    expect(countedMinors([late, earlyHighId, earlyLowId]).map((c) => c.caseId)).toEqual([
      earlyLowId.caseId,
      earlyHighId.caseId,
      late.caseId,
    ]);
  });
});

describe('planEscalations', () => {
  test('two minors do nothing', () => {
    expect(planEscalations([make(), make()])).toEqual([]);
  });

  test('three minors convert the 3rd and flag the first two', () => {
    const [a, b, c] = [make({ day: 1 }), make({ day: 2 }), make({ day: 3 })];
    expect(planEscalations([c, a, b])).toEqual([{ majorCaseId: c.caseId, minorCaseIds: [a.caseId, b.caseId] }]);
  });

  test('the 3rd case is the third by date even if it has the lowest id', () => {
    const a = make({ day: 1 });
    const b = make({ day: 2 });
    const c = make({ day: 3 });
    c.caseId = 0; // lowest id, latest date
    expect(planEscalations([a, b, c])[0].majorCaseId).toBe(0);
  });

  test('a case that is not counted never joins a group', () => {
    const a = make({ day: 1 });
    const rejected = make({ day: 2, status: 'rejected' });
    const reported = make({ day: 2, status: 'reported' });
    const b = make({ day: 3 });
    expect(planEscalations([a, rejected, reported, b])).toEqual([]);
  });

  test('six minors make two groups; seven leave one waiting', () => {
    const six = Array.from({ length: 6 }, (_, i) => make({ day: i + 1 }));
    expect(planEscalations(six)).toEqual([
      { majorCaseId: six[2].caseId, minorCaseIds: [six[0].caseId, six[1].caseId] },
      { majorCaseId: six[5].caseId, minorCaseIds: [six[3].caseId, six[4].caseId] },
    ]);
    expect(planEscalations([...six, make({ day: 9 })])).toHaveLength(2);
  });

  test('the counter restarts: after a conversion, one new minor plans nothing', () => {
    const [a, b, c] = [make({ day: 1 }), make({ day: 2 }), make({ day: 3 })];
    const afterConversion: EscalationCandidate[] = [
      { ...a, isEscalated: true },
      { ...b, isEscalated: true },
      { ...c, severity: 'Major' }, // converted to H068
      make({ day: 4 }),
    ];
    expect(planEscalations(afterConversion)).toEqual([]);
  });

  test('a custom threshold is honoured (one config function)', () => {
    const [a, b] = [make({ day: 1 }), make({ day: 2 })];
    expect(planEscalations([a, b], 2)).toEqual([{ majorCaseId: b.caseId, minorCaseIds: [a.caseId] }]);
  });

  test('a threshold below 2 is rejected rather than looping or converting every case', () => {
    expect(() => planEscalations([make()], 1)).toThrow(/threshold/i);
  });
});
