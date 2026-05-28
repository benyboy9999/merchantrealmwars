import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation error', details: err.flatten() });
    return;
  }

  if (err instanceof Error) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  res.status(500).json({ error: 'Unknown error' });
}
