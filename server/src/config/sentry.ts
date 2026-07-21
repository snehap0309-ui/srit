import { env } from './env';

let Sentry: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Sentry = require('@sentry/node');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@sentry/profiling-node');
} catch {
  // Sentry packages not available
}

export function initSentry() {
  if (!Sentry || !env.sentryDsn) return;

  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.nodeEnv,
    tracesSampleRate: env.isProduction ? 0.1 : 0,
    profilesSampleRate: env.isProduction ? 0.1 : 0,
    enabled: env.isProduction,
  });
}

export function getSentryRequestHandler() {
  if (!Sentry || !Sentry.Handlers) return (_req: any, _res: any, next: any) => next();
  return Sentry.Handlers.requestHandler();
}

export function getSentryErrorHandler() {
  if (!Sentry || !Sentry.Handlers) return (err: any, _req: any, _res: any, next: any) => next(err);
  return Sentry.Handlers.errorHandler();
}
