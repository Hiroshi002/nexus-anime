import { getRedis } from "../client";
import { cacheKeys } from "../keys";
import { TTL } from "../ttl";

export async function getGenres<T>(): Promise<T | null> {
  const redis = getRedis();
  return await redis.get<T>(cacheKeys.genres());
}

export async function setGenres<T>(data: T): Promise<void> {
  const redis = getRedis();
  await redis.set(cacheKeys.genres(), data, { ex: TTL.GENRES });
}
