import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createLogger, KafkaProducer, RedisCache } from '@eventhub/shared-utils';
import { authRouter } from './routes/auth.routes';
import { userRouter } from './routes/user.routes';
import { errorHandler } from './middleware/error-handler';
import { prisma } from './config/database';

dotenv.config();

const logger = createLogger('user-service');
const app: Express = express();
const PORT = process.env.PORT || 3001;

// Initialize Kafka and Redis
export const kafkaProducer = new KafkaProducer(
  (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
);
export const redisCache = new RedisCache(
  process.env.REDIS_URL || 'redis://localhost:6379'
);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'user-service',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);

// Error handling
app.use(errorHandler);

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');
  
  await prisma.$disconnect();
  await kafkaProducer.disconnect();
  await redisCache.disconnect();
  
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
const startServer = async () => {
  try {
    // Connect to dependencies
    await redisCache.connect();
    await kafkaProducer.connect();
    
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected');

    app.listen(PORT, () => {
      logger.info(`User Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

startServer();

export default app;
