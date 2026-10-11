/** Workbook display codes (V001, S001, C001): a letter plus the id padded to 3 digits. Derived, never stored. */
export function displayCode(prefix: 'V' | 'H' | 'S' | 'C', id: number): string {
  return `${prefix}${String(id).padStart(3, '0')}`;
}
