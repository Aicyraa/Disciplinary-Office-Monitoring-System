import { MAX_FILES, MAX_FILE_BYTES, isPdfName, notPdfMessage } from '@/utils/files';

/** Returns a message for the first problem, or null when the selection can be sent. */
export function checkSelection(
  files: ReadonlyArray<{ name: string; size: number }>,
  existingCount: number,
): string | null {
  if (files.length === 0) return 'Choose at least one file.';
  if (existingCount + files.length > MAX_FILES) return 'You can upload only one file per sanction.';
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
            ? 'You can upload only one file per sanction.'
            : null;
    if (problem === null) accepted.push(file);
    else error ??= problem;
  }
  return { accepted, error };
}
