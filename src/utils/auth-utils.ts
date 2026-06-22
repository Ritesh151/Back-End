import { CookieOptions, Request, Response } from 'express';

/**
 * Get cookie options based on environment
 */
export const getCookieOptions = (): CookieOptions => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
};

/**
 * Set auth tokens in cookies
 */
export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
): void => {
  const cookieOptions = getCookieOptions();

  // Set refresh token in cookie (not access token for security)
  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  // Set access token in response body (not cookie for flexibility)
  res.cookie('accessToken', accessToken, {
    httpOnly: false, // Access token can be accessed by frontend
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15 minutes
  });
};

/**
 * Clear auth cookies
 */
export const clearAuthCookies = (res: Response): void => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.clearCookie('accessToken', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
};

/**
 * Get user role from request
 */
export const getUserRoleFromRequest = (req: Request): string | undefined => {
  return (req as any).user?.role;
};

/**
 * Check if user has required role
 */
export const hasRole = (userRole: string, requiredRoles: string[]): boolean => {
  return requiredRoles.includes(userRole);
};
