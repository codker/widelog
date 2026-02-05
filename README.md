# widelog

[![npm version](https://img.shields.io/npm/v/widelog)](https://www.npmjs.com/package/widelog)
[![CI](https://github.com/codker/widelog/actions/workflows/ci.yml/badge.svg)](https://github.com/codker/widelog/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/widelog)](https://nodejs.org/)

Are you tired of logging every single request in detail, log after log, only to drown in log volume and miss the important events when needed?

`widelog` is here to help, providing a structured "wide event" for each request that captures all the essential information in a single log. With smart sampling rules, you can control log volume while ensuring critical events are always logged. Adapters make it easy to integrate with your existing logger, and middlewares provide seamless integration with popular web frameworks.

## Installation

```bash
npm install widelog
```

Adapters and middlewares are available as subpath imports. Install their peer dependencies as needed:

```bash
# for pino adapter
npm install pino

# for fastify middleware
npm install fastify fastify-plugin

# for prisma middleware
npm install @prisma/client
```

Requires Node.js >= 22 (uses AsyncLocalStorage).

## Quick Start

### Fastify Integration

The Fastify plugin automatically creates a request context for each incoming request and emits a wide event just before the response is sent. Use `logContext` in route handlers and downstream to enrich the context.

By default, the emitted event name is `"request_completed"`. Set `eventName` on the context to override it, the middleware will then consume it (remove it from the log output) and use it as the log message.

```typescript
import Fastify from "fastify";
import pino from "pino";
import { createWideLogger, logContext } from "widelog";
import { pinoAdapter } from "widelog/adapters/pino";
import { fastifyWideLogger } from "widelog/middlewares/fastify";

const pinoLogger = pino({ level: "info" });

const wideLogger = createWideLogger(pinoAdapter(pinoLogger), {
  sampling: {
    sampleRate: 0.05, // 5% of normal requests
    slowRequestThresholdMs: 500, // always log requests slower than 500ms
    neverLogPaths: [/^\/health$/, /^\/metrics$/], // skip logging for those endpoints
  },
});

const app = Fastify({
  loggerInstance: pinoLogger,
  disableRequestLogging: true, // let widelog handle request logging
});

await app.register(fastifyWideLogger, { wideLogger });

// example of a user profile endpoint
app.get<{ Params: { id: string } }>("/api/users/:id", async (req) => {
  // you can use logContext to enrich the log context with additional fields relevant to this route
  logContext.set({
    eventName: "get-user-profile",
    userId: req.params.id,
    operationType: "read",
    resourceType: "user",
  });

  return { id: req.params.id, name: "John Doe" };
});

// health check (never logged, as per neverLogPaths)
app.get("/health", async () => ({ status: "ok" }));

await app.listen({ port: 3000 });
```

## Why widelog?

Let's look at a checkout flow example with multiple steps:

```
{"level":"info","msg":"fetching order","requestId":"abc123","path":"/api/orders/123/pay",...}
{"level":"info","msg":"validating payment","requestId":"abc123","path":"/api/orders/123/pay","cardType":"visa",...}
{"level":"info","msg":"processing payment","requestId":"abc123","path":"/api/orders/123/pay","cardType":"visa",...}
{"level":"info","msg":"payment failed","requestId":"abc123","path":"/api/orders/123/pay","error":"invalid_card",...}
```

Four logs to trace a single request. Now imagine this happening across thousands of requests per second. Important events like payment failures get lost in the noise and are not immediately useful when debugging issues or monitoring system health, you need to look through tons of logs to stitch together what happened.

With `widelog`, you get one rich structured log per request:

```json
{
  "level": "error",
  "msg": "process_order_payment",
  "requestId": "abc123",
  "method": "GET",
  "path": "/api/orders/123/pay",
  "url": "/api/orders/123/pay",
  "userAgent": "Mozilla/5.0 ...",
  "ip": "...",
  "userId": "user456",
  "statusCode": 500,
  "responseTimeMs": 1200,
  "dbQueryCount": 3,
  "dbQueryTimeMs": 150,
  "details": {
    "orderId": 123,
    "orderExists": true,
    "cardNumber": "**** **** **** 4242",
    "cardType": "visa",
    "cardValid": false,
    "paymentMethodId": "pm_789",
    "paymentAmount": 4999,
    "currency": "USD"
  },
  "error": {
    "message": "invalid_card",
    "code": "PAYMENT_FAILED"
  },
  "samplingReason": "error_status"
}
```

This is easier to search, filter and analyze.

## Features

- Adapter-based: works with any logger through a simple adapter interface
- Middlewares: ready to use middlewares for automatic request logging in your preferred web framework
- Context tracking: context persists throughout the request lifecycle using AsyncLocalStorage
- Smart sampling: configurable sampling rules to manage log volume
- Type-safe: full TypeScript support with generic type-safe setters
- Log levels: automatic level selection based on status code (5xx: error, 4xx: warn, rest: info)

Available adapters:

- Pino (`widelog/adapters/pino`)

Available middlewares:

- Fastify (`widelog/middlewares/fastify`)
- Prisma (`widelog/middlewares/prisma`)

Want more? Open a PR and contribute your own!

## Sampling Rules

Sampling rules are evaluated in order (first match wins):

1. neverLogPaths: drop immediately
2. errorStatusCodes: always emit
3. slowRequestThresholdMs: always emit
4. vipUserIds: always emit
5. alwaysLogPaths: always emit
6. sampleRate: random sampling

## API

### `createWideLogger(adapter, options?)`

Creates a wide event logger.

- `adapter`: `LoggerAdapter` - any logger adapter (e.g. `pinoAdapter(logger)`)
- `options.sampling`: sampling configuration
  - `sampleRate`: number (0-1, default: 0.05) - clamped to [0, 1]. Set to 1 while developing to log all requests.
  - `slowRequestThresholdMs`: number (default: 1000)
  - `errorStatusCodes`: number[] (default: 5xx codes)
  - `vipUserIds`: Set\<string\> - user IDs to always log
  - `alwaysLogPaths`: RegExp[]
  - `neverLogPaths`: RegExp[]

Returns a `WideLogger` instance.

### WideLogger Methods

- `runContext<T>(ctx, fn)` - execute function within a request context
- `getContext()` - get current context (undefined outside a context)
- `set<K>(field, value)` - type-safe setter for a single context field
- `set(fields)` - set multiple context fields at once from a `Partial<WideRequestContext>`
- `setDetails(data)` - merge arbitrary data into `ctx.details`
- `trackDbQuery(durationMs)` - increment query count and accumulate time
- `emit(eventName)` - emit a wide event (subject to sampling). Log level is selected automatically: 5xx → error, 4xx → warn, rest → info.

### `logContext`

The `logContext` object is exported for direct use in route handlers and downstream code. It provides the same context manipulation methods:

```typescript
import { logContext } from "widelog";

// set a single field
logContext.set("userId", "123");

// or set multiple fields at once
logContext.set({ userId: "123", operationType: "read", resourceType: "order" });

logContext.trackDbQuery(25);
logContext.setDetails({ emailSent: true });
```

- `run<T>(ctx, fn)` - run function within a new context
- `get()` - get current context (undefined if outside context)
- `set<K>(field, value)` - type-safe setter for a single field (no-op if outside context)
- `set(fields)` - set multiple fields at once from a `Partial<WideRequestContext>` (no-op if outside context)
- `setDetails(data)` - merge data into `ctx.details` (no-op if outside context)
- `trackDbQuery(durationMs)` - increment query count and accumulate time (no-op if outside context)

### `WideRequestContext`

Available fields on the request context:

| Field            | Type                                                 | Description                                                           |
| ---------------- | ---------------------------------------------------- | --------------------------------------------------------------------- |
| `requestId`      | `string`                                             | unique request identifier (required)                                  |
| `timestamp`      | `string`                                             | ISO timestamp (required)                                              |
| `startTime`      | `number`                                             | `performance.now()` value (required, excluded from log output)        |
| `details`        | `Record<string, unknown>`                            | arbitrary detail data (required, use `setDetails` to populate)        |
| `method`         | `string?`                                            | HTTP method                                                           |
| `path`           | `string?`                                            | route path (e.g. `/api/users/:id`)                                    |
| `url`            | `string?`                                            | full request URL                                                      |
| `ip`             | `string?`                                            | client IP address                                                     |
| `userAgent`      | `string?`                                            | client user agent                                                     |
| `userId`         | `string?`                                            | authenticated user ID                                                 |
| `sessionId`      | `string?`                                            | session identifier                                                    |
| `traceId`        | `string?`                                            | distributed trace identifier                                          |
| `operationType`  | `"read" \| "write" \| "delete"?`                     | type of operation                                                     |
| `resourceType`   | `string?`                                            | resource being operated on                                            |
| `resourceId`     | `string?`                                            | ID of the resource                                                    |
| `eventName`      | `string?`                                            | custom event name (consumed by Fastify middleware as the log message) |
| `statusCode`     | `number?`                                            | HTTP status code                                                      |
| `responseTimeMs` | `number?`                                            | response duration in milliseconds                                     |
| `dbQueryCount`   | `number?`                                            | number of database queries (populated by `trackDbQuery`)              |
| `dbQueryTimeMs`  | `number?`                                            | total database query time (populated by `trackDbQuery`)               |
| `error`          | `{ code: string; message: string; stack?: string }?` | error details                                                         |
| `samplingReason` | `string?`                                            | reason for the sampling decision (set automatically on emit)          |

### `pinoAdapter(logger)`

Wraps a Pino logger instance as a `LoggerAdapter`.

```typescript
import pino from "pino";
import { pinoAdapter } from "widelog/adapters/pino";

const adapter = pinoAdapter(pino({ level: "info" }));
```

### `fastifyWideLogger`

Fastify plugin that adds automatic wide event logging. Pass a `wideLogger` instance in options.

```typescript
import { fastifyWideLogger } from "widelog/middlewares/fastify";

await app.register(fastifyWideLogger, { wideLogger });
```

The plugin registers three hooks:

- `onRequest` - creates context with request metadata
- `onError` - captures error details
- `onResponse` - finalizes context and emits the wide event

### `prismaWideLogger`

Prisma client extension that automatically tracks query durations. Every query executed through the extended client calls `logContext.trackDbQuery` with the measured duration.

```typescript
import { PrismaClient } from "@prisma/client";
import { prismaWideLogger } from "widelog/middlewares/prisma";

const prisma = new PrismaClient().$extends(prismaWideLogger());
```

All queries through `prisma` will now automatically populate `dbQueryCount` and `dbQueryTimeMs` on the current wide log context.

### Custom Adapters

Implement the `LoggerAdapter` interface:

```typescript
import type { LoggerAdapter } from "widelog";

const myAdapter: LoggerAdapter = {
  trace: (msg, meta) => {
    /* ... */
  },
  debug: (msg, meta) => {
    /* ... */
  },
  info: (msg, meta) => {
    /* ... */
  },
  warn: (msg, meta) => {
    /* ... */
  },
  error: (msg, meta) => {
    /* ... */
  },
  child: (bindings) => {
    /* return child adapter */
  },
};
```

## Examples

See `/examples` directory:

- `pino-example.ts` - basic Pino usage
- `fastify-example.ts` - Fastify integration
- `custom-adapter-example.ts` - creating custom adapters

## License

MIT
