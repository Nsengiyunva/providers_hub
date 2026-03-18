import jwt, { SignOptions } from 'jsonwebtoken';
import { StringValue } from 'ms';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export class JwtUtils {
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiry: StringValue;
  private refreshTokenExpiry: StringValue;

  constructor() {
    this.accessTokenSecret = process.env.JWT_SECRET || 'your-secret-key';
    this.refreshTokenSecret =
      process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';

    this.accessTokenExpiry = (process.env.JWT_ACCESS_EXPIRY ||
      '15m') as StringValue;

    this.refreshTokenExpiry = (process.env.JWT_REFRESH_EXPIRY ||
      '7d') as StringValue;
  }

  /**
   * Generate Access Token
   */
  generateAccessToken(payload: JwtPayload): string {
    const options: SignOptions = {
      expiresIn: this.accessTokenExpiry,
    };

    return jwt.sign(payload, this.accessTokenSecret, options);
  }

  /**
   * Generate Refresh Token
   */
  generateRefreshToken(payload: JwtPayload): string {
    const options: SignOptions = {
      expiresIn: this.refreshTokenExpiry,
    };

    return jwt.sign(payload, this.refreshTokenSecret, options);
  }

  /**
   * Verify Access Token
   */
  verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.accessTokenSecret) as JwtPayload;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Access token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid access token');
      }
      throw new Error('Access token verification failed');
    }
  }

  /**
   * Verify Refresh Token
   */
  verifyRefreshToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.refreshTokenSecret) as JwtPayload;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      }
      throw new Error('Refresh token verification failed');
    }
  }

  /**
   * Decode Token (no verification)
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }

  /**
   * Generate both tokens (best practice helper)
   */
  generateAuthTokens(payload: JwtPayload) {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
    };
  }
}

export default new JwtUtils();