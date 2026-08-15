/**
 * AccessCountdown
 * Displays the remaining time on a trial or subscription in the sidebar.
 * Auto-locks the app when the timer hits zero by refreshing the user from the API.
 */
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { getMe } from "@workspace/api-client-react";
import { Clock, CreditCard, AlertTriangle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

type Mode = "trial" | "subscription";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

function calcTimeLeft(expiresAt: string): TimeLeft {
  const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  return {
    days:    Math.floor(diff / 86_400_000),
    hours:   Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000)  / 60_000),
    seconds: Math.floor((diff % 60_000)     / 1_000),
    totalMs: diff,
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function AccessCountdown() {
  const { user, updateUser } = useAuth();
  const { t, isRTL } = useLang();
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  // Determine which expiry to show: prefer trial over subscription
  useEffect(() => {
    if (!user) { setMode(null); setExpiresAt(null); return; }
    const u = user as any;

    const trialValid =
      u.accessActivated &&
      u.trialExpiresAt &&
      new Date(u.trialExpiresAt) > new Date();

    const subValid =
      u.subscriptionActive &&
      u.subscriptionExpiry &&
      new Date(u.subscriptionExpiry) > new Date();

    if (trialValid) {
      setMode("trial");
      setExpiresAt(u.trialExpiresAt);
    } else if (subValid) {
      setMode("subscription");
      setExpiresAt(u.subscriptionExpiry);
    } else {
      setMode(null);
      setExpiresAt(null);
    }
  }, [user]);

  // Refresh user from server when timer hits zero (triggers AccessGate)
  const handleExpiry = useCallback(async () => {
    try {
      const fresh = await getMe();
      updateUser(fresh);
    } catch {
      // network error — just update locally so gate shows
      updateUser({ ...(user as any), accessActivated: false, subscriptionActive: false });
    }
  }, [user, updateUser]);

  // Tick every second
  useEffect(() => {
    if (!expiresAt) { setTimeLeft(null); return; }
    const tick = () => {
      const tl = calcTimeLeft(expiresAt);
      setTimeLeft(tl);
      if (tl.totalMs <= 0) handleExpiry();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, handleExpiry]);

  if (!mode || !timeLeft || timeLeft.totalMs <= 0) return null;

  const isTrial = mode === "trial";
  const urgent  = timeLeft.totalMs < 60 * 60 * 1000; // < 1 hour left
  const warning = timeLeft.totalMs < 6 * 60 * 60 * 1000; // < 6 hours

  /* Format display:
   *  Trial  → HH:MM:SS (down to seconds, they expire quickly)
   *  Subscription with days → "Xd Yh" abbreviated
   *  Subscription < 1 day → HH:MM:SS
   */
  const formatTime = () => {
    if (isTrial || timeLeft.days === 0) {
      return `${pad(timeLeft.hours)}:${pad(timeLeft.minutes)}:${pad(timeLeft.seconds)}`;
    }
    if (timeLeft.days >= 1) {
      return `${timeLeft.days}d ${pad(timeLeft.hours)}h`;
    }
    return `${pad(timeLeft.hours)}:${pad(timeLeft.minutes)}`;
  };

  const colorClass = urgent
    ? "text-red-500 border-red-500/30 bg-red-500/5"
    : warning
    ? "text-amber-500 border-amber-500/30 bg-amber-500/5"
    : isTrial
    ? "text-violet-400 border-violet-500/30 bg-violet-500/5"
    : "text-green-500 border-green-500/30 bg-green-500/5";

  const Icon = urgent ? AlertTriangle : isTrial ? Zap : Clock;

  return (
    <div className={cn(
      "rounded-xl border px-3 py-2.5 mb-3 text-xs",
      colorClass,
    )}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 font-semibold">
          <Icon className="size-3 shrink-0" />
          {isTrial ? (
            <span>Free Trial</span>
          ) : (
            <span>Subscription</span>
          )}
        </div>
        <span className="font-mono font-bold tracking-tight text-sm">
          {formatTime()}
        </span>
      </div>

      <p className="text-[10px] opacity-70 leading-snug">
        {urgent
          ? "Access expires very soon!"
          : warning
          ? "Access expiring soon — renew to keep learning."
          : isTrial
          ? "Trial access · renews with a plan"
          : "Active subscription"}
      </p>

      {(urgent || warning) && (
        <Link
          href="/subscription"
          className={cn(
            "mt-2 flex items-center gap-1 text-[10px] font-semibold underline underline-offset-2 opacity-80 hover:opacity-100",
          )}
        >
          <CreditCard className="size-3 shrink-0" />
          Subscribe to keep access
        </Link>
      )}
    </div>
  );
}
