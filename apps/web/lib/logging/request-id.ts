import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

export const REQUEST_ID_HEADER = "X-Request-Id";

export function getRequestId(request?: NextRequest): string {
  if (request) {
    const clientRequestId = request.headers.get(REQUEST_ID_HEADER);
    if (clientRequestId) return clientRequestId;
  }
  return `req_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}
