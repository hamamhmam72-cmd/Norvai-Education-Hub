import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  AudioLines, BookOpen, BrainCircuit, Camera, CheckCircle2, Code2,
  FileText, ImagePlus, Library, Loader2, Mic, Play, Plus, Send,
  Sparkles, Timer, Upload, Users, Wand2, X,
} from "lucide-react";
import { useCreateSummary, useAnalyzeCode, type Summary, type DebugSession } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type HubTab = "materials" | "questions" | "team" | "voice" | "progress";
type Question = { id: number; course: string; prompt: string; answer: string | null; sourceLabel: string | null; createdAt: string };
type Productivity = { studyMinutes: number; summarizedFiles: number; codeReviews: number; teamProjectProgress: number };

const tabs: Array<{ id: HubTab; label: string; icon: typeof FileText }> = [
  { id: "materials", label: "Materials & Summary", icon: FileText },
  { id: "questions", label: "University Question Bank", icon: Library },
  { id: "team", label: "Team Code Review", icon: Users },
  { id: "voice", label: "Voice Study Notes", icon: AudioLines },
  { id: "progress", label: "Productivity", icon: Timer },
];

export default function StudyHub() {
  const [tab, setTab] = useState<HubTab>("materials");
  const { user } = useAuth();
  const { toast } = useToast();
  const [productivity, setProductivity] = useState<Productivity | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    apiFetch<Productivity>("/study/productivity").then(setProductivity).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (tab === "questions") {
      apiFetch<Question[]>("/question-bank").then(setQuestions).catch((error) => {
        toast({ variant: "destructive", description: error.message });
      });
    }
  }, [tab, toast]);

  const logStudy = async (minutes: number, source: string) => {
    try {
      await apiFetch("/study/sessions", {
        method: "POST",
        body: JSON.stringify({ minutes, source }),
      });
      const next = await apiFetch<Productivity>("/study/productivity");
      setProductivity(next);
      toast({ title: `${minutes} minutes logged`, description: "Your productivity dashboard was updated." });
    } catch (error: any) {
      toast({ variant: "destructive", description: error.message });
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10 animate-in fade-in duration-500">
      <div className="rounded-2xl bg-sidebar p-6 text-sidebar-foreground shadow-sm md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-primary-foreground">
              <Sparkles className="size-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em]">Norv Study Hub</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">One workspace for your whole study day.</h1>
            <p className="mt-2 max-w-2xl text-sidebar-foreground/75">
              Summarize material, capture lectures, share university questions, review code with Monk, and keep your progress visible.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric value={productivity?.studyMinutes ?? 0} label="minutes" />
            <Metric value={productivity?.summarizedFiles ?? 0} label="summaries" />
            <Metric value={productivity?.codeReviews ?? 0} label="reviews" />
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <Button key={id} variant={tab === id ? "default" : "outline"} onClick={() => setTab(id)} className="shrink-0 gap-2">
            <Icon className="size-4" />{label}
          </Button>
        ))}
      </div>

      {tab === "materials" && <MaterialsPanel onLog={() => logStudy(25, "summary")} />}
      {tab === "questions" && <QuestionBank questions={questions} onCreated={(item) => setQuestions((current) => [item, ...current])} />}
      {tab === "team" && <TeamReview onLog={() => logStudy(20, "code-review")} />}
      {tab === "voice" && <VoiceNotes onLog={() => logStudy(15, "voice-notes")} />}
      {tab === "progress" && <ProductivityPanel data={productivity} onLog={logStudy} userName={user?.fullName} />}
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return <div className="rounded-xl border border-sidebar-border/60 bg-sidebar-accent/50 px-3 py-2"><div className="text-xl font-bold">{value}</div><div className="text-[10px] text-sidebar-foreground/60">{label}</div></div>;
}

function MaterialsPanel({ onLog }: { onLog: () => void }) {
  const { toast } = useToast();
  const [topic, setTopic] = useState("Software Engineering");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<Summary | null>(null);
  const createSummary = useCreateSummary();

  const readFile = async (file: File) => {
    setFileName(file.name);
    if (file.type.startsWith("text/") || /\.(txt|md|csv)$/i.test(file.name)) {
      setText(await file.text());
      return;
    }
    toast({
      title: "File attached",
      description: "PDF, image, and audio capture are ready for the storage pipeline; paste extracted text here for immediate Monk analysis.",
    });
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (text.trim().length < 50) {
      toast({ variant: "destructive", description: "Add at least 50 characters or attach a text/Markdown file." });
      return;
    }
    createSummary.mutate({ data: { topic, title: title || undefined, text } }, {
      onSuccess: (summary) => { setResult(summary); onLog(); },
      onError: (error: any) => toast({ variant: "destructive", description: error.message }),
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Wand2 className="size-5 text-primary" />Smart material intake</CardTitle><CardDescription>Upload a text file, use the camera/gallery, or paste notes. Monk treats attached material as data, not instructions.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm hover:border-primary"><Upload className="size-4" />PDF / text file<input type="file" accept=".pdf,.txt,.md,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} /></label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm hover:border-primary"><Camera className="size-4" />Capture / gallery<input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} /></label>
          </div>
          {fileName && <Badge variant="secondary" className="gap-1"><FileText className="size-3" />{fileName}</Badge>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Topic</Label><Input value={topic} onChange={(e) => setTopic(e.target.value.slice(0, 100))} /></div>
            <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} placeholder="Optional title" /></div>
          </div>
          <Textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 50000))} placeholder="Paste extracted text or lecture notes here..." className="min-h-64 font-mono text-sm" />
          <Button onClick={submit} disabled={createSummary.isPending} className="w-full gap-2">{createSummary.isPending ? <Loader2 className="size-4 animate-spin" /> : <BrainCircuit className="size-4" />}Generate summary and review questions</Button>
        </CardContent>
      </Card>
      <Card className="min-h-[520px]">
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="size-5 text-primary" />Monk result</CardTitle></CardHeader>
        <CardContent>
          {!result ? <EmptyState icon={ImagePlus} text="Your summary, key points, and technical terms will appear here." /> : <ScrollArea className="h-[450px]"><div className="space-y-5"><div><Badge>{result.topic}</Badge><h2 className="mt-2 text-2xl font-bold">{result.title || "Document Summary"}</h2></div><p className="leading-relaxed">{result.summary}</p><div><h3 className="mb-2 font-semibold">Key points</h3><ul className="space-y-2">{result.keyPoints.map((point, index) => <li key={index} className="flex gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" />{point}</li>)}</ul></div><div className="flex flex-wrap gap-2">{(result.technicalTerms ?? []).map((term) => <Badge key={term} variant="outline">{term}</Badge>)}</div></div></ScrollArea>}
        </CardContent>
      </Card>
    </div>
  );
}

function QuestionBank({ questions, onCreated }: { questions: Question[]; onCreated: (item: Question) => void }) {
  const { toast } = useToast();
  const [course, setCourse] = useState("");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!course.trim() || !prompt.trim()) return;
    setIsSaving(true);
    try {
      const item = await apiFetch<Question>("/question-bank", { method: "POST", body: JSON.stringify({ course, prompt, answer, sourceLabel }) });
      onCreated(item); setPrompt(""); setAnswer(""); setSourceLabel("");
      toast({ title: "Question shared", description: "Students in your university and major can now see it." });
    } catch (error: any) { toast({ variant: "destructive", description: error.message }); } finally { setIsSaving(false); }
  };
  return <div className="grid gap-6 lg:grid-cols-[360px_1fr]"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="size-5 text-primary" />Share a past question</CardTitle><CardDescription>Only students with the same university and major see this bank.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><Input value={course} onChange={(e) => setCourse(e.target.value.slice(0, 120))} placeholder="Course name" /><Textarea value={prompt} onChange={(e) => setPrompt(e.target.value.slice(0, 5000))} placeholder="Question or exam prompt" /><Textarea value={answer} onChange={(e) => setAnswer(e.target.value.slice(0, 10000))} placeholder="Optional answer / solution" /><Input value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value.slice(0, 160))} placeholder="Source (e.g. Midterm 2025)" /><Button className="w-full" disabled={isSaving}>{isSaving ? <Loader2 className="size-4 animate-spin" /> : "Share question"}</Button></form></CardContent></Card><Card><CardHeader><CardTitle>Shared question bank</CardTitle><CardDescription>{questions.length} questions available for your academic group.</CardDescription></CardHeader><CardContent><ScrollArea className="h-[510px]"><div className="space-y-3">{questions.length === 0 ? <EmptyState icon={Library} text="No questions yet. Add the first one for your university group." /> : questions.map((question) => <div key={question.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="secondary">{question.course}</Badge>{question.sourceLabel && <span className="text-xs text-muted-foreground">{question.sourceLabel}</span>}</div><p className="mt-3 font-medium">{question.prompt}</p>{question.answer && <details className="mt-3 text-sm"><summary className="cursor-pointer text-primary">Show solution</summary><p className="mt-2 whitespace-pre-wrap text-muted-foreground">{question.answer}</p></details>}</div>)}</div></ScrollArea></CardContent></Card></div>;
}

function TeamReview({ onLog }: { onLog: () => void }) {
  const { toast } = useToast();
  const analyzeCode = useAnalyzeCode();
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("TypeScript");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<DebugSession | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const snippet = await apiFetch<{ review: string }>("/team/snippets/review", { method: "POST", body: JSON.stringify({ title: title || "Team snippet", language, code }) });
      setResult({ ...(snippet as any), status: "clean", code, language });
      onLog();
    } catch (error: any) {
      toast({ variant: "destructive", description: error.message });
    }
  };
  return <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Code2 className="size-5 text-primary" />Smart team code review</CardTitle><CardDescription>Monk reviews defensive issues and stores the report for the shared team workspace.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><Input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} placeholder="Snippet title" /><Select value={language} onValueChange={setLanguage}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["TypeScript", "JavaScript", "Python", "Java", "C++", "SQL", "Go", "Rust"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Textarea value={code} onChange={(e) => setCode(e.target.value.slice(0, 20000))} className="min-h-80 bg-zinc-950 font-mono text-sm text-zinc-100" placeholder="// Paste code for Monk and your teammates" /><Button className="w-full gap-2" disabled={!code.trim() || analyzeCode.isPending} onClick={submit}><Sparkles className="size-4" />Review and share</Button></form></CardContent></Card><Card><CardHeader><CardTitle>Review report</CardTitle></CardHeader><CardContent>{result && (result as any).review ? <ScrollArea className="h-[500px]"><pre className="whitespace-pre-wrap text-sm leading-relaxed">{(result as any).review}</pre></ScrollArea> : <EmptyState icon={Code2} text="The team report will appear here after Monk checks your snippet." />}</CardContent></Card></div>;
}

function VoiceNotes({ onLog }: { onLog: () => void }) {
  const { toast } = useToast();
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognition = useRef<any>(null);
  const start = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { toast({ variant: "destructive", description: "Speech recognition is not supported in this browser. You can still paste a transcript below." }); return; }
    const instance = new SpeechRecognition();
    instance.lang = "ar-JO";
    instance.continuous = true;
    instance.interimResults = true;
    instance.onresult = (event: any) => setTranscript(Array.from(event.results).map((result: any) => result[0].transcript).join(" "));
    instance.onend = () => setIsListening(false);
    instance.start(); recognition.current = instance; setIsListening(true);
  };
  const stop = () => { recognition.current?.stop(); setIsListening(false); onLog(); };
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Mic className="size-5 text-primary" />Voice notes to study material</CardTitle><CardDescription>Record an Arabic or English lecture note, then reuse the transcript in Smart Summary to create key points, mind maps, and quiz prompts.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="flex flex-wrap gap-3"><Button onClick={isListening ? stop : start} variant={isListening ? "destructive" : "default"} className="gap-2">{isListening ? <><X className="size-4" />Stop recording</> : <><Mic className="size-4" />Start recording</>}</Button><Badge variant={isListening ? "destructive" : "secondary"}>{isListening ? "Listening…" : "Ready"}</Badge></div><Textarea value={transcript} onChange={(e) => setTranscript(e.target.value.slice(0, 50000))} className="min-h-80" placeholder="Your transcript appears here. You can edit it, then open Materials & Summary to analyze it with Monk." /><div className="flex justify-end"><Button variant="outline" onClick={() => navigator.clipboard.writeText(transcript)} disabled={!transcript}>Copy transcript</Button></div></CardContent></Card>;
}

function ProductivityPanel({ data, onLog, userName }: { data: Productivity | null; onLog: (minutes: number, source: string) => void; userName?: string }) {
  return <div className="space-y-6"><Card><CardHeader><CardTitle>{userName ? `${userName}'s study momentum` : "Your study momentum"}</CardTitle><CardDescription>Log focused sessions and keep your academic goals visible.</CardDescription></CardHeader><CardContent><div className="grid gap-4 sm:grid-cols-4">{[["Study minutes", data?.studyMinutes ?? 0], ["Summaries", data?.summarizedFiles ?? 0], ["Code reviews", data?.codeReviews ?? 0], ["Team progress", `${data?.teamProjectProgress ?? 0}%`]].map(([label, value]) => <div key={label} className="rounded-2xl border bg-muted/20 p-5"><div className="text-2xl font-bold">{value}</div><div className="mt-1 text-sm text-muted-foreground">{label}</div></div>)}</div></CardContent></Card><div className="grid gap-4 md:grid-cols-3"><Card><CardContent className="flex items-center justify-between p-5"><div><div className="font-semibold">25-minute focus</div><div className="text-sm text-muted-foreground">Pomodoro-style session</div></div><Button size="icon" onClick={() => onLog(25, "focus")}><Play className="size-4" /></Button></CardContent></Card><Card><CardContent className="flex items-center justify-between p-5"><div><div className="font-semibold">Review lectures</div><div className="text-sm text-muted-foreground">Continue your resources</div></div><Button asChild size="icon"><Link href="/lectures"><BookOpen className="size-4" /></Link></Button></CardContent></Card><Card><CardContent className="flex items-center justify-between p-5"><div><div className="font-semibold">AI mock interview</div><div className="text-sm text-muted-foreground">Practice with Monk</div></div><Button asChild size="icon"><Link href="/career"><Send className="size-4" /></Link></Button></CardContent></Card></div></div>;
}

function EmptyState({ icon: Icon, text }: { icon: typeof FileText; text: string }) {
  return <div className="flex min-h-60 flex-col items-center justify-center text-center text-muted-foreground"><Icon className="mb-3 size-10 opacity-30" /><p className="max-w-sm text-sm">{text}</p></div>;
}