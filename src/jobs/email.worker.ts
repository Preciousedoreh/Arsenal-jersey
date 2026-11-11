import { Worker } from 'bullmq';
import { logger } from '../config/logger.js';
import { createBullConnection } from '../lib/redis.js';
import { emailService } from '../services/email/email.service.js';
import {
  renderTemplate,
  type TemplateDataMap,
  type TemplateName,
} from '../services/email/templates/index.js';

export const EMAIL_QUEUE_NAME = 'email';

/** A queued email: which template, who receives it, and the template's typed data. */
export type EmailJob = {
  [N in TemplateName]: { template: N; to: string[]; data: TemplateDataMap[N] };
}[TemplateName];

export async function processEmailJob(job: EmailJob): Promise<void> {
  if (job.to.length === 0) return;
  const rendered = renderTemplate(job.template, job.data as never);
  await emailService.send({ to: job.to, ...rendered });
}

export function startEmailWorker(): Worker<EmailJob> {
  const worker = new Worker<EmailJob>(EMAIL_QUEUE_NAME, async (job) => processEmailJob(job.data), {
    connection: createBullConnection(),
    concurrency: 5,
  });
  worker.on('completed', (job) =>
    logger.debug({ jobId: job.id, template: job.data.template }, 'email job done'),
  );
  worker.on('failed', (job, err) =>
    logger.error(
      { jobId: job?.id, template: job?.data.template, attempts: job?.attemptsMade, err },
      'email job failed',
    ),
  );
  logger.info('email worker started');
  return worker;
}
