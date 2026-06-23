import 'express-async-errors';
import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { connectDB, disconnectDB } from './config/database';
import { logger } from './utils/logger';
import { createServer } from 'http';
import { errorMiddleware } from './middlewares/error.middleware';
import { notFoundMiddleware } from './middlewares/not-found.middleware';
import { validationErrorHandler } from './middlewares/validation.middleware';
import { requestTimeout } from './middlewares/timeout.middleware';
import { rateLimiter } from './middlewares/rate-limiter.middleware';
import routes from './routes/index';
import { cronScheduler } from './schedulers/cron.scheduler';
import { authService } from './services/auth.service';
import { initSocketManager } from './modules/automation-monitor/socket-manager';
import { join } from 'path';
import { aiProcessingQueue } from './services/ai-processing-queue.service';

let isShuttingDown = false;

dotenv.config();

process.on('unhandledRejection', (reason: unknown) => {
  logger.fatal({ err: reason instanceof Error ? reason.message : String(reason) }, 'UNHANDLED REJECTION');
  process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
  logger.fatal({ err: error.message, stack: error.stack }, 'UNCAUGHT EXCEPTION');
  process.exit(1);
});

const app = express();
const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(url => url.trim()) : 'http://localhost:3000';

// Trust the first proxy (Render) so that req.ip and rate limiters work correctly
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));

app.use(rateLimiter);

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

app.use('/api/v1', (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const originalEnd = res.end.bind(res);
  res.end = function (this: Response, ...args: any[]) {
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn({ method: req.method, url: req.originalUrl, duration, status: res.statusCode }, `[PERF] Slow request: ${req.method} ${req.originalUrl} took ${duration}ms`);
    }
    return originalEnd(...args);
  } as any;
  next();
});

app.use('/api/v1', requestTimeout(29000), routes);

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Backend is live 🚀',
    status: 'OK',
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Lead Finder API is running',
    timestamp: new Date().toISOString(),
  });
});

app.use(validationErrorHandler);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

const startServer = async (): Promise<void> => {
  try {
    await connectDB();
    await authService.ensureAdmin();
    await cronScheduler.start();

    const httpServer = createServer(app);
    initSocketManager(httpServer);

    httpServer.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.fatal({ port: PORT }, `Port ${PORT} is already in use. Kill the existing process with: fuser -k ${PORT}/tcp`);
      } else {
        logger.fatal({ err: error.message }, 'Server error');
      }
      process.exit(1);
    });

    httpServer.listen(PORT, () => {
      logger.info(`Server started on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`API prefix: /api/v1`);
    });

    setImmediate(async () => {
      try {
        const count = await aiProcessingQueue.enqueueAllPendingLeads(50);
        logger.info(`[Startup] Auto-enqueued ${count} existing leads for AI pipeline`);
      } catch (error) {
        logger.error(error instanceof Error ? error : new Error(String(error)), '[Startup] AI pipeline enqueue failed (non-blocking)');
      }
    });

    setImmediate(async () => {
      try {
        const { leadMigrationService } = await import('./services/lead-migration.service');
        const result = await leadMigrationService.migrateWebsiteDetectionFields(200);
        logger.info({ result }, '[Startup] Website detection migration complete');
      } catch (error) {
        logger.error(error instanceof Error ? error : new Error(String(error)), '[Startup] Website detection migration failed (non-blocking)');
      }
    });

    const shutdown = async (): Promise<void> => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      logger.info('Shutting down server...');
      try {
        await cronScheduler.stop();
        httpServer.close(() => {
          logger.info('HTTP server closed');
        });
        await disconnectDB();
        process.exit(0);
      } catch (error: any) {
        logger.error({ err: error?.message || error }, 'Shutdown error');
        process.exit(1);
      }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error: any) {
    logger.error({ err: error?.message || error }, 'Failed to start server');
    process.exit(1);
  }
};

startServer();

export default app;
