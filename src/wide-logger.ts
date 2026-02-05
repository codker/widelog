import type {
  LoggerAdapter,
  WideRequestContext,
  WideLogger,
  WideLoggerOptions,
} from "./types.js";
import { logContext } from "./context.js";
import { configureSampling, shouldEmit } from "./sampling.js";
import { emitWideEvent } from "./emit.js";

export function createWideLogger(
  adapter: LoggerAdapter,
  options: WideLoggerOptions = {},
): WideLogger {
  const samplingConfig = configureSampling(options.sampling);

  return {
    runContext: <T>(ctx: WideRequestContext, fn: () => T): T => {
      return logContext.run(ctx, fn);
    },

    getContext: (): WideRequestContext | undefined => {
      return logContext.get();
    },

    set: <K extends keyof WideRequestContext>(
      fieldOrFields: K | Partial<WideRequestContext>,
      value?: WideRequestContext[K],
    ): void => {
      if (typeof fieldOrFields === "string") {
        logContext.set(fieldOrFields, value as WideRequestContext[K]);
      } else {
        logContext.set(fieldOrFields);
      }
    },

    setDetails: (data: Record<string, unknown>): void => {
      logContext.setDetails(data);
    },

    trackDbQuery: (durationMs: number): void => {
      logContext.trackDbQuery(durationMs);
    },

    emit: (eventName: string): void => {
      const ctx = logContext.get();

      if (!ctx) {
        return;
      }

      const result = shouldEmit(ctx, samplingConfig);
      ctx.samplingReason = result.reason;

      if (result.decision === "emit") {
        emitWideEvent(adapter, eventName, ctx);
      }
    },
  };
}
