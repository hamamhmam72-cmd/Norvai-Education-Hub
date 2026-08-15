import { useState } from "react";
import { useCreateSummary, Summary } from "@workspace/api-client-react";
import { 
  FileText, Wand2, Copy, CheckCircle2, ChevronRight, 
  List, Tag, BrainCircuit, Loader2, BookOpen
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

const TOPICS = [
  "Networks", 
  "Cybersecurity", 
  "Software Engineering", 
  "Algorithms", 
  "Databases", 
  "OS",
  "General IT"
];

export default function SmartSummary() {
  const { toast } = useToast();
  const [topic, setTopic] = useState<string>("Software Engineering");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [result, setResult] = useState<Summary | null>(null);
  const [copied, setCopied] = useState(false);

  const createSummary = useCreateSummary();

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.length < 50) {
      toast({ variant: "destructive", description: "Please enter at least 50 characters of text to summarize." });
      return;
    }

    createSummary.mutate(
      { data: { topic, title: title || undefined, text } },
      {
        onSuccess: (res) => {
          setResult(res);
          toast({ title: "Summary generated successfully" });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Failed to generate summary", description: err.message });
        }
      }
    );
  };

  const handleCopy = () => {
    if (!result) return;
    
    const content = `
${result.title || "Summary"} (${result.topic})
Difficulty: ${result.difficultyLevel}

SUMMARY:
${result.summary}

KEY POINTS:
${result.keyPoints.map(p => `- ${p}`).join("\n")}

TERMS:
${result.technicalTerms?.join(", ")}
    `.trim();

    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ description: "Copied to clipboard" });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500 h-[calc(100vh-8rem)] flex flex-col">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Smart Summary</h1>
        <p className="text-muted-foreground mt-1">
          Paste long technical articles, lecture transcripts, or documentation to get an instant breakdown.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 flex-1 min-h-0">
        
        {/* Input Panel */}
        <Card className="border-border/50 shadow-sm flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              Input Material
            </CardTitle>
            <CardDescription>Paste the text you want to condense.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-4">
            <form id="summary-form" onSubmit={handleGenerate} className="flex-1 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Topic Area</Label>
                  <Select value={topic} onValueChange={setTopic}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select topic" />
                    </SelectTrigger>
                    <SelectContent>
                      {TOPICS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Title (Optional)</Label>
                  <Input 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    placeholder="e.g. OSI Model Chapter 2"
                  />
                </div>
              </div>
              
              <div className="space-y-2 flex-1 flex flex-col">
                <div className="flex justify-between items-center">
                  <Label>Content to Summarize</Label>
                  <span className="text-xs text-muted-foreground">{text.length} chars (min 50)</span>
                </div>
                <Textarea 
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Paste your notes, transcript, or article here..."
                  className="flex-1 resize-none font-mono text-sm leading-relaxed"
                />
              </div>
            </form>

            <Button 
              form="summary-form" 
              type="submit" 
              className="w-full h-12 text-base font-semibold group mt-auto"
              disabled={text.length < 50 || createSummary.isPending}
            >
              {createSummary.isPending ? (
                <>
                  <Loader2 className="mr-2 size-5 animate-spin" />
                  Analyzing Text...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 size-5 transition-transform group-hover:scale-110" />
                  Generate Summary
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results Panel */}
        <Card className="border-border/50 shadow-sm flex flex-col overflow-hidden bg-sidebar/5">
          <CardHeader className="border-b border-border/50 bg-card flex flex-row items-center justify-between py-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="size-5 text-primary" />
                Analysis Results
              </CardTitle>
            </div>
            {result && (
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <CheckCircle2 className="size-4 mr-2 text-green-500" /> : <Copy className="size-4 mr-2" />}
                {copied ? "Copied" : "Copy All"}
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden relative">
            {!result && !createSummary.isPending && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Wand2 className="size-8 text-muted-foreground/50" />
                </div>
                <h3 className="font-semibold text-foreground">Waiting for input</h3>
                <p className="text-sm mt-1 max-w-sm">
                  Paste your text on the left and click generate to see the AI breakdown here.
                </p>
              </div>
            )}

            {createSummary.isPending && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                <Loader2 className="size-10 animate-spin text-primary mb-4" />
                <p className="font-medium animate-pulse">Extracting key concepts...</p>
              </div>
            )}

            {result && (
              <ScrollArea className="h-full">
                <div className="p-6 space-y-8">
                  {/* Header info */}
                  <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-border/50">
                    <Badge variant="default" className="text-xs uppercase">{result.topic}</Badge>
                    {result.difficultyLevel && (
                      <Badge variant="outline" className="text-xs">Level: {result.difficultyLevel}</Badge>
                    )}
                    <h2 className="text-xl font-bold w-full mt-2">{result.title || "Document Summary"}</h2>
                  </div>

                  {/* Summary Block */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-wider">
                      <FileText className="size-4" /> The Gist
                    </h3>
                    <p className="text-base leading-relaxed bg-card p-4 rounded-lg border border-border/50 shadow-sm">
                      {result.summary}
                    </p>
                  </div>

                  {/* Key Points */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-wider">
                      <List className="size-4" /> Key Points
                    </h3>
                    <ul className="space-y-2 bg-card p-4 rounded-lg border border-border/50 shadow-sm">
                      {result.keyPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <ChevronRight className="size-4 text-primary shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Terms & Tags */}
                  <div className="grid sm:grid-cols-2 gap-6">
                    {result.technicalTerms && result.technicalTerms.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-wider">
                          <BookOpen className="size-4" /> Technical Terms
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {result.technicalTerms.map((term, i) => (
                            <Badge key={i} variant="secondary" className="font-normal shadow-sm">
                              {term}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {result.tags && result.tags.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-wider">
                          <Tag className="size-4" /> Related Tags
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {result.tags.map((tag, i) => (
                            <Badge key={i} variant="outline" className="font-normal">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
