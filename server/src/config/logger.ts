import pino from 'pino';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { env } from './env';

export const logger = pino({
  level: env.isProduction ? 'info' : 'debug',
  transport: env.isProduction
    ? undefined
    : {
        target: 'pino/file',
        options: { destination: 1, colorize: true },
      },
  formatters: {
    level(label) {
      return { level: label.toUpperCase() };
    },
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers.set-cookie',
      'res.headers["set-cookie"]',
      'body.password',
      'body.passwordStr',
      'body.currentPassword',
      'body.newPassword',
      'body.token',
      'body.code',
      'body.otp',
      'body.refreshToken',
      'body.accessToken',
      'body.devCode',
      'body.apiKey',
      'body.apiSecret',
      'body.CLOUDINARY_API_SECRET',
      'token',
      'accessToken',
      'refreshToken',
      'password',
      'currentPassword',
      'newPassword',
      'otp',
      'code',
      '*.password',
      '*.token',
      '*.apiKey',
      '*.apiSecret',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const httpLogger = pinoHttp({
  logger,
  customProps: (req) => ({
    correlationId: (req as any).correlationId,
  }),
  autoLogging: {
    ignore: (req) => (req.url || '').startsWith('/health'),
  },
  wrapSerializers: false,
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export function correlationMiddleware(req: Request, _res: Response, next: NextFunction) {
  req.correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();
  _res.setHeader('x-correlation-id', req.correlationId);
  next();
}
