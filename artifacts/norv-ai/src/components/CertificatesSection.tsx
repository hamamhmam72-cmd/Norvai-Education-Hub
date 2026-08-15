import { useRef } from "react";
import { useGetCertificates, Certificate } from "@workspace/api-client-react";
import { useLang } from "@/context/LanguageContext";
import { Award, Download, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";

const LEVEL_COLORS: Record<string, string> = {
  beginner: "#0ea5e9",
  intermediate: "#f59e0b",
  advanced: "#8b5cf6",
  expert: "#10b981",
};

function downloadCertificate(cert: Certificate) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 850;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const accent = LEVEL_COLORS[cert.level] ?? "#0ea5e9";

  // Background
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, 1200, 850);

  // Border
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.strokeRect(40, 40, 1120, 770);
  ctx.strokeStyle = accent + "55";
  ctx.lineWidth = 2;
  ctx.strokeRect(56, 56, 1088, 738);

  ctx.textAlign = "center";

  // Brand
  ctx.fillStyle = accent;
  ctx.font = "bold 40px Georgia, serif";
  ctx.fillText("Norv", 600, 150);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 56px Georgia, serif";
  ctx.fillText("Certificate of Completion", 600, 240);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "24px Georgia, serif";
  ctx.fillText("This certificate is proudly awarded to", 600, 330);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 64px Georgia, serif";
  ctx.fillText(cert.studentName ?? "Student", 600, 430);

  // Divider
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(400, 465);
  ctx.lineTo(800, 465);
  ctx.stroke();

  ctx.fillStyle = "#94a3b8";
  ctx.font = "24px Georgia, serif";
  ctx.fillText("for successfully completing the", 600, 530);

  ctx.fillStyle = accent;
  ctx.font = "bold 44px Georgia, serif";
  const levelName = cert.level.charAt(0).toUpperCase() + cert.level.slice(1);
  ctx.fillText(`${levelName} Level`, 600, 590);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "24px Georgia, serif";
  ctx.fillText("of the Norv learning program", 600, 640);

  const issued = new Date(cert.issuedAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  ctx.font = "20px Georgia, serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText(`Issued on ${issued}`, 600, 730);
  ctx.fillText(cert.certificateNumber, 600, 765);

  const link = document.createElement("a");
  link.download = `norv-ai-certificate-${cert.level}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function CertificatePreview({ cert }: { cert: Certificate }) {
  const accent = LEVEL_COLORS[cert.level] ?? "#0ea5e9";
  const levelName = cert.level.charAt(0).toUpperCase() + cert.level.slice(1);
  const issued = new Date(cert.issuedAt).toLocaleDateString();
  return (
    <div
      dir="ltr"
      className="aspect-[12/8.5] w-full rounded-lg p-6 sm:p-10 flex flex-col items-center justify-center text-center"
      style={{ background: "#0b1220", border: `4px solid ${accent}` }}
    >
      <p className="font-serif font-bold text-lg" style={{ color: accent }}>Norv</p>
      <p className="font-serif font-bold text-xl sm:text-3xl text-slate-100 mt-2">Certificate of Completion</p>
      <p className="text-slate-400 text-xs sm:text-sm mt-4">This certificate is proudly awarded to</p>
      <p className="font-serif font-bold text-2xl sm:text-4xl text-white mt-2">{cert.studentName ?? "Student"}</p>
      <div className="w-40 h-px my-3" style={{ background: accent }} />
      <p className="text-slate-400 text-xs sm:text-sm">for successfully completing the</p>
      <p className="font-serif font-bold text-lg sm:text-2xl mt-1" style={{ color: accent }}>{levelName} Level</p>
      <p className="text-slate-400 text-xs sm:text-sm mt-1">of the Norv learning program</p>
      <p className="text-slate-500 text-[10px] sm:text-xs mt-4">Issued on {issued} · {cert.certificateNumber}</p>
    </div>
  );
}

export function CertificatesSection() {
  const { t } = useLang();
  const { data: certificates } = useGetCertificates();

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="size-5 text-primary" />
          {t("certificates")}
        </CardTitle>
        <CardDescription>{t("certificatesDesc")}</CardDescription>
      </CardHeader>
      <CardContent>
        {!certificates || certificates.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <ScrollText className="size-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground max-w-xs">{t("noCertificates")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {certificates.map((cert) => (
              <div
                key={cert.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3"
                data-testid={`certificate-${cert.level}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: (LEVEL_COLORS[cert.level] ?? "#0ea5e9") + "22" }}
                  >
                    <Award className="size-5" style={{ color: LEVEL_COLORS[cert.level] ?? "#0ea5e9" }} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm capitalize truncate">
                      {t(cert.level as any) ?? cert.level}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{cert.certificateNumber}</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">{t("viewCertificate")}</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogTitle className="sr-only">{t("certificateOfCompletion")}</DialogTitle>
                      <CertificatePreview cert={cert} />
                      <Button onClick={() => downloadCertificate(cert)} className="w-full">
                        <Download className="me-2 size-4" />
                        {t("downloadCertificate")}
                      </Button>
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="icon" onClick={() => downloadCertificate(cert)} title={t("downloadCertificate")}>
                    <Download className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
