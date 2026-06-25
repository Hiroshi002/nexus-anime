// Drizzle Kit configuration
//
// Environment tiers (see docs/m2/environment-specification.md §2):
//   Local      → docker compose, postgres:16-alpine on localhost:5432
//   Preview    → Neon branch (ephemeral, per-PR)
//   Staging    → Neon staging instance (persistent)
//   Production → Neon production instance (persistent, monitored)
//
// DATABASE_URL is read from the environment. The default is only a safety
// net for `drizzle-kit generate` against a freshly-cloned repo; CI and
// production deployments must always set DATABASE_URL explicitly.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/*.ts",
  out: "./dialects",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://nexus:nexus@localhost:5432/nexus_anime",
  },
  verbose: true,
  strict: true,
});
