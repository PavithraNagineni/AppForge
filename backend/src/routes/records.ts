/**
 * Dynamic Records API
 * Handles CRUD for any entity defined in an app config.
 * All data stored as JSONB in AppRecord table.
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { AppConfig, Entity } from '../types/config';
import { validateRecord } from '../utils/recordValidator';

const router = Router();

// Helper: get app + entity or return 404
async function getAppEntity(
  slug: string,
  entityName: string,
  userId: string,
): Promise<{ app: { id: string; config: AppConfig }; entity: Entity } | null> {
  const app = await prisma.app.findFirst({
    where: { slug, userId },
  });
  if (!app) return null;

  const config = app.config as AppConfig;
  const entity = config.entities.find(
    (e) => e.name.toLowerCase() === entityName.toLowerCase(),
  );
  if (!entity) return null;

  return { app: { id: app.id, config }, entity };
}

// ── List records ──────────────────────────────────────────────────────────────
router.get('/:slug/entities/:entity/records', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await getAppEntity(req.params.slug, req.params.entity, req.userId!);
    if (!result) {
      res.status(404).json({ error: 'App or entity not found' });
      return;
    }

    const { app, entity } = result;

    // Pagination
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize as string) || 20);
    const skip = (page - 1) * pageSize;

    // Build base where
    const where = {
      appId: app.id,
      entityName: entity.name,
      ...(entity.userScoped !== false && { userId: req.userId }),
    };

    const [total, records] = await prisma.$transaction([
      prisma.appRecord.count({ where }),
      prisma.appRecord.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Filter/search in application layer (JSONB)
    let data = records.map((r) => ({
      id: r.id,
      ...(r.data as object),
      _createdAt: r.createdAt,
      _updatedAt: r.updatedAt,
    }));

    // Search
    const search = req.query.search as string;
    if (search) {
      const lower = search.toLowerCase();
      data = data.filter((row) =>
        Object.values(row).some((v) =>
          String(v).toLowerCase().includes(lower),
        ),
      );
    }

    // Filter by field
    for (const [key, val] of Object.entries(req.query)) {
      if (['page', 'pageSize', 'search', 'sortBy', 'sortOrder'].includes(key)) continue;
      data = data.filter((row) => String((row as Record<string, unknown>)[key]) === String(val));
    }

    // Sort
    const sortBy = req.query.sortBy as string;
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    if (sortBy) {
      data.sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[sortBy];
        const bVal = (b as Record<string, unknown>)[sortBy];
        if (aVal === undefined) return 1;
        if (bVal === undefined) return -1;
        return (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) * sortOrder;
      });
    }

    res.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    console.error('List records error:', err);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// ── Get single record ─────────────────────────────────────────────────────────
router.get('/:slug/entities/:entity/records/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await getAppEntity(req.params.slug, req.params.entity, req.userId!);
    if (!result) {
      res.status(404).json({ error: 'App or entity not found' });
      return;
    }

    const record = await prisma.appRecord.findFirst({
      where: {
        id: req.params.id,
        appId: result.app.id,
        entityName: result.entity.name,
        ...(result.entity.userScoped !== false && { userId: req.userId }),
      },
    });

    if (!record) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    res.json({ id: record.id, ...(record.data as object), _createdAt: record.createdAt, _updatedAt: record.updatedAt });
  } catch {
    res.status(500).json({ error: 'Failed to fetch record' });
  }
});

// ── Create record ─────────────────────────────────────────────────────────────
router.post('/:slug/entities/:entity/records', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await getAppEntity(req.params.slug, req.params.entity, req.userId!);
    if (!result) {
      res.status(404).json({ error: 'App or entity not found' });
      return;
    }

    const { entity, app } = result;
    const { data, errors, isValid } = validateRecord(req.body, entity, 'create');

    if (!isValid) {
      res.status(400).json({ error: 'Validation failed', details: errors });
      return;
    }

    // Add auto-generated fields
    const autoId = uuidv4();
    const now = new Date().toISOString();
    const recordData: Record<string, unknown> = {
      id: autoId,
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    const record = await prisma.appRecord.create({
      data: {
        id: autoId,
        appId: app.id,
        entityName: entity.name,
        userId: req.userId!,
        data: recordData,
      },
    });

    // Trigger notification
    await createNotification(req.userId!, `${entity.displayName || entity.name} created`, `New ${entity.name} record was created.`, 'success');

    res.status(201).json({ id: record.id, ...(record.data as object) });
  } catch (err) {
    console.error('Create record error:', err);
    res.status(500).json({ error: 'Failed to create record' });
  }
});

// ── Update record ─────────────────────────────────────────────────────────────
router.put('/:slug/entities/:entity/records/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await getAppEntity(req.params.slug, req.params.entity, req.userId!);
    if (!result) {
      res.status(404).json({ error: 'App or entity not found' });
      return;
    }

    const { entity, app } = result;

    const existing = await prisma.appRecord.findFirst({
      where: {
        id: req.params.id,
        appId: app.id,
        entityName: entity.name,
        ...(entity.userScoped !== false && { userId: req.userId }),
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    const { data, errors, isValid } = validateRecord(req.body, entity, 'update');
    if (!isValid) {
      res.status(400).json({ error: 'Validation failed', details: errors });
      return;
    }

    const existingData = existing.data as Record<string, unknown>;
    const updatedData = {
      ...existingData,
      ...data,
      id: existing.id,
      createdAt: existingData.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const updated = await prisma.appRecord.update({
      where: { id: existing.id },
      data: { data: updatedData },
    });

    res.json({ id: updated.id, ...(updated.data as object) });
  } catch {
    res.status(500).json({ error: 'Failed to update record' });
  }
});

// ── Delete record ─────────────────────────────────────────────────────────────
router.delete('/:slug/entities/:entity/records/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await getAppEntity(req.params.slug, req.params.entity, req.userId!);
    if (!result) {
      res.status(404).json({ error: 'App or entity not found' });
      return;
    }

    const { entity, app } = result;

    const existing = await prisma.appRecord.findFirst({
      where: {
        id: req.params.id,
        appId: app.id,
        entityName: entity.name,
        ...(entity.userScoped !== false && { userId: req.userId }),
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    await prisma.appRecord.delete({ where: { id: existing.id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

// ── Aggregate (for stats/charts) ───────────────────────────────────────────────
router.get('/:slug/entities/:entity/aggregate', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await getAppEntity(req.params.slug, req.params.entity, req.userId!);
    if (!result) {
      res.status(404).json({ error: 'App or entity not found' });
      return;
    }

    const { entity, app } = result;
    const { aggregate, field, groupBy } = req.query as Record<string, string>;

    const records = await prisma.appRecord.findMany({
      where: {
        appId: app.id,
        entityName: entity.name,
        ...(entity.userScoped !== false && { userId: req.userId }),
      },
    });

    const data = records.map((r) => r.data as Record<string, unknown>);

    if (groupBy) {
      // Group by a field and aggregate
      const groups: Record<string, unknown[]> = {};
      for (const row of data) {
        const key = String(row[groupBy] ?? 'Unknown');
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
      }

      const result = Object.entries(groups).map(([key, rows]) => ({
        label: key,
        value: computeAggregate(rows, aggregate || 'count', field),
      }));

      res.json(result);
      return;
    }

    // Single aggregate
    const value = computeAggregate(data, aggregate || 'count', field);
    res.json({ value });
  } catch {
    res.status(500).json({ error: 'Failed to compute aggregate' });
  }
});

function computeAggregate(
  rows: Record<string, unknown>[],
  aggregate: string,
  field?: string,
): number {
  switch (aggregate) {
    case 'count':
      return rows.length;
    case 'sum':
      return rows.reduce((acc, r) => acc + (Number(field && r[field]) || 0), 0);
    case 'avg':
      if (rows.length === 0) return 0;
      return rows.reduce((acc, r) => acc + (Number(field && r[field]) || 0), 0) / rows.length;
    case 'min':
      return rows.reduce((min, r) => Math.min(min, Number(field && r[field]) || 0), Infinity);
    case 'max':
      return rows.reduce((max, r) => Math.max(max, Number(field && r[field]) || 0), -Infinity);
    default:
      return rows.length;
  }
}

async function createNotification(userId: string, title: string, message: string, type: string) {
  try {
    await prisma.notification.create({ data: { userId, title, message, type } });
  } catch {
    // Non-fatal
  }
}

export default router;
