import { vi } from "vitest";
import type { LoggerAdapter, WideRequestContext } from "../src/types.js";

export function createMockAdapter(): LoggerAdapter & { logs: unknown[] } {
  const logs: unknown[] = [];

  return {
    logs,
    trace: vi.fn((msg, meta) => logs.push({ level: "trace", msg, meta })),
    debug: vi.fn((msg, meta) => logs.push({ level: "debug", msg, meta })),
    info: vi.fn((msg, meta) => logs.push({ level: "info", msg, meta })),
    warn: vi.fn((msg, meta) => logs.push({ level: "warn", msg, meta })),
    error: vi.fn((msg, meta) => logs.push({ level: "error", msg, meta })),
    child: vi.fn(function (this: LoggerAdapter) {
      return this;
    }),
  };
}

export function createContext(
  overrides: Partial<WideRequestContext> = {},
): WideRequestContext {
  return {
    requestId: "test-123",
    method: "GET",
    path: "/api/test",
    url: "/api/test",
    startTime: Date.now(),
    timestamp: new Date().toISOString(),
    details: {},
    ...overrides,
  };
}
