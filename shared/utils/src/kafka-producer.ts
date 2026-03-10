import { Kafka, Producer, ProducerRecord } from 'kafkajs';
import { KafkaEvent } from '@eventhub/shared-types';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from './logger';

const logger = createLogger('kafka-producer');

export class KafkaProducer {
  private kafka: Kafka;
  private producer: Producer;
  private connected: boolean = false;

  constructor(brokers: string[]) {
    this.kafka = new Kafka({
      clientId: 'eventhub-producer',
      brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });
    this.producer = this.kafka.producer();
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.producer.connect();
      this.connected = true;
      logger.info('Kafka producer connected');
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.producer.disconnect();
      this.connected = false;
      logger.info('Kafka producer disconnected');
    }
  }

  async sendEvent<T>(
    topic: string,
    eventType: string,
    payload: T,
    metadata?: {
      userId?: string;
      correlationId?: string;
      source: string;
    }
  ): Promise<void> {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const event: KafkaEvent<T> = {
        eventId: uuidv4(),
        eventType,
        timestamp: new Date(),
        payload,
        metadata
      };

      await this.producer.send({
        topic,
        messages: [
          {
            key: metadata?.userId || event.eventId,
            value: JSON.stringify(event),
            headers: {
              eventType,
              timestamp: event.timestamp.toISOString()
            }
          }
        ]
      });

      logger.info(`Event published to topic ${topic}`, { eventType, eventId: event.eventId });
    } catch (error) {
      logger.error('Failed to send Kafka event', { topic, eventType, error });
      throw error;
    }
  }

  async sendBatch(records: ProducerRecord[]): Promise<void> {
    try {
      if (!this.connected) {
        await this.connect();
      }

      await this.producer.sendBatch({
        topicMessages: records
      });

      logger.info(`Batch of ${records.length} events published`);
    } catch (error) {
      logger.error('Failed to send Kafka batch', { error });
      throw error;
    }
  }
}

export default KafkaProducer;
