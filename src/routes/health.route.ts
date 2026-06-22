import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { APIResponse } from '../utils/api-response';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : 'disconnected';

  APIResponse.success(res, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: dbStatus,
    },
  });
});

export default router;
