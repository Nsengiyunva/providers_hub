import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '@eventhub/shared-utils';

const logger = createLogger('request-logger');

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Generate correlation ID
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  req.headers['x-correlation-id'] = correlationId;

  // Attach to response headers
  res.setHeader('X-Correlation-ID', correlationId);

  const startTime = Date.now();

  // Log incoming request
  logger.info('Incoming request', {
    correlationId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  // Capture the original end function
  const originalEnd = res.end;

  // Override end function to log response
  res.end = function(this: any, ...args: any[]) {
    const duration = Date.now() - startTime;
    
    logger.info('Outgoing response', {
      correlationId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });

    // Call original end function
    return originalEnd.apply(this, args);
  } as any;

  next();
};
