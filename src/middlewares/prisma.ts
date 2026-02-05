import { performance } from "node:perf_hooks";

import { logContext } from "../context.js";

type QueryArgs = {
  args: unknown;
  model: string;
  operation: string;
  query: (args: unknown) => Promise<unknown>;
};

/**
 * prisma client extension that automatically tracks query durations
 * using widelog's logContext.trackDbQuery.
 *
 * usage:
 * ```typescript
 * import { PrismaClient } from "@prisma/client";
 * import { prismaWideLogger } from "widelog/middlewares/prisma";
 *
 * const prisma = new PrismaClient().$extends(prismaWideLogger());
 * ```
 */
export function prismaWideLogger() {
  return {
    name: "widelog-prisma" as const,
    query: {
      $allModels: {
        async $allOperations({ args, query }: QueryArgs) {
          const start = performance.now();
          const result = await query(args);

          logContext.trackDbQuery(performance.now() - start);

          return result;
        },
      },
    },
  };
}
