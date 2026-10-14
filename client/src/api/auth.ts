import type { AuthUser } from '@shared/types';
import { get, post } from './client';

export const authApi = {
  login: (email: string, password: string) => post<{ user: AuthUser }>('/auth/login', { email, password }),
  logout: () => post<null>('/auth/logout'),
  me: () => get<{ user: AuthUser }>('/auth/me'),
  /** `currentPassword` null: the forced change right after a temporary-password sign-in (UI-POLISH-SPEC D1). */
  changePassword: (currentPassword: string | null, newPassword: string) =>
    post<{ user: AuthUser }>('/auth/change-password', currentPassword === null ? { newPassword } : { currentPassword, newPassword }),
};
