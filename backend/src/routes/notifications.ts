import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// ── List ───────────────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(notifications);
  } catch {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// ── Unread count ───────────────────────────────────────────────────────────────
router.get('/unread-count', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.userId, read: false },
    });
    res.json({ count });
  } catch {
    res.status(500).json({ error: 'Failed to count notifications' });
  }
});

// ── Mark as read ───────────────────────────────────────────────────────────────
router.patch('/:id/read', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.userId },
      data: { read: true },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// ── Mark all read ──────────────────────────────────────────────────────────────
router.patch('/read-all', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.userId, read: false },
      data: { read: true },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// ── Delete ─────────────────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.deleteMany({
      where: { id: req.params.id, userId: req.userId },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

export default router;
