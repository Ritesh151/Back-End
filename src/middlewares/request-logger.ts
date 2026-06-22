import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestStart = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - requestStart;

    if (duration > 1000) {
      logger.warn({ method: req.method, path: req.path, status: res.statusCode, duration: `${duration}ms` }, 'Slow request');
    }
  });

  next();
};
