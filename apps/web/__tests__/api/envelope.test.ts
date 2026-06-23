import { describe, expect, it } from "vitest";

import { errorResponse, isApiErrorResponse, successResponse } from "@/lib/api/envelope";

describe("API envelope", () => {
  it("should create a success response with data", () => {
    const response = successResponse({ status: "ok" });
    expect(response).toEqual({ data: { status: "ok" } });
  });

  it("should create an error response with code and details", () => {
    const response = errorResponse("Not found", "NOT_FOUND", [
      { field: "id", message: "Invalid" },
    ]);
    expect(isApiErrorResponse(response)).toBe(true);
    expect(response.error.code).toBe("NOT_FOUND");
  });
});
