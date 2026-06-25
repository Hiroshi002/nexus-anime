export const cacheKeys = {
  animeDetail: (slug: string) => `v1:anime:${slug}`,

  trending: (scope: string, cursor?: string) =>
    cursor ? `v1:trending:${scope}:${cursor}` : `v1:trending:${scope}`,

  search: (queryHash: string, cursor?: string) =>
    cursor ? `v1:search:${queryHash}:${cursor}` : `v1:search:${queryHash}`,

  shelf: (key: string) => `v1:shelves:${key}`,

  genres: () => `v1:genres`,

  studios: () => `v1:studios`,

  subscription: (userId: string) => `v1:subscription:${userId}`,

  rateLimit: (ip: string, window: number) => `v1:rate:${ip}:${window}`,
} as const;
