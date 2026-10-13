import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { StudentLookup } from '@/components/ui/StudentLookup';
import { Textarea } from '@/components/ui/Textarea';

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

test('Button is a pill by default and a plain type=button', () => {
  const out = html(createElement(Button, null, 'Save'));
  expect(out).toContain('type="button"');
  expect(out).toContain('rounded-full');
  expect(out).toContain('bg-primary');
  expect(out).toContain('>Save<');
});

test('Button variants change the look', () => {
  expect(html(createElement(Button, { variant: 'secondary' }, 'x'))).toContain('border-primary');
  expect(html(createElement(Button, { variant: 'danger' }, 'x'))).toContain('border-danger-strong');
  expect(html(createElement(Button, { variant: 'success' }, 'x'))).toContain('bg-success-strong');
  expect(html(createElement(Button, { variant: 'gold' }, 'x'))).toContain('bg-gold');
  expect(html(createElement(Button, { variant: 'neutral' }, 'x'))).toContain('border-line-strong');
});

test('Button size sets the height', () => {
  expect(html(createElement(Button, { size: 'sm' }, 'x'))).toContain('min-h-[34px]');
  expect(html(createElement(Button, { size: 'xxl' }, 'x'))).toContain('min-h-[50px]');
});

test('busy Button locks, shows the busy label and a spinner', () => {
  const out = html(createElement(Button, { busy: true, busyLabel: 'Signing in…' }, 'Sign in'));
  expect(out).toContain('disabled=""');
  expect(out).toContain('aria-busy="true"');
  expect(out).toContain('Signing in…');
  expect(out).not.toContain('>Sign in<');
  expect(out).toContain('animate-spin');
});

test('busy filled Buttons keep white text and spinner over the disabled look', () => {
  expect(html(createElement(Button, { busy: true }, 'Save'))).toContain('aria-busy:text-white');
  expect(html(createElement(Button, { busy: true, variant: 'success' }, 'Save'))).toContain('aria-busy:text-white');
});

test('busy Button says Saving… by default', () => {
  expect(html(createElement(Button, { busy: true }, 'Save'))).toContain('Saving…');
});

test('disabled Button explains why and uses the disabled look', () => {
  const out = html(createElement(Button, { disabled: true, disabledReason: 'Add a reason first' }, 'Reject'));
  expect(out).toContain('disabled=""');
  expect(out).toContain('title="Add a reason first"');
  expect(out).toContain('bg-disabled-bg');
});

test('Field links the label and shows no error by default', () => {
  const out = html(createElement(Field, { label: 'Student ID', id: 'sid' }));
  expect(out).toContain('<label');
  expect(out).toContain('for="sid"');
  expect(out).toContain('id="sid"');
  expect(out).not.toContain('aria-invalid');
});

test('Field with an error is invalid, red and describes itself with the message', () => {
  const out = html(createElement(Field, { label: 'Student ID', id: 'sid', error: 'Enter your student ID.' }));
  expect(out).toContain('aria-invalid="true"');
  expect(out).toContain('border-danger-strong');
  expect(out).toContain('aria-describedby="sid-error"');
  expect(out).toContain('id="sid-error"');
  expect(out).toContain('Enter your student ID.');
  expect(out).toContain('>error<');
});

test('Field generates an id when none is given', () => {
  const out = html(createElement(Field, { label: 'Name' }));
  expect(out).toMatch(/for="([^"]+)"/);
});

test('Select renders its options with the same label and error rules', () => {
  const out = html(
    createElement(
      Select,
      { label: 'Program', id: 'p', error: 'Choose your program.' },
      createElement('option', { value: '' }, 'Choose your program'),
    ),
  );
  expect(out).toContain('<select');
  expect(out).toContain('for="p"');
  expect(out).toContain('aria-invalid="true"');
  expect(out).toContain('Choose your program.');
});

test('Textarea renders a labelled textarea', () => {
  const out = html(createElement(Textarea, { label: 'Reason', id: 'r', rows: 3 }));
  expect(out).toContain('<textarea');
  expect(out).toContain('for="r"');
});

test('Alert tones set the role and icon', () => {
  const error = html(createElement(Alert, { tone: 'error', children: 'No match' }));
  expect(error).toContain('role="alert"');
  expect(error).toContain('bg-danger-soft');
  expect(error).toContain('>error<');
  const info = html(createElement(Alert, { tone: 'info', children: 'FYI' }));
  expect(info).toContain('role="status"');
  expect(info).toContain('bg-info-soft');
  expect(info).toContain('>info<');
  expect(html(createElement(Alert, { tone: 'warning', children: 'w' }))).toContain('bg-warn-soft');
  expect(html(createElement(Alert, { tone: 'success', children: 's' }))).toContain('bg-success-soft');
});

test('Alert accepts a custom icon', () => {
  expect(html(createElement(Alert, { tone: 'error', icon: 'wifi_off', children: 'x' }))).toContain('>wifi_off<');
});

test('StudentLookup shows the found student in green', () => {
  const out = html(
    createElement(StudentLookup, {
      label: 'Student ID',
      id: 'lookup',
      value: '2025-1234567',
      onChange: () => undefined,
      lookup: { status: 'found', summary: 'Juan Dela Cruz · BSIT 3rd Year' },
    }),
  );
  expect(out).toContain('Juan Dela Cruz · BSIT 3rd Year');
  expect(out).toContain('person_check');
  expect(out).toContain('text-success');
  expect(out).toContain('aria-live="polite"');
});

test('StudentLookup shows the exact not-found line in red', () => {
  const out = html(
    createElement(StudentLookup, {
      label: 'Student ID',
      id: 'lookup',
      value: '2025-0000000',
      onChange: () => undefined,
      lookup: { status: 'not_found' },
    }),
  );
  expect(out).toContain('No student found with that ID.');
  expect(out).toContain('text-danger');
});

test('StudentLookup shows nothing under the field while idle', () => {
  const out = html(
    createElement(StudentLookup, {
      label: 'Student ID',
      id: 'lookup',
      value: '',
      onChange: () => undefined,
      lookup: { status: 'idle' },
    }),
  );
  expect(out).not.toContain('person_check');
  expect(out).not.toContain('No student found');
});
