import { Redis } from "@upstash/redis";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        "Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN. " +
          "See docs/redis-strategy.md for configuration.",
      );
    }

    client = new Redis({ url, token });
  }

  return client;
}

export function setRedis(mock: Redis | null): void {
  client = mock;
}
