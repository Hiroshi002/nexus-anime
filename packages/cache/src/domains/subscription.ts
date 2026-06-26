import { getRedis } from "../client";
import { cacheFeatures } from "../feature-flags";
import { cacheKeys } from "../keys";
import { safeGet, safeSet } from "../safe";
import { TTL } from "../ttl";

export async function cacheSubscriptionStatus(
  userId: string,
  status: string,
): Promise<void> {
  if (!cacheFeatures.subscription()) return;
  const redis = getRedis();
  await safeSet(redis, cacheKeys.subscription(userId), status, { ex: TTL.SUBSCRIPTION });
}

export async function getCachedSubscriptionStatus(
  userId: string,
): Promise<string | null> {
  if (!cacheFeatures.subscription()) return null;
  const redis = getRedis();
  return safeGet<string>(redis, cacheKeys.subscription(userId));
}
