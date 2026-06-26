import { getRedis } from "./client";
import { cacheKeys } from "./keys";
import { safeDel, safeScan } from "./safe";

export async function invalidateAnime(slug: string): Promise<void> {
  const redis = getRedis();
  await safeDel(redis, cacheKeys.animeDetail(slug));
}

export async function invalidateTrending(): Promise<void> {
  const redis = getRedis();
  let cursor = 0;
  do {
    const [nextCursor, keys] = await safeScan(redis, cursor, "v1:trending:*", 100);
    if (keys.length > 0) {
      await safeDel(redis, ...keys);
    }
    cursor = nextCursor;
  } while (cursor !== 0);
}

export async function invalidateShelf(key: string): Promise<void> {
  const redis = getRedis();
  await safeDel(redis, cacheKeys.shelf(key));
}

export async function invalidateAllShelves(): Promise<void> {
  const redis = getRedis();
  let cursor = 0;
  do {
    const [nextCursor, keys] = await safeScan(redis, cursor, "v1:shelves:*", 100);
    if (keys.length > 0) {
      await safeDel(redis, ...keys);
    }
    cursor = nextCursor;
  } while (cursor !== 0);
}

export async function invalidateSubscription(userId: string): Promise<void> {
  const redis = getRedis();
  await safeDel(redis, cacheKeys.subscription(userId));
}

export async function invalidateSearch(): Promise<void> {
  const redis = getRedis();
  let cursor = 0;
  do {
    const [nextCursor, keys] = await safeScan(redis, cursor, "v1:search:*", 100);
    if (keys.length > 0) {
      await safeDel(redis, ...keys);
    }
    cursor = nextCursor;
  } while (cursor !== 0);
}

export async function invalidateVersion(prefix: string): Promise<number> {
  const redis = getRedis();
  let cursor = 0;
  let deleted = 0;

  do {
    const [nextCursor, keys] = await safeScan(redis, cursor, `${prefix}:*`, 100);
    if (keys.length > 0) {
      await safeDel(redis, ...keys);
      deleted += keys.length;
    }
    cursor = nextCursor;
  } while (cursor !== 0);

  return deleted;
}
