import { describe, expect, test } from 'vitest';
import { createPrismaOutboxStore } from '../../../src/repositories/notifications/prisma.js';
import { SYSTEM_EMPLOYEE_ID } from '../../../src/domain/clearance/rules.js';
import type { PendingNotification } from '../../../src/services/notifications/delivery.js';

type Employee = { employee_id: string; employee_email: string; first_name: string; is_active: boolean };

/** A fake `employee_accounts.findMany` that applies the `where` the store sends (is_active and employee_id.not). */
function fakeDb(employees: Employee[]) {
  const findMany = async ({ where }: { where: { is_active?: boolean; employee_id?: { not?: string } } }) =>
    employees
      .filter((e) => where.is_active === undefined || e.is_active === where.is_active)
      .filter((e) => where.employee_id?.not === undefined || e.employee_id !== where.employee_id.not)
      .map(({ employee_email, first_name }) => ({ employee_email, first_name }));
  return { employee_accounts: { findMany }, notifications: {}, student_accounts: {} } as unknown as Parameters<
    typeof createPrismaOutboxStore
  >[0];
}

const staffRow = { recipientType: 'staff', studentId: null } as unknown as PendingNotification;

describe('staff email recipients', () => {
  test('every active employee except the SYSTEM account, even if SYSTEM is ever made active', async () => {
    const store = createPrismaOutboxStore(
      fakeDb([
        { employee_id: 'E001', employee_email: 'officer@example.test', first_name: 'Officer', is_active: true },
        { employee_id: 'E002', employee_email: 'former@example.test', first_name: 'Former', is_active: false },
        { employee_id: SYSTEM_EMPLOYEE_ID, employee_email: 'system@example.invalid', first_name: 'SDO', is_active: true },
      ]),
    );
    expect(await store.recipientsOf(staffRow)).toEqual([{ email: 'officer@example.test', firstName: 'Officer' }]);
  });
});
