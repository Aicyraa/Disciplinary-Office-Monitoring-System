import { useEffect, useState } from 'react';
import type { StudentProfileView } from '@shared/types';
import { toApiError } from '@/api/client';
import { studentsApi } from '@/api/students';
import type { LookupState } from '@/components/ui/StudentLookup';
import { ordinalYear } from '@/utils/account';
import { STUDENT_ID_PATTERN } from '@/validators/studentId';

/**
 * Live "Maria Santos · BSN 2nd Year" under a student ID field (deck src 2790). Asks the staff student endpoint
 * once the ID is complete, a short moment after typing stops; the API owns the answer.
 */
export function useStudentLookup(rawId: string): { lookup: LookupState; profile: StudentProfileView | null } {
  const id = rawId.trim();
  const [state, setState] = useState<{ id: string; lookup: LookupState; profile: StudentProfileView | null }>({
    id: '',
    lookup: { status: 'idle' },
    profile: null,
  });

  useEffect(() => {
    if (!STUDENT_ID_PATTERN.test(id)) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setState({ id, lookup: { status: 'checking' }, profile: null });
      studentsApi.student(id).then(
        ({ profile }) => {
          if (!cancelled) {
            setState({ id, lookup: { status: 'found', summary: `${profile.firstName} ${profile.lastName} · ${profile.program} ${ordinalYear(profile.yearLevel)}` }, profile });
          }
        },
        (error: unknown) => {
          if (cancelled) return;
          setState({ id, lookup: toApiError(error).status === 404 ? { status: 'not_found' } : { status: 'idle' }, profile: null });
        },
      );
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id]);

  // An incomplete ID, or one the answer is not about yet, shows nothing.
  if (!STUDENT_ID_PATTERN.test(id) || state.id !== id) return { lookup: { status: 'idle' }, profile: null };
  return { lookup: state.lookup, profile: state.profile };
}
