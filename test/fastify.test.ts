import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";
import { fastifyWideLogger } from "../src/middlewares/fastify.js";
import { createWideLogger } from "../src/wide-logger.js";
import { logContext } from "../src/context.js";
import { createMockAdapter } from "./helpers.js";
import type { WideRequestContext } from "../src/types.js";

describe("fastifyWideLogger", () => {
  let adapter: ReturnType<typeof createMockAdapter>;
  let wideLogger: ReturnType<typeof createWideLogger>;

  beforeEach(() => {
    adapter = createMockAdapter();
    wideLogger = createWideLogger(adapter, {
      sampling: { sampleRate: 1 }, // 100% sampling for tests
    });
  });

  it("should create request context on incoming request", async () => {
    const app = Fastify();
    await app.register(fastifyWideLogger, { wideLogger });

    let capturedContext: WideRequestContext | undefined;

    app.get("/test", async () => {
      capturedContext = logContext.get();

      return { ok: true };
    });

    const response = await app.inject({
      method: "GET",
      url: "/test",
      headers: {
        "user-agent": "test-agent",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(capturedContext).toBeDefined();
    expect(capturedContext!.method).toBe("GET");
    expect(capturedContext!.path).toBe("/test");
    expect(capturedContext!.url).toBe("/test");
    expect(capturedContext!.userAgent).toBe("test-agent");
    expect(capturedContext!.requestId).toBeDefined();
    expect(capturedContext!.timestamp).toBeDefined();
    expect(capturedContext!.startTime).toBeDefined();
  });

  it("should emit wide event on successful response", async () => {
    const app = Fastify();
    await app.register(fastifyWideLogger, { wideLogger });

    app.get<{ Params: { id: string } }>("/api/users/:id", async (request) => {
      logContext.set("userId", request.params.id);

      return { id: request.params.id };
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/users/123",
    });

    expect(response.statusCode).toBe(200);

    // verify wide event was emitted
    expect(adapter.info).toHaveBeenCalled();
    const call = (adapter.info as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("request_completed");
    expect(call[1].method).toBe("GET");
    expect(call[1].path).toBe("/api/users/:id");
    expect(call[1].statusCode).toBe(200);
    expect(call[1].userId).toBe("123");
    expect(call[1].responseTimeMs).toBeDefined();
    expect(typeof call[1].responseTimeMs).toBe("number");
  });

  it("should capture error details on error responses", async () => {
    const app = Fastify();
    await app.register(fastifyWideLogger, { wideLogger });

    app.get("/error", async () => {
      const error = new Error("Something went wrong");
      (error as Error & { code: string }).code = "INTERNAL_ERROR";
      throw error;
    });

    const response = await app.inject({
      method: "GET",
      url: "/error",
    });

    expect(response.statusCode).toBe(500);

    // verify error was logged at error level
    expect(adapter.error).toHaveBeenCalled();
    const call = (adapter.error as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("request_completed");
    expect(call[1].statusCode).toBe(500);
    expect(call[1].error).toBeDefined();
    expect(call[1].error.code).toBe("INTERNAL_ERROR");
    expect(call[1].error.message).toBe("Something went wrong");
  });

  it("should respect neverLogPaths and not emit", async () => {
    const app = Fastify();
    await app.register(fastifyWideLogger, {
      wideLogger: createWideLogger(adapter, {
        sampling: {
          sampleRate: 1,
          neverLogPaths: [/^\/health/],
        },
      }),
    });

    app.get("/health", async () => {
      return { status: "ok" };
    });

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);

    // verify no wide event was emitted for health check
    expect(adapter.info).not.toHaveBeenCalled();
    expect(adapter.error).not.toHaveBeenCalled();
  });

  it("should allow context modification within route handlers", async () => {
    const app = Fastify();
    await app.register(fastifyWideLogger, { wideLogger });

    app.get<{ Params: { id: string } }>(
      "/api/workspaces/:id",
      async (request) => {
        // simulate auth middleware setting user
        logContext.set("userId", "user-456");

        // simulate db queries
        logContext.trackDbQuery(25);
        logContext.trackDbQuery(15);

        // add details data
        logContext.setDetails({ feature: "workspace-view" });

        return { id: request.params.id };
      },
    );

    const response = await app.inject({
      method: "GET",
      url: "/api/workspaces/abc123",
    });

    expect(response.statusCode).toBe(200);

    // verify context was properly populated
    expect(adapter.info).toHaveBeenCalled();
    const call = (adapter.info as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].userId).toBe("user-456");
    expect(call[1].dbQueryCount).toBe(2);
    expect(call[1].dbQueryTimeMs).toBe(40);
    expect(call[1].details.feature).toBe("workspace-view");
  });

  it("should handle POST requests correctly", async () => {
    const app = Fastify();
    await app.register(fastifyWideLogger, { wideLogger });

    app.post("/api/users", async () => {
      logContext.set("userId", "admin-123");
      logContext.setDetails({ action: "user-create" });

      return { id: "new-user-id" };
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/users",
      payload: { name: "John Doe" },
    });

    expect(response.statusCode).toBe(200);

    expect(adapter.info).toHaveBeenCalled();
    const call = (adapter.info as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].method).toBe("POST");
    expect(call[1].path).toBe("/api/users");
    expect(call[1].userId).toBe("admin-123");
    expect(call[1].details.action).toBe("user-create");
  });

  it("should track response time accurately", async () => {
    const app = Fastify();
    await app.register(fastifyWideLogger, { wideLogger });

    app.get("/slow", async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { ok: true };
    });

    const startTime = Date.now();
    const response = await app.inject({
      method: "GET",
      url: "/slow",
    });
    const endTime = Date.now();

    expect(response.statusCode).toBe(200);

    const call = (adapter.info as ReturnType<typeof vi.fn>).mock.calls[0];
    const loggedResponseTime = call[1].responseTimeMs;

    // logged response time should be close to actual request time
    expect(loggedResponseTime).toBeGreaterThanOrEqual(45);
    expect(loggedResponseTime).toBeLessThanOrEqual(endTime - startTime + 20);
  });

  it("should handle concurrent requests with isolated contexts", async () => {
    const app = Fastify();
    await app.register(fastifyWideLogger, { wideLogger });

    const contexts: Array<{
      paramId: string;
      requestId: string | undefined;
    }> = [];

    app.get<{ Params: { id: string } }>("/concurrent/:id", async (request) => {
      const ctx = logContext.get();

      contexts.push({
        paramId: request.params.id,
        requestId: ctx?.requestId,
      });

      // small delay to increase chance of overlap
      await new Promise((resolve) => setTimeout(resolve, 10));

      return { id: request.params.id };
    });

    // fire 3 concurrent requests
    await Promise.all([
      app.inject({ method: "GET", url: "/concurrent/1" }),
      app.inject({ method: "GET", url: "/concurrent/2" }),
      app.inject({ method: "GET", url: "/concurrent/3" }),
    ]);

    // each request should have a unique requestId
    const requestIds = contexts.map((c) => c.requestId);

    expect(new Set(requestIds).size).toBe(3);

    expect(contexts.some((c) => c.paramId === "1")).toBe(true);
    expect(contexts.some((c) => c.paramId === "2")).toBe(true);
    expect(contexts.some((c) => c.paramId === "3")).toBe(true);
  });
});
