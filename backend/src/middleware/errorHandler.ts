import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message);

  if (res.headersSent) return;

  // Prisma errors
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    const pe = err as { code?: string; meta?: Record<string, unknown> };
    if (pe.code === 'P2002') {
      res.status(409).json({ error: 'Duplicate entry — record already exists', code: 'DUPLICATE' });
      return;
    }
    if (pe.code === 'P2025') {
      res.status(404).json({ error: 'Record not found', code: 'NOT_FOUND' });
      return;
    }
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({ error: err.message, code: 'VALIDATION_ERROR' });
    return;
  }

  // Default 500
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}
