import { getRedis } from "./client";
import { cacheKeys } from "./keys";

export async function invalidateAnime(slug: string): Promise<void> {
  const redis = getRedis();
  await redis.del(cacheKeys.animeDetail(slug));
}

export async function invalidateTrending(): Promise<void> {
  const redis = getRedis();
  let cursor = 0;
  do {
    const [nextCursor, keys] = await redis.scan(cursor, {
      match: "v1:trending:*",
      count: 100,
    });
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    cursor = Number(nextCursor);
  } while (cursor !== 0);
}

export async function invalidateShelf(key: string): Promise<void> {
  const redis = getRedis();
  await redis.del(cacheKeys.shelf(key));
}

export async function invalidateAllShelves(): Promise<void> {
  const redis = getRedis();
  let cursor = 0;
  do {
    const [nextCursor, keys] = await redis.scan(cursor, {
      match: "v1:shelves:*",
      count: 100,
    });
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    cursor = Number(nextCursor);
  } while (cursor !== 0);
}

export async function invalidateSubscription(userId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(cacheKeys.subscription(userId));
}

export async function invalidateSearch(): Promise<void> {
  const redis = getRedis();
  let cursor = 0;
  do {
    const [nextCursor, keys] = await redis.scan(cursor, {
      match: "v1:search:*",
      count: 100,
    });
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    cursor = Number(nextCursor);
  } while (cursor !== 0);
}

export async function invalidateVersion(prefix: string): Promise<number> {
  const redis = getRedis();
  let cursor = 0;
  let deleted = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, {
      match: `${prefix}:*`,
      count: 100,
    });
    if (keys.length > 0) {
      await redis.del(...keys);
      deleted += keys.length;
    }
    cursor = Number(nextCursor);
  } while (cursor !== 0);

  return deleted;
}
