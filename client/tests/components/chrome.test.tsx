import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { AccountDetailsModal, ChangePasswordModal, PasswordRuleList } from '@/components/account/AccountModals';
import { BellRow } from '@/components/layout/BellPopover';
import { Sidebar } from '@/components/layout/Sidebar';
import { AuthProvider } from '@/context/AuthContext';
import { navGroups } from '@/utils/nav';

const at = (path: string, node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>);

describe('Sidebar (deck src 264)', () => {
  const props = { groups: navGroups('staff'), countFor: () => 0, role: 'staff' as const };

  test('full width: 264 px, gold right edge, the portal label and sentence-case group labels', () => {
    const html = at('/cases', <Sidebar {...props} labels />);
    expect(html).toContain('w-[264px]');
    expect(html).toContain('border-r-4 border-gold');
    expect(html).toContain('Student Discipline Office · Staff');
    expect(html).toContain('>Manage<');
    expect(html).not.toContain('uppercase');
  });

  test('the current page: dark background, a gold bar and a gold filled icon', () => {
    const html = at('/cases', <Sidebar {...props} labels />);
    expect(html).toMatch(/aria-current="page"[^>]*bg-primary-active/);
    expect(html).toContain('w-[3px] rounded-r-[3px] bg-gold');
    expect(html).toMatch(/FILL&quot;_1\]? text-gold/);
  });

  test('rail: 80 px, no labels, dividers, and the count as a small gold chip', () => {
    const html = at('/', <Sidebar {...props} labels={false} countFor={(item) => (item.badge === 'cases' ? 6 : 0)} />);
    expect(html).toContain('w-20');
    expect(html).not.toContain('>Manage<');
    expect(html).toContain('h-px bg-white/16');
    expect(html).toContain('aria-label="6 waiting"');
    expect(html).toContain('absolute top-1.5 right-2.5');
  });

  test('the templates entry is current on its own page and Violations is not', () => {
    const html = at('/sanction-templates', <Sidebar {...props} labels />);
    expect(html).toMatch(/title="Sanction templates"[^>]*bg-primary-active|bg-primary-active[^>]*title="Sanction templates"/);
    expect(html).not.toMatch(/title="Violations"[^>]*bg-primary-active/);
  });
});

describe('BellRow (deck src 343)', () => {
  test('an unread appointment: tinted icon, bold title, time and the unread dot', () => {
    const html = renderToStaticMarkup(
      <BellRow
        item={{ id: 1, kind: 'appt', title: 'New appointment assigned', message: 'An appointment has been scheduled.', isRead: false, dateCreated: '2026-10-07T07:15:00.000Z', href: '/appointments/4' }}
        onOpen={() => undefined}
      />,
    );
    expect(html).toContain('>event<');
    expect(html).toContain('bg-info-soft');
    expect(html).toContain('font-bold');
    expect(html).toContain('Wed, Oct 7 · 3:15 PM');
    expect(html).toContain('bg-primary');
    expect(html).toContain('aria-label="Unread. New appointment assigned. An appointment has been scheduled."');
  });
});

describe('account dialogs (deck W83 to W85)', () => {
  const user = { role: 'staff' as const, id: 'E001', email: 'am@nu-fairview.edu.ph', firstName: 'Andrea', lastName: 'Marcelo', mustChangePassword: false };

  test('Account details: initials, name, rows, the correction note and Change password', () => {
    const html = renderToStaticMarkup(<AccountDetailsModal open user={user} onClose={() => undefined} onChangePassword={() => undefined} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('>AM<');
    expect(html).toContain('Andrea Marcelo');
    expect(html).toContain('First name');
    expect(html).toContain('SDO Officer');
    expect(html).toContain('To correct these details, contact the Student Discipline Office.');
    expect(html).toContain('>Change password<');
  });

  test('Change password: three fields, the live rules, Cancel and Change password', () => {
    const html = renderToStaticMarkup(
      <AuthProvider>
        <ChangePasswordModal open onClose={() => undefined} />
      </AuthProvider>,
    );
    expect(html).toContain('Current password');
    expect(html).toContain('New password');
    expect(html).toContain('Confirm new password');
    expect(html).toContain('At least 8 characters');
    expect(html).toContain('>Cancel<');
  });

  test('the rule list ticks a met rule', () => {
    const html = renderToStaticMarkup(<PasswordRuleList password="abcdefgh" />);
    expect(html).toContain('>check_circle<');
    expect(html).toContain('>radio_button_unchecked<');
  });
});
