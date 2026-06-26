import { getRedis } from "../client";
import { cacheFeatures } from "../feature-flags";
import { cacheKeys } from "../keys";
import { safeGet, safeSet } from "../safe";
import { TTL } from "../ttl";

export async function getTrending<T>(scope: string, cursor?: string): Promise<T | null> {
  if (!cacheFeatures.trending()) return null;
  const redis = getRedis();
  return safeGet<T>(redis, cacheKeys.trending(scope, cursor));
}

export async function setTrending<T>(scope: string, data: T, cursor?: string): Promise<void> {
  if (!cacheFeatures.trending()) return;
  const redis = getRedis();
  await safeSet(redis, cacheKeys.trending(scope, cursor), data, { ex: TTL.TRENDING });
}
