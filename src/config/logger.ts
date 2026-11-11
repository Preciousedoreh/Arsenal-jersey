import { pino } from 'pino';
import { env, isProduction, isTest } from './env.js';

/**
 * Anything that may contain credentials or tokens is redacted before it reaches a log sink.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'jersey-store-api' },
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.headers["x-mock-signature"]',
      'res.headers["set-cookie"]',
      '*.password',
      '*.newPassword',
      '*.currentPassword',
      '*.token',
    ],
    censor: '[redacted]',
  },
  ...(!isProduction && !isTest
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
        },
      }
    : {}),
});

export type Logger = typeof logger;
