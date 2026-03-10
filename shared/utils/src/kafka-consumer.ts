import { Kafka, Consumer, EachMessagePayload, KafkaMessage } from 'kafkajs';
import { KafkaEvent } from '@eventhub/shared-types';
import { createLogger } from './logger';

const logger = createLogger('kafka-consumer');

export type MessageHandler = (event: KafkaEvent) => Promise<void>;

export class KafkaConsumer {
  private kafka: Kafka;
  private consumer: Consumer;
  private connected: boolean = false;
  private handlers: Map<string, MessageHandler[]> = new Map();

  constructor(brokers: string[], groupId: string) {
    this.kafka = new Kafka({
      clientId: `eventhub-${groupId}`,
      brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });
    this.consumer = this.kafka.consumer({
      groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.consumer.connect();
      this.connected = true;
      logger.info('Kafka consumer connected');
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.consumer.disconnect();
      this.connected = false;
      logger.info('Kafka consumer disconnected');
    }
  }

  registerHandler(eventType: string, handler: MessageHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
    logger.info(`Handler registered for event type: ${eventType}`);
  }

  async subscribe(topics: string[]): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    for (const topic of topics) {
      await this.consumer.subscribe({ topic, fromBeginning: false });
      logger.info(`Subscribed to topic: ${topic}`);
    }
  }

  async start(): Promise<void> {
    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        await this.handleMessage(payload);
      }
    });
    logger.info('Kafka consumer started');
  }

  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;

    try {
      const event: KafkaEvent = JSON.parse(message.value!.toString());
      
      logger.info('Processing event', {
        topic,
        partition,
        offset: message.offset,
        eventType: event.eventType,
        eventId: event.eventId
      });

      const handlers = this.handlers.get(event.eventType);
      if (handlers && handlers.length > 0) {
        await Promise.all(handlers.map(handler => handler(event)));
        logger.info('Event processed successfully', { eventId: event.eventId });
      } else {
        logger.warn('No handlers registered for event type', { eventType: event.eventType });
      }
    } catch (error) {
      logger.error('Error processing message', {
        topic,
        partition,
        offset: message.offset,
        error
      });
      // Depending on your error handling strategy, you might want to:
      // 1. Retry the message
      // 2. Send to a dead letter queue
      // 3. Just log and continue
      throw error;
    }
  }
}

export default KafkaConsumer;
