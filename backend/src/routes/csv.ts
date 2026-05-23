/**
 * CSV Import System
 * Upload CSV → auto-detect columns → map to entity fields → import records
 */

import { Router, Response } from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { AppConfig, Entity } from '../types/config';
import { validateRecord } from '../utils/recordValidator';

const router = Router();

const upload = multer({
  dest: 'uploads/csv/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// Helper
async function getAppEntity(slug: string, entityName: string, userId: string) {
  const app = await prisma.app.findFirst({ where: { slug, userId } });
  if (!app) return null;
  const config = app.config as AppConfig;
  const entity = config.entities.find((e) => e.name.toLowerCase() === entityName.toLowerCase());
  if (!entity) return null;
  return { app: { id: app.id, config }, entity };
}

// ── Upload & Preview ──────────────────────────────────────────────────────────
router.post('/:slug/entities/:entity/csv/upload', requireAuth, upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No CSV file provided' });
    return;
  }

  try {
    const result = await getAppEntity(req.params.slug, req.params.entity, req.userId!);
    if (!result) {
      fs.unlinkSync(req.file.path);
      res.status(404).json({ error: 'App or entity not found' });
      return;
    }

    const { entity } = result;

    // Parse CSV
    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    const parsed = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'CSV parse error', details: parsed.errors });
      return;
    }

    const csvColumns = parsed.meta.fields || [];
    const preview = (parsed.data as Record<string, string>[]).slice(0, 5);
    const totalRows = parsed.data.length;

    // Auto-suggest column mapping
    const entityFields = entity.fields.filter((f) => !f.auto && !f.primary && !f.readonly);
    const suggestedMapping: Record<string, string> = {};

    for (const csvCol of csvColumns) {
      const lower = csvCol.toLowerCase().replace(/[\s_-]/g, '');
      const match = entityFields.find((f) => {
        const fNorm = f.name.toLowerCase().replace(/[\s_-]/g, '');
        const lNorm = (f.label || f.name).toLowerCase().replace(/[\s_-]/g, '');
        return fNorm === lower || lNorm === lower;
      });
      if (match) suggestedMapping[csvCol] = match.name;
    }

    // Store import session
    const importId = uuidv4();
    await prisma.csvImport.create({
      data: {
        id: importId,
        appId: result.app.id,
        entityName: entity.name,
        fileName: req.file.originalname,
        rowCount: totalRows,
        columnMap: suggestedMapping,
        status: 'pending',
      },
    });

    // Keep file on disk temporarily
    fs.renameSync(req.file.path, `uploads/csv/${importId}.csv`);

    res.json({
      importId,
      csvColumns,
      preview,
      totalRows,
      suggestedMapping,
      entityFields: entityFields.map((f) => ({
        name: f.name,
        label: f.label || f.name,
        type: f.type,
        required: f.required,
      })),
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('CSV upload error:', err);
    res.status(500).json({ error: 'CSV upload failed' });
  }
});

// ── Confirm & Process Import ──────────────────────────────────────────────────
router.post('/:slug/entities/:entity/csv/import/:importId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await getAppEntity(req.params.slug, req.params.entity, req.userId!);
    if (!result) {
      res.status(404).json({ error: 'App or entity not found' });
      return;
    }

    const { entity, app } = result;
    const { columnMap } = req.body as { columnMap: Record<string, string> };

    if (!columnMap || typeof columnMap !== 'object') {
      res.status(400).json({ error: 'columnMap is required' });
      return;
    }

    const importRecord = await prisma.csvImport.findFirst({
      where: { id: req.params.importId, appId: app.id },
    });

    if (!importRecord) {
      res.status(404).json({ error: 'Import session not found' });
      return;
    }

    // Update status
    await prisma.csvImport.update({
      where: { id: importRecord.id },
      data: { status: 'processing', columnMap },
    });

    // Process CSV
    const csvPath = `uploads/csv/${importRecord.id}.csv`;
    if (!fs.existsSync(csvPath)) {
      res.status(400).json({ error: 'CSV file expired — please re-upload' });
      return;
    }

    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const parsed = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = parsed.data as Record<string, string>[];
    let successCount = 0;
    const rowErrors: { row: number; errors: Record<string, string> }[] = [];

    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const creates = [];

      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const rowNumber = i + j + 1;

        // Map CSV columns to entity fields
        const mapped: Record<string, unknown> = {};
        for (const [csvCol, entityField] of Object.entries(columnMap)) {
          if (entityField && row[csvCol] !== undefined) {
            mapped[entityField] = row[csvCol];
          }
        }

        const { data, errors, isValid } = validateRecord(mapped, entity, 'create');
        if (!isValid) {
          rowErrors.push({ row: rowNumber, errors });
          continue;
        }

        const id = uuidv4();
        const now = new Date().toISOString();
        creates.push({
          id,
          appId: app.id,
          entityName: entity.name,
          userId: req.userId!,
          data: { id, ...data, createdAt: now, updatedAt: now },
        });
        successCount++;
      }

      if (creates.length > 0) {
        await prisma.appRecord.createMany({ data: creates });
      }
    }

    // Cleanup
    fs.unlinkSync(csvPath);

    await prisma.csvImport.update({
      where: { id: importRecord.id },
      data: {
        status: 'done',
        completedAt: new Date(),
        columnMap,
      },
    });

    res.json({
      success: true,
      imported: successCount,
      failed: rowErrors.length,
      errors: rowErrors.slice(0, 50), // Cap error list
    });
  } catch (err) {
    console.error('CSV import error:', err);
    res.status(500).json({ error: 'CSV import failed' });
  }
});

// ── Export CSV ─────────────────────────────────────────────────────────────────
router.get('/:slug/entities/:entity/csv/export', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await getAppEntity(req.params.slug, req.params.entity, req.userId!);
    if (!result) {
      res.status(404).json({ error: 'App or entity not found' });
      return;
    }

    const { entity, app } = result;

    const records = await prisma.appRecord.findMany({
      where: {
        appId: app.id,
        entityName: entity.name,
        ...(entity.userScoped !== false && { userId: req.userId }),
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = records.map((r) => r.data as Record<string, unknown>);
    const csv = Papa.unparse(data);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${entity.name}-export.csv"`);
    res.send(csv);
  } catch {
    res.status(500).json({ error: 'Export failed' });
  }
});

export default router;
