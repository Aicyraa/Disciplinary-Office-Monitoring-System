import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { AccountRecord, AccountRepo } from './repo.js';

type StudentRow = {
  student_id: string;
  student_email: string;
  first_name: string;
  last_name: string;
  password_hashed: string;
  must_change_password: boolean;
  is_active: boolean;
  avatar_key: string | null;
};

type EmployeeRow = {
  employee_id: string;
  employee_email: string;
  first_name: string;
  last_name: string;
  password_hashed: string;
  must_change_password: boolean;
  is_active: boolean;
  avatar_key: string | null;
};

const fromStudent = (row: StudentRow): AccountRecord => ({
  id: row.student_id,
  email: row.student_email,
  firstName: row.first_name,
  lastName: row.last_name,
  passwordHashed: row.password_hashed,
  mustChangePassword: row.must_change_password,
  isActive: row.is_active,
  avatarKey: row.avatar_key,
});

const fromEmployee = (row: EmployeeRow): AccountRecord => ({
  id: row.employee_id,
  email: row.employee_email,
  firstName: row.first_name,
  lastName: row.last_name,
  passwordHashed: row.password_hashed,
  mustChangePassword: row.must_change_password,
  isActive: row.is_active,
  avatarKey: row.avatar_key,
});

/** Prisma-backed account repository. Takes the client as a parameter so callers can pass a transaction. */
export function createPrismaAccountRepo(db: Pick<PrismaClient, 'student_accounts' | 'employee_accounts'>): AccountRepo {
  return {
    async findByEmail(role, email) {
      if (role === 'student') {
        const row = await db.student_accounts.findFirst({
          where: { student_email: { equals: email, mode: 'insensitive' } },
        });
        return row ? fromStudent(row) : null;
      }
      const row = await db.employee_accounts.findFirst({
        where: { employee_email: { equals: email, mode: 'insensitive' } },
      });
      return row ? fromEmployee(row) : null;
    },
    async findById(role, id) {
      if (role === 'student') {
        const row = await db.student_accounts.findUnique({ where: { student_id: id } });
        return row ? fromStudent(row) : null;
      }
      const row = await db.employee_accounts.findUnique({ where: { employee_id: id } });
      return row ? fromEmployee(row) : null;
    },
    async updatePassword(role, id, passwordHashed, mustChangePassword) {
      const data = { password_hashed: passwordHashed, must_change_password: mustChangePassword };
      if (role === 'student') {
        const result = await db.student_accounts.updateMany({ where: { student_id: id }, data });
        return result.count > 0;
      }
      const result = await db.employee_accounts.updateMany({ where: { employee_id: id }, data });
      return result.count > 0;
    },
    async updateAvatarKey(role, id, avatarKey) {
      const data = { avatar_key: avatarKey };
      if (role === 'student') {
        const result = await db.student_accounts.updateMany({ where: { student_id: id }, data });
        return result.count > 0;
      }
      const result = await db.employee_accounts.updateMany({ where: { employee_id: id }, data });
      return result.count > 0;
    },
  };
}
