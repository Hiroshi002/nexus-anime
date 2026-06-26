import { getRedis } from "../client";
import { cacheFeatures } from "../feature-flags";
import { cacheKeys } from "../keys";
import { safeGet, safeSet } from "../safe";
import { TTL } from "../ttl";

export async function getGenres<T>(): Promise<T | null> {
  if (!cacheFeatures.enabled()) return null;
  const redis = getRedis();
  return safeGet<T>(redis, cacheKeys.genres());
}

export async function setGenres<T>(data: T): Promise<void> {
  if (!cacheFeatures.enabled()) return;
  const redis = getRedis();
  await safeSet(redis, cacheKeys.genres(), data, { ex: TTL.GENRES });
}
