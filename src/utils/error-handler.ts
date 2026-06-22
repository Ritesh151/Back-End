import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { logger } from '../utils/logger';

interface CustomError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  stack?: string;
  code?: string;
}

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = (err as CustomError).statusCode || 500;
  const message = (err as CustomError).isOperational
    ? (err as CustomError).message
    : 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? { stack: err.stack, code: (err as CustomError).code } : message,
  });
};

export const asyncHandler =
  (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err) => next(err));
  };

export const notFound = (req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(`Route ${req.method} ${req.path} not found`, 404));
};
