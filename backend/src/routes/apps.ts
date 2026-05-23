import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validateAndSanitizeConfig } from '../utils/configValidator';
import { AppConfig } from '../types/config';

const router = Router();

// ── List apps ─────────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const apps = await prisma.app.findMany({
      where: { userId: req.userId },
      select: {
        id: true, slug: true, createdAt: true, updatedAt: true,
        config: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const result = apps.map((app) => {
      const config = app.config as AppConfig;
      return {
        id: app.id,
        slug: app.slug,
        name: config.name,
        description: config.description,
        entityCount: config.entities?.length || 0,
        pageCount: config.pages?.length || 0,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch apps' });
  }
});

// ── Create app ────────────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const raw = req.body;
    const { config, warnings, errors, isValid } = validateAndSanitizeConfig(raw);

    if (!isValid) {
      res.status(400).json({ error: 'Invalid config', details: errors });
      return;
    }

    // Generate unique slug
    const baseSlug = slugify(config.name);
    let slug = baseSlug;
    let attempt = 0;
    while (await prisma.app.findUnique({ where: { slug } })) {
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    const app = await prisma.app.create({
      data: {
        slug,
        config: config as object,
        userId: req.userId!,
      },
    });

    res.status(201).json({
      id: app.id,
      slug: app.slug,
      config: app.config,
      warnings, // Return warnings so client knows about coercions
      createdAt: app.createdAt,
    });
  } catch (err) {
    console.error('Create app error:', err);
    res.status(500).json({ error: 'Failed to create app' });
  }
});

// ── Get app by slug ───────────────────────────────────────────────────────────
router.get('/:slug', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const app = await prisma.app.findFirst({
      where: { slug: req.params.slug, userId: req.userId },
    });

    if (!app) {
      res.status(404).json({ error: 'App not found' });
      return;
    }

    res.json(app);
  } catch {
    res.status(500).json({ error: 'Failed to fetch app' });
  }
});

// ── Update app config ─────────────────────────────────────────────────────────
router.put('/:slug', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.app.findFirst({
      where: { slug: req.params.slug, userId: req.userId },
    });
    if (!existing) {
      res.status(404).json({ error: 'App not found' });
      return;
    }

    const { config, warnings, errors, isValid } = validateAndSanitizeConfig(req.body);
    if (!isValid) {
      res.status(400).json({ error: 'Invalid config', details: errors });
      return;
    }

    const updated = await prisma.app.update({
      where: { id: existing.id },
      data: { config: config as object },
    });

    res.json({ ...updated, warnings });
  } catch {
    res.status(500).json({ error: 'Failed to update app' });
  }
});

// ── Delete app ────────────────────────────────────────────────────────────────
router.delete('/:slug', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.app.findFirst({
      where: { slug: req.params.slug, userId: req.userId },
    });
    if (!existing) {
      res.status(404).json({ error: 'App not found' });
      return;
    }

    await prisma.app.delete({ where: { id: existing.id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete app' });
  }
});

// ── Validate config (without saving) ─────────────────────────────────────────
router.post('/validate', requireAuth, async (req: AuthRequest, res: Response) => {
  const { config, warnings, errors, isValid } = validateAndSanitizeConfig(req.body);
  res.json({ isValid, config, warnings, errors });
});

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50) || 'app';
}

export default router;
