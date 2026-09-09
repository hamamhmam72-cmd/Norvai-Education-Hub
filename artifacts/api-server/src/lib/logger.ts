import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});

export type TeamRealtimeTelemetryMetric =
  | "reconnect_attempts"
  | "publish_failures"
  | "hydration_failures";

const teamRealtimeTelemetry: Record<TeamRealtimeTelemetryMetric, number> = {
  reconnect_attempts: 0,
  publish_failures: 0,
  hydration_failures: 0,
};
let teamMessageLimitStoreFailures = 0;

/**
 * Record bounded, aggregate-only Team realtime telemetry. Keeping the counter
 * here makes the structured event shape consistent for log-based monitoring
 * without including project, user, or database connection details.
 */
export function recordTeamRealtimeTelemetry(metric: TeamRealtimeTelemetryMetric) {
  const count = teamRealtimeTelemetry[metric] + 1;
  teamRealtimeTelemetry[metric] = count;
  logger.warn(
    {
      telemetry: "team_realtime",
      metric,
      count,
    },
    "Team realtime telemetry counter incremented",
  );
  return count;
}

export function getTeamRealtimeTelemetry() {
  return { ...teamRealtimeTelemetry };
}

export function recordTeamMessageLimitStoreFailure() {
  teamMessageLimitStoreFailures += 1;
  logger.warn(
    {
      telemetry: "team_message_limits",
      metric: "store_failures",
      count: teamMessageLimitStoreFailures,
    },
    "Team message-limit telemetry counter incremented",
  );
  return teamMessageLimitStoreFailures;
}

export function getTeamMessageLimitTelemetry() {
  return { storeFailures: teamMessageLimitStoreFailures };
}
