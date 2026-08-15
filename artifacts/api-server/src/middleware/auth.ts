import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../lib/jwt.js";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Server-side paywall enforcement for core learning features.
 * Passes if the user is an admin, has an active subscription, or has
 * activated with a valid free access code.
 */
export function requireActiveAccess(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, async () => {
    try {
      if (req.user?.role === "admin") {
        next();
        return;
      }
      const [user] = await db
        .select({
          subscriptionActive: usersTable.subscriptionActive,
          subscriptionExpiry: usersTable.subscriptionExpiry,
          accessActivated: usersTable.accessActivated,
          trialExpiresAt: usersTable.trialExpiresAt,
        })
        .from(usersTable)
        .where(eq(usersTable.id, req.user!.userId))
        .limit(1);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const now = new Date();
      const subscriptionValid =
        user.subscriptionActive &&
        (!user.subscriptionExpiry || user.subscriptionExpiry > now);
      const trialValid =
        user.accessActivated &&
        !!user.trialExpiresAt &&
        user.trialExpiresAt > now;
      if (subscriptionValid || trialValid) {
        next();
        return;
      }
      // Determine why access was denied for a helpful error code
      const code =
        !user.subscriptionActive && !user.accessActivated
          ? "ACCESS_REQUIRED"
          : user.accessActivated && user.trialExpiresAt && user.trialExpiresAt <= now
          ? "TRIAL_EXPIRED"
          : "SUBSCRIPTION_EXPIRED";
      res.status(403).json({
        error:
          code === "TRIAL_EXPIRED"
            ? "Your 24-hour free trial has expired. Please subscribe or re-enter a valid code."
            : code === "SUBSCRIPTION_EXPIRED"
            ? "Your subscription has expired. Please renew to continue."
            : "Access not activated. Subscribe or enter a valid activation code.",
        code,
      });
    } catch (err) {
      next(err);
    }
  });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  });
}
