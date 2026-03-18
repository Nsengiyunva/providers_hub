import { createClient, RedisClientType } from 'redis';
import { createLogger } from './logger';

const logger = createLogger('redis-cache');

export class RedisCache {
  private client: RedisClientType;
  private connected: boolean = false;

  constructor(url: string) {
    this.client = createClient({ url });

    this.client.on('error', (err) => {
      logger.error('Redis Client Error', { error: err });
    });

    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.disconnect();
      this.connected = false;
      logger.info('Redis client disconnected');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get error', { key, error });
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const stringValue = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, stringValue);
      } else {
        await this.client.set(key, stringValue);
      }
      logger.debug('Cache set', { key, ttl: ttlSeconds });
    } catch (error) {
      logger.error('Cache set error', { key, error });
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
      logger.debug('Cache delete', { key });
    } catch (error) {
      logger.error('Cache delete error', { key, error });
      throw error;
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.debug('Cache delete pattern', { pattern, count: keys.length });
      }
    } catch (error) {
      logger.error('Cache delete pattern error', { pattern, error });
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', { key, error });
      return false;
    }
  }

  async increment(key: string, value: number = 1): Promise<number> {
    try {
      return await this.client.incrBy(key, value);
    } catch (error) {
      logger.error('Cache increment error', { key, error });
      throw error;
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.client.expire(key, seconds);
    } catch (error) {
      logger.error('Cache expire error', { key, error });
      throw error;
    }
  }

  async hGet(key: string, field: string): Promise<string | null> {
    try {
      return await this.client.hGet(key, field);
    } catch (error) {
      logger.error('Cache hGet error', { key, field, error });
      return null;
    }
  }

  async hSet(key: string, field: string, value: string): Promise<void> {
    try {
      await this.client.hSet(key, field, value);
    } catch (error) {
      logger.error('Cache hSet error', { key, field, error });
      throw error;
    }
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    try {
      return await this.client.hGetAll(key);
    } catch (error) {
      logger.error('Cache hGetAll error', { key, error });
      return {};
    }
  }

  getClient(): RedisClientType {
    return this.client;
  }
}

export default RedisCache;
