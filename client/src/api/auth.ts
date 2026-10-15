import type { AuthUser } from '@shared/types';
import { del, get, http, post, request } from './client';

export const authApi = {
  login: (email: string, password: string) => post<{ user: AuthUser }>('/auth/login', { email, password }),
  logout: () => post<null>('/auth/logout'),
  me: () => get<{ user: AuthUser }>('/auth/me'),
  /** `currentPassword` null: the forced change right after a temporary-password sign-in (UI-POLISH-SPEC D1). */
  changePassword: (currentPassword: string | null, newPassword: string) =>
    post<{ user: AuthUser }>('/auth/change-password', currentPassword === null ? { newPassword } : { currentPassword, newPassword }),
  /** Your own profile picture (SPEC 4.8). Both answer with the refreshed user. */
  setAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ user: AuthUser }>(() => http.put('/me/avatar', form));
  },
  removeAvatar: () => del<{ user: AuthUser }>('/me/avatar'),
};
