/**
 * This is a complete small app demonstrating how to use the Fastify middleware
 * for automatic request logging.
 *
 * We will use the Pino logger and a fake Prisma client.
 *
 * In a real app, extend your prisma client with the widelog middleware
 * to automatically track query durations:
 * const prisma = new PrismaClient().$extends(prismaWideLogger());
 */

import Fastify from "fastify";
import pino from "pino";
import { createWideLogger, logContext } from "widelog";
import { pinoAdapter } from "widelog/adapters/pino";
import { fastifyWideLogger } from "widelog/middlewares/fastify";

declare module "fastify" {
  interface FastifyRequest {
    user: {
      id: string;
    };
  }
}

// fake prisma client for demo purposes
const prisma = {
  user: {
    findUnique: async ({ where }: { where: { id: string } }) => {
      const duration = 30;
      await new Promise((resolve) => setTimeout(resolve, duration));

      // manual tracking for demo; the prisma middleware automates this
      logContext.trackDbQuery(duration);

      return { id: where.id, name: "John Doe" };
    },
  },
};

// config pino logger
const pinoLogger = pino({
  level: "info",
});

// create wide logger
const wideLogger = createWideLogger(pinoAdapter(pinoLogger), {
  sampling: {
    sampleRate: 1, // log all requests for demo
    neverLogPaths: [/^\/health$/], // skip health checks
  },
});

// create fastify app
const app = Fastify({
  loggerInstance: pinoLogger,
  disableRequestLogging: true, // disable default logging
});

// simulate authenticated user
app.decorateRequest("user", {
  getter() {
    return { id: "123" };
  },
});

// register widelog middleware
await app.register(fastifyWideLogger, { wideLogger });

// routes automatically get wide event logging
app.get<{ Params: { id: string } }>("/api/users/:id", async (request) => {
  const { id } = request.params;

  // this is request scoped
  logContext.set({
    eventName: "user-profile-get",
    userId: id,
    resourceType: "user",
    resourceId: id,
  });

  // simulate database work
  return await prisma.user.findUnique({ where: { id } });

  // before sending response, the onResponse hook will log the event automatically
  // if the request should be emitted based on sampling rules
});

// health check (never logged, filtered by neverLogPaths)
app.get("/health", async () => {
  return { status: "ok" };
});

// error route (always logged)
app.get("/error", async () => {
  throw new Error("Something went wrong");
});

// start server
await app.listen({ port: 3000 });

console.log("Server running on http://localhost:3000");
console.log("");
console.log("Try these URLs:");
console.log("  http://localhost:3000/api/users/123");
console.log("  http://localhost:3000/health (should not log)");
console.log("  http://localhost:3000/error (logs error)");
