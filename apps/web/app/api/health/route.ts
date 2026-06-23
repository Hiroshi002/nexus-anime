import { successResponse } from "@/lib/api/envelope";

export function GET() {
  return Response.json(successResponse({ status: "ok" as const }));
}
