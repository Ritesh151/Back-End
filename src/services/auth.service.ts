import { compare, hash } from 'bcryptjs';
import { sign, JwtPayload } from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { APIError } from '../utils/api-error';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-do-not-use';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

export interface JWTPayload extends JwtPayload {
  userId: string;
  role: 'admin';
}

export interface LoginResponse {
  user: Pick<IUser, 'id' | 'email' | 'name' | 'role'>;
  accessToken: string;
}

export class AuthService {
  async ensureAdmin(): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      throw new APIError('ADMIN_EMAIL not configured', 500);
    }

    const passwordHash = process.env.ADMIN_PASSWORD_HASH;
    if (!passwordHash) {
      throw new APIError('ADMIN_PASSWORD_HASH not configured. Run: node src/seed.ts', 500);
    }

    const existing = await User.findOne({ email: adminEmail }).select('+password');

    const seedName = adminEmail.split('@')[0].split(/[._]/)[0].charAt(0).toUpperCase()
      + adminEmail.split('@')[0].split(/[._]/)[0].slice(1);

    if (existing) {
      if (existing.password !== passwordHash) {
        existing.password = passwordHash;
        await existing.save({ validateBeforeSave: false });
        logger.info(`Admin password synced: ${adminEmail}`);
      }
      return;
    }

    await User.create({
      email: adminEmail,
      password: passwordHash,
      name: seedName,
      role: 'admin',
    });

    logger.info(`Admin user seeded: ${adminEmail}`);
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      throw new APIError('Server not configured', 500);
    }

    if (email.toLowerCase() !== adminEmail.toLowerCase()) {
      throw new APIError('Invalid email or password', 401);
    }

    const user = await User.findOne({ email: adminEmail }).select('+password');
    if (!user) {
      throw new APIError('Invalid email or password', 401);
    }

    const isValid = await compare(password, user.password);
    if (!isValid) {
      throw new APIError('Invalid email or password', 401);
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const accessToken = sign(
      { userId: user._id.toString(), role: 'admin' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as object
    );

    logger.info(`Admin logged in: ${adminEmail}`);

    const displayName = user.name !== 'Admin'
      ? user.name
      : user.email.split('@')[0].split(/[._]/)[0].charAt(0).toUpperCase()
        + user.email.split('@')[0].split(/[._]/)[0].slice(1);

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        name: displayName,
        role: 'admin',
      },
      accessToken,
    };
  }

  async getCurrentUser(userId: string): Promise<Pick<IUser, 'id' | 'email' | 'name' | 'role'>> {
    const user = await User.findById(userId);
    if (!user) {
      throw new APIError('Admin not found', 404);
    }
    const displayName = user.name !== 'Admin'
      ? user.name
      : user.email.split('@')[0].split(/[._]/)[0].charAt(0).toUpperCase()
        + user.email.split('@')[0].split(/[._]/)[0].slice(1);
    return {
      id: user._id.toString(),
      email: user.email,
      name: displayName,
      role: 'admin',
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new APIError('Admin not found', 404);
    }

    const isValid = await compare(currentPassword, user.password);
    if (!isValid) {
      throw new APIError('Current password is incorrect', 401);
    }

    user.password = await hash(newPassword, 10);
    await user.save();

    logger.info(`Admin password changed: ${user.email}`);
  }
}

export const authService = new AuthService();
