import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import type { AuthUser, HandbookEntryView } from '@shared/types';
import { resolveAccess } from './App';
import { AuthProvider } from './auth/AuthContext';
import { StatusPill } from './components/ui';
import { navGroups } from './lib/nav';
import { filterEntries } from './pages/Handbook';
import Login from './pages/Login';
import { passwordRuleError } from './pages/ChangePassword';

const user: AuthUser = {
  role: 'student',
  id: '2025-0000001',
  email: 'ana@students.nu-fairview.edu.ph',
  firstName: 'Ana',
  lastName: 'Cruz',
  mustChangePassword: false,
};

describe('resolveAccess', () => {
  test('waits while the session is being restored', () => {
    expect(resolveAccess({ status: 'loading' })).toBe('loading');
  });

  test('sends anonymous visitors to login', () => {
    expect(resolveAccess({ status: 'anonymous' })).toBe('login');
  });

  test('forces a password change before anything else', () => {
    expect(resolveAccess({ status: 'authenticated', user: { ...user, mustChangePassword: true } })).toBe('change-password');
  });

  test('lets a settled account through', () => {
    expect(resolveAccess({ status: 'authenticated', user })).toBe('allow');
  });
});

describe('navGroups destinations', () => {
  const paths = (role: 'student' | 'staff') => navGroups(role).flatMap((group) => group.items.map((item) => item.to));

  test('students get the seven student pages', () => {
    expect(paths('student')).toEqual([
      '/',
      '/inbox',
      '/violations',
      '/sanctions',
      '/appointments',
      '/clearance',
      '/handbook',
    ]);
  });

  test('staff get the case screens and no student-only pages', () => {
    expect(paths('staff')).toEqual([
      '/',
      '/inbox',
      '/record',
      '/appointments/new',
      '/handbook/new',
      '/cases',
      '/students',
      '/notices',
      '/appointments',
      '/clearance',
      '/handbook',
      '/handbook?tab=templates',
    ]);
  });
});

describe('Login', () => {
  test('renders labelled email and password fields and a submit button', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(html).toContain('NU email');
    expect(html).toContain('type="password"');
    expect(html).toContain('Sign in');
    expect(html).toContain('Room 204');
  });
});

describe('StatusPill', () => {
  test('uses the SPEC 9 colors and the friendly label', () => {
    const html = renderToStaticMarkup(<StatusPill status="rejected" />);
    expect(html).toContain('Not verified');
    expect(html).toContain('#ECEEF1');
    expect(html).toContain('#4A5260');
  });
});

describe('passwordRuleError', () => {
  test.each([
    ['short1', 'Use at least 8 characters.'],
    ['abcdefgh', 'Include at least one digit.'],
    ['12345678', 'Include at least one letter.'],
  ])('%s', (password, message) => {
    expect(passwordRuleError(password)).toBe(message);
  });

  test('accepts a valid password', () => {
    expect(passwordRuleError('abcdef12')).toBeNull();
  });
});

describe('filterEntries', () => {
  const entry = (id: number, violation: string, severity: 'Minor' | 'Major', section: string): HandbookEntryView => ({
    id,
    code: `H00${id}`,
    violationId: id,
    violationCode: `V00${id}`,
    violation,
    severity,
    section,
    description: `${violation} description`,
    sanctions: [],
  });
  const entries = [entry(1, 'Improper uniform', 'Minor', 'VI.D.1'), entry(2, 'Cheating', 'Major', 'VI.E.3')];

  test('matches violation, section and code case-insensitively', () => {
    expect(filterEntries(entries, 'UNIFORM', 'all').map((e) => e.id)).toEqual([1]);
    expect(filterEntries(entries, 'vi.e.3', 'all').map((e) => e.id)).toEqual([2]);
    expect(filterEntries(entries, 'h001', 'all').map((e) => e.id)).toEqual([1]);
  });

  test('filters by severity and combines with the query', () => {
    expect(filterEntries(entries, '', 'Major').map((e) => e.id)).toEqual([2]);
    expect(filterEntries(entries, 'uniform', 'Major')).toEqual([]);
  });
});
