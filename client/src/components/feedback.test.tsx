import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { ConfirmModal, LockedButton } from './feedback';
import { LoadingState } from './ui';

describe('ConfirmModal', () => {
  const base = { title: 'Reject this report', confirmLabel: 'Reject', onConfirm: () => undefined, onClose: () => undefined };

  test('renders nothing while closed', () => {
    expect(renderToStaticMarkup(<ConfirmModal {...base} open={false} />)).toBe('');
  });

  test('open: a labelled modal dialog with Cancel and the confirm action', () => {
    const html = renderToStaticMarkup(<ConfirmModal {...base} open />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Reject this report');
    expect(html).toContain('Cancel');
    expect(html).not.toContain('<textarea');
  });

  test('with a reason label the field is present and labelled', () => {
    const html = renderToStaticMarkup(<ConfirmModal {...base} open reasonLabel="Reason for rejecting" />);
    expect(html).toContain('<textarea');
    expect(html).toContain('Reason for rejecting');
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

describe('LoadingState', () => {
  test('placeholder cards with the label kept for screen readers', () => {
    const html = renderToStaticMarkup(<LoadingState label="Loading cases…" cards={2} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('Loading cases…');
    expect(html.match(/animate-pulse/g)).toHaveLength(2);
  });
});
