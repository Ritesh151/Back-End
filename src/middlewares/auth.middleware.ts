import { Request, Response, NextFunction } from 'express';
import { verify, JwtPayload } from 'jsonwebtoken';
import { APIError } from '../utils/api-error';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-do-not-use';

export interface AuthRequest extends Request {
  user: {
    id: string;
    role: 'admin';
  };
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken as string;
  }
  return null;
}

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const token = extractToken(req);
    if (!token) {
      next(new APIError('Authentication required', 401));
      return;
    }

    const decoded = verify(token, JWT_SECRET) as JwtPayload;
    if (!decoded.userId || decoded.role !== 'admin') {
      next(new APIError('Invalid token', 401));
      return;
    }

    (req as AuthRequest).user = {
      id: decoded.userId,
      role: 'admin',
    };

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      next(new APIError('Session expired. Please login again.', 401));
      return;
    }
    if (error.name === 'JsonWebTokenError') {
      next(new APIError('Invalid token', 401));
      return;
    }
    next(new APIError('Authentication failed', 401));
  }
};
