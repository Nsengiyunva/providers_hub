import { Request, Response, NextFunction, RequestHandler } from 'express';
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
  private circuits: Map<string, ServiceCircuit> = new Map();
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: 5,
      resetTimeout: 60000,
      halfOpenRequests: 3,
      ...config
    };

    this.loadCircuitStates();
  }

  private async loadCircuitStates(): Promise<void> {
    try {
      const services = [
        'user-service',
        'profile-service',
        'catalog-service',
        'inquiry-service'
      ];

      for (const service of services) {
        const [state, failures] = await Promise.all([
          redis.get(`circuit:${service}:state`),
          redis.get(`circuit:${service}:failures`)
        ]);

        this.circuits.set(service, {
          state: (state as CircuitState) || CircuitState.CLOSED,
          failures: parseInt(failures || '0', 10),
          lastFailureTime: Date.now(),
          successCount: 0
        });
      }
    } catch (error: unknown) {
      console.error('Error loading circuit states:', error);
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
    } catch (error: unknown) {
      console.error(`Error saving circuit for ${service}:`, error);
    }
  }

  private getCircuit(service: string): ServiceCircuit {
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
        console.log(`Circuit CLOSED for ${service}`);
      }
    } else {
      circuit.failures = Math.max(0, circuit.failures - 1);
    }

    await this.saveCircuitState(service, circuit);
  }

  async recordFailure(service: string): Promise<void> {
    const circuit = this.getCircuit(service);
    circuit.failures++;
    circuit.lastFailureTime = Date.now();

    if (
      circuit.state === CircuitState.HALF_OPEN ||
      circuit.failures >= this.config.failureThreshold
    ) {
      circuit.state = CircuitState.OPEN;
      circuit.successCount = 0;
      console.log(`Circuit OPEN for ${service}`);
    }

    await this.saveCircuitState(service, circuit);
  }

  canRequest(service: string): boolean {
    const circuit = this.getCircuit(service);

    if (circuit.state === CircuitState.CLOSED) return true;

    if (circuit.state === CircuitState.OPEN) {
      const elapsed = Date.now() - circuit.lastFailureTime;

      if (elapsed >= this.config.resetTimeout) {
        circuit.state = CircuitState.HALF_OPEN;
        circuit.successCount = 0;
        console.log(`Circuit HALF_OPEN for ${service}`);
        return true;
      }

      return false;
    }

    return true;
  }

  getAllStatus(): Record<string, ServiceCircuit> {
    const result: Record<string, ServiceCircuit> = {};
    this.circuits.forEach((c, s) => (result[s] = { ...c }));
    return result;
  }
}

const circuitBreakerInstance = new CircuitBreaker();


// ✅ FIXED MIDDLEWARE
export const circuitBreakerMiddleware: RequestHandler = (req, res, next) => {
  const serviceName = getServiceNameFromPath(req.path);

  if (!serviceName) return next();

  if (!circuitBreakerInstance.canRequest(serviceName)) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: `Circuit OPEN for ${serviceName}`
    });
  }

  // ✅ SAFER: use res.on('finish') instead of overriding res.end
  res.on('finish', () => {
    const statusCode = res.statusCode;

    if (statusCode >= 500) {
      circuitBreakerInstance.recordFailure(serviceName);
    } else {
      circuitBreakerInstance.recordSuccess(serviceName);
    }
  });

  next();
};


// Route → service mapping
function getServiceNameFromPath(path: string): string | null {
  if (path.startsWith('/api/users') || path.startsWith('/api/auth')) return 'user-service';
  if (path.startsWith('/api/profiles')) return 'profile-service';
  if (path.startsWith('/api/catalog')) return 'catalog-service';
  if (path.startsWith('/api/inquiries') || path.startsWith('/api/bookings')) return 'inquiry-service';
  if (path.startsWith('/api/payments')) return 'payment-service';
  if (path.startsWith('/api/reviews')) return 'review-service';
  if (path.startsWith('/api/notifications')) return 'notification-service';
  if (path.startsWith('/api/media')) return 'media-service';

  return null;
}

export default circuitBreakerMiddleware;

export const circuitBreaker = circuitBreakerMiddleware;

export function getCircuitBreakerStatus() {
  return circuitBreakerInstance.getAllStatus();
}