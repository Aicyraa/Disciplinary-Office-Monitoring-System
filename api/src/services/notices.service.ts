import { manilaToday } from '../views/me.views.js';
import type { NoticeStore } from '../repositories/notices/types.js';

export const MAX_NOTICE_TITLE = 120;
export const MAX_NOTICE_TEXT = 1000;

export type NoticeFailureCode = 'invalid_input' | 'not_found';
export interface NoticeFailure {
  ok: false;
  code: NoticeFailureCode;
  message: string;
}
export type NoticeResult<T> = ({ ok: true } & T) | NoticeFailure;

const fail = (code: NoticeFailureCode, message: string): NoticeFailure => ({ ok: false, code, message });

export interface NoticeService {
  publish(input: { employeeId: string; title: unknown; message: unknown; instructions?: unknown; expiresOn?: unknown }): Promise<
    NoticeResult<{ noticeId: number; recipients: number }>
  >;
  edit(input: { noticeId: number; title: unknown; message: unknown; instructions?: unknown; expiresOn?: unknown }): Promise<NoticeResult<unknown>>;
  remove(noticeId: number): Promise<NoticeResult<unknown>>;
}

function text(value: unknown, max: number, required: boolean): string | null | undefined {
  if (value === undefined || value === null) return required ? undefined : null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return required ? undefined : null;
  return trimmed.length <= max ? trimmed : undefined;
}

/** Message the students read: the message, then what they should do (when the office wrote that). */
export function inboxMessage(message: string, instructions: string | null): string {
  return instructions ? `${message}\n\nWhat to do: ${instructions}` : message;
}

export function createNoticeService({ store, now = () => new Date() }: { store: NoticeStore; now?: () => Date }): NoticeService {
  function parse(input: { title: unknown; message: unknown; instructions?: unknown; expiresOn?: unknown }) {
    const title = text(input.title, MAX_NOTICE_TITLE, true);
    if (typeof title !== 'string') return fail('invalid_input', `A title is required (up to ${MAX_NOTICE_TITLE} characters).`);
    const message = text(input.message, MAX_NOTICE_TEXT, true);
    if (typeof message !== 'string') return fail('invalid_input', `A message is required (up to ${MAX_NOTICE_TEXT} characters).`);
    const instructions = text(input.instructions, MAX_NOTICE_TEXT, false);
    if (instructions === undefined) return fail('invalid_input', `Instructions must be text up to ${MAX_NOTICE_TEXT} characters.`);

    let expiresOn: string | null = null;
    if (input.expiresOn !== undefined && input.expiresOn !== null && input.expiresOn !== '') {
      const raw = input.expiresOn;
      if (
        typeof raw !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(raw) ||
        new Date(`${raw}T00:00:00Z`).toISOString().slice(0, 10) !== raw
      ) {
        return fail('invalid_input', 'The expiry date must look like 2026-10-31.');
      }
      if (raw < manilaToday(now())) return fail('invalid_input', 'The expiry date cannot be in the past.');
      expiresOn = raw;
    }
    return { ok: true as const, title, message, instructions, expiresOn };
  }

  return {
    async publish({ employeeId, ...input }) {
      const parsed = parse(input);
      if (!parsed.ok) return parsed;
      const created = await store.create({
        title: parsed.title,
        message: parsed.message,
        instructions: parsed.instructions,
        expiresOn: parsed.expiresOn,
        employeeId,
        date: now(),
        inboxMessage: inboxMessage(parsed.message, parsed.instructions),
      });
      return { ok: true as const, noticeId: created.noticeId, recipients: created.recipients };
    },

    async edit({ noticeId, ...input }) {
      const parsed = parse(input);
      if (!parsed.ok) return parsed;
      const updated = await store.update(noticeId, {
        title: parsed.title,
        message: parsed.message,
        instructions: parsed.instructions,
        expiresOn: parsed.expiresOn,
        date: now(),
        inboxMessage: inboxMessage(parsed.message, parsed.instructions),
      });
      return updated ? { ok: true as const } : fail('not_found', 'Notice not found.');
    },

    async remove(noticeId) {
      return (await store.remove(noticeId)) ? { ok: true as const } : fail('not_found', 'Notice not found.');
    },
  };
}
