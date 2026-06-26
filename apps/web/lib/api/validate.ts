import type { z } from "zod";

import { ValidationError } from "./errors";

/**
 * Validates input against a Zod schema.
 * Throws ValidationError (400) with per-field details on failure.
 *
 * The input parameter is typed as `z.input<S>` (the schema's *input* type,
 * before defaults/transforms apply) so callers can omit fields that have
 * `.default()` — matching what Zod actually accepts at runtime.
 */
export function validate<S extends z.ZodTypeAny>(
  schema: S,
  input: z.input<S>,
): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw ValidationError.fromZod(result.error);
  }
  return result.data;
}
