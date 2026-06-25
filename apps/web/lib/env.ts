import "server-only";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  STRIPE_SECRET_KEY: z.string().min(1).default(""),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).default(""),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1).default(""),
  STRIPE_NEXUS_PRICE_ID: z.string().optional(),
});

const parsed = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  STRIPE_NEXUS_PRICE_ID: process.env.STRIPE_NEXUS_PRICE_ID,
});

if (!parsed.success) {
  const formatted = parsed.error.flatten().fieldErrors;
  throw new Error(`Invalid environment variables: ${JSON.stringify(formatted)}`);
}

export const env = parsed.data;
