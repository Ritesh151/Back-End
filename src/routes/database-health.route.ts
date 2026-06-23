import { Router } from 'express';
import mongoose from 'mongoose';
import { Lead } from '../models/Lead';
import { User } from '../models/User';
import { logger } from '../utils/logger';

const router = Router();

interface DatabaseStats {
  status: string;
  database: {
    connected: boolean;
    name: string;
    collections: number;
    dataSize: number;
    avgObjSize: number;
    readyState: number;
    readyStateLabel: string;
  };
  collections: {
    leads: number;
    users: number;
  };
  indexes: {
    leads: string[];
  };
  performance: {
    connectionTime: number;
    queryTime: number;
  };
  timestamp: string;
  environment: {
    nodeEnv: string;
    backendUrl: string;
    mongodbUri: string;
  };
}

router.get('/database-health', async (req, res) => {
  const startTime = Date.now();

  try {
    // 1. Check connection status
    const db = mongoose.connection;
    const readyState = db.readyState;
    const readyStateLabel = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    }[readyState] || 'unknown';

    // 2. Get database stats
    let stats: any = {};
    let dbConnected = false;

    try {
      stats = await db.db?.stats();
      dbConnected = true;
    } catch (statsError) {
      logger.warn('Could not fetch database stats:', statsError instanceof Error ? statsError.message : String(statsError));
    }

    // 3. Count documents in collections (with timeout protection)
    let leadsCount = 0;
    let usersCount = 0;

    try {
      leadsCount = await Promise.race([
        Lead.countDocuments(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 5000)),
      ]) as number;
    } catch (error) {
      logger.warn('Could not count leads:', error instanceof Error ? error.message : String(error));
    }

    try {
      usersCount = await Promise.race([
        User.countDocuments(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 5000)),
      ]) as number;
    } catch (error) {
      logger.warn('Could not count users:', error instanceof Error ? error.message : String(error));
    }

    // 4. Get indexes
    let indexNames: string[] = [];
    try {
      const indexes = await Lead.collection.getIndexes();
      indexNames = Object.keys(indexes);
    } catch (error) {
      logger.warn('Could not fetch indexes:', error instanceof Error ? error.message : String(error));
    }

    const performanceTime = Date.now() - startTime;

    // 5. Prepare response
    const response: DatabaseStats = {
      status: readyState === 1 ? 'healthy' : readyState === 2 ? 'connecting' : 'unhealthy',
      database: {
        connected: dbConnected && readyState === 1,
        name: db.getName() || 'unknown',
        collections: stats?.collections || 0,
        dataSize: stats?.dataSize || 0,
        avgObjSize: stats?.avgObjSize || 0,
        readyState,
        readyStateLabel,
      },
      collections: {
        leads: leadsCount,
        users: usersCount,
      },
      indexes: {
        leads: indexNames,
      },
      performance: {
        connectionTime: performanceTime,
        queryTime: performanceTime,
      },
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV || 'unknown',
        backendUrl: process.env.BACKEND_URL || 'unknown',
        mongodbUri: process.env.MONGODB_URI ? `${process.env.MONGODB_URI.substring(0, 30)}...` : 'not set',
      },
    };

    // 6. Determine HTTP status
    const httpStatus = readyState === 1 ? 200 : 503;

    res.status(httpStatus).json(response);

    logger.info('Database health check completed', { status: response.status, httpStatus });
  } catch (error) {
    logger.error(
      error instanceof Error ? error : new Error(String(error)),
      'Error during database health check'
    );

    const errorResponse = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };

    res.status(500).json(errorResponse);
  }
});

// Quick status endpoint (lighter weight)
router.get('/database-status', async (req, res) => {
  try {
    const db = mongoose.connection;
    const readyState = db.readyState;

    const statusLabels: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    res.json({
      status: statusLabels[readyState] || 'unknown',
      readyState,
      connected: readyState === 1,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
