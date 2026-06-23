import { Request, Response, NextFunction } from 'express';

const requestCounts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60000;
const MAX_REQUESTS = 120;
const SEARCH_MAX = 5;

export const rateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  let record = requestCounts.get(ip);
  if (!record || now > record.resetAt) {
    record = { count: 0, resetAt: now + WINDOW_MS };
    requestCounts.set(ip, record);
  }

  record.count++;

  if (record.count > MAX_REQUESTS) {
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please slow down.',
    });
    return;
  }

  if (req.path === '/search' && req.method === 'POST') {
    let searchCount = requestCounts.get(`${ip}:search`)?.count || 0;
    if (searchCount === 0) {
      requestCounts.set(`${ip}:search`, { count: 1, resetAt: now + WINDOW_MS });
    } else {
      const sr = requestCounts.get(`${ip}:search`)!;
      if (now > sr.resetAt) {
        sr.count = 1;
        sr.resetAt = now + WINDOW_MS;
      } else {
        sr.count++;
        if (sr.count > SEARCH_MAX) {
          res.status(429).json({
            success: false,
            message: 'Too many search requests. Please wait before starting a new search.',
          });
          return;
        }
      }
    }
  }

  next();
};

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts) {
    if (now > record.resetAt) {
      requestCounts.delete(key);
    }
  }
}, 60000);
