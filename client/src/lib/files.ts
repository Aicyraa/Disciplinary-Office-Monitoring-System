/** Client-side limits that mirror the API (SPEC 4.3 / 6.1). The API stays the authority. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 5;
export const ACCEPTED_EXTENSIONS = ['.pdf', '.docx'] as const;

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
    const lower = file.name.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) return `${file.name}: only PDF or DOCX files are accepted.`;
    if (file.size === 0) return `${file.name} is empty.`;
    if (file.size > MAX_FILE_BYTES) return `${file.name} is larger than 10 MB.`;
  }
  return null;
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
