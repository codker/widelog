import type {
  WideRequestContext,
  SamplingConfig,
  SamplingResult,
  WideLoggerOptions,
} from "./types.js";

const defaultConfig: SamplingConfig = {
  sampleRate: 0.05,
  slowRequestThresholdMs: 1000,
  errorStatusCodes: [
    500, 501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511,
  ],
  vipUserIds: new Set(),
  alwaysLogPaths: [],
  neverLogPaths: [],
};

export function configureSampling(
  options: WideLoggerOptions["sampling"] = {},
): SamplingConfig {
  return {
    sampleRate: Math.max(
      0,
      Math.min(1, options.sampleRate ?? defaultConfig.sampleRate),
    ),
    slowRequestThresholdMs:
      options.slowRequestThresholdMs ?? defaultConfig.slowRequestThresholdMs,
    errorStatusCodes: options.errorStatusCodes ?? [
      ...defaultConfig.errorStatusCodes,
    ],
    vipUserIds: options.vipUserIds ?? new Set(),
    alwaysLogPaths: options.alwaysLogPaths ?? [],
    neverLogPaths: options.neverLogPaths ?? [],
  };
}

export function shouldEmit(
  ctx: WideRequestContext,
  config: SamplingConfig,
): SamplingResult {
  // neverLogPaths takes precedence (even in dev mode)
  if (
    ctx.path &&
    config.neverLogPaths.length > 0 &&
    config.neverLogPaths.some((pattern) => pattern.test(ctx.path!))
  ) {
    return { decision: "drop", reason: "never_log_path" };
  }

  // always emit errors
  if (ctx.statusCode && config.errorStatusCodes.includes(ctx.statusCode)) {
    return { decision: "emit", reason: "error_status" };
  }

  // always emit slow requests
  if (
    ctx.responseTimeMs &&
    ctx.responseTimeMs >= config.slowRequestThresholdMs
  ) {
    return { decision: "emit", reason: "slow_request" };
  }

  // always emit for vip users
  if (ctx.userId && config.vipUserIds.has(ctx.userId)) {
    return { decision: "emit", reason: "vip_user" };
  }

  // alwaysLogPaths
  if (
    ctx.path &&
    config.alwaysLogPaths.length > 0 &&
    config.alwaysLogPaths.some((pattern) => pattern.test(ctx.path!))
  ) {
    return { decision: "emit", reason: "always_log_path" };
  }

  // random sampling
  if (config.sampleRate >= 1) {
    return { decision: "emit", reason: "full_sample" };
  }

  if (Math.random() < config.sampleRate) {
    return { decision: "emit", reason: "random_sample" };
  }

  return { decision: "drop", reason: "sampled_out" };
}
