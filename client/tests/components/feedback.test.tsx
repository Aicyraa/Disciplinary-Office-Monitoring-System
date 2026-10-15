import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { ConfirmModal, LockedButton, ToastView } from '@/components/feedback';

describe('ConfirmModal (UI-POLISH-SPEC 4.3)', () => {
  const base = { title: 'Reject GI-1042?', confirmLabel: 'Reject submission', onConfirm: () => undefined, onClose: () => undefined };

  test('renders nothing while closed', () => {
    expect(renderToStaticMarkup(<ConfirmModal {...base} open={false} />)).toBe('');
  });

  test('open: a labelled modal dialog with a tone icon, Cancel and the confirm action', () => {
    const html = renderToStaticMarkup(<ConfirmModal {...base} open />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Reject GI-1042?');
    expect(html).toContain('>help<');
    expect(html).toContain('>Cancel<');
    expect(html).not.toContain('<textarea');
  });

  test('danger tone: warning icon, a red filled confirm and the custom cancel label', () => {
    const html = renderToStaticMarkup(<ConfirmModal {...base} open tone="danger" cancelLabel="Keep reviewing" />);
    expect(html).toContain('>warning<');
    expect(html).toContain('bg-danger-soft');
    expect(html).toContain('bg-danger ');
    expect(html).toContain('>Keep reviewing<');
  });

  test('the old `danger` flag still means the danger tone', () => {
    expect(renderToStaticMarkup(<ConfirmModal {...base} open danger />)).toContain('>warning<');
  });

  test('ok tone: a green confirm', () => {
    const html = renderToStaticMarkup(<ConfirmModal {...base} open tone="ok" confirmLabel="Resolve case" />);
    expect(html).toContain('>task_alt<');
    expect(html).toContain('bg-success-strong');
  });

  test('a required reason: labelled field with the placeholder, confirm disabled until it has text', () => {
    const html = renderToStaticMarkup(
      <ConfirmModal
        {...base}
        open
        reasonLabel="Reason (saved to case history)"
        reasonPlaceholder="e.g. The ID entered did not match the student at the gate."
      />,
    );
    expect(html).toContain('<textarea');
    expect(html).toContain('Reason (saved to case history)');
    expect(html).toContain('placeholder="e.g. The ID entered did not match the student at the gate."');
    expect(html).toMatch(/<button type="submit" disabled=""[^>]*title="Add a reason first"/);
  });

  test('an optional reason does not block the confirm', () => {
    const html = renderToStaticMarkup(<ConfirmModal {...base} open reasonLabel="Remarks" reasonOptional />);
    expect(html).toContain('(optional)');
    expect(html).not.toMatch(/<button type="submit" disabled=""/);
  });

  test('a code block and a single acknowledgement button', () => {
    const html = renderToStaticMarkup(
      <ConfirmModal {...base} open tone="ok" title="Temporary password created" code="Temp-2861" confirmLabel="Done" hideCancel />,
    );
    expect(html).toContain('Temp-2861');
    expect(html).toContain('font-mono');
    expect(html).not.toContain('>Cancel<');
  });

  test('a bottom sheet on a phone, centred from 720 px', () => {
    const html = renderToStaticMarkup(<ConfirmModal {...base} open />);
    expect(html).toContain('rounded-t-[18px]');
    expect(html).toContain('rail:rounded-[14px]');
  });
});

describe('ToastView (dark bar, src 2086)', () => {
  test('a success toast: dark bar, gold check, polite status', () => {
    const html = renderToStaticMarkup(<ToastView tone="success" message="SDO-2026-016 resolved." onDismiss={() => undefined} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('bg-ink');
    expect(html).toContain('text-gold');
    expect(html).toContain('>check_circle<');
    expect(html).toContain('SDO-2026-016 resolved.');
  });

  test('an error toast: alert role, error icon and a dismiss button', () => {
    const html = renderToStaticMarkup(<ToastView tone="error" message="Something went wrong." onDismiss={() => undefined} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('>error<');
    expect(html).toContain('text-toast-error');
    expect(html).toContain('aria-label="Dismiss"');
  });
});

describe('LockedButton', () => {
  test('locked: says why, is aria-disabled and shows the lock', () => {
    const html = renderToStaticMarkup(<LockedButton lockedReason="Finish every requirement first.">Download clearance slip</LockedButton>);
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('Finish every requirement first.');
    expect(html).toContain('lock');
  });

  test('unlocked: a normal button', () => {
    const html = renderToStaticMarkup(<LockedButton>Download clearance slip</LockedButton>);
    expect(html).not.toContain('aria-disabled');
    expect(html).toContain('Download clearance slip');
  });
});
