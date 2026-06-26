import { Ratelimit } from "@upstash/ratelimit";

import { getRedis } from "./client";
import { safeCall } from "./safe";

export const rateLimiters = {
  standard: new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(100, "15 m"),
    prefix: "v1:rate:standard",
  }),

  authenticated: new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(200, "15 m"),
    prefix: "v1:rate:auth",
  }),

  admin: new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(30, "15 m"),
    prefix: "v1:rate:admin",
  }),
} as const;

export type RateLimiterKey = keyof typeof rateLimiters;

export async function consumeRateLimit(
  limiterKey: RateLimiterKey,
  identifier: string,
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  const limiter = rateLimiters[limiterKey];
  const fallback = { success: true, limit: 0, remaining: 0, reset: 0 };
  const result = await safeCall(() => limiter.limit(identifier), "ratelimit.limit", fallback);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}
