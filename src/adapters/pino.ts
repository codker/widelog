import type { Logger } from "pino";
import type { LoggerAdapter } from "../types.js";

class PinoAdapter implements LoggerAdapter {
  constructor(private logger: Logger) {}

  child(bindings: Record<string, unknown>): LoggerAdapter {
    return new PinoAdapter(this.logger.child(bindings));
  }

  debug(msg: string, meta?: Record<string, unknown>): void {
    this.logger.debug(meta, msg);
  }

  error(msg: string, meta?: Record<string, unknown>): void {
    this.logger.error(meta, msg);
  }

  info(msg: string, meta?: Record<string, unknown>): void {
    this.logger.info(meta, msg);
  }

  trace(msg: string, meta?: Record<string, unknown>): void {
    this.logger.trace(meta, msg);
  }

  warn(msg: string, meta?: Record<string, unknown>): void {
    this.logger.warn(meta, msg);
  }
}

export function pinoAdapter(logger: Logger): LoggerAdapter {
  return new PinoAdapter(logger);
}
