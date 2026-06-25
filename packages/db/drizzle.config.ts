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
