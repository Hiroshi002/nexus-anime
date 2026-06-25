export const TTL = {
  ANIME_DETAIL: 30 * 60,
  TRENDING: 10 * 60,
  SEARCH: 5 * 60,
  SHELVES: 15 * 60,
  GENRES: 60 * 60,
  STUDIOS: 60 * 60,
  SUBSCRIPTION: 5 * 60,
  RATE_LIMIT_WINDOW: 15 * 60,
} as const;

export type TtlKey = keyof typeof TTL;
