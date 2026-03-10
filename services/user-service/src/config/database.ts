import { PrismaClient } from '@prisma/client';
import { createLogger } from '@eventhub/shared-utils';

const logger = createLogger('prisma');

export const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' }
  ]
});

// Log queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query' as never, (e: any) => {
    logger.debug('Query executed', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`
    });
  });
}

prisma.$on('error' as never, (e: any) => {
  logger.error('Prisma error', { error: e });
});

prisma.$on('warn' as never, (e: any) => {
  logger.warn('Prisma warning', { warning: e });
});

export default prisma;
