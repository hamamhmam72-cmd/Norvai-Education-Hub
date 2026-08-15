import { useGetProgressLevel } from "@workspace/api-client-react";
import { useLang } from "@/context/LanguageContext";
import { Trophy, Star, Zap, Crown, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const LEVEL_META: Record<string, { icon: typeof Trophy; gradient: string }> = {
  beginner: { icon: Star, gradient: "from-sky-500/20 via-sky-500/10 to-transparent" },
  intermediate: { icon: Zap, gradient: "from-amber-500/20 via-amber-500/10 to-transparent" },
  advanced: { icon: Trophy, gradient: "from-violet-500/20 via-violet-500/10 to-transparent" },
  expert: { icon: Crown, gradient: "from-emerald-500/20 via-emerald-500/10 to-transparent" },
};

export function LevelBanner() {
  const { t } = useLang();
  const { data: progress } = useGetProgressLevel();

  if (!progress) return null;

  const meta = LEVEL_META[progress.level] ?? LEVEL_META.beginner;
  const Icon = meta.icon;
  const levelLabel = t(progress.level as any) ?? progress.level;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-r p-4 sm:p-5",
        meta.gradient
      )}
      data-testid="level-banner"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-background/80 border border-border/60 shadow-sm">
            <Icon className="size-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("currentLevel")}
            </p>
            <p className="text-xl font-bold capitalize leading-tight">{levelLabel}</p>
          </div>
        </div>

        <div className="flex-1 sm:px-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span className="flex items-center gap-1">
              <TrendingUp className="size-3" />
              {progress.points} {t("points")}
            </span>
            {progress.nextLevel && progress.nextLevelPoints != null ? (
              <span>
                {progress.nextLevelPoints - progress.points} {t("points")} {t("toNextLevel")}
              </span>
            ) : (
              <span>{t("maxLevelReached")}</span>
            )}
          </div>
          <Progress value={progress.progressPercent} className="h-2" />
        </div>
      </div>
    </div>
  );
}
