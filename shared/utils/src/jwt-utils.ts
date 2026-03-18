import jwt, { SignOptions } from 'jsonwebtoken';
import { UserRole } from '@eventhub/shared-types';
import { createLogger } from './logger';

const logger = createLogger('jwt-utils');

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export class JwtUtils {
  private secret: string;
  private accessTokenExpiry: string;
  private refreshTokenExpiry: string;

  constructor(
    secret: string = process.env.JWT_SECRET || 'your-secret-key',
    accessTokenExpiry: string = '15m',
    refreshTokenExpiry: string = '7d'
  ) {
    this.secret = secret;
    this.accessTokenExpiry = accessTokenExpiry;
    this.refreshTokenExpiry = refreshTokenExpiry;
  }

  generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    try {
      const options: SignOptions = {
        expiresIn: this.accessTokenExpiry
      };
      return jwt.sign(payload, this.secret, options);
    } catch (error) {
      logger.error('Error generating access token', { error });
      throw error;
    }
  }

  generateRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    try {
      const options: SignOptions = {
        expiresIn: this.refreshTokenExpiry
      };
      return jwt.sign(payload, this.secret, options);
    } catch (error) {
      logger.error('Error generating refresh token', { error });
      throw error;
    }
  }

  generateTokenPair(payload: Omit<JwtPayload, 'iat' | 'exp'>): {
    accessToken: string;
    refreshToken: string;
  } {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload)
    };
  }

  verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.secret) as JwtPayload;
    } catch (error) {
      logger.error('Token verification failed', { error });
      throw new Error('Invalid or expired token');
    }
  }

  decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch (error) {
      logger.error('Token decode failed', { error });
      return null;
    }
  }

  isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    return Date.now() >= decoded.exp * 1000;
  }
}

export default JwtUtils;
