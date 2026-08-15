import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { useActivateAccess, getMe } from "@workspace/api-client-react";
import { Lock, KeyRound, Loader2, CreditCard, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ReactNode } from "react";

// Routes accessible without activation (so users can activate, pay, or manage account)
const UNGATED_ROUTES = ["/profile", "/subscription", "/feedback"];

export function AccessGate({ children }: { children: ReactNode }) {
  const { user, updateUser } = useAuth();
  const { t } = useLang();
  const { toast } = useToast();
  const [location] = useLocation();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const activateAccess = useActivateAccess();

  const gated =
    !!user &&
    user.role !== "admin" &&
    !user.subscriptionActive &&
    !(user as any).accessActivated &&
    !UNGATED_ROUTES.some((r) => location === r || location.startsWith(r + "/"));

  if (!gated) return <>{children}</>;

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!code.trim()) return;
    activateAccess.mutate(
      { data: { code: code.trim() } },
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
    <div className="flex min-h-[70vh] items-center justify-center p-4" data-testid="access-gate">
      <Card className="w-full max-w-md border-border/60 shadow-lg">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
              <Lock className="size-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{t("accessRequired")}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("accessGateDesc")}</p>
          </div>

          <form onSubmit={handleActivate} className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <KeyRound className="size-4 text-primary" />
              {t("activationCode")}
            </label>
            <Input
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(null); }}
              placeholder={t("activationCodePlaceholder")}
              autoComplete="off"
              data-testid="input-activation-code"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              className="w-full"
              disabled={activateAccess.isPending || !code.trim()}
              data-testid="button-activate"
            >
              {activateAccess.isPending
                ? <Loader2 className="me-2 size-4 animate-spin" />
                : <Sparkles className="me-2 size-4" />}
              {t("activate")}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground">{t("orDivider")}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" asChild>
            <Link href="/subscription">
              <CreditCard className="me-2 size-4" />
              {t("subscribeInstead")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
