import { successResponse } from "@/lib/api/envelope";
import { handleApiError } from "@/lib/api/errors/handler";
import { getRequestId } from "@/lib/logging/request-id";

export async function GET() {
  const requestId = getRequestId();
  try {
    return successResponse({ status: "ok" as const }, { requestId, version: "v1" });
  } catch (error) {
    return handleApiError(error, requestId, "GET /api/v1/health");
  }
}
