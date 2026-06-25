import { describe, expect, it } from "vitest";

import { errorResponse, isApiErrorResponse, successResponse } from "@/lib/api/envelope";

describe("API envelope", () => {
  it("should create a success response with data and meta", () => {
    const response = successResponse({ status: "ok" });
    expect(response.data).toEqual({ status: "ok" });
    expect(response.meta).toEqual({ requestId: "unknown", version: "v1" });
  });

  it("should accept custom meta", () => {
    const response = successResponse(
      { status: "ok" },
      { requestId: "req_abc", version: "v1" },
    );
    expect(response.meta.requestId).toBe("req_abc");
  });

  it("should create an error response with code, details, and meta", () => {
    const response = errorResponse(
      "Not found",
      "NOT_FOUND",
      { requestId: "req_abc", version: "v1" },
      [{ field: "id", message: "Invalid" }],
    );
    expect(isApiErrorResponse(response)).toBe(true);
    expect(response.error.code).toBe("NOT_FOUND");
    expect(response.error.details).toEqual([{ field: "id", message: "Invalid" }]);
    expect(response.meta.requestId).toBe("req_abc");
  });
});
