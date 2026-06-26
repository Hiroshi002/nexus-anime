import { NextResponse } from "next/server";

import type { ApiMeta } from "./envelope";

/**
 * Standardized response builder for API routes.
 * Ensures consistent envelope + header shape across all endpoints.
 */
export const res = {
  ok<T>(data: T, meta: ApiMeta): NextResponse {
    return NextResponse.json(
      { data, meta },
      { status: 200, headers: { "X-Request-Id": meta.requestId } },
    );
  },

  created<T>(data: T, meta: ApiMeta): NextResponse {
    return NextResponse.json(
      { data, meta },
      { status: 201, headers: { "X-Request-Id": meta.requestId } },
    );
  },

  noContent(meta: ApiMeta): NextResponse {
    return new NextResponse(null, {
      status: 204,
      headers: { "X-Request-Id": meta.requestId },
    });
  },

  error(
    message: string,
    code: string,
    meta: ApiMeta,
    status: number,
    details?: { field?: string; message: string }[],
  ): NextResponse {
    return NextResponse.json(
      { error: { message, code, details: details ?? [] }, meta },
      { status, headers: { "X-Request-Id": meta.requestId } },
    );
  },
};
