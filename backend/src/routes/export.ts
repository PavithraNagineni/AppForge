/**
 * Export Routes
 * Generates downloadable project files via githubExport service.
 */

import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { AppConfig } from '../types/config';
import { generateFullProject } from '../services/githubExport';

const router = Router();

// ── Export as structured file map ─────────────────────────────────────────────
router.get('/:slug/code', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const app = await prisma.app.findFirst({
      where: { slug: req.params.slug, userId: req.userId },
    });

    if (!app) {
      res.status(404).json({ error: 'App not found' });
      return;
    }

    const config = app.config as AppConfig;
    const files = generateFullProject(config, app.slug);

    res.json({
      appName: config.name,
      slug: app.slug,
      fileCount: Object.keys(files).length,
      files,
    });
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ── Export config only ────────────────────────────────────────────────────────
router.get('/:slug/config', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const app = await prisma.app.findFirst({
      where: { slug: req.params.slug, userId: req.userId },
    });

    if (!app) {
      res.status(404).json({ error: 'App not found' });
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${app.slug}-config.json"`);
    res.send(JSON.stringify(app.config, null, 2));
  } catch {
    res.status(500).json({ error: 'Export failed' });
  }
});

export default router;
