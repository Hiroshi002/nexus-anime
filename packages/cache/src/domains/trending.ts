import { getRedis } from "../client";
import { cacheKeys } from "../keys";
import { TTL } from "../ttl";

export async function getTrending<T>(scope: string, cursor?: string): Promise<T | null> {
  const redis = getRedis();
  return await redis.get<T>(cacheKeys.trending(scope, cursor));
}

export async function setTrending<T>(scope: string, data: T, cursor?: string): Promise<void> {
  const redis = getRedis();
  await redis.set(cacheKeys.trending(scope, cursor), data, { ex: TTL.TRENDING });
}
