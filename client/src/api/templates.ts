import type { SanctionTemplateView } from '@shared/types';
import { progressPercent } from '@/utils/files';
import { get, del, request, http } from './client';

export const templatesApi = {
  sanctionTemplates: () => get<{ templates: SanctionTemplateView[] }>('/sanction-templates'),
  saveTemplateText: (sanctionId: number, input: { title: string; description: string; requirements: string }) =>
    request<{ ok: true }>(() => http.put(`/sanction-templates/${sanctionId}`, input)),
  uploadTemplateFiles: (sanctionId: number, files: File[], onProgress?: (percent: number) => void) => {
    const form = new FormData();
    for (const file of files) form.append('files', file);
    return request<{ fileIds: number[] }>(() =>
      http.post(`/sanction-templates/${sanctionId}/files`, form, {
        onUploadProgress: (event) => {
          const percent = progressPercent(event.loaded, event.total);
          if (percent !== null) onProgress?.(percent);
        },
      }),
    );
  },
  deleteTemplateFile: (fileId: number) => del<{ ok: true }>(`/sanction-templates/files/${fileId}`),
  templateFileUrl: (fileId: number) =>
    get<{ url: string; expiresInSeconds: number }>(`/sanction-templates/files/${fileId}/url`),
};
