import { NexusError } from "./errors";

/**
 * Translates thrown errors into a structured result for Server Actions.
 * Services throw typed errors; this function catches and translates.
 */
export function handleActionError(
  error: unknown,
  requestId: string,
): { success: false; error: { code: string; message: string; requestId: string } } {
  if (error instanceof NexusError) {
    return {
      success: false,
      error: { code: error.code, message: error.message, requestId },
    };
  }

  return {
    success: false,
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred", requestId },
  };
}
