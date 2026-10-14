import type { SanctionAssignmentOptions } from '@shared/types';
import { progressPercent } from '@/utils/files';
import { get, post, del, request, http } from './client';

export const sanctionsApi = {
  // Sanctions and proof files (SPEC 4.3, 6.1)
  sanctionOptions: (caseId: number) => get<{ options: SanctionAssignmentOptions }>(`/cases/${caseId}/sanction-options`),
  assignSanction: (caseId: number, sanctionId: number, dueDate: string, staffNote: string) =>
    post<{ caseSanctionId: number }>(`/cases/${caseId}/sanctions`, { sanctionId, dueDate, staffNote }),
  verifySanction: (caseSanctionId: number) => post<{ ok: true }>(`/case-sanctions/${caseSanctionId}/verify`),
  returnSanction: (caseSanctionId: number, reason: string) =>
    post<{ ok: true }>(`/case-sanctions/${caseSanctionId}/return`, { reason }),
  /** `onProgress` receives the whole percent of the request body sent so far (0-100). */
  uploadProof: (caseSanctionId: number, files: File[], replaceFileId?: number, onProgress?: (percent: number) => void) => {
    const form = new FormData();
    form.append('caseSanctionId', String(caseSanctionId));
    if (replaceFileId !== undefined) form.append('replaceFileId', String(replaceFileId));
    for (const file of files) form.append('files', file);
    return request<{ fileIds: number[] }>(() =>
      http.post('/files', form, {
        onUploadProgress: (event) => {
          const percent = progressPercent(event.loaded, event.total);
          if (percent !== null) onProgress?.(percent);
        },
      }),
    );
  },
  deleteProofFile: (fileId: number) => del(`/files/${fileId}`),
  fileUrl: (fileId: number) => get<{ url: string; expiresInSeconds: number }>(`/files/${fileId}/url`),
};
