import jwt, { SignOptions } from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export class JwtUtils {
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiry: string;
  private refreshTokenExpiry: string;

  constructor() {
    this.accessTokenSecret = process.env.JWT_SECRET || 'your-secret-key';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
  }

  generateAccessToken(payload: JwtPayload): string {
    const options: SignOptions = {
      expiresIn: this.accessTokenExpiry as string | number
    };
    
    return jwt.sign(payload, this.accessTokenSecret, options);
  }

  generateRefreshToken(payload: JwtPayload): string {
    const options: SignOptions = {
      expiresIn: this.refreshTokenExpiry as string | number
    };
    
    return jwt.sign(payload, this.refreshTokenSecret, options);
  }

  verifyAccessToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret) as JwtPayload;
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  verifyRefreshToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret) as JwtPayload;
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  decodeToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.decode(token) as JwtPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }
}

export default new JwtUtils();
