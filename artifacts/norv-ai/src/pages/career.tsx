import { useGetCareerRecommendations } from "@workspace/api-client-react";
import { useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  Compass, Briefcase, GraduationCap, Code2, AlertCircle, 
  ArrowRight, CheckCircle2, Loader2, Target, TrendingUp, Sparkles,
  BookOpen,
  Clock, Mic, Send, Volume2
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type InterviewMessage = { role: "interviewer" | "candidate"; content: string };
type InterviewSession = {
  id: number; role: string; mode: string; language: string; status: string;
  messages: InterviewMessage[]; score: number | null; feedback: string | null;
};

export default function CareerAdvisor() {
  const { user } = useAuth();
  const { data, isLoading } = useGetCareerRecommendations();

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500 pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-sidebar p-8 rounded-2xl text-sidebar-foreground shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2 text-primary-foreground">
            <Compass className="size-6" />
            <h1 className="text-3xl font-bold tracking-tight">Career Advisor</h1>
          </div>
          <p className="text-sidebar-foreground/80 max-w-xl text-lg">
            Personalized career trajectories based on your skills, specialization, and learning history.
          </p>
        </div>
        <div className="relative z-10 bg-sidebar-accent/50 p-4 rounded-xl backdrop-blur border border-sidebar-border min-w-[250px]">
          <p className="text-xs text-sidebar-foreground/60 font-semibold uppercase tracking-wider mb-2">Student Profile</p>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-sm text-sidebar-foreground/80">Target Area</span>
              <span className="text-sm font-medium text-sidebar-foreground">{user?.specialization}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-sidebar-foreground/80">Current Level</span>
              <span className="text-sm font-medium text-sidebar-foreground capitalize">{user?.skillLevel}</span>
            </div>
          </div>
        </div>
        {/* Decorative background */}
        <div className="absolute top-0 right-0 size-64 bg-primary/20 blur-[100px] rounded-full" />
      </div>

      <MockInterview />

      {isLoading ? (
        <div className="space-y-8">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="h-96 w-full rounded-2xl" />
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
        </div>
      ) : data ? (
        <div className="space-y-8">
          
          {/* Career Paths */}
          <div>
            <h2 className="text-2xl font-bold tracking-tight mb-6 flex items-center gap-2">
              <Target className="size-6 text-primary" />
              Recommended Roles
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(data.careerPaths ?? []).map((path, i) => (
                <Card key={i} className="border-border/50 shadow-sm hover-elevate transition-all overflow-hidden flex flex-col group relative">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 to-transparent" />
                  <CardContent className="p-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <Briefcase className="size-6" />
                      </div>
                      
                      {/* Circular Match Score */}
                      <div className="relative size-12 flex items-center justify-center">
                        <svg className="size-12 -rotate-90 transform" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="40" className="fill-none stroke-muted stroke-[12]" />
                          <circle cx="50" cy="50" r="40" className={cn(
                            path.matchScore > 80 ? "stroke-green-500" : path.matchScore > 60 ? "stroke-yellow-500" : "stroke-blue-500"
                          )} strokeWidth="12" fill="none" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * path.matchScore) / 100} strokeLinecap="round" />
                        </svg>
                        <span className="absolute text-[10px] font-bold">{path.matchScore}%</span>
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{path.title}</h3>
                    
                    <div className="flex items-center gap-2 mb-4">
                      <Badge variant="outline" className="font-normal bg-background">
                        {path.demandLevel} Demand
                      </Badge>
                      <Badge variant="secondary" className="font-normal text-xs">
                        {path.avgSalary}
                      </Badge>
                    </div>

                    <div className="mt-auto pt-4 border-t border-border/50">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Required Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(path.requiredSkills ?? []).slice(0, 5).map(skill => (
                          <span key={skill} className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-md">
                            {skill}
                          </span>
                        ))}
                        {(path.requiredSkills ?? []).length > 5 && (
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-md">+{(path.requiredSkills ?? []).length - 5}</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-8">
            {/* Learning Map */}
            <div className="lg:col-span-8 space-y-6">
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <GraduationCap className="size-6 text-primary" />
                Your Learning Roadmap
              </h2>
              <div className="bg-card border border-border/50 rounded-2xl p-6 md:p-8 shadow-sm relative">
                <div className="absolute left-[39px] md:left-[51px] top-10 bottom-10 w-0.5 bg-border" />
                <div className="space-y-8 relative">
                  {(data.learningMap ?? []).map((phase, i) => (
                    <div key={i} className="flex gap-4 md:gap-6 relative">
                      <div className="size-10 md:size-14 rounded-full bg-background border-2 border-primary flex items-center justify-center shrink-0 z-10 shadow-sm text-primary font-bold shadow-primary/20">
                        {i + 1}
                      </div>
                      <div className="pt-2 md:pt-4 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-3">
                          <h3 className="text-lg md:text-xl font-bold">{phase.phase}</h3>
                          <Badge variant="secondary" className="w-fit"><Clock className="size-3 mr-1"/> {phase.duration}</Badge>
                        </div>
                        <div className="bg-muted/30 border border-border/50 rounded-xl p-4 md:p-5 space-y-4">
                          <div>
                            <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                              <Sparkles className="size-4 text-amber-500" /> Focus Skills
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {(phase.skills ?? []).map(s => <Badge key={s} variant="outline" className="bg-background">{s}</Badge>)}
                            </div>
                          </div>
                          <div className="pt-2 border-t border-border/50">
                            <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                              <BookOpen className="size-4 text-blue-500" /> Resources
                            </p>
                            <ul className="grid sm:grid-cols-2 gap-2">
                              {(phase.resources ?? []).map(r => (
                                <li key={r} className="text-sm text-muted-foreground flex items-start gap-2">
                                  <ArrowRight className="size-3 shrink-0 mt-1 text-primary/50" />
                                  <span className="leading-snug">{r}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar Tools */}
            <div className="lg:col-span-4 space-y-8">
              
              {/* Language Suggestions */}
              <div>
                <h2 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2">
                  <Code2 className="size-5 text-primary" />
                  Tech Stack to Learn
                </h2>
                <div className="space-y-3">
                  {(data.suggestedLanguages ?? []).map((lang, i) => (
                    <Card key={i} className="border-border/50 shadow-sm">
                      <CardContent className="p-4 flex gap-4">
                        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">
                          {lang.language?.substring(0, 2) ?? "?"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold">{lang.language}</h4>
                            <Badge variant={lang.priority === "high" ? "default" : "secondary"} className="text-[10px] h-5 px-1.5 uppercase">
                              {lang.priority} Priority
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-snug">{lang.reason}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Skill Gaps */}
              <Card className="border-border/50 shadow-sm bg-orange-500/5 border-orange-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-orange-600 dark:text-orange-400">
                    <AlertCircle className="size-5" />
                    Identified Skill Gaps
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {(data.skillGaps ?? []).map((gap, i) => (
                      <li key={i} className="flex gap-3 text-sm text-foreground/80 items-start">
                        <div className="size-1.5 rounded-full bg-orange-500 shrink-0 mt-1.5" />
                        <span className="leading-snug">{gap}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Immediate Steps */}
              <Card className="border-primary/20 shadow-sm bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-primary">
                    <TrendingUp className="size-5" />
                    Action Plan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {(data.immediateSteps ?? []).map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm font-medium items-start">
                        <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
                        <span className="leading-snug">{step}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MockInterview() {
  const { toast } = useToast();
  const [role, setRole] = useState("Junior Software Engineer");
  const [language, setLanguage] = useState("English");
  const [mode, setMode] = useState("text");
  const [answer, setAnswer] = useState("");
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loading, setLoading] = useState(false);
  const recognition = useRef<any>(null);

  const start = async () => {
    setLoading(true);
    try {
      setSession(await apiFetch<InterviewSession>("/career/interviews", {
        method: "POST", body: JSON.stringify({ role, language, mode }),
      }));
    } catch (error: any) {
      toast({ variant: "destructive", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const respond = async () => {
    if (!session || !answer.trim()) return;
    setLoading(true);
    try {
      const updated = await apiFetch<InterviewSession>(`/career/interviews/${session.id}/respond`, {
        method: "POST", body: JSON.stringify({ answer }),
      });
      setSession(updated);
      setAnswer("");
      const latest = [...updated.messages].reverse().find((message) => message.role === "interviewer");
      if (latest && mode === "voice" && "speechSynthesis" in window) {
        speechSynthesis.speak(new SpeechSynthesisUtterance(latest.content));
      }
    } catch (error: any) {
      toast({ variant: "destructive", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const record = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ variant: "destructive", description: "Voice recognition is not supported in this browser." });
      return;
    }
    const instance = new SpeechRecognition();
    instance.lang = language === "Arabic" ? "ar-JO" : "en-US";
    instance.onresult = (event: any) => setAnswer(event.results[0][0].transcript);
    instance.start();
    recognition.current = instance;
  };

  let feedback: any = null;
  try { feedback = session?.feedback ? JSON.parse(session.feedback) : null; } catch { feedback = null; }

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Mic className="size-5 text-primary" />Live Monk Mock Interview</CardTitle>
        <CardDescription>Complete five adaptive questions, by text or voice, and receive a scored coaching report.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!session ? (
          <div className="grid gap-3 md:grid-cols-[1fr_180px_160px_auto]">
            <Input value={role} onChange={(event) => setRole(event.target.value.slice(0, 100))} placeholder="Target role" />
            <Select value={language} onValueChange={setLanguage}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="English">English</SelectItem><SelectItem value="Arabic">العربية</SelectItem></SelectContent></Select>
            <Select value={mode} onValueChange={setMode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="text">Text</SelectItem><SelectItem value="voice">Voice</SelectItem></SelectContent></Select>
            <Button onClick={start} disabled={loading || !role.trim()}>{loading ? <Loader2 className="size-4 animate-spin" /> : "Start interview"}</Button>
          </div>
        ) : (
          <>
            <div className="max-h-80 space-y-3 overflow-y-auto rounded-xl bg-muted/30 p-4">
              {session.messages.map((message, index) => (
                <div key={index} className={cn("max-w-[85%] rounded-xl p-3 text-sm", message.role === "candidate" ? "ms-auto bg-primary text-primary-foreground" : "bg-card border")}>
                  <div className="mb-1 text-[10px] font-bold uppercase opacity-60">{message.role === "candidate" ? "You" : "Monk"}</div>
                  {message.content}
                  {message.role === "interviewer" && mode === "voice" && <button className="ms-2 align-middle" onClick={() => speechSynthesis.speak(new SpeechSynthesisUtterance(message.content))}><Volume2 className="inline size-4" /></button>}
                </div>
              ))}
            </div>
            {session.status === "active" ? (
              <div className="flex gap-2">
                <Textarea value={answer} onChange={(event) => setAnswer(event.target.value.slice(0, 6000))} placeholder="Give a structured interview answer…" className="min-h-24" />
                <div className="flex flex-col gap-2">
                  {mode === "voice" && <Button variant="outline" size="icon" onClick={record} aria-label="Record answer"><Mic className="size-4" /></Button>}
                  <Button size="icon" onClick={respond} disabled={loading || !answer.trim()} aria-label="Submit answer">{loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}</Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 rounded-xl border border-primary/30 bg-primary/5 p-5 md:grid-cols-[120px_1fr]">
                <div><div className="text-4xl font-bold text-primary">{session.score}/100</div><div className="text-xs text-muted-foreground">Interview score</div></div>
                <div className="space-y-3"><p>{feedback?.feedback || "Interview completed."}</p><div className="flex flex-wrap gap-2">{feedback?.strengths?.map((item: string) => <Badge key={item} variant="secondary">{item}</Badge>)}</div><Button variant="outline" onClick={() => setSession(null)}>Practice another role</Button></div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
