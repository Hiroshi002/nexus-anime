import { route } from "@/lib/api/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HealthStatus {
  status: "ok" | "degraded";
  version: string;
  uptimeSeconds: number;
  checks: {
    memory: "ok";
  };
}

const START_TIME = Date.now();

export const GET = route(async (): Promise<HealthStatus> => {
  return {
    status: "ok",
    version: "v1",
    uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
    checks: {
      memory: "ok",
    },
  };
});
