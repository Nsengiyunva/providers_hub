import Redis from 'ioredis';
import logger from './logger';

export class RedisCache {
  private client: Redis;

  constructor(redisUrl?: string) {
    this.client = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');

    this.client.on('connect', () => {
      logger.info('Redis connected');
    });

    this.client.on('error', (error: Error) => {
      logger.error('Redis connection error:', error);
    });
  }

  async get(key: string): Promise<string | null> {
    try {
      const value = await this.client.get(key);
      return value;
    } catch (error) {
      logger.error('Redis GET error:', error);
      return null;
    }
  }

  async set(key: string, value: string, expiryInSeconds?: number): Promise<boolean> {
    try {
      if (expiryInSeconds) {
        await this.client.setex(key, expiryInSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      logger.error('Redis SET error:', error);
      return false;
    }
  }

  async setWithExpiry(key: string, value: string, expiryInSeconds: number): Promise<boolean> {
    return this.set(key, value, expiryInSeconds);
  }

  async delete(key: string): Promise<boolean> {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis DELETE error:', error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error:', error);
      return false;
    }
  }

  async increment(key: string): Promise<number> {
    try {
      const result = await this.client.incr(key);
      return result;
    } catch (error) {
      logger.error('Redis INCREMENT error:', error);
      return 0;
    }
  }

  async decrement(key: string): Promise<number> {
    try {
      const result = await this.client.decr(key);
      return result;
    } catch (error) {
      logger.error('Redis DECREMENT error:', error);
      return 0;
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      await this.client.expire(key, seconds);
      return true;
    } catch (error) {
      logger.error('Redis EXPIRE error:', error);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      const result = await this.client.ttl(key);
      return result;
    } catch (error) {
      logger.error('Redis TTL error:', error);
      return -1;
    }
  }

  async hGet(key: string, field: string): Promise<string | null> {
    try {
      const value = await this.client.hget(key, field);
      return value || null;
    } catch (error) {
      logger.error('Redis HGET error:', error);
      return null;
    }
  }

  async hSet(key: string, field: string, value: string): Promise<boolean> {
    try {
      await this.client.hset(key, field, value);
      return true;
    } catch (error) {
      logger.error('Redis HSET error:', error);
      return false;
    }
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    try {
      const result = await this.client.hgetall(key);
      return result;
    } catch (error) {
      logger.error('Redis HGETALL error:', error);
      return {};
    }
  }

  async hDel(key: string, field: string): Promise<boolean> {
    try {
      await this.client.hdel(key, field);
      return true;
    } catch (error) {
      logger.error('Redis HDEL error:', error);
      return false;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      const keys = await this.client.keys(pattern);
      return keys;
    } catch (error) {
      logger.error('Redis KEYS error:', error);
      return [];
    }
  }

  async flushAll(): Promise<boolean> {
    try {
      await this.client.flushall();
      return true;
    } catch (error) {
      logger.error('Redis FLUSHALL error:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      logger.info('Redis disconnected');
    } catch (error) {
      logger.error('Redis disconnect error:', error);
    }
  }

  getClient(): Redis {
    return this.client;
  }
}

export default new RedisCache();
