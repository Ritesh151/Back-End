import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requestTimeout = (timeoutMs: number = 120000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      logger.warn({ path: req.path, method: req.method, timeoutMs }, 'Request timeout');
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          message: 'Request timed out. Please try again.',
        });
      }
    }, timeoutMs);

    res.on('finish', () => {
      clearTimeout(timer);
    });

    next();
  };
};
