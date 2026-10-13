import type { NotificationKind } from '@shared/types.js';

/** The `payload` of every Flow 2 request. Plain data only: built here, never from request bodies or DB rows. */
export interface NotifyPayload {
  notification_id: number;
  idempotency_key: string;
  channel: 'email';
  /** One address, or several separated by ";" (what Power Automate's "To" field takes). */
  to: string;
  cc: string[];
  subject: string;
  html_body: string;
  link_url: string | null;
}

export interface NotifyInput {
  notificationId: number;
  idempotencyKey: string;
  title: string;
  message: string;
  /** Absolute URL of the page this opens, or null. */
  linkUrl: string | null;
  /** Recipient addresses; at least one. */
  to: string[];
  /** First name for the greeting, or null for a group (all staff). */
  greetingName: string | null;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const LINE_BREAKS: ReadonlySet<number> = new Set([10, 13, 0x2028, 0x2029]);

/** One line of text: every line-break character becomes a space, so a value can never start a second header. */
export function oneLine(text: string): string {
  let result = '';
  let inBreak = false;
  for (const character of text) {
    if (LINE_BREAKS.has(character.codePointAt(0) ?? -1)) {
      // A run of breaks (CR LF, blank lines) is one space.
      if (!inBreak) result += ' ';
      inBreak = true;
    } else {
      result += character;
      inBreak = false;
    }
  }
  return result;
}

/** Only http(s) links go into an email, whatever the configuration says. */
function safeHref(url: string | null): string | null {
  if (url === null) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** Subject and a short intro per kind, so the email says what kind of update it is at a glance. */
const KIND_INTRO: Record<NotificationKind, { subjectPrefix: string; intro: string }> = {
  report: { subjectPrefix: 'Report', intro: 'A violation report was received.' },
  case: { subjectPrefix: 'Case update', intro: 'There is an update on one of your cases.' },
  esc: { subjectPrefix: 'Escalation', intro: 'A case was treated as a Major offense.' },
  sanction: { subjectPrefix: 'Sanction', intro: 'There is an update on a sanction.' },
  appt: { subjectPrefix: 'Appointment', intro: 'There is an update on an SDO appointment.' },
  clr: { subjectPrefix: 'Clearance', intro: 'There is an update on your clearance.' },
  account: { subjectPrefix: 'Account', intro: 'There is a change to your account.' },
  newviol: { subjectPrefix: 'New violation', intro: 'A violation was recorded.' },
  notice: { subjectPrefix: 'Important notice', intro: 'The SDO office posted an important notice for students.' },
};

type Builder = (input: NotifyInput) => NotifyPayload;

function build(kind: NotificationKind): Builder {
  const { subjectPrefix, intro } = KIND_INTRO[kind];
  return (input) => {
    const href = safeHref(input.linkUrl);
    const greeting = input.greetingName ? `Hi ${escapeHtml(input.greetingName)},` : 'Hello,';
    const link = href
      ? `<p><a href="${escapeHtml(href)}">Open it in the SDO Portal</a></p>`
      : '';
    return {
      notification_id: input.notificationId,
      idempotency_key: input.idempotencyKey,
      channel: 'email',
      to: input.to.join(';'),
      cc: [],
      // A subject is one line: any line break in the title is flattened (header-injection defense in depth).
      subject: `[SDO Portal] ${subjectPrefix}: ${oneLine(input.title)}`.slice(0, 200),
      html_body:
        `<p>${greeting}</p>` +
        `<p>${escapeHtml(intro)}</p>` +
        `<p><strong>${escapeHtml(input.title)}</strong><br>${escapeHtml(input.message).replace(/\r?\n/g, '<br>')}</p>` +
        link +
        '<p style="color:#5B6576;font-size:12px">NU Fairview Student Discipline Office. This is an automatic message; do not reply.</p>',
      link_url: href,
    };
  };
}

/**
 * One pure builder per notification kind (POWER-AUTOMATE.md section 4, rule 2). `Record<NotificationKind, ...>`
 * means adding a kind to the shared union fails the build until it has a builder.
 */
export const notifyPayloadBuilders: Record<NotificationKind, Builder> = {
  report: build('report'),
  case: build('case'),
  esc: build('esc'),
  sanction: build('sanction'),
  appt: build('appt'),
  clr: build('clr'),
  account: build('account'),
  newviol: build('newviol'),
  notice: build('notice'),
};

export function buildNotifyPayload(kind: NotificationKind, input: NotifyInput): NotifyPayload {
  return notifyPayloadBuilders[kind](input);
}
