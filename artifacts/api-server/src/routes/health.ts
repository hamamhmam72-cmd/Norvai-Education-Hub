import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getTeamRealtimeHealth } from "../lib/team-realtime.js";
import { getTeamMessageLimitTelemetry } from "../lib/logger.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const teamRealtime = getTeamRealtimeHealth();
  const data = HealthCheckResponse.parse({
   status: teamRealtime.pubSubListener === "connected" ? "ok" : "degraded",
    teamRealtime,
    teamMessageLimits: getTeamMessageLimitTelemetry(),
  });
  res.json(data);
});

export default router;
