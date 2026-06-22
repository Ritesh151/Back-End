import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import 'dotenv/config';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  logger.error('MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

let cachedConnection: mongoose.Mongoose | null = null;

export const connectDB = async (): Promise<void> => {
  try {
    if (cachedConnection) {
      logger.info('Using existing database connection');
      return;
    }

    const opts = {
      maxPoolSize: 100,
      minPoolSize: 10,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,
      family: 4,
      retryWrites: true,
      w: 'majority' as const,
    };

    const connection = await mongoose.connect(MONGODB_URI, opts);

    cachedConnection = connection;

    logger.info('Database connected successfully');
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error(String(error)), 'Database connection failed:');
    process.exit(1);
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    if (cachedConnection) {
      await mongoose.disconnect();
      cachedConnection = null;
      logger.info('Database disconnected');
    }
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error(String(error)), 'Error disconnecting database:');
  }
};
