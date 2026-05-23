import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { generateToken } from './auth';

export function configurePassport() {
  // ── Local Strategy ───────────────────────────────────────────────────────
  passport.use(
    new LocalStrategy(
      { usernameField: 'email', passwordField: 'password' },
      async (email, password, done) => {
        try {
          const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
          if (!user || !user.passwordHash) {
            return done(null, false, { message: 'Invalid email or password' });
          }
          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) {
            return done(null, false, { message: 'Invalid email or password' });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  // ── Google OAuth Strategy ────────────────────────────────────────────────
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: '/api/auth/google/callback',
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('No email from Google'));

            let user = await prisma.user.findFirst({
              where: { OR: [{ provider: 'google', providerId: profile.id }, { email }] },
            });

            if (!user) {
              user = await prisma.user.create({
                data: {
                  email,
                  name: profile.displayName,
                  avatarUrl: profile.photos?.[0]?.value,
                  provider: 'google',
                  providerId: profile.id,
                },
              });
            } else if (user.provider !== 'google') {
              // Link Google to existing account
              user = await prisma.user.update({
                where: { id: user.id },
                data: { provider: 'google', providerId: profile.id, avatarUrl: profile.photos?.[0]?.value },
              });
            }

            return done(null, user);
          } catch (err) {
            return done(err as Error);
          }
        },
      ),
    );
  }
}
