import { performance } from "node:perf_hooks";
import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import type { WideRequestContext, WideLogger } from "../types.js";
import { AsyncResource } from "node:async_hooks";

export interface FastifyWideLoggerOptions {
  wideLogger: WideLogger;
}

const asyncResourceSymbol = Symbol("asyncResource");

const wideEventLoggerPlugin: FastifyPluginAsync<
  FastifyWideLoggerOptions
> = async (app, options) => {
  const { wideLogger } = options;

  app.addHook("onRequest", function hook(req, _res, done) {
    const ctx: WideRequestContext = {
      details: {},
      ip: req.ip,
      method: req.method,
      path: req.routeOptions.url ?? req.url,
      requestId: req.id,
      startTime: performance.now(),
      timestamp: new Date().toISOString(),
      url: req.url,
      userAgent: req.headers["user-agent"],
    };

    wideLogger.runContext(ctx, () => {
      const asyncResource = new AsyncResource("fastify-wide-logger");

      // @ts-expect-error - symbol is too generic
      req[asyncResourceSymbol] = asyncResource;

      asyncResource.runInAsyncScope(done, req.raw);
    });
  });

  // onError: capture error details
  app.addHook("onError", async (_request, _reply, error) => {
    const ctx = wideLogger.getContext();

    if (!ctx) {
      return;
    }

    ctx.error = {
      code: error.code ?? "UNKNOWN",
      message: error.message,
      stack: error.stack,
    };
  });

  // onResponse: finalize and emit log
  app.addHook("onResponse", async (_request, reply) => {
    const ctx = wideLogger.getContext();

    if (!ctx) {
      return;
    }

    ctx.statusCode = reply.statusCode;
    ctx.responseTimeMs = performance.now() - ctx.startTime;

    // extract the event name before emitting
    const eventName = ctx.eventName ?? "request_completed";
    delete ctx.eventName;

    wideLogger.emit(eventName);
  });
};

/**
 * wrapped with fastify-plugin (`fp()`) to intentionally break Fastify's default
 * encapsulation so the wide logger hooks are registered at the root scope and
 * apply to every route regardless of plugin nesting.
 */
export const fastifyWideLogger = fp(wideEventLoggerPlugin, {
  name: "widelog",
});

export default fastifyWideLogger;
