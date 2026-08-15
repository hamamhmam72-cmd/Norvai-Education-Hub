import { useState } from "react";
import { useLang } from "@/context/LanguageContext";
import { useSubmitFeedback } from "@workspace/api-client-react";
import { MessageSquareHeart, Star, Loader2, Send, Lightbulb, Bug, Smile, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "suggestion", labelKey: "suggestion" as const, icon: Lightbulb },
  { value: "bug", labelKey: "bugReport" as const, icon: Bug },
  { value: "experience", labelKey: "userExperience" as const, icon: Smile },
  { value: "other", labelKey: "other" as const, icon: MoreHorizontal },
];

export default function FeedbackPage() {
  const { t } = useLang();
  const { toast } = useToast();
  const [category, setCategory] = useState("suggestion");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const submitFeedback = useSubmitFeedback();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 3) return;
    submitFeedback.mutate(
      { data: { category: category as any, message: message.trim(), ...(rating ? { rating } : {}) } },
      {
        onSuccess: () => {
          toast({ description: t("feedbackThanks") });
          setMessage("");
          setRating(null);
          setCategory("suggestion");
        },
        onError: (err: any) => {
          toast({ variant: "destructive", description: err?.message ?? "Failed to submit feedback." });
        },
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex items-center gap-3">
        <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <MessageSquareHeart className="size-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("feedbackTitle")}</h1>
          <p className="text-muted-foreground mt-1">{t("feedbackDesc")}</p>
        </div>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{t("feedbackCategory")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  data-testid={`category-${c.value}`}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all",
                    category === c.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <c.icon className="size-5" />
                  {t(c.labelKey)}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("yourMessage")}</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("feedbackPlaceholder")}
                rows={6}
                maxLength={5000}
                data-testid="input-feedback-message"
              />
              <p className="text-xs text-muted-foreground text-end">{message.length}/5000</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("yourRating")}</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(rating === n ? null : n)}
                    data-testid={`rating-${n}`}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className={cn(
                        "size-7",
                        rating != null && n <= rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/40"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full sm:w-auto px-8"
              disabled={submitFeedback.isPending || message.trim().length < 3}
              data-testid="button-send-feedback"
            >
              {submitFeedback.isPending
                ? <Loader2 className="me-2 size-4 animate-spin" />
                : <Send className="me-2 size-4" />}
              {t("sendFeedback")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
