import type { NotificationKind } from '@shared/types.js';
import { emailDetails, type EmailDetails } from './details.js';

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

const FONT = "font-family:'Public Sans',Segoe UI,Arial,Helvetica,sans-serif;";

/** Escaped text with its line breaks kept. */
const textHtml = (text: string): string => escapeHtml(text).replace(/\r?\n/g, '<br>');

/** The message card's contents: the lead sentence, then one labelled line per detail (label left, value right). */
function detailsHtml({ lead, rows }: EmailDetails): string {
  const leadHtml = lead
    ? `<p style="margin:0${rows.length ? ' 0 12px' : ''};${FONT}font-size:15px;line-height:23px;color:#1C2445">${textHtml(lead)}</p>`
    : '';
  if (rows.length === 0) return leadHtml;
  const lines = rows
    .map(
      ([label, value], index) =>
        `<tr><td valign="top" width="130" style="padding:${index ? '8px' : '0'} 12px 0 0;${FONT}font-size:13px;line-height:21px;font-weight:600;color:#5B6576;white-space:nowrap">${escapeHtml(label)}</td>` +
        `<td valign="top" style="padding:${index ? '8px' : '0'} 0 0;${FONT}font-size:15px;line-height:21px;font-weight:700;color:#1C2445">${textHtml(value)}</td></tr>`,
    )
    .join('');
  return `${leadHtml}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${lines}</table>`;
}

/**
 * The branded email around the text (header band, title, message card, button). Email clients ignore most CSS,
 * so it is a full-width table with inline styles only and no images. Every value that comes from a person is
 * escaped by the caller.
 */
function emailHtml(parts: {
  preheader: string;
  greeting: string;
  intro: string;
  title: string;
  message: string;
  href: string | null;
}): string {
  const font = FONT;
  const button = parts.href
    ? '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0">' +
      `<tr><td bgcolor="#35408E" style="border-radius:10px">` +
      `<a href="${parts.href}" style="display:inline-block;padding:13px 26px;${font}font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:10px">Open in SDO Portal &rarr;</a>` +
      '</td></tr></table>'
    : '';
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light only"><title>SDO Portal</title></head>' +
    '<body style="margin:0;padding:0;background:#FFFFFF">' +
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${parts.preheader}</div>` +
    // Full width: no page colour, frame or rounded card around the email.
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="width:100%;background:#FFFFFF">' +
    // Header: navy band with the office name; a thin gold rule under it.
    `<tr><td bgcolor="#35408E" style="background:#35408E;padding:20px 28px;${font}color:#FFFFFF">` +
    '<div style="font-size:17px;font-weight:800;line-height:22px">Student Discipline Office</div>' +
    '<div style="font-size:13px;line-height:18px;color:#F2D46B;font-weight:600">NU Fairview &middot; SDO Portal</div>' +
    '</td></tr>' +
    '<tr><td bgcolor="#F2D46B" style="background:#F2D46B;height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>' +
    // Body.
    `<tr><td style="padding:28px;${font}color:#1C2445">` +
    `<h1 style="margin:0;font-size:22px;line-height:29px;font-weight:800;color:#1C2445">${parts.title}</h1>` +
    `<p style="margin:18px 0 0;font-size:15px;line-height:23px">${parts.greeting}</p>` +
    `<p style="margin:6px 0 0;font-size:15px;line-height:23px;color:#5B6576">${parts.intro}</p>` +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px">' +
    `<tr><td style="background:#F5F7FC;border-left:4px solid #35408E;border-radius:0 8px 8px 0;padding:16px 18px;${font}font-size:15px;line-height:23px;color:#1C2445">${parts.message}</td></tr>` +
    '</table>' +
    button +
    '</td></tr>' +
    '</table></body></html>'
  );
}

type Builder = (input: NotifyInput) => NotifyPayload;

function build(kind: NotificationKind): Builder {
  const { subjectPrefix, intro } = KIND_INTRO[kind];
  return (input) => {
    const href = safeHref(input.linkUrl);
    return {
      notification_id: input.notificationId,
      idempotency_key: input.idempotencyKey,
      channel: 'email',
      to: input.to.join(';'),
      cc: [],
      // A subject is one line: any line break in the title is flattened (header-injection defense in depth).
      subject: `[SDO Portal] ${subjectPrefix}: ${oneLine(input.title)}`.slice(0, 200),
      html_body: emailHtml({
        preheader: escapeHtml(oneLine(`${intro} ${input.title}`)),
        greeting: input.greetingName ? `Hi ${escapeHtml(input.greetingName)},` : 'Hello,',
        intro: escapeHtml(intro),
        title: escapeHtml(input.title),
        message: detailsHtml(emailDetails(input.message)),
        href: href ? escapeHtml(href) : null,
      }),
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
