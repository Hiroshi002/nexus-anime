import { uuid, varchar, text, timestamp, pgTable } from "drizzle-orm/pg-core";
import { anime } from "./anime";

export const genres = pgTable("genres", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  iconUrl: varchar("icon_url", { length: 1024 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studios = pgTable("studios", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  logoUrl: varchar("logo_url", { length: 1024 }),
  website: varchar("website", { length: 500 }),
  foundedDate: timestamp("founded_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const animeGenres = pgTable("anime_genres", {
  animeId: uuid("anime_id")
    .notNull()
    .references(() => anime.id, { onDelete: "cascade" }),
  genreId: uuid("genre_id")
    .notNull()
    .references(() => genres.id, { onDelete: "cascade" }),
});
