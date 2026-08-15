import { useState } from "react";
import { 
  useAnalyzeCode, 
  useGetDebugSessions,
  DebugSession 
} from "@workspace/api-client-react";
import { 
  Terminal, Play, CheckCircle2, XCircle, AlertTriangle, 
  Lightbulb, Code2, RotateCcw, Loader2, ArrowRight
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useQueryClient } from "@tanstack/react-query";
import { getGetDebugSessionsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

const LANGUAGES = [
  "Python", "JavaScript", "Java", "C++", "C", 
  "TypeScript", "Go", "Rust", "PHP", "SQL"
];

export default function CodeDebugger() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [language, setLanguage] = useState<string>("Python");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<DebugSession | null>(null);

  const analyzeCode = useAnalyzeCode();
  const { data: history, isLoading: historyLoading } = useGetDebugSessions();

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast({ variant: "destructive", description: "Please enter some code to analyze." });
      return;
    }

    analyzeCode.mutate(
      { data: { language, code } },
      {
        onSuccess: (res) => {
          setResult(res);
          queryClient.invalidateQueries({ queryKey: getGetDebugSessionsQueryKey() });
          
          if (res.status === "clean") {
            toast({ title: "Code is clean!", description: "No major issues found." });
          } else {
            toast({ variant: "destructive", title: "Issues found", description: `Found ${res.errors?.length || 0} errors.` });
          }
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Analysis Failed", description: err.message });
        }
      }
    );
  };

  const handleLoadHistory = (session: DebugSession) => {
    setCode(session.code);
    setLanguage(session.language);
    setResult(session);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Code Debugger</h1>
        <p className="text-muted-foreground mt-1">
          Paste your code to find bugs, optimize performance, and learn best practices.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        
        {/* Editor Panel */}
        <Card className="border-border/50 shadow-sm flex flex-col h-[600px]">
          <CardHeader className="py-3 px-4 border-b border-border/50 bg-sidebar/5 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="size-4 text-primary" />
              <span className="font-semibold text-sm">Editor</span>
            </div>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-[140px] h-8 text-xs bg-background">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col relative bg-zinc-950 text-zinc-50">
            {/* Extremely simple line number simulation by padding left */}
            <form id="debug-form" onSubmit={handleAnalyze} className="flex-1 flex flex-col h-full relative">
              <Textarea 
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="// Paste your code here..."
                className="flex-1 resize-none font-mono text-sm leading-relaxed p-4 bg-transparent border-0 focus-visible:ring-0 text-zinc-100 placeholder:text-zinc-600 rounded-none"
                spellCheck={false}
              />
              <div className="absolute bottom-4 right-4">
                <Button 
                  type="submit" 
                  size="lg"
                  className="shadow-lg shadow-black/20"
                  disabled={!code.trim() || analyzeCode.isPending}
                >
                  {analyzeCode.isPending ? (
                    <><Loader2 className="mr-2 size-4 animate-spin" /> Analyzing...</>
                  ) : (
                    <><Play className="mr-2 size-4" /> Check Code</>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Results Panel */}
        <Card className="border-border/50 shadow-sm flex flex-col h-[600px] overflow-hidden">
          <CardHeader className="border-b border-border/50 py-4">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Code2 className="size-5 text-primary" />
                Analysis Results
              </span>
              {result && (
                <Badge variant={result.status === "clean" ? "default" : "destructive"} className="uppercase">
                  {result.status === "clean" ? "No Errors" : "Issues Found"}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="p-0 flex-1 relative overflow-hidden bg-sidebar/5">
            {!result && !analyzeCode.isPending && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Terminal className="size-8 text-muted-foreground/50" />
                </div>
                <h3 className="font-semibold text-foreground">Awaiting Code</h3>
                <p className="text-sm mt-1 max-w-sm">
                  Run an analysis to see syntax errors, logical flaws, and optimization suggestions here.
                </p>
              </div>
            )}

            {analyzeCode.isPending && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                <Loader2 className="size-10 animate-spin text-primary mb-4" />
                <p className="font-medium animate-pulse">Running static analysis...</p>
              </div>
            )}

            {result && (
              <ScrollArea className="h-full">
                <div className="p-6 space-y-8">
                  
                  {/* Score */}
                  {result.efficiencyScore !== undefined && result.efficiencyScore !== null && (
                    <div className="flex items-center gap-6 bg-card p-4 rounded-xl border border-border/50 shadow-sm">
                      <div className="relative size-16 flex items-center justify-center shrink-0">
                        <svg className="size-16 -rotate-90 transform" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="40" className="fill-none stroke-muted stroke-[8]" />
                          <circle cx="50" cy="50" r="40" className={result.efficiencyScore > 80 ? "stroke-green-500" : result.efficiencyScore > 50 ? "stroke-yellow-500" : "stroke-red-500"} strokeWidth="8" fill="none" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * result.efficiencyScore) / 100} strokeLinecap="round" />
                        </svg>
                        <span className="absolute text-lg font-bold">{result.efficiencyScore}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">Efficiency Score</h4>
                        <p className="text-sm text-muted-foreground leading-snug">
                          {result.efficiencyScore > 80 ? "Great job! Your code is well optimized." : 
                           result.efficiencyScore > 50 ? "Decent, but there's room for improvement." : 
                           "Needs significant optimization."}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Errors */}
                  {result.errors && result.errors.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-destructive flex items-center gap-2 uppercase tracking-wider">
                        <AlertTriangle className="size-4" /> Issues & Fixes
                      </h3>
                      <div className="space-y-3">
                        {result.errors.map((err, i) => (
                          <div key={i} className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <Badge variant="destructive" className="shrink-0">Line {err.line}</Badge>
                              <div>
                                <p className="font-semibold text-destructive-foreground/90 text-sm mb-1">{err.type}</p>
                                <p className="text-sm mb-3">{err.message}</p>
                                <div className="bg-background rounded-md p-3 border border-border/50">
                                  <p className="text-xs font-semibold text-primary mb-1 uppercase tracking-wider">Suggested Fix</p>
                                  <code className="text-xs font-mono text-foreground">{err.fix}</code>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Best Practices */}
                  {result.bestPractices && result.bestPractices.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2 uppercase tracking-wider">
                        <Lightbulb className="size-4" /> Best Practices
                      </h3>
                      <ul className="space-y-2 bg-blue-500/5 p-4 rounded-lg border border-blue-500/20">
                        {result.bestPractices.map((bp, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="size-4 text-blue-500 shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{bp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Fixed Code */}
                  {result.fixedCode && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-green-600 dark:text-green-400 flex items-center gap-2 uppercase tracking-wider">
                        <CheckCircle2 className="size-4" /> Optimized Code
                      </h3>
                      <div className="bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden">
                        <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center">
                          <span className="text-xs font-mono text-zinc-400">{result.language}</span>
                        </div>
                        <div className="p-4 overflow-x-auto">
                          <pre className="text-sm font-mono text-zinc-100 whitespace-pre">
                            {result.fixedCode}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <div className="pt-6">
        <h2 className="text-xl font-bold tracking-tight mb-4">Recent Sessions</h2>
        {historyLoading ? (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : history && history.length > 0 ? (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {history.map(session => (
              <Card 
                key={session.id} 
                className="cursor-pointer hover:border-primary/50 transition-colors group border-border/50 shadow-sm"
                onClick={() => handleLoadHistory(session)}
              >
                <CardContent className="p-4 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className="font-normal">{session.language}</Badge>
                    <Badge variant={session.status === 'clean' ? 'default' : 'destructive'} className="text-[10px] h-5">
                      {session.status === 'clean' ? 'Clean' : 'Errors'}
                    </Badge>
                  </div>
                  <pre className="text-xs font-mono text-muted-foreground line-clamp-3 mb-4 bg-muted p-2 rounded flex-1">
                    {session.code}
                  </pre>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto">
                    <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1 group-hover:text-primary transition-colors font-medium">
                      Load <RotateCcw className="size-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No previous debugging sessions.</p>
        )}
      </div>
    </div>
  );
}
