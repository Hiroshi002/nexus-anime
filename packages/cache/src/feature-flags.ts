export const cacheFeatures = {
  enabled: () => process.env.ENABLE_REDIS_CACHE === "true",
  animeDetails: () => process.env.ENABLE_REDIS_CACHE === "true",
  trending: () => process.env.ENABLE_REDIS_CACHE === "true",
  search: () => process.env.ENABLE_REDIS_CACHE === "true",
  shelves: () =>
    process.env.ENABLE_REDIS_SHELVES === "true" ||
    process.env.ENABLE_REDIS_CACHE === "true",
  subscription: () => process.env.ENABLE_REDIS_CACHE === "true",
} as const;
