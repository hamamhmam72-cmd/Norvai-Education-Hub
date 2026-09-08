import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getTeamRealtimeHealth } from "../lib/team-realtime.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const teamRealtime = getTeamRealtimeHealth();
  const data = HealthCheckResponse.parse({
    status: teamRealtime.pubSubListener === "connected" ? "ok" : "degraded",
    teamRealtime,
  });
  res.json(data);
});

export default router;
