export function warn(message: string, data?: unknown): void {
  if (process.env.NODE_ENV === "test") return;
  console.warn(`[cache] ${message}`, data ?? "");
}
