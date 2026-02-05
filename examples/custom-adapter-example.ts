/**
 * Example: Creating a custom logger adapter.
 *
 * This shows how to create an adapter for any logging library.
 */
import {
  createWideLogger,
  type LoggerAdapter,
  type WideRequestContext,
} from "widelog";

// example: console adapter
function consoleAdapter(
  baseBindings: Record<string, unknown> = {},
): LoggerAdapter {
  const log =
    (level: string, logFn: typeof console.log) =>
    (msg: string, meta?: Record<string, unknown>) => {
      logFn(`[${level}]`, msg, { ...baseBindings, ...meta });
    };

  return {
    trace: log("TRACE", console.log),
    debug: log("DEBUG", console.log),
    info: log("INFO", console.log),
    warn: log("WARN", console.warn),
    error: log("ERROR", console.error),
    child: (bindings) => consoleAdapter({ ...baseBindings, ...bindings }),
  };
}

// integration example

// create wide logger with custom adapter
const wideLogger = createWideLogger(consoleAdapter(), {
  sampling: {
    sampleRate: 1, // log everything for demo
  },
});

const context: WideRequestContext = {
  details: {},
  method: "POST",
  path: "/api/orders",
  requestId: crypto.randomUUID(),
  startTime: performance.now(),
  timestamp: new Date().toISOString(),
  url: "/api/orders",
};

// simulate logging
wideLogger.runContext(context, () => {
  // set base info, possibly in the request handler or middleware
  wideLogger.set({
    userId: "348903489",
    operationType: "write",
    resourceType: "order",
  });

  // add details in the business logic layer
  wideLogger.setDetails({
    amount: 9999,
    currency: "EUR",
    orderId: "23523",
  });

  // emits a log event
  // if using widelog middlewares, this is already done for you at the end of the
  // request, before the response is sent
  wideLogger.emit("order_created");
});
