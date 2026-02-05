// src/context.ts

import { AsyncLocalStorage } from "node:async_hooks";

import type { WideRequestContext } from "./types.js";

const storage = new AsyncLocalStorage<WideRequestContext>();

/**
 * logContext provides utilities to manage request context across async operations.
 * It uses AsyncLocalStorage under the hood to maintain context per request.
 */
export const logContext = {
  /**
   * run function within a context.
   * use in framework integration (fastify preHandler) and background jobs.
   */
  run<T>(ctx: WideRequestContext, fn: () => T): T {
    return storage.run(ctx, fn);
  },

  /**
   * get current context.
   * returns undefined if called outside execution context.
   */
  get(): WideRequestContext | undefined {
    return storage.getStore();
  },

  /**
   * set known fields on current context.
   * accepts either a single field/value pair or a partial context object.
   * no-op if no active context (defensive).
   */
  set<K extends keyof WideRequestContext>(
    fieldOrFields: K | Partial<WideRequestContext>,
    value?: WideRequestContext[K],
  ): void {
    const ctx = storage.getStore();

    if (!ctx) {
      return;
    }

    if (typeof fieldOrFields === "string") {
      ctx[fieldOrFields] = value as WideRequestContext[K];
    } else {
      Object.assign(ctx, fieldOrFields);
    }
  },

  /**
   * add arbitrary data to details field.
   * no-op if no active context.
   */
  setDetails(data: Record<string, unknown>): void {
    const ctx = storage.getStore();

    if (!ctx) {
      return;
    }

    Object.assign(ctx.details, data);
  },

  /**
   * track a database query duration.
   * increments dbQueryCount and accumulates dbQueryTimeMs.
   */
  trackDbQuery(durationMs: number): void {
    const ctx = storage.getStore();

    if (!ctx) {
      return;
    }

    ctx.dbQueryCount = (ctx.dbQueryCount ?? 0) + 1;
    ctx.dbQueryTimeMs = (ctx.dbQueryTimeMs ?? 0) + durationMs;
  },
};
