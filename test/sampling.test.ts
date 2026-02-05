import { describe, it, expect } from "vitest";
import { configureSampling, shouldEmit } from "../src/sampling.js";
import { createContext } from "./helpers.js";

describe("sampling", () => {
  describe("configureSampling", () => {
    it("should use default values when no options provided", () => {
      const config = configureSampling();

      expect(config.sampleRate).toBe(0.05);
      expect(config.slowRequestThresholdMs).toBe(1000);
      expect(config.errorStatusCodes).toEqual([
        500, 501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511,
      ]);
      expect(config.vipUserIds.size).toBe(0);
      expect(config.alwaysLogPaths).toEqual([]);
      expect(config.neverLogPaths).toEqual([]);
    });

    it("should override default values with provided options", () => {
      const config = configureSampling({
        sampleRate: 0.5,
        slowRequestThresholdMs: 2000,
        vipUserIds: new Set(["user-1"]),
      });

      expect(config.sampleRate).toBe(0.5);
      expect(config.slowRequestThresholdMs).toBe(2000);
      expect(config.vipUserIds.has("user-1")).toBe(true);
    });

    it("should clamp sampleRate to [0, 1]", () => {
      const tooHigh = configureSampling({ sampleRate: 5 });
      expect(tooHigh.sampleRate).toBe(1);

      const tooLow = configureSampling({ sampleRate: -2 });
      expect(tooLow.sampleRate).toBe(0);

      const withinRange = configureSampling({ sampleRate: 0.5 });
      expect(withinRange.sampleRate).toBe(0.5);
    });
  });

  describe("shouldEmit", () => {
    it("should drop requests matching neverLogPaths", () => {
      const config = configureSampling({
        neverLogPaths: [/^\/health$/],
      });

      const ctx = createContext({ path: "/health" });
      const result = shouldEmit(ctx, config);

      expect(result.decision).toBe("drop");
      expect(result.reason).toBe("never_log_path");
    });

    it("should emit error status codes", () => {
      const config = configureSampling({
        errorStatusCodes: [500, 502],
        sampleRate: 0, // disable random sampling for this test
      });

      const ctx500 = createContext({ statusCode: 500 });
      const ctx502 = createContext({ statusCode: 502 });
      const ctx200 = createContext({ statusCode: 200 });

      expect(shouldEmit(ctx500, config).decision).toBe("emit");
      expect(shouldEmit(ctx502, config).decision).toBe("emit");
      expect(shouldEmit(ctx200, config).decision).not.toBe("emit");
    });

    it("should emit slow requests", () => {
      const config = configureSampling({
        slowRequestThresholdMs: 1000,
        sampleRate: 0, // disable random sampling for this test
      });

      const slowCtx = createContext({ responseTimeMs: 1500 });
      const fastCtx = createContext({ responseTimeMs: 500 });

      const slowResult = shouldEmit(slowCtx, config);
      expect(slowResult.decision).toBe("emit");
      expect(slowResult.reason).toBe("slow_request");
      expect(shouldEmit(fastCtx, config).decision).toBe("drop");
    });

    it("should emit for vip users", () => {
      const config = configureSampling({
        vipUserIds: new Set(["vip-user"]),
        sampleRate: 0, // disable random sampling for this test
      });

      const vipCtx = createContext({ userId: "vip-user" });
      const normalCtx = createContext({ userId: "normal-user" });

      const vipResult = shouldEmit(vipCtx, config);
      expect(vipResult.decision).toBe("emit");
      expect(vipResult.reason).toBe("vip_user");
      expect(shouldEmit(normalCtx, config).decision).toBe("drop");
    });

    it("should emit for alwaysLogPaths", () => {
      const config = configureSampling({
        alwaysLogPaths: [/^\/api\/admin/],
        sampleRate: 0, // disable random sampling for this test
      });

      const adminCtx = createContext({ path: "/api/admin/users" });
      const normalCtx = createContext({ path: "/api/users" });

      const adminResult = shouldEmit(adminCtx, config);
      expect(adminResult.decision).toBe("emit");
      expect(adminResult.reason).toBe("always_log_path");
      expect(shouldEmit(normalCtx, config).decision).not.toBe("emit");
    });

    it("should respect precedence order", () => {
      const config = configureSampling({
        neverLogPaths: [/^\/health/],
        alwaysLogPaths: [/^\/health/],
        sampleRate: 0,
      });

      // neverLogPaths should take precedence over alwaysLogPaths
      const ctx = createContext({ path: "/health" });
      expect(shouldEmit(ctx, config).decision).toBe("drop");
    });

    it("should randomly sample based on sampleRate", () => {
      const config = configureSampling({
        sampleRate: 1, // 100% sample rate for deterministic test
      });

      const ctx = createContext();
      const result = shouldEmit(ctx, config);

      expect(result.decision).toBe("emit");
      expect(result.reason).toBe("full_sample");
    });
  });
});
