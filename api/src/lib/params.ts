/** A positive whole number from a path parameter (at most 9 digits), or null. Shared by every router. */
export function parseId(value: unknown): number | null {
  return typeof value === 'string' && /^\d{1,9}$/.test(value) ? Number(value) : null;
}
