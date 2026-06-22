import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { APIResponse } from '../utils/api-response';
import { APIError } from '../utils/api-error';
import { AuthRequest } from '../middlewares/auth.middleware';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new APIError('Email and password are required', 400);
      }

      const result = await authService.login(email, password);

      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000,
        path: '/',
      });

      APIResponse.success(
        res,
        { user: result.user, accessToken: result.accessToken },
        'Login successful'
      );
    } catch (error) {
      next(error);
    }
  }

  async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.clearCookie('accessToken', { path: '/' });
      APIResponse.success(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const user = await authService.getCurrentUser(authReq.user.id);
      APIResponse.success(res, user, 'User fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        throw new APIError('Current password and new password are required', 400);
      }

      if (newPassword.length < 8) {
        throw new APIError('New password must be at least 8 characters', 400);
      }

      await authService.changePassword(authReq.user.id, currentPassword, newPassword);

      res.clearCookie('accessToken', { path: '/' });
      APIResponse.success(res, null, 'Password changed successfully. Please login again.');
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
