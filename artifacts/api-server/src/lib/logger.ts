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

export type AbuseCleanupTelemetry = {
  removedRows: number;
  durationMs: number;
  approximateLiveRows: number;
  approximateDeadRows: number;
  consecutiveFullBatches: number;
  backlogLikely: boolean;
};

export function recordAbuseCleanupTelemetry(sample: AbuseCleanupTelemetry) {
  const bindings = {
    telemetry: "abuse_rate_limit_cleanup",
    metric: sample.backlogLikely ? "backlog_growth" : "cleanup_sample",
    removedRows: sample.removedRows,
    durationMs: sample.durationMs,
    approximateLiveRows: sample.approximateLiveRows,
    approximateDeadRows: sample.approximateDeadRows,
    consecutiveFullBatches: sample.consecutiveFullBatches,
  };
  if (sample.backlogLikely) {
    logger.warn(bindings, "Expired abuse-counter backlog may be outgrowing bounded cleanup");
  } else {
    logger.info(bindings, "Abuse-counter cleanup telemetry sampled");
  }
}

export type TeamEntitlementCheckSource = "periodic" | "pre_broadcast";
export type TeamEntitlementDurationBucket =
  | "under_10_ms"
  | "10_to_49_ms"
  | "50_to_199_ms"
  | "200_ms_or_more";

type TeamEntitlementCheckTelemetry = {
  checkedProjects: number;
  checkedMembers: number;
  durationBuckets: Record<TeamEntitlementDurationBucket, number>;
  consecutiveSlowChecks: number;
};

function emptyEntitlementCheckTelemetry(): TeamEntitlementCheckTelemetry {
  return {
    checkedProjects: 0,
    checkedMembers: 0,
    durationBuckets: {
      under_10_ms: 0,
      "10_to_49_ms": 0,
      "50_to_199_ms": 0,
      "200_ms_or_more": 0,
    },
    consecutiveSlowChecks: 0,
  };
}

const teamEntitlementCheckTelemetry: Record<
  TeamEntitlementCheckSource,
  TeamEntitlementCheckTelemetry
> = {
  periodic: emptyEntitlementCheckTelemetry(),
  pre_broadcast: emptyEntitlementCheckTelemetry(),
};

export function teamEntitlementDurationBucket(durationMs: number): TeamEntitlementDurationBucket {
  if (durationMs < 10) return "under_10_ms";
  if (durationMs < 50) return "10_to_49_ms";
  if (durationMs < 200) return "50_to_199_ms";
  return "200_ms_or_more";
}

export function recordTeamEntitlementCheck(input: {
  source: TeamEntitlementCheckSource;
  durationMs: number;
  memberCount: number;
}) {
  const telemetry = teamEntitlementCheckTelemetry[input.source];
  const bucket = teamEntitlementDurationBucket(input.durationMs);
  telemetry.checkedProjects += 1;
  telemetry.checkedMembers += input.memberCount;
  telemetry.durationBuckets[bucket] += 1;
  telemetry.consecutiveSlowChecks = bucket === "200_ms_or_more"
    ? telemetry.consecutiveSlowChecks + 1
    : 0;

  const sustainedSlowdown = telemetry.consecutiveSlowChecks === 3
    || (telemetry.consecutiveSlowChecks > 3 && telemetry.consecutiveSlowChecks % 10 === 0);
  if (sustainedSlowdown) {
    logger.warn(
      {
        telemetry: "team_entitlement_checks",
        metric: "sustained_latency",
        source: input.source,
        durationBucket: bucket,
        checkedProjects: 1,
        checkedMembers: input.memberCount,
        consecutiveSlowChecks: telemetry.consecutiveSlowChecks,
      },
      "Team entitlement checks are consistently slow",
    );
  }
  return { bucket, sustainedSlowdown };
}

export function getTeamEntitlementCheckTelemetry() {
  return {
    periodic: {
      ...teamEntitlementCheckTelemetry.periodic,
      durationBuckets: { ...teamEntitlementCheckTelemetry.periodic.durationBuckets },
    },
    preBroadcast: {
      ...teamEntitlementCheckTelemetry.pre_broadcast,
      durationBuckets: { ...teamEntitlementCheckTelemetry.pre_broadcast.durationBuckets },
    },
  };
}
