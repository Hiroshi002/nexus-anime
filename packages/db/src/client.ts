import "server-only";

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const VALID_DATABASE_URL_PREFIXES = ["postgresql://", "postgres://"] as const;

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. See docs/m2/environment-specification.md for configuration.",
    );
  }
  if (!VALID_DATABASE_URL_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    throw new Error(
      `DATABASE_URL must start with "postgresql://" or "postgres://". Got "${url.slice(0, 16)}...". ` +
        "See docs/m2/environment-specification.md for configuration.",
    );
  }
  return url;
}

function readPoolSize(): number {
  const raw = process.env.DATABASE_POOL_SIZE;
  if (raw === undefined || raw === "") return 10;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 10;
}

export type Database = ReturnType<typeof drizzle<typeof schema>>;

let client: Database | null = null;

export function getDb(): Database {
  if (!client) {
    const sql = neon(requireDatabaseUrl());
    client = drizzle(sql, { schema });
  }
  return client;
}

/** @deprecated Use getDb() instead. */
export const db = getDb;

export const databaseConfig = {
  get url(): string {
    return requireDatabaseUrl();
  },
  get poolSize(): number {
    return readPoolSize();
  },
};

export { schema };
