/**
 * pg v9 treats `sslmode=prefer|require|verify-ca` as aliases for `verify-full` and prints a security warning at
 * startup. Writing `verify-full` ourselves keeps the exact same behavior and silences the warning. A URL that
 * opts into the libpq semantics (`uselibpqcompat`) or already says something else is left alone.
 */
export function withExplicitSsl(connectionString: string): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return connectionString;
  }
  if (url.searchParams.has('uselibpqcompat')) return connectionString;
  const mode = url.searchParams.get('sslmode');
  if (mode === 'prefer' || mode === 'require' || mode === 'verify-ca') {
    url.searchParams.set('sslmode', 'verify-full');
    return url.toString();
  }
  return connectionString;
}
