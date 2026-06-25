import "server-only";

import Stripe from "stripe";

import { env } from "@/lib/env";

/**
 * Stripe client singleton.
 *
 * Uses the server-side secret key only — the publishable key is exposed
 * to the browser via NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and should be
 * accessed through `env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in client code.
 *
 * This module is guarded by `server-only` so it can never be accidentally
 * imported into a client bundle.
 */
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-06-24.dahlia",
  typescript: true,
});
