const SUFFIX = 'SDO Portal';

/** The browser tab title for a page: its heading, then the portal name ("My Violations · SDO Portal"). */
export function pageTitle(heading: string): string {
  const text = heading.trim();
  return text === '' ? SUFFIX : `${text} · ${SUFFIX}`;
}
