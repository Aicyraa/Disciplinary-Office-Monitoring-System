import { beforeEach, describe, expect, test } from 'vitest';
import { createMemoryHandbookAdminStore, type MemoryHandbookAdminStore } from './admin-memory-store.js';
import { createHandbookAdminService, type HandbookAdminService } from './admin-service.js';

let store: MemoryHandbookAdminStore;
let service: HandbookAdminService;

beforeEach(() => {
  store = createMemoryHandbookAdminStore({
    records: [
      {
        handbookEntryId: 1,
        violationId: 1,
        violationType: 'Wearing no ID',
        severity: 'Minor',
        description: 'Not wearing the school ID.',
        isSystem: false,
        section: 'VI.D.1',
        sanctions: [{ offenseNumber: 1, sanctionId: 1 }],
      },
      {
        handbookEntryId: 68,
        violationId: 68,
        violationType: '3 minor offense',
        severity: 'Major',
        description: 'System entry.',
        isSystem: true,
        section: 'VI.E.20',
        sanctions: [],
      },
    ],
    cases: { 1: 3 },
  });
  service = createHandbookAdminService({ store });
});

const input = (overrides: Record<string, unknown> = {}) => ({
  violationType: 'Loitering',
  severity: 'Minor',
  section: 'VI.D.9',
  description: 'Staying in a restricted area.',
  sanctions: [
    { offenseNumber: 1, sanctionId: 1 },
    { offenseNumber: 2, sanctionId: 2 },
  ],
  ...overrides,
});

describe('create', () => {
  test('adds a violation and its handbook entry with the allowed sanctions per offense', async () => {
    const result = await service.create(input());
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(store.entry(result.handbookEntryId)).toMatchObject({
      violationType: 'Loitering',
      severity: 'Minor',
      section: 'VI.D.9',
      isSystem: false,
      sanctions: [
        { offenseNumber: 1, sanctionId: 1 },
        { offenseNumber: 2, sanctionId: 2 },
      ],
    });
  });

  test('a sanction list is optional (the handbook may define none yet)', async () => {
    expect(await service.create(input({ sanctions: [] }))).toMatchObject({ ok: true });
  });

  test('the name must be unique, ignoring case and spaces', async () => {
    expect(await service.create(input({ violationType: '  wearing NO id ' }))).toMatchObject({ ok: false, code: 'violation_exists' });
    expect(store.state.violations).toHaveLength(2);
  });

  test('a database unique error from a lost race is the same refusal', async () => {
    const racing = createHandbookAdminService({
      store: {
        transaction: (work) =>
          store.transaction((tx) =>
            work({
              ...tx,
              insertViolation: async () => {
                throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
              },
            }),
          ),
      },
    });
    expect(await racing.create(input())).toMatchObject({ ok: false, code: 'violation_exists' });
  });

  test.each([
    ['no name', { violationType: '  ' }],
    ['a name over 200 characters', { violationType: 'x'.repeat(201) }],
    ['a category that is not Minor or Major', { severity: 'Severe' }],
    ['no section', { section: '' }],
    ['a section over 50 characters', { section: 'x'.repeat(51) }],
    ['no description', { description: '' }],
    ['a description over 2000 characters', { description: 'x'.repeat(2001) }],
    ['sanctions that are not a list', { sanctions: 'all' }],
    ['an offense number of 0', { sanctions: [{ offenseNumber: 0, sanctionId: 1 }] }],
    ['an offense number over 5', { sanctions: [{ offenseNumber: 6, sanctionId: 1 }] }],
    ['a repeated pair', { sanctions: [{ offenseNumber: 1, sanctionId: 1 }, { offenseNumber: 1, sanctionId: 1 }] }],
    ['a sanction that does not exist', { sanctions: [{ offenseNumber: 1, sanctionId: 99 }] }],
  ])('refuses %s', async (_label, override) => {
    expect(await service.create(input(override))).toMatchObject({ ok: false, code: 'invalid_input' });
    expect(store.state.violations).toHaveLength(2);
  });
});

describe('update', () => {
  test('changes the name, section, description and the sanction set', async () => {
    const result = await service.update({
      handbookEntryId: 1,
      violationType: 'Not wearing the ID',
      section: 'VI.D.2',
      description: 'Updated.',
      sanctions: [{ offenseNumber: 1, sanctionId: 2 }],
    });
    expect(result).toEqual({ ok: true });
    expect(store.entry(1)).toMatchObject({
      violationType: 'Not wearing the ID',
      section: 'VI.D.2',
      description: 'Updated.',
      sanctions: [{ offenseNumber: 1, sanctionId: 2 }],
    });
  });

  test('only the fields sent change', async () => {
    await service.update({ handbookEntryId: 1, description: 'Only this.' });
    expect(store.entry(1)).toMatchObject({
      violationType: 'Wearing no ID',
      section: 'VI.D.1',
      description: 'Only this.',
      sanctions: [{ offenseNumber: 1, sanctionId: 1 }],
    });
  });

  test('renaming to another violation\'s name is refused; keeping its own name is fine', async () => {
    await service.create(input());
    expect(await service.update({ handbookEntryId: 1, violationType: 'LOITERING' })).toMatchObject({ code: 'violation_exists' });
    expect(await service.update({ handbookEntryId: 1, violationType: 'wearing no id' })).toEqual({ ok: true });
  });

  test('the category cannot change once cases use the entry (it would change escalation counts)', async () => {
    expect(await service.update({ handbookEntryId: 1, severity: 'Major' })).toMatchObject({ ok: false, code: 'violation_in_use' });
    expect(store.entry(1)?.severity).toBe('Minor');
    // The same category is not a change.
    expect(await service.update({ handbookEntryId: 1, severity: 'Minor' })).toEqual({ ok: true });
  });

  test('the category can change while no case uses the entry', async () => {
    const created = await service.create(input());
    if (!created.ok) throw new Error('setup');
    expect(await service.update({ handbookEntryId: created.handbookEntryId, severity: 'Major' })).toEqual({ ok: true });
    expect(store.entry(created.handbookEntryId)?.severity).toBe('Major');
  });

  test('the system entry cannot be edited and looks like it does not exist', async () => {
    expect(await service.update({ handbookEntryId: 68, description: 'x' })).toMatchObject({ ok: false, code: 'not_found' });
  });

  test('an unknown entry is not found; an empty change is refused', async () => {
    expect(await service.update({ handbookEntryId: 999, description: 'x' })).toMatchObject({ code: 'not_found' });
    expect(await service.update({ handbookEntryId: 1 })).toMatchObject({ code: 'invalid_input' });
  });

  test('invalid values are refused and nothing changes', async () => {
    expect(await service.update({ handbookEntryId: 1, severity: 'Severe' })).toMatchObject({ code: 'invalid_input' });
    expect(await service.update({ handbookEntryId: 1, sanctions: [{ offenseNumber: 1, sanctionId: 99 }] })).toMatchObject({
      code: 'invalid_input',
    });
    expect(store.entry(1)).toMatchObject({ severity: 'Minor', sanctions: [{ offenseNumber: 1, sanctionId: 1 }] });
  });

  test('an empty sanction list clears the allowed sanctions', async () => {
    expect(await service.update({ handbookEntryId: 1, sanctions: [] })).toEqual({ ok: true });
    expect(store.entry(1)?.sanctions).toEqual([]);
  });
});
