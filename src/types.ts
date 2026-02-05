/**
 * Adapter type for any logger implementation
 */
export type LoggerAdapter = {
  child(bindings: Record<string, unknown>): LoggerAdapter;
  debug(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  trace(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
};

/**
 * Request context for wide event logging
 */
export type WideRequestContext = {
  dbQueryCount?: number;
  dbQueryTimeMs?: number;
  details: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  eventName?: string;
  ip?: string;
  method?: string;
  operationType?: "read" | "write" | "delete";
  path?: string;
  requestId: string;
  resourceId?: string;
  resourceType?: string;
  responseTimeMs?: number;
  samplingReason?: string;
  sessionId?: string;
  startTime: number;
  statusCode?: number;
  timestamp: string;
  traceId?: string;
  url?: string;
  userAgent?: string;
  userId?: string;
};

/**
 * Result of a sampling decision
 */
export type SamplingResult = {
  decision: "emit" | "drop";
  reason: string;
};

/**
 * Sampling configuration options
 */
export type SamplingConfig = {
  alwaysLogPaths: RegExp[];
  errorStatusCodes: number[];
  neverLogPaths: RegExp[];
  sampleRate: number;
  slowRequestThresholdMs: number;
  vipUserIds: Set<string>;
};

/**
 * Options for creating a wide logger
 */
export type WideLoggerOptions = {
  sampling?: Partial<SamplingConfig>;
};

/**
 * Wide logger type
 */
export type WideLogger = {
  emit(eventName: string): void;
  getContext(): WideRequestContext | undefined;
  runContext<T>(ctx: WideRequestContext, fn: () => T): T;
  set<K extends keyof WideRequestContext>(
    field: K,
    value: WideRequestContext[K],
  ): void;
  set(fields: Partial<WideRequestContext>): void;
  setDetails(data: Record<string, unknown>): void;
  trackDbQuery(durationMs: number): void;
};
