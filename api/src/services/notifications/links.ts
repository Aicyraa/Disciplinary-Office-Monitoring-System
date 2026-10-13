import type { AccountRole, NotificationLinkType } from '@shared/types.js';

/**
 * The page a notification points to (`link_type` + `link_id`), as an app path. One mapping serves the inbox and
 * the email link, so they can never disagree. Returns null when there is nothing sensible to open.
 *
 * Students and staff have different screens for the same thing: a case is /violations/:id for the student and
 * /cases/:id for staff. A sanction has no page of its own for staff (it lives on the case page), so staff
 * notifications about sanctions are stored as case links by the code that writes them.
 */
export function linkPath(
  audience: AccountRole,
  linkType: NotificationLinkType | null,
  linkId: number | null,
): string | null {
  if (linkType === null) return null;
  const id = linkId !== null && Number.isInteger(linkId) && linkId > 0 ? linkId : null;

  if (audience === 'student') {
    switch (linkType) {
      case 'case':
        return id === null ? '/violations' : `/violations/${id}`;
      case 'sanction':
        return '/sanctions';
      case 'appointment':
        return '/appointments';
      case 'clearance':
        return '/clearance';
      case 'inbox':
        return '/inbox';
      default:
        return null;
    }
  }

  switch (linkType) {
    case 'case':
      return id === null ? '/cases' : `/cases/${id}`;
    case 'inbox':
      return '/inbox';
    case 'sanction':
      // No staff page per sanction; the case list is the nearest honest destination.
      return '/cases';
    default:
      return null;
  }
}
