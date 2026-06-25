import { getRedis } from "../client";
import { cacheKeys } from "../keys";
import { TTL } from "../ttl";

export async function getAnimeDetail<T>(slug: string): Promise<T | null> {
  const redis = getRedis();
  return await redis.get<T>(cacheKeys.animeDetail(slug));
}

export async function setAnimeDetail<T>(slug: string, data: T): Promise<void> {
  const redis = getRedis();
  await redis.set(cacheKeys.animeDetail(slug), data, { ex: TTL.ANIME_DETAIL });
}
