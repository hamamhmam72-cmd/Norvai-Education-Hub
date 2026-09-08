import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  AudioLines, BookOpen, BrainCircuit, Camera, CheckCircle2, Code2,
  FileText, ImagePlus, Library, Loader2, Mic, Play, Plus, Send,
  Sparkles, Timer, Upload, Users, Wand2, X,
  GraduationCap, Network, BarChart3, ExternalLink,
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
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type HubTab = "materials" | "questions" | "team" | "voice" | "academic" | "progress";
type Question = { id: number; course: string; prompt: string; answer: string | null; sourceLabel: string | null; createdAt: string };
type Productivity = { studyMinutes: number; summarizedFiles: number; codeReviews: number; teamProjectProgress: number; daily?: Array<{ day: string; minutes: number; summaries: number; reviews: number }> };
type MaterialResult = Summary & { questions?: string[]; mindMap?: Array<{ label: string; children: string[] }>; transcript?: string; fileName?: string; mimeType?: string };
type TeamSnippet = { id: number; title: string; language: string; review: string; createdAt: string };

const tabs: Array<{ id: HubTab; label: string; icon: typeof FileText }> = [
  { id: "materials", label: "Materials & Summary", icon: FileText },
  { id: "questions", label: "University Question Bank", icon: Library },
  { id: "team", label: "Team Code Review", icon: Users },
  { id: "voice", label: "Voice Study Notes", icon: AudioLines },
  { id: "academic", label: "Academic Resources", icon: GraduationCap },
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
      {tab === "academic" && <AcademicPanel />}
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
  const [result, setResult] = useState<MaterialResult | null>(null);
  const [processingFile, setProcessingFile] = useState(false);
  const createSummary = useCreateSummary();

  const readFile = async (file: File) => {
    setFileName(file.name);
    if (file.type.startsWith("text/") || /\.(txt|md|csv)$/i.test(file.name)) {
      setText(await file.text());
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast({ variant: "destructive", description: "The maximum file size is 15 MB." });
      return;
    }
    setProcessingFile(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const token = localStorage.getItem("norv_token");
      const response = await fetch("/api/study/materials/process", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "File processing failed");
      setResult(payload);
      if (payload.transcript) setText(payload.transcript);
      onLog();
      toast({ title: "Study material created", description: `${file.name} was processed safely by Monk.` });
    } catch (error: any) {
      toast({ variant: "destructive", description: error.message });
    } finally {
      setProcessingFile(false);
    }
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
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm hover:border-primary"><Upload className="size-4" />PDF / audio / text<input type="file" accept=".pdf,.txt,.md,.csv,audio/*" className="hidden" disabled={processingFile} onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} /></label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm hover:border-primary"><Camera className="size-4" />Capture / gallery<input type="file" accept="image/png,image/jpeg,image/webp" capture="environment" className="hidden" disabled={processingFile} onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} /></label>
          </div>
          {processingFile && <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-3 text-sm text-primary"><Loader2 className="size-4 animate-spin" />Monk is extracting and securing the material…</div>}
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
          {!result ? <EmptyState icon={ImagePlus} text="Your summary, key points, review questions, and transcript will appear here." /> : <ScrollArea className="h-[450px]"><div className="space-y-5"><div><Badge>{result.topic}</Badge><h2 className="mt-2 text-2xl font-bold">{result.title || "Document Summary"}</h2>{result.fileName && <p className="text-xs text-muted-foreground">{result.fileName}</p>}</div><p className="leading-relaxed">{result.summary}</p><div><h3 className="mb-2 font-semibold">Key points</h3><ul className="space-y-2">{result.keyPoints.map((point, index) => <li key={index} className="flex gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" />{point}</li>)}</ul></div>{result.questions?.length ? <div><h3 className="mb-2 font-semibold">Review questions</h3><ol className="list-decimal space-y-2 ps-5 text-sm">{result.questions.map((question) => <li key={question}>{question}</li>)}</ol></div> : null}{result.mindMap?.length ? <div><h3 className="mb-2 flex items-center gap-2 font-semibold"><Network className="size-4 text-primary" />Mind map</h3><div className="grid gap-2 sm:grid-cols-2">{result.mindMap.map((node) => <div key={node.label} className="rounded-lg border bg-muted/20 p-3"><div className="font-medium">{node.label}</div><ul className="mt-2 list-disc ps-4 text-xs text-muted-foreground">{node.children.map((child) => <li key={child}>{child}</li>)}</ul></div>)}</div></div> : null}<div className="flex flex-wrap gap-2">{(result.technicalTerms ?? []).map((term) => <Badge key={term} variant="outline">{term}</Badge>)}</div>{result.transcript && <details><summary className="cursor-pointer font-semibold">Full extracted transcript</summary><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{result.transcript}</p></details>}</div></ScrollArea>}
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
  const [quiz, setQuiz] = useState<{ title: string; questions: Array<{ prompt: string; options: string[]; answerIndex: number; explanation: string }> } | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
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
  const generateQuiz = async () => {
    setQuizLoading(true);
    try {
      setQuiz(await apiFetch("/question-bank/quiz", { method: "POST", body: JSON.stringify({ course: course || undefined, count: 5 }) }));
    } catch (error: any) { toast({ variant: "destructive", description: error.message }); } finally { setQuizLoading(false); }
  };
  return <div className="space-y-6">
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="size-5 text-primary" />Share a past question</CardTitle><CardDescription>Only students with the same university and major see this bank.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><Input value={course} onChange={(e) => setCourse(e.target.value.slice(0, 120))} placeholder="Course name" /><Textarea value={prompt} onChange={(e) => setPrompt(e.target.value.slice(0, 5000))} placeholder="Question or exam prompt" /><Textarea value={answer} onChange={(e) => setAnswer(e.target.value.slice(0, 10000))} placeholder="Optional answer / solution" /><Input value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value.slice(0, 160))} placeholder="Source (e.g. Midterm 2025)" /><Button className="w-full" disabled={isSaving}>{isSaving ? <Loader2 className="size-4 animate-spin" /> : "Share question"}</Button></form></CardContent></Card>
      <Card><CardHeader><CardTitle>Shared question bank</CardTitle><CardDescription>{questions.length} questions available for your academic group.</CardDescription></CardHeader><CardContent><div className="mb-4 flex justify-end"><Button variant="outline" onClick={generateQuiz} disabled={quizLoading || questions.length < 3}>{quizLoading ? <Loader2 className="size-4 animate-spin" /> : <><BrainCircuit className="me-2 size-4" />Generate Monk quiz</>}</Button></div><ScrollArea className="h-[510px]"><div className="space-y-3">{questions.length === 0 ? <EmptyState icon={Library} text="No questions yet. Add the first one for your university group." /> : questions.map((question) => <div key={question.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="secondary">{question.course}</Badge>{question.sourceLabel && <span className="text-xs text-muted-foreground">{question.sourceLabel}</span>}</div><p className="mt-3 font-medium">{question.prompt}</p>{question.answer && <details className="mt-3 text-sm"><summary className="cursor-pointer text-primary">Show solution</summary><p className="mt-2 whitespace-pre-wrap text-muted-foreground">{question.answer}</p></details>}</div>)}</div></ScrollArea></CardContent></Card>
    </div>
    {quiz && <Card><CardHeader><CardTitle>{quiz.title || "Smart university quiz"}</CardTitle></CardHeader><CardContent className="space-y-4">{quiz.questions.map((item, index) => <details key={index} className="rounded-lg border p-4"><summary className="cursor-pointer font-medium">{index + 1}. {item.prompt}</summary><ol className="mt-3 list-[upper-alpha] ps-5 text-sm text-muted-foreground">{item.options.map((option) => <li key={option}>{option}</li>)}</ol><p className="mt-3 text-sm text-primary">{item.explanation}</p></details>)}</CardContent></Card>}
  </div>;
}

function TeamReview({ onLog }: { onLog: () => void }) {
  const { toast } = useToast();
  const analyzeCode = useAnalyzeCode();
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("TypeScript");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<DebugSession | null>(null);
  const [snippets, setSnippets] = useState<TeamSnippet[]>([]);
  useEffect(() => { apiFetch<TeamSnippet[]>("/team/snippets").then(setSnippets).catch(() => undefined); }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const snippet = await apiFetch<{ review: string }>("/team/snippets/review", { method: "POST", body: JSON.stringify({ title: title || "Team snippet", language, code }) });
      setResult({ ...(snippet as any), status: "clean", code, language });
      setSnippets((items) => [snippet as TeamSnippet, ...items]);
      onLog();
    } catch (error: any) {
      toast({ variant: "destructive", description: error.message });
    }
  };
  return <div className="space-y-6"><TeamWorkspace /><div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Code2 className="size-5 text-primary" />Smart team code review</CardTitle><CardDescription>Monk reviews defensive issues and stores the report for the shared team workspace.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><Input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} placeholder="Snippet title" /><Select value={language} onValueChange={setLanguage}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["TypeScript", "JavaScript", "Python", "Java", "C++", "SQL", "Go", "Rust"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Textarea value={code} onChange={(e) => setCode(e.target.value.slice(0, 20000))} className="min-h-80 bg-zinc-950 font-mono text-sm text-zinc-100" placeholder="// Paste code for Monk and your teammates" /><Button className="w-full gap-2" disabled={!code.trim() || analyzeCode.isPending} onClick={submit}><Sparkles className="size-4" />Review and share</Button></form></CardContent></Card><Card><CardHeader><CardTitle>Shared team repository</CardTitle><CardDescription>{snippets.length} reviewed snippets for your university group.</CardDescription></CardHeader><CardContent>{result && (result as any).review ? <ScrollArea className="h-56"><pre className="whitespace-pre-wrap text-sm leading-relaxed">{(result as any).review}</pre></ScrollArea> : <EmptyState icon={Code2} text="The team report will appear here after Monk checks your snippet." />}<div className="mt-4 space-y-2">{snippets.slice(0, 8).map((snippet) => <details key={snippet.id} className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">{snippet.title} <Badge variant="outline" className="ms-2">{snippet.language}</Badge></summary><pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{snippet.review}</pre></details>)}</div></CardContent></Card></div><TeamMembers /></div>;
}

type TeamProjectView = { id: number; name: string };
type TeamMessage = { id: number; userId: number; username?: string; fullName?: string; content: string | null; imageUrl: string | null; createdAt: string };

function TeamWorkspace() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<TeamProjectView[]>([]);
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [message, setMessage] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("TypeScript");
  const [notice, setNotice] = useState("");
  useEffect(() => { apiFetch<TeamProjectView[]>("/team/projects").then((items) => { setProjects(items); if (items[0]) setProjectId(String(items[0].id)); }).catch(() => undefined); }, []);
  useEffect(() => {
    if (!projectId) return;
    const refresh = () => Promise.all([
      apiFetch<TeamMessage[]>(`/team/projects/${projectId}/messages`),
      apiFetch<{ sharedCode: string; codeLanguage: string }>(`/team/projects/${projectId}/code`),
    ]).then(([nextMessages, project]) => { setMessages(nextMessages); setCode(project.sharedCode); setLanguage(project.codeLanguage); setNotice(""); })
      .catch((error: Error) => setNotice(error.message));
    refresh();
    const timer = window.setInterval(() => {
      apiFetch<TeamMessage[]>(`/team/projects/${projectId}/messages`).then(setMessages).catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [projectId]);
  const createProject = async () => {
    try {
      const project = await apiFetch<TeamProjectView>("/team/projects", {
        method: "POST", body: JSON.stringify({ name: projectName, completionPercent: 0 }),
      });
      setProjects((items) => [project, ...items]); setProjectId(String(project.id)); setProjectName("");
      toast({ title: "Team project created", description: "Chat and shared code are ready." });
    } catch (error) { toast({ variant: "destructive", description: error instanceof Error ? error.message : "Project creation failed" }); }
  };
  const send = async () => {
    try {
      let imageUrl: string | undefined;
      if (image) {
        const upload = await apiFetch<{ uploadURL: string; objectPath: string }>("/storage/uploads/request-url", {
          method: "POST", body: JSON.stringify({ name: image.name, size: image.size, contentType: image.type }),
        });
        const response = await fetch(upload.uploadURL, { method: "PUT", headers: { "Content-Type": image.type }, body: image });
        if (!response.ok) throw new Error("Image upload failed");
        imageUrl = upload.objectPath;
      }
      await apiFetch(`/team/projects/${projectId}/messages`, { method: "POST", body: JSON.stringify({ content: message, imageUrl }) });
      setMessage(""); setImage(null);
      setMessages(await apiFetch<TeamMessage[]>(`/team/projects/${projectId}/messages`));
    } catch (error) { toast({ variant: "destructive", description: error instanceof Error ? error.message : "Message failed" }); }
  };
  const saveCode = async () => {
    try {
      await apiFetch(`/team/projects/${projectId}/code`, { method: "PUT", body: JSON.stringify({ code, language }) });
      toast({ title: "Shared code saved", description: "Editors will see the latest version." });
    } catch (error) { toast({ variant: "destructive", description: error instanceof Error ? error.message : "Save failed" }); }
  };
  return <Card className="border-primary/30"><CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-5 text-primary" />Team live workspace</CardTitle><CardDescription>Interactive chat, image sharing, and a shared code editor for Team subscribers.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex flex-col gap-2 sm:flex-row"><Select value={projectId} onValueChange={setProjectId}><SelectTrigger className="flex-1"><SelectValue placeholder="Choose a team project" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>)}</SelectContent></Select><Input value={projectName} onChange={(event) => setProjectName(event.target.value.slice(0, 160))} placeholder="New project name" className="sm:max-w-56" /><Button onClick={createProject} disabled={!projectName.trim()}><Plus className="me-2 size-4" />Create project</Button></div>{notice && <div className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700">{notice}</div>}<div className="grid gap-4 lg:grid-cols-2"><div className="space-y-3"><ScrollArea className="h-72 rounded-xl border p-3"><div className="space-y-3">{messages.map((item) => <div key={item.id} className="rounded-lg bg-muted/40 p-3"><div className="text-xs font-semibold text-primary">{item.fullName || item.username || "Team member"}</div>{item.content && <p className="mt-1 whitespace-pre-wrap text-sm">{item.content}</p>}{item.imageUrl && <TeamImage objectPath={item.imageUrl} />}</div>)}</div></ScrollArea><Textarea value={message} onChange={(event) => setMessage(event.target.value.slice(0, 2000))} placeholder="Message your team…" /><div className="flex flex-wrap gap-2"><Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setImage(event.target.files?.[0] ?? null)} className="max-w-xs" /><Button onClick={send} disabled={!projectId || (!message.trim() && !image)}>Send</Button></div></div><div className="space-y-3"><Select value={language} onValueChange={setLanguage}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["TypeScript", "JavaScript", "Python", "Java", "C++", "SQL", "Go", "Rust"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Textarea value={code} onChange={(event) => setCode(event.target.value.slice(0, 50000))} className="min-h-72 bg-zinc-950 font-mono text-sm text-zinc-100" placeholder="// Shared project code" /><Button onClick={saveCode} disabled={!projectId}>Save shared code</Button></div></div></CardContent></Card>;
}

function TeamImage({ objectPath }: { objectPath: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const id = objectPath.split("/").pop();
    if (id) apiFetch<{ url: string }>(`/storage/objects/${id}/url`).then((value) => setUrl(value.url)).catch(() => undefined);
  }, [objectPath]);
  return url ? <img src={url} alt="Team attachment" className="mt-2 max-h-56 rounded-lg object-contain" /> : <div className="mt-2 text-xs text-muted-foreground">Loading image…</div>;
}

function TeamMembers() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Array<{ id: number; name: string }>>([]);
  const [projectId, setProjectId] = useState("");
  const [members, setMembers] = useState<Array<{ id: number; username: string; fullName: string; role: string }>>([]);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("viewer");
  useEffect(() => { apiFetch<typeof projects>("/team/projects").then((items) => { setProjects(items); if (items[0]) setProjectId(String(items[0].id)); }).catch(() => undefined); }, []);
  useEffect(() => { if (projectId) apiFetch<typeof members>(`/team/projects/${projectId}/members`).then(setMembers).catch(() => setMembers([])); }, [projectId]);
  const invite = async () => {
    try {
      const member = await apiFetch<typeof members[number]>(`/team/projects/${projectId}/members`, { method: "POST", body: JSON.stringify({ username, role }) });
      setMembers((items) => [...items.filter((item) => item.id !== member.id), member]); setUsername("");
    } catch (error: any) { toast({ variant: "destructive", description: error.message }); }
  };
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-5 text-primary" />Team membership and permissions</CardTitle><CardDescription>Owners can add university teammates as editors or viewers.</CardDescription></CardHeader><CardContent className="space-y-4"><Select value={projectId} onValueChange={setProjectId}><SelectTrigger><SelectValue placeholder="Choose a project" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>)}</SelectContent></Select><div className="flex flex-wrap gap-2"><Input value={username} onChange={(event) => setUsername(event.target.value.slice(0, 120))} placeholder="Student username" className="max-w-xs" /><Select value={role} onValueChange={setRole}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="editor">Editor</SelectItem><SelectItem value="viewer">Viewer</SelectItem></SelectContent></Select><Button onClick={invite} disabled={!projectId || !username.trim()}>Add member</Button></div><div className="flex flex-wrap gap-2">{members.map((member) => <Badge key={member.id} variant="secondary">{member.fullName || member.username} · {member.role}</Badge>)}</div></CardContent></Card>;
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
  const [projects, setProjects] = useState<Array<{ id: number; name: string; completionPercent: number }>>([]);
  const [projectName, setProjectName] = useState("");
  const [projectProgress, setProjectProgress] = useState(0);
  const { toast } = useToast();
  useEffect(() => { apiFetch<typeof projects>("/team/projects").then(setProjects).catch(() => undefined); }, []);
  const addProject = async () => {
    try {
      const item = await apiFetch<typeof projects[number]>("/team/projects", { method: "POST", body: JSON.stringify({ name: projectName, completionPercent: projectProgress }) });
      setProjects((items) => [item, ...items]); setProjectName(""); setProjectProgress(0);
    } catch (error: any) { toast({ variant: "destructive", description: error.message }); }
  };
  return <div className="space-y-6"><Card><CardHeader><CardTitle>{userName ? `${userName}'s study momentum` : "Your study momentum"}</CardTitle><CardDescription>Track study hours, summarized files, team project completion, and code work.</CardDescription></CardHeader><CardContent><div className="grid gap-4 sm:grid-cols-4">{[["Study minutes", data?.studyMinutes ?? 0], ["Summaries", data?.summarizedFiles ?? 0], ["Code reviews", data?.codeReviews ?? 0], ["Team progress", `${data?.teamProjectProgress ?? 0}%`]].map(([label, value]) => <div key={label} className="rounded-2xl border bg-muted/20 p-5"><div className="text-2xl font-bold">{value}</div><div className="mt-1 text-sm text-muted-foreground">{label}</div></div>)}</div></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="size-5 text-primary" />Daily activity</CardTitle></CardHeader><CardContent><div className="h-64 w-full">{data?.daily?.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={data.daily}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="day" /><YAxis /><Tooltip /><Bar dataKey="minutes" fill="hsl(var(--primary))" name="Study minutes" /></BarChart></ResponsiveContainer> : <EmptyState icon={BarChart3} text="Log a session to see your study activity chart." />}</div></CardContent></Card><Card><CardHeader><CardTitle>Team project completion</CardTitle><CardDescription>Shared with students in your university and major.</CardDescription></CardHeader><CardContent className="space-y-3">{projects.map((project) => <div key={project.id} className="flex items-center gap-3"><span className="min-w-32 text-sm">{project.name}</span><Progress value={project.completionPercent} className="flex-1" /><span className="text-xs text-muted-foreground">{project.completionPercent}%</span></div>)}<div className="flex flex-wrap gap-2"><Input value={projectName} onChange={(event) => setProjectName(event.target.value.slice(0, 160))} placeholder="New team project" className="max-w-xs" /><Input type="number" min={0} max={100} value={projectProgress} onChange={(event) => setProjectProgress(Number(event.target.value))} className="w-24" /><Button onClick={addProject} disabled={!projectName.trim()}>Add project</Button></div></CardContent></Card><div className="grid gap-4 md:grid-cols-3"><Card><CardContent className="flex items-center justify-between p-5"><div><div className="font-semibold">25-minute focus</div><div className="text-sm text-muted-foreground">Pomodoro-style session</div></div><Button size="icon" onClick={() => onLog(25, "focus")}><Play className="size-4" /></Button></CardContent></Card><Card><CardContent className="flex items-center justify-between p-5"><div><div className="font-semibold">Review lectures</div><div className="text-sm text-muted-foreground">Continue your resources</div></div><Button asChild size="icon"><Link href="/lectures"><BookOpen className="size-4" /></Link></Button></CardContent></Card><Card><CardContent className="flex items-center justify-between p-5"><div><div className="font-semibold">AI mock interview</div><div className="text-sm text-muted-foreground">Practice with Monk</div></div><Button asChild size="icon"><Link href="/career"><Send className="size-4" /></Link></Button></CardContent></Card></div></div>;
}

function AcademicPanel() {
  const { toast } = useToast();
  const [resources, setResources] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [professorName, setProfessorName] = useState("");
  const [professorUniversity, setProfessorUniversity] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    Promise.all([apiFetch<any[]>("/academic/resources"), apiFetch<any[]>("/academic/non-it-subjects")]).then(([nextResources, nextSubjects]) => { setResources(nextResources); setSubjects(nextSubjects); }).catch(() => undefined);
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true);
    try {
      let material: any = {};
      let objectPath: string | undefined;
      if (file) {
        const token = localStorage.getItem("norv_token");
        const uploadMeta = await fetch("/api/storage/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
        });
        const upload = await uploadMeta.json();
        if (!uploadMeta.ok) throw new Error(upload.error || "Could not prepare file storage");
        const stored = await fetch(upload.uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!stored.ok) throw new Error("Could not upload the research file");
        objectPath = upload.objectPath;
        const form = new FormData(); form.append("file", file);
        const response = await fetch("/api/study/materials/process", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form });
        material = await response.json(); if (!response.ok) throw new Error(material.error);
      }
      const resource = await apiFetch<any>("/academic/resources", { method: "POST", body: JSON.stringify({ type: "research", title, subject, professorName, professorUniversity, sourceUrl, objectPath, summary: material.summary, questions: material.questions, mindMap: material.mindMap, mimeType: file?.type }) });
      setResources((items) => [resource, ...items]); setTitle(""); setSubject(""); setProfessorName(""); setProfessorUniversity(""); setSourceUrl(""); setFile(null);
      toast({ title: "Research submitted", description: "It is now waiting for academic review before publication." });
    } catch (error: any) { toast({ variant: "destructive", description: error.message }); } finally { setSaving(false); }
  };
  return <div className="space-y-6"><div className="grid gap-6 lg:grid-cols-[380px_1fr]"><Card><CardHeader><CardTitle className="flex items-center gap-2"><GraduationCap className="size-5 text-primary" />Academic resources</CardTitle><CardDescription>Submit an Arab or Jordanian professor lecture/research paper. Monk extracts a safe summary before review.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-3"><Input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 180))} placeholder="Research or lecture title" required /><Input value={subject} onChange={(e) => setSubject(e.target.value.slice(0, 120))} placeholder="Subject" required /><Input value={professorName} onChange={(e) => setProfessorName(e.target.value.slice(0, 160))} placeholder="Professor name" /><Input value={professorUniversity} onChange={(e) => setProfessorUniversity(e.target.value.slice(0, 160))} placeholder="Jordanian university" /><Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value.slice(0, 500))} placeholder="Optional public source URL" /><Input type="file" accept=".pdf,image/*,audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /><Button className="w-full" disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : "Submit for review"}</Button></form></CardContent></Card><Card><CardHeader><CardTitle>Published lectures and research</CardTitle><CardDescription>Arab professor lectures and reviewed academic materials.</CardDescription></CardHeader><CardContent className="space-y-3">{resources.length ? resources.map((resource) => <div key={resource.id} className="rounded-xl border p-4"><div className="flex items-center justify-between gap-2"><Badge>{resource.type}</Badge>{resource.professorName && <span className="text-xs text-muted-foreground">{resource.professorName}</span>}</div><h3 className="mt-2 font-semibold">{resource.title}</h3><p className="text-sm text-muted-foreground">{resource.summary || resource.description || resource.subject}</p>{resource.sourceUrl && <a href={resource.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-primary">Open source <ExternalLink className="size-3" /></a>}</div>) : <EmptyState icon={GraduationCap} text="No published resources yet." />}</CardContent></Card></div><Card><CardHeader><CardTitle>Non-IT memorization subjects</CardTitle><CardDescription>Standalone 3-month access plan: 10 JOD via CliQ.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-3">{subjects.map((item) => <div key={item.id} className="rounded-xl border p-4"><Badge variant="secondary">{item.category}</Badge><h3 className="mt-2 font-semibold">{item.title}</h3><p className="mt-1 text-sm text-muted-foreground">{item.description}</p><div className="mt-3 text-sm font-medium">3 months · 10 JOD</div></div>)}</CardContent></Card></div>;
}

function EmptyState({ icon: Icon, text }: { icon: typeof FileText; text: string }) {
  return <div className="flex min-h-60 flex-col items-center justify-center text-center text-muted-foreground"><Icon className="mb-3 size-10 opacity-30" /><p className="max-w-sm text-sm">{text}</p></div>;
}