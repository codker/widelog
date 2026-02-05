import { describe, it, expect, vi } from "vitest";
import { createWideLogger } from "../src/wide-logger.js";
import { createMockAdapter, createContext } from "./helpers.js";

describe("createWideLogger", () => {
  describe("runContext", () => {
    it("should run function within context", () => {
      const adapter = createMockAdapter();
      const wideLogger = createWideLogger(adapter);
      const ctx = createContext();

      const result = wideLogger.runContext(ctx, () => {
        return wideLogger.getContext()?.requestId;
      });

      expect(result).toBe("test-123");
    });
  });

  describe("getContext", () => {
    it("should return current context", () => {
      const adapter = createMockAdapter();
      const wideLogger = createWideLogger(adapter);
      const ctx = createContext();

      expect(wideLogger.getContext()).toBeUndefined();

      wideLogger.runContext(ctx, () => {
        expect(wideLogger.getContext()).toBe(ctx);
      });
    });
  });

  describe("set", () => {
    it("should set field on context", () => {
      const adapter = createMockAdapter();
      const wideLogger = createWideLogger(adapter);
      const ctx = createContext();

      wideLogger.runContext(ctx, () => {
        wideLogger.set("userId", "user-123");
        expect(wideLogger.getContext()?.userId).toBe("user-123");
      });
    });

    it("should set multiple fields from an object", () => {
      const adapter = createMockAdapter();
      const wideLogger = createWideLogger(adapter);
      const ctx = createContext();

      wideLogger.runContext(ctx, () => {
        wideLogger.set({
          userId: "user-456",
          method: "POST",
          path: "/api/items",
        });

        expect(wideLogger.getContext()?.userId).toBe("user-456");
        expect(wideLogger.getContext()?.method).toBe("POST");
        expect(wideLogger.getContext()?.path).toBe("/api/items");
      });
    });
  });

  describe("setDetails", () => {
    it("should add details data", () => {
      const adapter = createMockAdapter();
      const wideLogger = createWideLogger(adapter);
      const ctx = createContext();

      wideLogger.runContext(ctx, () => {
        wideLogger.setDetails({ foo: "bar" });
        expect(wideLogger.getContext()?.details.foo).toBe("bar");
      });
    });
  });

  describe("trackDbQuery", () => {
    it("should track database queries", () => {
      const adapter = createMockAdapter();
      const wideLogger = createWideLogger(adapter);
      const ctx = createContext();

      wideLogger.runContext(ctx, () => {
        wideLogger.trackDbQuery(50);
        expect(wideLogger.getContext()?.dbQueryCount).toBe(1);
      });
    });
  });

  describe("emit", () => {
    it("should emit wide event when sampled", () => {
      const adapter = createMockAdapter();
      const wideLogger = createWideLogger(adapter, {
        sampling: { sampleRate: 1 }, // 100% sample rate
      });

      const ctx = createContext();

      wideLogger.runContext(ctx, () => {
        wideLogger.emit("test_event");
      });

      expect(adapter.info).toHaveBeenCalled();
      const call = (adapter.info as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe("test_event");
      expect(call[1].requestId).toBe("test-123");
    });

    it("should emit at error level for 5xx status codes", () => {
      const adapter = createMockAdapter();
      const wideLogger = createWideLogger(adapter, {
        sampling: { sampleRate: 1 },
      });
      const ctx = createContext({ statusCode: 500 });

      wideLogger.runContext(ctx, () => {
        wideLogger.emit("error_event");
      });

      expect(adapter.error).toHaveBeenCalled();
    });

    it("should emit at warn level for 4xx status codes", () => {
      const adapter = createMockAdapter();
      const wideLogger = createWideLogger(adapter, {
        sampling: { sampleRate: 1 },
      });
      const ctx = createContext({ statusCode: 404 });

      wideLogger.runContext(ctx, () => {
        wideLogger.emit("not_found_event");
      });

      expect(adapter.warn).toHaveBeenCalled();
      expect(adapter.info).not.toHaveBeenCalled();
      expect(adapter.error).not.toHaveBeenCalled();
    });

    it("should not emit when sampled out", () => {
      const adapter = createMockAdapter();
      const wideLogger = createWideLogger(adapter, {
        sampling: { sampleRate: 0 }, // 0% sample rate
      });
      const ctx = createContext();

      wideLogger.runContext(ctx, () => {
        wideLogger.emit("test_event");
      });

      expect(adapter.info).not.toHaveBeenCalled();
      expect(adapter.error).not.toHaveBeenCalled();
    });

    it("should not emit outside of context", () => {
      const adapter = createMockAdapter();
      const wideLogger = createWideLogger(adapter);

      // not in a context
      wideLogger.emit("test_event");

      expect(adapter.info).not.toHaveBeenCalled();
      expect(adapter.error).not.toHaveBeenCalled();
    });

    it("should set ctx.samplingReason from sampling result", () => {
      const adapter = createMockAdapter();
      const wideLogger = createWideLogger(adapter, {
        sampling: { sampleRate: 1 },
      });
      const ctx = createContext();

      wideLogger.runContext(ctx, () => {
        wideLogger.emit("test_event");
        expect(ctx.samplingReason).toBe("full_sample");
      });
    });
  });
});
