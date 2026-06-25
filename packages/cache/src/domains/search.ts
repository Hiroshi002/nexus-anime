import { getRedis } from "../client";
import { cacheKeys } from "../keys";
import { TTL } from "../ttl";
import { hashQuery } from "../serializers";

export async function getSearchResults<T>(query: string, cursor?: string): Promise<T | null> {
  const redis = getRedis();
  const hash = hashQuery(query);
  return await redis.get<T>(cacheKeys.search(hash, cursor));
}

export async function setSearchResults<T>(
  query: string,
  data: T,
  cursor?: string,
): Promise<void> {
  const redis = getRedis();
  const hash = hashQuery(query);
  await redis.set(cacheKeys.search(hash, cursor), data, { ex: TTL.SEARCH });
}
