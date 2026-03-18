import { Request, Response, NextFunction } from 'express';
import { logger } from '@eventhub/shared-utils';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  
  // Log incoming request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Capture response
  const originalEnd = res.end;
  
  res.end = function(this: Response, ...args: any[]): Response {
    const duration = Date.now() - startTime;
    
    // Log response
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length')
    });

    // Log errors
    if (res.statusCode >= 400) {
      logger.warn('Request error', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`
      });
    }

    // Call original end method with proper types
    if (args.length > 0) {
      return originalEnd.call(this, args[0], args[1] as BufferEncoding, args[2] as (() => void) | undefined);
    }
    return originalEnd.call(this);
  };

  next();
}

export default requestLogger;
