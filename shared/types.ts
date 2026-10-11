
export type HealthResponse = {
  status: 'ok';
};

export type AccountRole = 'student' | 'staff';

/** The signed-in user as the API exposes it. Never carries a password hash. */
export type AuthUser = {
  role: AccountRole;
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  mustChangePassword: boolean;
};
