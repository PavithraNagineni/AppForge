import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
  };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as {
      userId: string;
      email: string;
    };

    req.userId = payload.userId;
    req.user = { id: payload.userId, email: payload.email, name: null };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    } else {
      res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
    }
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as {
        userId: string;
        email: string;
      };
      req.userId = payload.userId;
      req.user = { id: payload.userId, email: payload.email, name: null };
    } catch {
      // Ignore — optional
    }
  }
  next();
}

export function generateToken(userId: string, email: string): string {
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '7d' },
  );
}
