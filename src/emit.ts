import type { LoggerAdapter, WideRequestContext } from "./types.js";

export function emitWideEvent(
  adapter: LoggerAdapter,
  eventName: string,
  ctx: WideRequestContext,
): void {
  // omit startTime from logs, timestamp already present
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { startTime, ...contextWithoutStartTime } = ctx;

  const logEntry = {
    ...contextWithoutStartTime,
  };

  try {
    // error for 5xx
    if (ctx.statusCode && ctx.statusCode >= 500) {
      adapter.error(eventName, logEntry);
    }
    // warn for 4xx
    else if (ctx.statusCode && ctx.statusCode >= 400) {
      adapter.warn(eventName, logEntry);
    }
    // info otherwise
    else {
      adapter.info(eventName, logEntry);
    }
  } catch {
    // this should never happen, but silently swallow adapter errors to avoid disrupting the application
  }
}
