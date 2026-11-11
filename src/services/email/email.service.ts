import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export interface EmailMessage {
  to: string[];
  subject: string;
  html: string;
  text: string;
}

/**
 * Transport-agnostic email sender. Swap the implementation (Resend, SendGrid, SES…)
 * without touching callers — only `createEmailService` needs to change.
 */
export interface EmailService {
  send(message: EmailMessage): Promise<void>;
}

export class NodemailerEmailService implements EmailService {
  private readonly transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS ?? '' } } : {}),
    });
  }

  async send(message: EmailMessage): Promise<void> {
    const info = await this.transporter.sendMail({
      from: env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    logger.debug({ messageId: info.messageId, subject: message.subject }, 'email sent');
  }
}

/** In-memory outbox used by the test suite. */
export class MemoryEmailService implements EmailService {
  readonly outbox: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.outbox.push(message);
  }

  clear(): void {
    this.outbox.length = 0;
  }
}

function createEmailService(): EmailService {
  return env.EMAIL_TRANSPORT === 'memory' ? new MemoryEmailService() : new NodemailerEmailService();
}

export const emailService: EmailService = createEmailService();
