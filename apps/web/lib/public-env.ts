export const PUBLIC_ENV = {
  APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
  SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "",
} as const;
