import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import passport from 'passport';
import { prisma } from '../lib/prisma';
import { generateToken, requireAuth, AuthRequest } from '../middleware/auth';
import { sendEmail, welcomeEmail } from '../services/email';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Valid email is required' }); return;
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' }); return;
    }
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) { res.status(409).json({ error: 'Email already in use' }); return; }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email: email.toLowerCase(), passwordHash, name: typeof name === 'string' ? name.trim() : null, provider: 'local' },
      select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true },
    });
    const token = generateToken(user.id, user.email);

    // Welcome email (non-blocking)
    const tmpl = welcomeEmail(user.name || '');
    sendEmail({ to: user.email, ...tmpl }).catch(() => {});

    // Welcome notification
    prisma.notification.create({ data: { userId: user.id, title: 'Welcome to AppForge!', message: 'Create your first app by clicking "New App".', type: 'info' } }).catch(() => {});

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', (req: Request, res: Response, next) => {
  passport.authenticate('local', { session: false }, (err: Error, user: { id: string; email: string; name: string | null } | false, info: { message: string }) => {
    if (err) return next(err);
    if (!user) { res.status(401).json({ error: info?.message || 'Invalid credentials' }); return; }
    const token = generateToken(user.id, user.email);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  })(req, res, next);
});

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=oauth' }),
  (req: Request, res: Response) => {
    const user = req.user as { id: string; email: string } | undefined;
    if (!user) { res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth`); return; }
    const token = generateToken(user.id, user.email);
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  },
);

router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, avatarUrl: true, provider: true, createdAt: true },
    });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch { res.status(500).json({ error: 'Failed to fetch user' }); }
});

router.patch('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { ...(name !== undefined && { name: String(name).trim() }) },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
    res.json(user);
  } catch { res.status(500).json({ error: 'Failed to update profile' }); }
});

router.post('/change-password', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) { res.status(400).json({ error: 'New password must be at least 8 characters' }); return; }
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    if (user.passwordHash) {
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) { res.status(401).json({ error: 'Current password is incorrect' }); return; }
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.userId }, data: { passwordHash } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed to change password' }); }
});

export default router;
