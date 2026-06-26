import type { Redis, SetCommandOptions } from "@upstash/redis";

import { warn } from "./logger";

export async function safeGet<T>(redis: Redis, key: string): Promise<T | null> {
  try {
    return await redis.get<T>(key);
  } catch (err) {
    warn("redis.get failed", { key, err });
    return null;
  }
}

export async function safeSet(
  redis: Redis,
  key: string,
  data: unknown,
  opts?: SetCommandOptions,
): Promise<void> {
  try {
    await redis.set(key, data, opts);
  } catch (err) {
    warn("redis.set failed", { key, err });
  }
}

export async function safeDel(redis: Redis, ...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch (err) {
    warn("redis.del failed", { keys, err });
  }
}

export async function safeScan(
  redis: Redis,
  cursor: number,
  match: string,
  count: number,
): Promise<[number, string[]]> {
  try {
    const [nextCursor, keys] = await redis.scan(cursor, { match, count });
    return [Number(nextCursor), keys];
  } catch (err) {
    warn("redis.scan failed", { cursor, match, err });
    return [0, []];
  }
}

export async function safeCall<T>(
  fn: () => Promise<T>,
  label: string,
  fallback: T,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    warn(`${label} failed`, { err });
    return fallback;
  }
}
