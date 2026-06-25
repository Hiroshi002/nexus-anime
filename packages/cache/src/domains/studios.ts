import { getRedis } from "../client";
import { cacheKeys } from "../keys";
import { TTL } from "../ttl";

export async function getStudios<T>(): Promise<T | null> {
  const redis = getRedis();
  return await redis.get<T>(cacheKeys.studios());
}

export async function setStudios<T>(data: T): Promise<void> {
  const redis = getRedis();
  await redis.set(cacheKeys.studios(), data, { ex: TTL.STUDIOS });
}
