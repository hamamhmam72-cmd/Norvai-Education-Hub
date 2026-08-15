import { useState, useRef } from "react";
import {
  useGetSubscriptionStatus,
  useRequestSubscription,
  SubscriptionRequestInputPlan,
} from "@workspace/api-client-react";
import { useLang } from "@/context/LanguageContext";
import {
  CreditCard, CheckCircle2, Clock, ShieldCheck,
  Upload, Sparkles, AlertCircle, Loader2, ArrowRight, ImageIcon, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetSubscriptionStatusQueryKey } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const PLANS = [
  { id: "3months", name: "3 Months", price: "10 JOD", desc: "Perfect for a single semester.", popular: false },
  { id: "6months", name: "6 Months", price: "19 JOD", desc: "Covers a full academic year.", popular: true },
  { id: "1year", name: "1 Year", price: "55 JOD", desc: "Best value for dedicated students.", popular: false },
] as const;

export default function Subscription() {
  const { t } = useLang();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status, isLoading: statusLoading } = useGetSubscriptionStatus();
  const requestSubscription = useRequestSubscription();

  const [selectedPlan, setSelectedPlan] = useState<SubscriptionRequestInputPlan>("6months");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [receiptInputMode, setReceiptInputMode] = useState<"url" | "upload">("url");
  const [imageUploading, setImageUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const token = localStorage.getItem("norv_token");
      const res = await fetch(`${import.meta.env.BASE_URL}api/upload/image`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        setReceiptUrl(data.url);
        setImagePreview(data.url);
        toast({ description: "Image uploaded successfully." });
      } else {
        throw new Error("Upload failed");
      }
    } catch {
      toast({ variant: "destructive", description: "Failed to upload image." });
    } finally {
      setImageUploading(false);
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    setReceiptUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptUrl.trim()) {
      toast({ variant: "destructive", description: "Please provide a receipt (URL or uploaded image)." });
      return;
    }
    requestSubscription.mutate(
      { data: { plan: selectedPlan, receiptUrl } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSubscriptionStatusQueryKey() });
          toast({ title: "Request Submitted", description: "Your subscription is pending approval." });
          setReceiptUrl("");
          setImagePreview(null);
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Submission Failed", description: err?.message });
        },
      }
    );
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-500 pb-10">

      <div className="text-center space-y-4 mb-12">
        <div className="mx-auto size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Sparkles className="size-8 text-primary" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">{t("unlockPro")}</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t("subscriptionDesc")}</p>
      </div>

      {statusLoading ? (
        <Card className="h-40 flex items-center justify-center border-border/50">
          <Loader2 className="animate-spin text-muted-foreground" />
        </Card>
      ) : status?.active ? (
        <Card className="border-green-500/50 bg-green-500/5 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <ShieldCheck className="size-40 text-green-500" />
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-500 text-2xl">
              <CheckCircle2 className="size-6" />
              {t("activeSubscription")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 relative z-10">
            <p className="text-lg">You have full access to all Pro features.</p>
            <div className="flex gap-8 mt-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t("currentPlan")}</p>
                <p className="font-bold text-xl capitalize">{status.plan?.replace("months", " Months")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t("expiresOn")}</p>
                <p className="font-bold text-xl">
                  {(status as any).expiresAt
                    ? new Date((status as any).expiresAt).toLocaleDateString()
                    : (status as any).expiryDate
                    ? new Date((status as any).expiryDate).toLocaleDateString()
                    : t("lifetime")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : status?.pendingRequest ? (
        <Card className="border-yellow-500/50 bg-yellow-500/5 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Clock className="size-40 text-yellow-500" />
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500 text-2xl">
              <Clock className="size-6" />
              {t("activationPending")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 relative z-10">
            <p className="text-lg">{t("pendingDesc")}</p>
            <p className="text-sm text-muted-foreground max-w-md">
              Usually takes less than 24 hours. If you have any issues, please contact support.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Plan Cards */}
          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <Card
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={cn(
                  "relative cursor-pointer transition-all border-2 overflow-hidden",
                  selectedPlan === plan.id
                    ? "border-primary bg-primary/5 shadow-md scale-[1.02]"
                    : "border-border/50 hover:border-primary/50"
                )}
              >
                {plan.popular && (
                  <div className="absolute top-0 inset-x-0 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider text-center py-1">
                    Most Popular
                  </div>
                )}
                <CardContent className={cn("text-center p-6", plan.popular ? "pt-8" : "")}>
                  <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{plan.desc}</p>
                  <div className="text-3xl font-extrabold mb-1">{plan.price}</div>
                  <div className="text-sm text-muted-foreground">one-time payment</div>
                  {selectedPlan === plan.id && (
                    <div className="mt-4 flex justify-center">
                      <CheckCircle2 className="size-5 text-primary" />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Payment + Receipt */}
          <Card className="border-border/50 shadow-sm mt-8 overflow-hidden">
            <div className="grid md:grid-cols-2">
              {/* Left: Payment Instructions */}
              <div className="bg-sidebar p-8 text-sidebar-foreground flex flex-col justify-center">
                <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <CreditCard className="size-6 text-primary" />
                  {t("paymentInstructions")}
                </h3>
                <p className="text-sidebar-foreground/80 mb-6 leading-relaxed">
                  We currently support local transfers via CliQ. Please follow these steps:
                </p>
                <ol className="space-y-4">
                  <li className="flex gap-3 items-start">
                    <div className="size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0">1</div>
                    <span>Transfer the exact amount for your selected plan via CliQ.</span>
                  </li>
                  <li className="flex gap-3 items-start">
                    <div className="size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0">2</div>
                    <div>
                      <span>Send to Alias:</span>
                      <div className="bg-sidebar-accent/50 p-3 rounded-md mt-2 font-mono text-sm border border-sidebar-border">
                        <span className="text-xs text-sidebar-foreground/50 block mb-1 uppercase">Alias Name</span>
                        HAMMAM ALI OMAR TAHA
                        <span className="text-xs text-sidebar-foreground/50 block mt-2 mb-1 uppercase">Bank</span>
                        Bank Al Etihad
                      </div>
                    </div>
                  </li>
                  <li className="flex gap-3 items-start">
                    <div className="size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0">3</div>
                    <span>Upload your receipt screenshot or paste the image link below.</span>
                  </li>
                </ol>
              </div>

              {/* Right: Receipt Form */}
              <div className="p-8 flex flex-col justify-center bg-card">
                <form onSubmit={handleSubmit} className="space-y-5 max-w-sm w-full mx-auto">
                  <div className="text-center mb-2">
                    <h3 className="text-xl font-bold mb-1">{t("submitReceipt")}</h3>
                    <p className="text-sm text-muted-foreground">
                      Upload a screenshot or paste a link to your payment receipt.
                    </p>
                  </div>

                  {/* Toggle: URL vs Upload */}
                  <Tabs value={receiptInputMode} onValueChange={(v) => { setReceiptInputMode(v as "url" | "upload"); setReceiptUrl(""); setImagePreview(null); }}>
                    <TabsList className="w-full">
                      <TabsTrigger value="url" className="flex-1 gap-1.5">
                        <Upload className="size-3.5" /> Paste URL
                      </TabsTrigger>
                      <TabsTrigger value="upload" className="flex-1 gap-1.5">
                        <ImageIcon className="size-3.5" /> Upload Image
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="url" className="mt-3">
                      <div className="space-y-2">
                        <Label htmlFor="receiptUrl">{t("receiptUrl")}</Label>
                        <div className="relative">
                          <Upload className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                          <Input
                            id="receiptUrl"
                            placeholder="https://i.imgur.com/..."
                            value={receiptUrl}
                            onChange={e => setReceiptUrl(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{t("receiptHint")}</p>
                      </div>
                    </TabsContent>

                    <TabsContent value="upload" className="mt-3">
                      <div className="space-y-3">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                        />
                        {imagePreview ? (
                          <div className="relative">
                            <img
                              src={imagePreview}
                              alt="Receipt preview"
                              className="w-full h-40 object-cover rounded-lg border border-border"
                            />
                            <button
                              type="button"
                              onClick={clearImage}
                              className="absolute top-2 right-2 size-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={imageUploading}
                            className="w-full h-36 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                          >
                            {imageUploading ? (
                              <Loader2 className="size-6 animate-spin" />
                            ) : (
                              <>
                                <ImageIcon className="size-8" />
                                <span className="text-sm font-medium">Click to upload receipt</span>
                                <span className="text-xs">PNG, JPG up to 5MB</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>

                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-semibold group"
                    disabled={requestSubscription.isPending || !receiptUrl.trim()}
                  >
                    {requestSubscription.isPending ? (
                      <Loader2 className="mr-2 size-5 animate-spin" />
                    ) : (
                      <>
                        {t("verifyPayment")}
                        <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </Button>

                  <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted p-3 rounded-md">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <p>Accounts are verified manually. Fake receipts will result in an immediate permanent ban.</p>
                  </div>
                </form>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
