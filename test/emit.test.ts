import { describe, it, expect, vi } from "vitest";
import { emitWideEvent } from "../src/emit.js";
import { createMockAdapter, createContext } from "./helpers.js";

describe("emitWideEvent", () => {
  it("should emit event at info level for successful requests", () => {
    const adapter = createMockAdapter();
    const ctx = createContext({ statusCode: 200 });

    emitWideEvent(adapter, "request_completed", ctx);

    expect(adapter.info).toHaveBeenCalled();
    expect(adapter.error).not.toHaveBeenCalled();
    expect(adapter.warn).not.toHaveBeenCalled();

    const [msg, meta] = (adapter.info as ReturnType<typeof vi.fn>).mock
      .calls[0];

    expect(msg).toBe("request_completed");
    expect(meta.requestId).toBe("test-123");
  });

  it("should emit event at error level for 5xx errors", () => {
    const adapter = createMockAdapter();
    const ctx = createContext({ statusCode: 500 });

    emitWideEvent(adapter, "request_failed", ctx);

    expect(adapter.error).toHaveBeenCalled();
    expect(adapter.info).not.toHaveBeenCalled();
    expect(adapter.warn).not.toHaveBeenCalled();
  });

  it("should emit event at warn level for 4xx errors", () => {
    const adapter = createMockAdapter();
    const ctx = createContext({ statusCode: 404 });

    emitWideEvent(adapter, "not_found", ctx);

    expect(adapter.warn).toHaveBeenCalled();
    expect(adapter.info).not.toHaveBeenCalled();
    expect(adapter.error).not.toHaveBeenCalled();
  });

  it("should exclude startTime from logs", () => {
    const adapter = createMockAdapter();
    const ctx = createContext({ startTime: 123456789 });

    emitWideEvent(adapter, "test", ctx);

    const [, meta] = (adapter.info as ReturnType<typeof vi.fn>).mock.calls[0];

    expect(meta.startTime).toBeUndefined();
    expect(meta.requestId).toBe("test-123");
  });

  it("should include details data in log entry", () => {
    const adapter = createMockAdapter();
    const ctx = createContext({
      details: {
        foo: "bar",
        nested: { key: "value" },
      },
    });

    emitWideEvent(adapter, "test", ctx);

    const [, meta] = (adapter.info as ReturnType<typeof vi.fn>).mock.calls[0];

    expect(meta.details.foo).toBe("bar");
    expect(meta.details.nested).toEqual({ key: "value" });
  });

  it("should catch adapter errors and not propagate them", () => {
    const adapter = createMockAdapter();
    (adapter.info as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("adapter exploded");
    });

    const ctx = createContext({ statusCode: 200 });

    // should not throw
    expect(() => emitWideEvent(adapter, "test", ctx)).not.toThrow();
  });
});
