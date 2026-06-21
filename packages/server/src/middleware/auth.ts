import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { db } from '../db/client.js';

export interface AuthPayload {
  playerId: string;
  empireId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as AuthPayload;
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, config.JWT_SECRET) as AuthPayload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.auth = payload;

  const adminEmails = config.ADMIN_EMAILS
    ? config.ADMIN_EMAILS.split(',').map((e) => e.trim()).filter(Boolean)
    : [];

  db.player.findUnique({
    where: { id: payload.playerId },
    select: { isAdmin: true, email: true },
  }).then((player) => {
    const isAdmin = player?.isAdmin || (player?.email != null && adminEmails.includes(player.email));
    if (!isAdmin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    next();
  }).catch(next);
}
