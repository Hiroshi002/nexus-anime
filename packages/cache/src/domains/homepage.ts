import { getRedis } from "../client";
import { cacheKeys } from "../keys";
import { TTL } from "../ttl";

export async function getShelf<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  return await redis.get<T>(cacheKeys.shelf(key));
}

export async function setShelf<T>(key: string, data: T): Promise<void> {
  const redis = getRedis();
  await redis.set(cacheKeys.shelf(key), data, { ex: TTL.SHELVES });
}
