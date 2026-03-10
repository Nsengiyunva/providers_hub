import axios from 'axios';
import { createLogger } from '@eventhub/shared-utils';

const logger = createLogger('service-registry');

interface ServiceConfig {
  name: string;
  url: string;
  healthEndpoint: string;
  timeout: number;
  retries: number;
}

class ServiceRegistry {
  private services: Map<string, ServiceConfig>;
  private healthStatus: Map<string, boolean>;

  constructor() {
    this.services = new Map();
    this.healthStatus = new Map();
    this.initializeServices();
  }

  private initializeServices() {
    const services: ServiceConfig[] = [
      {
        name: 'user-service',
        url: process.env.USER_SERVICE_URL || 'http://user-service:3001',
        healthEndpoint: '/health',
        timeout: 5000,
        retries: 3
      },
      {
        name: 'profile-service',
        url: process.env.PROFILE_SERVICE_URL || 'http://profile-service:3002',
        healthEndpoint: '/health',
        timeout: 5000,
        retries: 3
      },
      {
        name: 'catalog-service',
        url: process.env.CATALOG_SERVICE_URL || 'http://catalog-service:3003',
        healthEndpoint: '/health',
        timeout: 5000,
        retries: 3
      },
      {
        name: 'inquiry-service',
        url: process.env.INQUIRY_SERVICE_URL || 'http://inquiry-service:3004',
        healthEndpoint: '/health',
        timeout: 5000,
        retries: 3
      },
      {
        name: 'payment-service',
        url: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3005',
        healthEndpoint: '/health',
        timeout: 5000,
        retries: 3
      },
      {
        name: 'review-service',
        url: process.env.REVIEW_SERVICE_URL || 'http://review-service:3006',
        healthEndpoint: '/health',
        timeout: 5000,
        retries: 3
      },
      {
        name: 'notification-service',
        url: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3007',
        healthEndpoint: '/health',
        timeout: 5000,
        retries: 3
      },
      {
        name: 'media-service',
        url: process.env.MEDIA_SERVICE_URL || 'http://media-service:3008',
        healthEndpoint: '/health',
        timeout: 5000,
        retries: 3
      }
    ];

    services.forEach(service => {
      this.services.set(service.name, service);
      this.healthStatus.set(service.name, false);
    });

    logger.info(`Initialized ${services.length} services in registry`);
  }

  getServiceUrl(serviceName: string): string {
    const service = this.services.get(serviceName);
    if (!service) {
      logger.error(`Service ${serviceName} not found in registry`);
      throw new Error(`Service ${serviceName} not found`);
    }
    return service.url;
  }

  getService(serviceName: string): ServiceConfig | undefined {
    return this.services.get(serviceName);
  }

  getAllServices(): string[] {
    return Array.from(this.services.keys());
  }

  async checkHealth(serviceName: string): Promise<boolean> {
    const service = this.services.get(serviceName);
    if (!service) {
      return false;
    }

    try {
      const response = await axios.get(
        `${service.url}${service.healthEndpoint}`,
        {
          timeout: service.timeout,
          validateStatus: (status) => status === 200
        }
      );

      const isHealthy = response.data.status === 'healthy';
      this.healthStatus.set(serviceName, isHealthy);

      if (isHealthy) {
        logger.debug(`Service ${serviceName} is healthy`);
      } else {
        logger.warn(`Service ${serviceName} returned unhealthy status`);
      }

      return isHealthy;
    } catch (error: any) {
      this.healthStatus.set(serviceName, false);
      logger.error(`Health check failed for ${serviceName}`, {
        error: error.message
      });
      return false;
    }
  }

  async healthCheckAll(): Promise<Map<string, boolean>> {
    const promises = Array.from(this.services.keys()).map(serviceName =>
      this.checkHealth(serviceName)
    );

    await Promise.allSettled(promises);
    return this.healthStatus;
  }

  getHealthStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    this.healthStatus.forEach((healthy, serviceName) => {
      status[serviceName] = healthy;
    });
    return status;
  }

  isServiceHealthy(serviceName: string): boolean {
    return this.healthStatus.get(serviceName) || false;
  }

  // Start periodic health checks
  startHealthMonitoring(intervalMs: number = 30000) {
    setInterval(async () => {
      logger.debug('Running periodic health checks...');
      await this.healthCheckAll();
    }, intervalMs);
    logger.info(`Started health monitoring with ${intervalMs}ms interval`);
  }
}

export const serviceRegistry = new ServiceRegistry();

// Start health monitoring on initialization
if (process.env.NODE_ENV !== 'test') {
  serviceRegistry.startHealthMonitoring();
}
