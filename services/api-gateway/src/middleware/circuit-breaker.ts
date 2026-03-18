import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
}

interface ServiceCircuit {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  successCount: number;
}

class CircuitBreaker {
  private circuits: Map<string, ServiceCircuit>;
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.circuits = new Map();
    this.config = {
      failureThreshold: 5,
      resetTimeout: 60000, // 60 seconds
      halfOpenRequests: 3,
      ...config
    };
    
    // Load circuit states from Redis on startup
    this.loadCircuitStates();
  }

  private async loadCircuitStates(): Promise<void> {
    try {
      const services = ['user-service', 'profile-service', 'catalog-service', 'inquiry-service'];
      
      for (const service of services) {
        const stateKey = `circuit:${service}:state`;
        const failuresKey = `circuit:${service}:failures`;
        
        const [state, failures] = await Promise.all([
          redis.get(stateKey),
          redis.get(failuresKey)
        ]);
        
        this.circuits.set(service, {
          state: (state as CircuitState) || CircuitState.CLOSED,
          failures: parseInt(failures || '0'),
          lastFailureTime: Date.now(),
          successCount: 0
        });
      }
    } catch (error) {
      console.error('Error loading circuit states from Redis:', error);
    }
  }

  private async saveCircuitState(service: string, circuit: ServiceCircuit): Promise<void> {
    try {
      await Promise.all([
        redis.set(`circuit:${service}:state`, circuit.state),
        redis.set(`circuit:${service}:failures`, circuit.failures.toString()),
        redis.expire(`circuit:${service}:state`, 3600),
        redis.expire(`circuit:${service}:failures`, 3600)
      ]);
    } catch (error) {
      console.error(`Error saving circuit state for ${service}:`, error);
    }
  }

  getCircuit(service: string): ServiceCircuit {
    if (!this.circuits.has(service)) {
      this.circuits.set(service, {
        state: CircuitState.CLOSED,
        failures: 0,
        lastFailureTime: 0,
        successCount: 0
      });
    }
    return this.circuits.get(service)!;
  }

  async recordSuccess(service: string): Promise<void> {
    const circuit = this.getCircuit(service);

    if (circuit.state === CircuitState.HALF_OPEN) {
      circuit.successCount++;
      
      if (circuit.successCount >= this.config.halfOpenRequests) {
        circuit.state = CircuitState.CLOSED;
        circuit.failures = 0;
        circuit.successCount = 0;
        console.log(`Circuit for ${service} CLOSED after successful recovery`);
      }
    } else if (circuit.state === CircuitState.CLOSED) {
      circuit.failures = Math.max(0, circuit.failures - 1);
    }

    await this.saveCircuitState(service, circuit);
  }

  async recordFailure(service: string): Promise<void> {
    const circuit = this.getCircuit(service);
    circuit.failures++;
    circuit.lastFailureTime = Date.now();

    if (circuit.state === CircuitState.HALF_OPEN) {
      circuit.state = CircuitState.OPEN;
      circuit.successCount = 0;
      console.log(`Circuit for ${service} re-OPENED after failure in half-open state`);
    } else if (circuit.failures >= this.config.failureThreshold) {
      circuit.state = CircuitState.OPEN;
      console.log(`Circuit for ${service} OPENED after ${circuit.failures} failures`);
    }

    await this.saveCircuitState(service, circuit);
  }

  canRequest(service: string): boolean {
    const circuit = this.getCircuit(service);

    if (circuit.state === CircuitState.CLOSED) {
      return true;
    }

    if (circuit.state === CircuitState.OPEN) {
      const timeSinceLastFailure = Date.now() - circuit.lastFailureTime;
      
      if (timeSinceLastFailure >= this.config.resetTimeout) {
        circuit.state = CircuitState.HALF_OPEN;
        circuit.successCount = 0;
        console.log(`Circuit for ${service} moved to HALF_OPEN state`);
        return true;
      }
      
      return false;
    }

    // HALF_OPEN state
    return true;
  }

  getStatus(service: string): ServiceCircuit {
    return this.getCircuit(service);
  }

  getAllStatus(): Record<string, ServiceCircuit> {
    const status: Record<string, ServiceCircuit> = {};
    this.circuits.forEach((circuit, service) => {
      status[service] = { ...circuit };
    });
    return status;
  }
}

// Create singleton instance
const circuitBreakerInstance = new CircuitBreaker();

// Middleware function
export function circuitBreakerMiddleware(req: Request, res: Response, next: NextFunction): void {

  if (!req || !req.path) {
    return next();
  }

  const serviceName = getServiceNameFromPath(req.path);

  if (!serviceName) {
    return next();
  }

  if (!circuitBreakerInstance.canRequest(serviceName)) {
    res.status(503).json({
      error: 'Service Unavailable',
      message: `Circuit breaker is OPEN for ${serviceName}`,
      service: serviceName
    });
    return;
  }

  // Intercept response to record success/failure
  const originalEnd = res.end;
  
  res.end = function(this: Response, ...args: any[]): Response {
    const statusCode = res.statusCode;

    if (statusCode >= 500) {
      circuitBreakerInstance.recordFailure(serviceName);
    } else {
      circuitBreakerInstance.recordSuccess(serviceName);
    }

    // Call original end method with proper types
    if (args.length > 0) {
      return originalEnd.call(this, args[0], args[1] as BufferEncoding, args[2] as (() => void) | undefined);
    }
    return originalEnd.call(this);
  };

  next();
}

function getServiceNameFromPath(path: string): string | null {
  if (!path || typeof path !== 'string') {
    return null;
  }
  
  if (path.startsWith('/api/users') || path.startsWith('/api/auth')) {
    return 'user-service';
  }
  if (path.startsWith('/api/profiles')) {
    return 'profile-service';
  }
  if (path.startsWith('/api/catalog')) {
    return 'catalog-service';
  }
  if (path.startsWith('/api/inquiries') || path.startsWith('/api/bookings')) {
    return 'inquiry-service';
  }
  if (path.startsWith('/api/payments')) {
    return 'payment-service';
  }
  if (path.startsWith('/api/reviews')) {
    return 'review-service';
  }
  if (path.startsWith('/api/notifications')) {
    return 'notification-service';
  }
  if (path.startsWith('/api/media')) {
    return 'media-service';
  }
  return null;
}

// Export middleware as default
export default circuitBreakerMiddleware;

// Also export for named import compatibility
export const circuitBreaker = circuitBreakerMiddleware;

// Export status endpoint
export function getCircuitBreakerStatus(): Record<string, ServiceCircuit> {
  return circuitBreakerInstance.getAllStatus();
}
