/**
 * Example: Using widelog with Pino
 */
import pino from "pino";
import { createWideLogger, type WideRequestContext } from "widelog";
import { pinoAdapter } from "widelog/adapters/pino";

// create pino logger
const pinoLogger = pino({
  level: "info",
});

// create wide logger with pino adapter
const wideLogger = createWideLogger(pinoAdapter(pinoLogger), {
  sampling: {
    sampleRate: 1, // log all for demo
  },
});

// simulate a request context
const context: WideRequestContext = {
  requestId: crypto.randomUUID(),
  method: "GET",
  path: "/api/users/:id",
  url: "/api/users/123",
  userAgent: "Mozilla/5.0",
  ip: "127.0.0.1",
  startTime: performance.now(),
  timestamp: new Date().toISOString(),
  details: {},
};

// simulate logging within the request context
wideLogger.runContext(context, () => {
  // set multiple context fields at once
  wideLogger.set({
    userId: "user-456",
    operationType: "write",
    resourceType: "order",
  });

  // trackDbQuery should be integrated with your DB layer to automatically track queries and timings
  wideLogger.trackDbQuery(120);

  // add details to the request context for this log event and all downstream events
  wideLogger.setDetails({
    amount: 99.99,
    currency: "USD",
    orderId: "order-789",
  });

  // emits a log event
  // if using widelog middlewares, this is already done for you at the end of the
  // request, before the response is sent
  wideLogger.emit("order_created");
});
