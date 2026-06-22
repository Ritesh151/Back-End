import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export const validationErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof ZodError) {
    logger.warn(`[validation] Validation failed for ${req.method} ${req.path}: ${JSON.stringify(err.errors)}`);
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }
  next(err as Error);
};