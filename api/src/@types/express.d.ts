import type { AccountRole } from '@shared/types.js';

declare global {
  // Passport's documented way to type req.user; a namespace is the only form that merges.
  namespace Express {
    // Passport stores the signed-in AuthUser on req.user.
    interface User {
      role: AccountRole;
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      mustChangePassword: boolean;
    }
  }
}
