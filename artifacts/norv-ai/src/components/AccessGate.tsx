import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { useActivateAccess, getMe } from "@workspace/api-client-react";
import {
  Lock, KeyRound, Loader2, CreditCard,
  Sparkles, ShieldCheck, ArrowRight, Timer, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

// Routes always accessible — users must be able to set up, subscribe, or activate
// Routes always accessible — users must be able to set up, subscribe, or activate
const UNGATED_ROUTES = ["/profile", "/subscription", "/feedback", "/setup"];

/** Returns true when a timestamp string is set and still in the future. */
function isFutureDate(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() > Date.now();
}

export function AccessGate({ children }: { children: ReactNode }) {
  const { user, updateUser } = useAuth();
  const { t, isRTL } = useLang();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const activateAccess = useActivateAccess();

  const u = user as any;
  const subscriptionValid =
    u?.subscriptionActive &&
    isFutureDate(u?.subscriptionExpiry ?? null) || (u?.subscriptionActive && !u?.subscriptionExpiry);
  const trialValid =
    u?.accessActivated && isFutureDate(u?.trialExpiresAt);

  const isUngated = !user ||
    user.role === "admin" ||
    subscriptionValid ||
    trialValid ||
    UNGATED_ROUTES.some((r) => location === r || location.startsWith(r + "/"));

  const gated = !isUngated;

  // Determine reason for gating so we can show a helpful message
  const gateReason: "trial_expired" | "sub_expired" | "no_access" =
    u?.accessActivated && !trialValid && u?.trialExpiresAt
      ? "trial_expired"
      : u?.subscriptionActive && !subscriptionValid
      ? "sub_expired"
      : "no_access";

  if (!gated) return <>{children}</>;

  const handleActivate = (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    const trimmed = code.trim();
    if (!trimmed) return;
    activateAccess.mutate(
      { data: { code: trimmed } },
      {
        onSuccess: async () => {
          try {
            const fresh = await getMe();
            updateUser(fresh);
          } catch {
            updateUser({ ...(user as any), accessActivated: true });
          }
          toast({ description: t("accessActivatedMsg") });
        },
        onError: () => setError(t("invalidActivationCode")),
      }
    );
  };

  return (
    <div
      className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4"
      data-testid="access-gate"
    >
      {/* Card */}
      <div className={cn(
        "w-full max-w-sm rounded-2xl border border-border/60 bg-card shadow-xl overflow-hidden",
        "animate-in fade-in slide-in-from-bottom-4 duration-300",
      )}>

        {/* Top gradient banner */}
        <div className="h-2 bg-gradient-to-r from-violet-600 via-primary to-indigo-500" />

        <div className="p-6 space-y-6">

          {/* Icon + heading — adapts to reason */}
          <div className="flex flex-col items-center text-center gap-3">
            <div className={cn(
              "size-14 rounded-2xl flex items-center justify-center shadow-inner",
              gateReason === "trial_expired"
                ? "bg-amber-500/10"
                : gateReason === "sub_expired"
                ? "bg-red-500/10"
                : "bg-primary/10",
            )}>
              {gateReason === "trial_expired" ? (
                <Timer className="size-7 text-amber-500" />
              ) : gateReason === "sub_expired" ? (
                <RefreshCw className="size-7 text-red-500" />
              ) : (
                <Lock className="size-7 text-primary" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {gateReason === "trial_expired"
                  ? t("trialExpiredTitle")
                  : gateReason === "sub_expired"
                  ? t("subExpiredTitle")
                  : t("accessRequired")}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1 max-w-xs">
                {gateReason === "trial_expired"
                  ? t("trialExpiredDesc")
                  : gateReason === "sub_expired"
                  ? t("subExpiredDesc")
                  : t("accessGateDesc")}
              </p>
            </div>
          </div>

          {/* Code form */}
          <form onSubmit={handleActivate} className="space-y-3">
            <label className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <KeyRound className="size-4 text-primary shrink-0" />
              {t("activationCode")}
            </label>

            <Input
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(null); }}
              placeholder={t("activationCodePlaceholder")}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              className={cn(
                "h-12 text-base rounded-xl border-border/60",
                "focus-visible:ring-primary/40 focus-visible:border-primary/60",
                error && "border-destructive focus-visible:ring-destructive/30",
              )}
              data-testid="input-activation-code"
            />

            {error && (
              <p className="text-sm text-destructive flex items-center gap-1.5 animate-in fade-in duration-200">
                <span className="size-4 rounded-full bg-destructive/10 flex items-center justify-center text-xs font-bold shrink-0">!</span>
                {error}
              </p>
            )}

            {/* Activate button — onClick + type=submit for max iOS compat */}
            <Button
              type="submit"
              onClick={() => handleActivate()}
              className={cn(
                "w-full h-12 text-base rounded-xl font-semibold",
                "bg-gradient-to-r from-violet-600 to-primary hover:from-violet-500 hover:to-primary/90",
                "shadow-md shadow-primary/20 transition-all",
              )}
              disabled={activateAccess.isPending || !code.trim()}
              data-testid="button-activate"
            >
              {activateAccess.isPending ? (
                <Loader2 className={cn("size-5 animate-spin", isRTL ? "ms-2" : "me-2")} />
              ) : (
                <Sparkles className={cn("size-5", isRTL ? "ms-2" : "me-2")} />
              )}
              {t("activate")}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("orDivider")}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Subscribe button — use <a> for guaranteed iOS navigation */}
          <a
            href="/subscription"
            onClick={(e) => { e.preventDefault(); navigate("/subscription"); }}
            className={cn(
              "w-full h-12 rounded-xl border-2 border-border/60 bg-transparent",
              "flex items-center justify-center gap-2",
              "text-sm font-semibold text-foreground",
              "hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]",
              "transition-all duration-150 no-underline",
            )}
          >
            <CreditCard className="size-4 text-muted-foreground shrink-0" />
            {t("subscribeInstead")}
            <ArrowRight className={cn("size-4 text-muted-foreground ms-auto", isRTL && "rotate-180")} />
          </a>

          {/* Trust note */}
          <p className="text-[11px] text-muted-foreground/60 text-center flex items-center justify-center gap-1.5">
            <ShieldCheck className="size-3" />
            Norv · Secure activation
          </p>
        </div>
      </div>
    </div>
  );
}
