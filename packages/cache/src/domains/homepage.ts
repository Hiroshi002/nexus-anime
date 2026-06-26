import { getRedis } from "../client";
import { cacheFeatures } from "../feature-flags";
import { cacheKeys } from "../keys";
import { safeGet, safeSet } from "../safe";
import { TTL } from "../ttl";

export async function getShelf<T>(key: string): Promise<T | null> {
  if (!cacheFeatures.shelves()) return null;
  const redis = getRedis();
  return safeGet<T>(redis, cacheKeys.shelf(key));
}

export async function setShelf<T>(key: string, data: T): Promise<void> {
  if (!cacheFeatures.shelves()) return;
  const redis = getRedis();
  await safeSet(redis, cacheKeys.shelf(key), data, { ex: TTL.SHELVES });
}
