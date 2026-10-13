import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import type { AuthUser } from '@shared/types';
import { resolveAccess } from '@/App';
import { AuthProvider } from '@/context/AuthContext';
import { StatusPill } from '@/components/ui';
import { navGroups } from '@/utils/nav';
import Login from '@/pages/public/Login';

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
      '/sanction-templates',
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
    expect(html).toContain('Forgot password?');
    expect(html).toContain('href="/report"');
    expect(html).toContain('NU FAIRVIEW');
    // The help text shows only after "Forgot password?" (deck W04); no extra office-hours line.
    expect(html).not.toContain('Room 204');
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
