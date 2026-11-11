import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { EMAIL_QUEUE_NAME, processEmailJob, type EmailJob } from '../jobs/email.worker.js';
import { createBullConnection } from './redis.js';

export interface EmailQueue {
  enqueue(job: EmailJob): Promise<void>;
  close(): Promise<void>;
}

/** Redis-backed queue with retries + exponential backoff, so slow SMTP never blocks a request. */
class BullEmailQueue implements EmailQueue {
  private queue: Queue<EmailJob> | undefined;

  private get q(): Queue<EmailJob> {
    this.queue ??= new Queue<EmailJob>(EMAIL_QUEUE_NAME, {
      connection: createBullConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    });
    return this.queue;
  }

  async enqueue(job: EmailJob): Promise<void> {
    await this.q.add(job.template, job);
  }

  async close(): Promise<void> {
    await this.queue?.close();
  }
}

/** Processes jobs immediately in-process. Used by tests; never in production (env validation forbids it). */
class InlineEmailQueue implements EmailQueue {
  async enqueue(job: EmailJob): Promise<void> {
    try {
      await processEmailJob(job);
    } catch (err) {
      logger.error({ err, template: job.template }, 'inline email job failed');
    }
  }

  async close(): Promise<void> {}
}

export const emailQueue: EmailQueue =
  env.QUEUE_DRIVER === 'inline' ? new InlineEmailQueue() : new BullEmailQueue();
