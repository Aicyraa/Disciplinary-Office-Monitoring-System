import { Passport } from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import type { AccountRole } from '@shared/types.js';
import type { AuthService } from '../services/auth.service.js';

/**
 * A Passport instance of our own (not the global one): email + password strategy, and the session key
 * `<role>:<id>` so a student and a staff member can never share a key (SPEC 4.8).
 */
export type Authenticator = InstanceType<typeof Passport>;

export function createAuthenticator(service: AuthService): Authenticator {
  const authenticator = new Passport();

  authenticator.use(
    new LocalStrategy({ usernameField: 'email', passwordField: 'password' }, (email, password, done) => {
      // JSON can carry objects or arrays here; anything but strings is just a failed login.
      if (typeof email !== 'string' || typeof password !== 'string') return done(null, false);
      service.login(email, password).then(
        (user) => done(null, user ?? false),
        (error: unknown) => done(error),
      );
    }),
  );
  authenticator.serializeUser((user, done) => done(null, `${user.role}:${user.id}`));
  authenticator.deserializeUser((key: string, done) => {
    const [role, ...rest] = key.split(':');
    if (role !== 'student' && role !== 'staff') return done(null, false);
    service.getUser(role as AccountRole, rest.join(':')).then(
      (user) => done(null, user ?? false),
      (error: unknown) => done(error),
    );
  });

  return authenticator;
}
