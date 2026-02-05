import { describe, it, expect, vi } from "vitest";
import { logContext } from "../src/context.js";
import { prismaWideLogger } from "../src/middlewares/prisma.js";
import { createContext } from "./helpers.js";

describe("prismaWideLogger", () => {
  it("should return a valid prisma extension config", () => {
    const extension = prismaWideLogger();

    expect(extension).toBeDefined();
    expect(extension.name).toBe("widelog-prisma");
    expect(extension.query?.$allModels?.$allOperations).toBeTypeOf("function");
  });

  it("should track query duration via logContext", async () => {
    const extension = prismaWideLogger();
    const wrapper = extension.query!.$allModels!.$allOperations!;
    const ctx = createContext();

    await logContext.run(ctx, async () => {
      const fakeQuery = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { id: 1 };
      });

      const result = await wrapper({
        args: { where: { id: 1 } },
        query: fakeQuery,
        model: "User",
        operation: "findUnique",
      });

      expect(result).toEqual({ id: 1 });
      expect(fakeQuery).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(ctx.dbQueryCount).toBe(1);
      expect(ctx.dbQueryTimeMs).toBeGreaterThanOrEqual(15);
    });
  });

  it("should accumulate multiple query durations", async () => {
    const extension = prismaWideLogger();
    const wrapper = extension.query!.$allModels!.$allOperations!;
    const ctx = createContext();

    await logContext.run(ctx, async () => {
      const fakeQuery = vi.fn(async () => ({ id: 1 }));

      await wrapper({
        args: {},
        query: fakeQuery,
        model: "User",
        operation: "findMany",
      });

      await wrapper({
        args: {},
        query: fakeQuery,
        model: "Post",
        operation: "findMany",
      });

      expect(ctx.dbQueryCount).toBe(2);
      expect(ctx.dbQueryTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  it("should not throw when called outside of context", async () => {
    const extension = prismaWideLogger();
    const wrapper = extension.query!.$allModels!.$allOperations!;
    const fakeQuery = vi.fn(async () => ({ id: 1 }));

    const result = await wrapper({
      args: {},
      query: fakeQuery,
      model: "User",
      operation: "findUnique",
    });

    expect(result).toEqual({ id: 1 });
    expect(fakeQuery).toHaveBeenCalled();
  });

  it("should propagate query errors without tracking", async () => {
    const extension = prismaWideLogger();
    const wrapper = extension.query!.$allModels!.$allOperations!;
    const ctx = createContext();

    await logContext.run(ctx, async () => {
      const fakeQuery = vi.fn(async () => {
        throw new Error("connection refused");
      });

      await expect(
        wrapper({
          args: {},
          query: fakeQuery,
          model: "User",
          operation: "findUnique",
        }),
      ).rejects.toThrow("connection refused");

      expect(ctx.dbQueryCount).toBeUndefined();
    });
  });
});
