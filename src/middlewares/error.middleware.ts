import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AxiosError } from 'axios';
import { logger } from '../utils/logger';

interface ApiError {
  success: boolean;
  message: string;
  code?: string;
  details?: unknown;
  error?: string;
  stack?: string;
}

export const errorMiddleware: ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = 500;
  let message = 'Internal Server Error';
  let code: string | undefined;
  let details: unknown;

  if (err instanceof AxiosError) {
    const axiosErr = err as AxiosError;
    
    if (axiosErr.response?.status) {
      statusCode = axiosErr.response.status;
      message = axiosErr.response.statusText || message;
      
      const data = axiosErr.response.data as any;
      if (data?.message) message = data.message;
      if (data?.code) code = data.code;
      if (data?.detail) details = data.detail;
      
      logger.error({
        type: 'AxiosError',
        status: statusCode,
        message,
        code,
        axiosMessage: axiosErr.message,
        path: req.path,
        method: req.method,
      }, '[AxiosError] Request to AI service failed');
    } else if (axiosErr.code === 'ECONNREFUSED') {
      statusCode = 503;
      message = 'AI service unavailable';
      code = 'AI_SERVICE_UNAVAILABLE';
      logger.error({
        type: 'AxiosConnectionError',
        message: 'Connection refused to AI service',
        path: req.path,
      }, '[AxiosError] Connection refused');
    } else {
      statusCode = 500;
      message = 'External service error';
      code = 'EXTERNAL_SERVICE_ERROR';
      logger.error({
        type: 'AxiosUnknownError',
        axiosMessage: axiosErr.message,
        path: req.path,
      }, '[AxiosError] Unknown axios error');
    }
  } else if (err.statusCode) {
    statusCode = err.statusCode;
    message = err.message || message;
    code = err.code;
    details = err.details;
  } else if (err.status) {
    statusCode = err.status;
    message = err.message || message;
  } else if (err.isOperational) {
    message = err.message;
    statusCode = err.statusCode || 400;
  }

  logger.error({
    statusCode,
    message,
    code,
    path: req.path,
    method: req.method,
    body: req.body ? { keyword: req.body.keyword, location: req.body.location } : undefined,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  }, '[ErrorMiddleware] Returning error response');

  const response: ApiError = {
    success: false,
    message,
  };

  if (code) response.code = code;
  if (details) response.details = details;
  if (process.env.NODE_ENV === 'development') {
    response.error = err.message;
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};
