import { getRedis } from "../client";
import { cacheKeys } from "../keys";
import { TTL } from "../ttl";

export async function cacheSubscriptionStatus(
  userId: string,
  status: string,
): Promise<void> {
  const redis = getRedis();
  await redis.set(cacheKeys.subscription(userId), status, { ex: TTL.SUBSCRIPTION });
}

export async function getCachedSubscriptionStatus(
  userId: string,
): Promise<string | null> {
  const redis = getRedis();
  return await redis.get<string>(cacheKeys.subscription(userId));
}
