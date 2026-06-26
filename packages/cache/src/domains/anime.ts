import { getRedis } from "../client";
import { cacheFeatures } from "../feature-flags";
import { cacheKeys } from "../keys";
import { safeGet, safeSet } from "../safe";
import { TTL } from "../ttl";

export async function getAnimeDetail<T>(slug: string): Promise<T | null> {
  if (!cacheFeatures.animeDetails()) return null;
  const redis = getRedis();
  return safeGet<T>(redis, cacheKeys.animeDetail(slug));
}

export async function setAnimeDetail<T>(slug: string, data: T): Promise<void> {
  if (!cacheFeatures.animeDetails()) return;
  const redis = getRedis();
  await safeSet(redis, cacheKeys.animeDetail(slug), data, { ex: TTL.ANIME_DETAIL });
}
