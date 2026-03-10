import { Request, Response, NextFunction } from 'express';
import { createLogger } from '@eventhub/shared-utils';
import { redisCache } from '../index';

const logger = createLogger('circuit-breaker');

interface CircuitState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

class CircuitBreaker {
  private readonly failureThreshold: number = 5;
  private readonly resetTimeout: number = 60000; // 1 minute
  private readonly halfOpenRequests: number = 3;
  
  async getState(serviceName: string): Promise<CircuitState> {
    const key = `circuit:${serviceName}`;
    const state = await redisCache.get<CircuitState>(key);
    
    if (!state) {
      return {
        failures: 0,
        lastFailureTime: 0,
        state: 'CLOSED'
      };
    }
    
    return state;
  }

  async setState(serviceName: string, state: CircuitState): Promise<void> {
    const key = `circuit:${serviceName}`;
    await redisCache.set(key, state, 300); // 5 minutes TTL
  }

  async recordSuccess(serviceName: string): Promise<void> {
    const state = await this.getState(serviceName);
    
    if (state.state === 'HALF_OPEN') {
      // Successful request in half-open state, close the circuit
      logger.info(`Circuit closed for ${serviceName}`);
      await this.setState(serviceName, {
        failures: 0,
        lastFailureTime: 0,
        state: 'CLOSED'
      });
    } else if (state.state === 'CLOSED' && state.failures > 0) {
      // Reset failure count on success
      await this.setState(serviceName, {
        failures: 0,
        lastFailureTime: 0,
        state: 'CLOSED'
      });
    }
  }

  async recordFailure(serviceName: string): Promise<void> {
    const state = await this.getState(serviceName);
    const newFailures = state.failures + 1;
    
    if (newFailures >= this.failureThreshold) {
      // Open the circuit
      logger.warn(`Circuit opened for ${serviceName} after ${newFailures} failures`);
      await this.setState(serviceName, {
        failures: newFailures,
        lastFailureTime: Date.now(),
        state: 'OPEN'
      });
    } else {
      // Increment failure count
      await this.setState(serviceName, {
        failures: newFailures,
        lastFailureTime: Date.now(),
        state: state.state
      });
    }
  }

  async canRequest(serviceName: string): Promise<boolean> {
    const state = await this.getState(serviceName);
    
    if (state.state === 'CLOSED') {
      return true;
    }
    
    if (state.state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - state.lastFailureTime;
      
      if (timeSinceLastFailure >= this.resetTimeout) {
        // Transition to half-open
        logger.info(`Circuit transitioning to half-open for ${serviceName}`);
        await this.setState(serviceName, {
          ...state,
          state: 'HALF_OPEN'
        });
        return true;
      }
      
      return false;
    }
    
    // HALF_OPEN state - allow limited requests
    return true;
  }
}

const circuitBreaker = new CircuitBreaker();

export const circuitBreakerMiddleware = (serviceName: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const canProceed = await circuitBreaker.canRequest(serviceName);
      
      if (!canProceed) {
        logger.warn(`Circuit breaker OPEN for ${serviceName}`, {
          path: req.path,
          method: req.method
        });
        
        return res.status(503).json({
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: `${serviceName} is temporarily unavailable. Please try again later.`
          }
        });
      }

      // Store original end function
      const originalEnd = res.end;
      const originalSend = res.send;
      const originalJson = res.json;

      // Wrap response to track success/failure
      const trackResponse = function(this: any, ...args: any[]) {
        const statusCode = res.statusCode;
        
        if (statusCode >= 200 && statusCode < 400) {
          circuitBreaker.recordSuccess(serviceName);
        } else if (statusCode >= 500) {
          circuitBreaker.recordFailure(serviceName);
        }
        
        return originalEnd.apply(this, args);
      };

      res.end = trackResponse as any;
      
      next();
    } catch (error: any) {
      logger.error('Circuit breaker middleware error', {
        serviceName,
        error: error.message
      });
      next();
    }
  };
};

// Export as default for backwards compatibility
export const circuitBreaker = circuitBreakerMiddleware;
