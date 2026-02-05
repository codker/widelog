import { describe, it, expect } from "vitest";
import { logContext } from "../src/context.js";
import { createContext } from "./helpers.js";

describe("context", () => {
  describe("runContext", () => {
    it("should run function within context", () => {
      const ctx = createContext();

      const result = logContext.run(ctx, () => {
        return logContext.get()?.requestId;
      });

      expect(result).toBe("test-123");
    });

    it("should isolate different contexts", () => {
      const ctx1 = createContext({ requestId: "req-1" });
      const ctx2 = createContext({ requestId: "req-2" });

      logContext.run(ctx1, () => {
        expect(logContext.get()?.requestId).toBe("req-1");

        logContext.run(ctx2, () => {
          expect(logContext.get()?.requestId).toBe("req-2");
        });

        // outer context should be restored
        expect(logContext.get()?.requestId).toBe("req-1");
      });
    });

    it("should return function result", () => {
      const ctx = createContext();

      const result = logContext.run(ctx, () => {
        return "test-result";
      });

      expect(result).toBe("test-result");
    });
  });

  describe("getContext", () => {
    it("should return undefined outside of context", () => {
      expect(logContext.get()).toBeUndefined();
    });

    it("should return context inside runContext", () => {
      const ctx = createContext();

      logContext.run(ctx, () => {
        expect(logContext.get()).toBe(ctx);
      });
    });
  });

  describe("set", () => {
    it("should set field on context", () => {
      const ctx = createContext();

      logContext.run(ctx, () => {
        logContext.set("userId", "user-123");
        expect(logContext.get()?.userId).toBe("user-123");
      });
    });

    it("should silently do nothing outside of context", () => {
      expect(() => logContext.set("userId", "user-123")).not.toThrow();
      expect(logContext.get()).toBeUndefined();
    });

    it("should set multiple fields from an object", () => {
      const ctx = createContext();

      logContext.run(ctx, () => {
        logContext.set({
          userId: "user-123",
          method: "POST",
          path: "/api/users",
        });

        expect(logContext.get()?.userId).toBe("user-123");
        expect(logContext.get()?.method).toBe("POST");
        expect(logContext.get()?.path).toBe("/api/users");
      });
    });

    it("should overwrite existing field values with object form", () => {
      const ctx = createContext({ method: "GET", path: "/old" });

      logContext.run(ctx, () => {
        logContext.set({ method: "PUT", path: "/new" });

        expect(logContext.get()?.method).toBe("PUT");
        expect(logContext.get()?.path).toBe("/new");
      });
    });

    it("should not affect unrelated fields when using object form", () => {
      const ctx = createContext({ userId: "existing-user" });

      logContext.run(ctx, () => {
        logContext.set({ method: "DELETE" });

        expect(logContext.get()?.userId).toBe("existing-user");
        expect(logContext.get()?.method).toBe("DELETE");
      });
    });

    it("should silently do nothing outside of context with object form", () => {
      expect(() => logContext.set({ userId: "user-123" })).not.toThrow();
      expect(logContext.get()).toBeUndefined();
    });
  });

  describe("setDetails", () => {
    it("should add details data to context", () => {
      const ctx = createContext();

      logContext.run(ctx, () => {
        logContext.setDetails({ foo: "bar", count: 42 });
        expect(logContext.get()?.details).toEqual({ foo: "bar", count: 42 });
      });
    });

    it("should merge with existing details data", () => {
      const ctx = createContext({ details: { existing: true } });

      logContext.run(ctx, () => {
        logContext.setDetails({ new: "data" });
        expect(logContext.get()?.details).toEqual({
          existing: true,
          new: "data",
        });
      });
    });

    it("should silently do nothing outside of context", () => {
      expect(() => logContext.setDetails({ foo: "bar" })).not.toThrow();
    });
  });

  describe("trackDbQuery", () => {
    it("should track single query", () => {
      const ctx = createContext();

      logContext.run(ctx, () => {
        logContext.trackDbQuery(50);
        expect(logContext.get()?.dbQueryCount).toBe(1);
        expect(logContext.get()?.dbQueryTimeMs).toBe(50);
      });
    });

    it("should accumulate multiple queries", () => {
      const ctx = createContext();

      logContext.run(ctx, () => {
        logContext.trackDbQuery(50);
        logContext.trackDbQuery(100);
        logContext.trackDbQuery(25);

        expect(logContext.get()?.dbQueryCount).toBe(3);
        expect(logContext.get()?.dbQueryTimeMs).toBe(175);
      });
    });

    it("should silently do nothing outside of context", () => {
      expect(() => logContext.trackDbQuery(50)).not.toThrow();
    });
  });
});
