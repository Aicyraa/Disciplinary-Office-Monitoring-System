/** Client-side limits that mirror the API (SPEC 4.3 / 6.1). The API stays the authority. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 5;
/** Files are PDF only so every file can be previewed inside the app (UI-POLISH-SPEC D7). */
export const ACCEPTED_EXTENSIONS = ['.pdf'] as const;
/** The `accept` attribute of every file input. */
export const ACCEPT_ATTRIBUTE = '.pdf,application/pdf';

export const notPdfMessage = (name: string): string => `${name} is not a PDF file.`;

const isPdfName = (name: string): boolean => ACCEPTED_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Returns a message for the first problem, or null when the selection can be sent. */
export function checkSelection(
  files: ReadonlyArray<{ name: string; size: number }>,
  existingCount: number,
): string | null {
  if (files.length === 0) return 'Choose at least one file.';
  if (existingCount + files.length > MAX_FILES) return `You can attach at most ${MAX_FILES} files.`;
  for (const file of files) {
    if (!isPdfName(file.name)) return notPdfMessage(file.name);
    if (file.size === 0) return `${file.name} is empty.`;
    if (file.size > MAX_FILE_BYTES) return `${file.name} is larger than 10 MB.`;
  }
  return null;
}

/**
 * Picking or dropping files: keep the good ones, drop the rest and name the first problem (deck W71: a wrong file
 * is rejected inline and the other files stay). `existingCount` is what is already chosen or attached.
 */
export function splitSelection<T extends { name: string; size: number }>(
  files: ReadonlyArray<T>,
  existingCount: number,
): { accepted: T[]; error: string | null } {
  const accepted: T[] = [];
  let error: string | null = null;
  for (const file of files) {
    const problem = !isPdfName(file.name)
      ? notPdfMessage(file.name)
      : file.size === 0
        ? `${file.name} is empty.`
        : file.size > MAX_FILE_BYTES
          ? `${file.name} is larger than 10 MB.`
          : existingCount + accepted.length >= MAX_FILES
            ? `You can upload up to ${MAX_FILES} files.`
            : null;
    if (problem === null) accepted.push(file);
    else error ??= problem;
  }
  return { accepted, error };
}

/** Add days to a YYYY-MM-DD calendar day (UTC arithmetic, so no time zone can shift it). */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Today in Asia/Manila as YYYY-MM-DD. */
export function manilaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Whole percent of the bytes sent so far (0-100), or null when the browser cannot tell the total. */
export function progressPercent(loaded: number, total: number | undefined): number | null {
  if (!total || total <= 0) return null;
  return Math.min(100, Math.max(0, Math.floor((loaded / total) * 100)));
}

/** What the main upload button says: what it will do, or how far the upload is. */
export function uploadButtonLabel({ count, busy, percent }: { count: number; busy: boolean; percent: number | null }): string {
  if (busy) {
    if (percent === null) return 'Uploading…';
    return percent >= 100 ? 'Processing…' : `Uploading… ${percent}%`;
  }
  if (count === 0) return 'Add a file to submit';
  return `Upload ${count} file${count === 1 ? "" : "s"}`;
}
