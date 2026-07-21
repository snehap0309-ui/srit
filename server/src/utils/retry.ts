import { PrismaClientUnknownRequestError, PrismaClientRustPanicError } from '@prisma/client/runtime/library';

const RETRYABLE_ERROR_MESSAGES = ['Response from the Engine was empty', 'Connection pool timeout', 'Can\'t reach database'];

function isRetryableError(err: unknown): boolean {
  if (err instanceof PrismaClientUnknownRequestError || err instanceof PrismaClientRustPanicError) {
    return RETRYABLE_ERROR_MESSAGES.some((msg) => err.message.includes(msg));
  }
  if (err instanceof Error && err.message?.includes('Response from the Engine was empty')) {
    return true;
  }
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: { maxRetries?: number; baseDelayMs?: number },
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 100;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries || !isRetryableError(err)) {
        throw err;
      }
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('Unreachable');
}
