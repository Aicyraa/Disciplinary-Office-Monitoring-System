import bcrypt from 'bcryptjs';
import { describe, expect, test } from 'vitest';
import { createMemoryAccountRepo } from '../../src/repositories/auth/memory-repo.js';
import { createAuthService } from '../../src/services/auth.service.js';

const PASSWORD = 'Passw0rd1';
const hash = bcrypt.hashSync(PASSWORD, 4);

const account = (role: 'student' | 'staff', id: string, email: string, isActive = true) => ({
  role,
  id,
  email,
  firstName: 'Fake',
  lastName: id,
  passwordHashed: hash,
  mustChangePassword: false,
  isActive,
});

const service = (accounts: ReturnType<typeof account>[]) =>
  createAuthService({ repo: createMemoryAccountRepo(accounts), rounds: 4 });

describe('login: the role is the table the account lives in, the email must be an NU address', () => {
  test('a student with a student address signs in as a student', async () => {
    const user = await service([account('student', '2025-0000001', 'ana@students.nu-fairview.edu.ph')]).login(
      'ana@students.nu-fairview.edu.ph',
      PASSWORD,
    );
    expect(user).toMatchObject({ role: 'student', id: '2025-0000001' });
  });

  test('a staff account with a staff address signs in as staff', async () => {
    const user = await service([account('staff', 'E001', 'officer@nu-fairview.edu.ph')]).login('officer@nu-fairview.edu.ph', PASSWORD);
    expect(user).toMatchObject({ role: 'staff', id: 'E001' });
  });

  test('a staff account that uses a student address (the demo accounts) signs in as staff', async () => {
    const user = await service([account('staff', 'E003', 'feleoagd@students.nu-fairview.edu.ph')]).login(
      'FeleoAGD@Students.NU-Fairview.edu.ph',
      PASSWORD,
    );
    expect(user).toMatchObject({ role: 'staff', id: 'E003' });
  });

  test('a student account that uses the staff domain signs in as a student', async () => {
    const user = await service([account('student', '2025-0000009', 'odd@nu-fairview.edu.ph')]).login('odd@nu-fairview.edu.ph', PASSWORD);
    expect(user).toMatchObject({ role: 'student', id: '2025-0000009' });
  });

  test('an address outside the two NU domains never signs in, even when an account has it', async () => {
    const accounts = [account('student', '2025-0000002', 'ben@gmail.com'), account('staff', 'E002', 'x@example.org')];
    expect(await service(accounts).login('ben@gmail.com', PASSWORD)).toBeNull();
    expect(await service(accounts).login('x@example.org', PASSWORD)).toBeNull();
  });

  test('a wrong password, an unknown address and an inactive account all give null', async () => {
    const accounts = [
      account('staff', 'E003', 'feleoagd@students.nu-fairview.edu.ph'),
      account('staff', 'E004', 'gone@nu-fairview.edu.ph', false),
    ];
    const auth = service(accounts);
    expect(await auth.login('feleoagd@students.nu-fairview.edu.ph', 'wrong-pass1')).toBeNull();
    expect(await auth.login('nobody@students.nu-fairview.edu.ph', PASSWORD)).toBeNull();
    expect(await auth.login('gone@nu-fairview.edu.ph', PASSWORD)).toBeNull();
  });
});
