import "server-only";

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

let client: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function db(): ReturnType<typeof drizzle<typeof schema>> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. See docs/m2/environment-specification.md for configuration.",
      );
    }
    const sql = neon(url);
    client = drizzle(sql, { schema });
  }
  return client;
}

export type Database = ReturnType<typeof db>;
export { schema };
