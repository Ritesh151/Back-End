import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export const validateObjectId = (paramName: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const id = req.params[paramName];

    if (!id || id === 'undefined' || id === 'null' || id === '') {
      logger.warn(`[validateObjectId] Missing or invalid ${paramName}: "${id}" from ${req.method} ${req.path}`);
      res.status(400).json({
        success: false,
        message: `Invalid ${paramName}: "${id}" is not a valid ID`,
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      logger.warn(`[validateObjectId] Invalid ObjectId format for ${paramName}: "${id}" from ${req.method} ${req.path}`);
      res.status(400).json({
        success: false,
        message: `Invalid ${paramName} format`,
      });
      return;
    }

    next();
  };
};
