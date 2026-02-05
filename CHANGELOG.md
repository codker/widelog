# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-07

I'm excited to announce the first stable release of `widelog`, a small event logger for Node.js!

It's type-safe and comes with built-in middlewares for easy integration with web frameworks.

Here's a quick overview:

`widelog` is a wide event logger for Node.js that helps you emit rich, structured "wide events" for requests, while intelligently sampling them based on configurable rules. It works with any logger via adapters and provides built-in middlewares for seamless integration.

I'm starting with a Pino adapter and a Fastify plugin, but more adapters and middlewares will be added. Contributions are welcome!

### Features

- Adapter-based architecture: works with any logger through an adapter interface
- Provided middlewares: Middlewares are included for automatic request logging
- Context tracking: AsyncLocalStorage-based request context for per-request aggregation
- Smart sampling: Configurable sampling rules to manage log volume
  - Random sampling with configurable rate
  - Always log slow requests (configurable threshold)
  - Always log error responses (5xx status codes)
  - VIP user tracking (logs requests from specific users are always logged)
  - Path-based inclusion/exclusion rules
- Type-safe: Full TypeScript support with comprehensive type definitions
- Zero runtime dependencies: Peer dependencies are optional if using built-in adapters/middlewares

### Adapters

- Pino adapter (`pinoAdapter`) - works with the popular Pino logger

### Middlewares

- Fastify plugin (`fastifyWideLogger`) - automatic request context and logging for Fastify
- Prisma extension (`prismaWideLogger`) - automatic query duration tracking for Prisma

[1.0.0]: https://github.com/codker/widelog/releases/tag/v1.0.0
