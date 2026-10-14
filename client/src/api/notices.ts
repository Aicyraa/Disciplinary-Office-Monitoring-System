import type { NoticeListResponse } from '@shared/types';
import { get, post, patch, del } from './client';

export const noticesApi = {
  // Notices (staff): broadcast, edit, remove
  notices: () => get<NoticeListResponse>('/notices'),
  publishNotice: (input: { title: string; message: string; instructions?: string; expiresOn?: string }) =>
    post<{ noticeId: number; recipients: number }>('/notices', input),
  editNotice: (id: number, input: { title: string; message: string; instructions?: string; expiresOn?: string }) =>
    patch<{ ok: true }>(`/notices/${id}`, input),
  removeNotice: (id: number) => del<{ ok: true }>(`/notices/${id}`),
};
