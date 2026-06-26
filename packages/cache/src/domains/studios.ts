import { getRedis } from "../client";
import { cacheFeatures } from "../feature-flags";
import { cacheKeys } from "../keys";
import { safeGet, safeSet } from "../safe";
import { TTL } from "../ttl";

export async function getStudios<T>(): Promise<T | null> {
  if (!cacheFeatures.enabled()) return null;
  const redis = getRedis();
  return safeGet<T>(redis, cacheKeys.studios());
}

export async function setStudios<T>(data: T): Promise<void> {
  if (!cacheFeatures.enabled()) return;
  const redis = getRedis();
  await safeSet(redis, cacheKeys.studios(), data, { ex: TTL.STUDIOS });
}
