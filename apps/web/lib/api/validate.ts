import type { ZodSchema } from "zod";

import { ValidationError } from "./errors";

/**
 * Validates input against a Zod schema.
 * Throws ValidationError (400) with per-field details on failure.
 */
export function validate<T>(schema: ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw ValidationError.fromZod(result.error);
  }
  return result.data;
}
