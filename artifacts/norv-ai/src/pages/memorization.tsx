import { useEffect, useState } from "react";
import {
  Brain, FileText, Plus, BookOpen, Clock, Play, RotateCcw,
  CheckCircle2, AlertCircle, ChevronLeft, Loader2, BookMarked, Eye, Upload
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

type DeckSummary = {
  id: number;
  title: string;
  sourceLabel?: string;
  flashcardCount: number;
  examQuestionCount: number;
  createdAt: string;
  updatedAt: string;
};

type Deck = {
  id: number;
  title: string;
  sourceLabel?: string | null;
  bulletSummary: { heading: string; points: { text: string; keyTerms: string[] }[] }[];
  flashcards: { id: string; front: string; back: string }[];
  fillBlanks: { id: string; prompt: string; answer: string; hint?: string }[];
  quickQuiz: { id: string; type: string; question: string; options: string[]; answer: string; explanation: string }[];
  examQuestions: { id: string; type: string; question: string; options?: string[]; answer: string; explanation?: string }[];
  progress: { cardId: string; reviewCount: number; correctCount: number; intervalDays: number; dueAt: string }[];
};

type ExamQuestion = {
  id: string;
  type: string;
  question: string;
  options?: string[];
  answer: string;
  explanation?: string;
};

const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Something went wrong.";

function useReducedMotion() {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setMatches(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  return matches;
}

function HighlightedText({ text, terms }: { text: string; terms: string[] }) {
  if (!terms || terms.length === 0) return <span>{text}</span>;
  const escapedTerms = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${escapedTerms})`, 'gi');
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) => {
        const isTerm = terms.some(t => t.toLowerCase() === part.toLowerCase());
        return isTerm ? (
          <span key={i} className="bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded-md border border-primary/20">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </span>
  );
}

export default function MemorizationPlan() {
  const [view, setView] = useState<"list" | "create" | "deck">("list");
  const [activeDeckId, setActiveDeckId] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-5xl p-6 animate-in fade-in duration-500">
      {view === "list" && (
        <DeckListView 
          onSelect={(id) => { setActiveDeckId(id); setView("deck"); }} 
          onCreate={() => setView("create")} 
        />
      )}
      {view === "create" && (
        <CreateDeckView 
          onCreated={(id) => { setActiveDeckId(id); setView("deck"); }} 
          onCancel={() => setView("list")} 
        />
      )}
      {view === "deck" && activeDeckId && (
        <DeckActiveView 
          deckId={activeDeckId} 
          onBack={() => { setActiveDeckId(null); setView("list"); }} 
        />
      )}
    </div>
  );
}

function DeckListView({ onSelect, onCreate }: { onSelect: (id: number) => void, onCreate: () => void }) {
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    apiFetch<DeckSummary[]>("/memorization/decks")
      .then(setDecks)
      .catch((error: unknown) => toast({ variant: "destructive", description: errorMessage(error) }))
      .finally(() => setLoading(false));
  }, [toast]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Memorization Plans</h1>
          <p className="text-muted-foreground mt-1">Your personal study desk. Focused, structured, and effective.</p>
        </div>
        <Button onClick={onCreate} className="gap-2 shrink-0">
          <Plus className="size-4" /> Create Deck
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
      ) : decks.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed border-2">
          <BookOpen className="size-12 text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-xl font-semibold mb-2">No memorization decks yet</h3>
          <p className="text-muted-foreground max-w-sm mb-6">Extract text from your lectures or notes, and transform them into interactive memorization plans.</p>
          <Button onClick={onCreate} variant="outline" className="gap-2"><Plus className="size-4" /> Generate your first deck</Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map(deck => (
            <Card key={deck.id} className="hover:border-primary/50 transition-colors cursor-pointer group flex flex-col" onClick={() => onSelect(deck.id)}>
              <CardHeader className="flex-1 pb-4">
                <div className="flex justify-between items-start gap-4">
                  <CardTitle className="leading-tight group-hover:text-primary transition-colors">{deck.title}</CardTitle>
                  <Brain className="size-5 text-muted-foreground shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
                </div>
                {deck.sourceLabel && <CardDescription className="mt-2 line-clamp-1">{deck.sourceLabel}</CardDescription>}
              </CardHeader>
              <CardFooter className="pt-0 flex justify-between text-xs text-muted-foreground border-t p-4 bg-muted/10">
                <span className="flex items-center gap-1.5"><BookMarked className="size-3.5" /> {deck.flashcardCount} cards</span>
                <span className="flex items-center gap-1.5"><Clock className="size-3.5" /> {deck.examQuestionCount} Qs</span>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateDeckView({ onCreated, onCancel }: { onCreated: (id: number) => void, onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [language, setLanguage] = useState("en");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", description: "File is too large. Max 5MB." });
      return;
    }
    try {
      const text = await file.text();
      setSourceText(text);
      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
    } catch (error: unknown) {
      toast({ variant: "destructive", description: "Failed to read file: " + errorMessage(error) });
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (sourceText.trim().length < 100) {
      toast({ variant: "destructive", description: "Please provide at least 100 characters of study content." });
      return;
    }
    if (!title.trim()) {
      toast({ variant: "destructive", description: "Please provide a title." });
      return;
    }
    
    setIsGenerating(true);
    try {
      const res = await apiFetch<{ id: number }>("/memorization/decks/generate", {
        method: "POST",
        body: JSON.stringify({ title, sourceText, sourceLabel, language })
      });
      toast({ title: "Deck generated!", description: "Your memorization plan is ready." });
      onCreated(res.id);
    } catch (error: unknown) {
      toast({ variant: "destructive", description: errorMessage(error) });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onCancel} className="-ml-2"><ChevronLeft className="size-5" /></Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Memorization Plan</h1>
          <p className="text-muted-foreground mt-1">Transform your notes into an interactive study desk.</p>
        </div>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary-foreground/80 flex items-start gap-3">
        <AlertCircle className="size-5 shrink-0 mt-0.5 text-primary" />
        <p className="leading-relaxed">
          Need to extract text from a PDF, image, or audio recording? Use the <span className="font-medium text-foreground">Study Hub</span> intake tools first, then paste your extracted summary text here to build a targeted memorization plan. You can also directly load local text files.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Deck Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Biology Midterm 1" disabled={isGenerating} required />
          </div>
          <div className="space-y-2">
            <Label>Source Label (Optional)</Label>
            <Input value={sourceLabel} onChange={e => setSourceLabel(e.target.value)} placeholder="e.g., Chapter 4 & 5" disabled={isGenerating} />
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Source Content</Label>
            <label className="text-xs flex items-center gap-1.5 cursor-pointer text-primary hover:underline font-medium">
              <Upload className="size-3.5" />
              Upload .txt / .md
              <input type="file" accept=".txt,.md,.csv" className="hidden" onChange={handleFileChange} disabled={isGenerating} />
            </label>
          </div>
          <Textarea 
            value={sourceText} 
            onChange={e => setSourceText(e.target.value)} 
            placeholder="Paste your extracted study text, lecture transcript, or notes here..." 
            className="min-h-64 font-mono text-sm leading-relaxed" 
            disabled={isGenerating}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Generation Language</Label>
          <Select value={language} onValueChange={setLanguage} disabled={isGenerating}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ar">Arabic</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="pt-4 border-t flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isGenerating}>Cancel</Button>
          <Button type="submit" disabled={isGenerating} className="min-w-32">
            {isGenerating ? <><Loader2 className="size-4 animate-spin mr-2" /> Generating...</> : "Generate Deck"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function DeckActiveView({ deckId, onBack }: { deckId: number, onBack: () => void }) {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [tab, setTab] = useState<"summary" | "flashcards" | "blanks" | "quiz" | "exam">("summary");

  useEffect(() => {
    apiFetch<Deck>(`/memorization/decks/${deckId}`)
      .then(setDeck)
      .catch((error: unknown) => toast({ variant: "destructive", description: errorMessage(error) }))
      .finally(() => setLoading(false));
  }, [deckId, toast]);

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>;
  if (!deck) return <div className="py-20 text-center"><p className="text-muted-foreground">Failed to load deck.</p><Button variant="outline" className="mt-4" onClick={onBack}>Go Back</Button></div>;

  const tabs = [
    { id: "summary", label: "Study Summary", icon: FileText },
    { id: "flashcards", label: "Flashcards", icon: BookMarked },
    { id: "blanks", label: "Fill Blanks", icon: CheckCircle2 },
    { id: "quiz", label: "Quick Quiz", icon: Brain },
    { id: "exam", label: "Practice Exam", icon: Clock },
  ] as const;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2 mt-1 shrink-0"><ChevronLeft className="size-5" /></Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{deck.title}</h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="secondary" className="font-normal">{deck.sourceLabel || "Imported Plan"}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-border/50">
        {tabs.map(({ id, label, icon: Icon }) => (
          <Button 
            key={id} 
            variant={tab === id ? "default" : "outline"} 
            onClick={() => setTab(id)} 
            className="shrink-0 gap-2 rounded-full mb-[-2px]"
          >
            <Icon className="size-4" /> {label}
          </Button>
        ))}
      </div>

      <div className="mt-6 animate-in slide-in-from-bottom-2 duration-300 fade-in">
        {tab === "summary" && <SummaryTab summary={deck.bulletSummary} />}
        {tab === "flashcards" && <FlashcardsTab cards={deck.flashcards} deckId={deckId} />}
        {tab === "blanks" && <FillBlanksTab blanks={deck.fillBlanks} />}
        {tab === "quiz" && <QuickQuizTab quiz={deck.quickQuiz} />}
        {tab === "exam" && <ExamTab deckId={deckId} />}
      </div>
    </div>
  );
}

function SummaryTab({ summary }: { summary: Deck["bulletSummary"] }) {
  if (!summary || summary.length === 0) return <div className="text-muted-foreground text-center py-20 border-dashed border rounded-xl">No summary available.</div>;
  return (
    <div className="space-y-10 max-w-4xl">
      {summary.map((section, idx) => (
        <div key={idx} className="space-y-4">
          <h3 className="text-xl font-bold tracking-tight border-b pb-2 text-foreground/90">{section.heading}</h3>
          <ul className="space-y-4">
            {section.points.map((point, pIdx) => (
               <li key={pIdx} className="flex items-start gap-3 text-muted-foreground leading-relaxed">
                  <CheckCircle2 className="size-5 shrink-0 text-primary/60 mt-0.5" />
                  <HighlightedText text={point.text} terms={point.keyTerms || []} />
               </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function FlashcardsTab({ cards, deckId }: { cards: Deck["flashcards"], deckId: number }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const reducedMotion = useReducedMotion();
  
  if (!cards || cards.length === 0) return <div className="text-muted-foreground text-center py-20 border-dashed border rounded-xl">No flashcards available.</div>;
  if (currentIndex >= cards.length) return (
    <div className="text-center py-20 max-w-md mx-auto border-dashed border rounded-xl bg-muted/10">
      <CheckCircle2 className="mx-auto size-16 text-primary mb-4" /> 
      <h3 className="text-2xl font-bold mb-2">Review Complete</h3>
      <p className="text-muted-foreground">You have finished all flashcards in this deck. Return tomorrow for your spaced repetition review.</p>
      <Button variant="outline" className="mt-6" onClick={() => setCurrentIndex(0)}>Review Again</Button>
    </div>
  );

  const card = cards[currentIndex];
  const progress = (currentIndex / cards.length) * 100;

  const handleReview = async (rating: "again" | "hard" | "good" | "easy") => {
    setIsSubmitting(true);
    try {
      await apiFetch(`/memorization/decks/${deckId}/cards/${card.id}/review`, {
        method: "POST",
        body: JSON.stringify({ rating })
      });
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(c => c + 1), 150);
    } catch (error: unknown) {
      toast({ variant: "destructive", description: errorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center gap-6 py-4">
      <div className="w-full space-y-2">
        <div className="flex justify-between w-full text-sm font-medium text-muted-foreground">
          <span>Card {currentIndex + 1} of {cards.length}</span>
          <span>{Math.round(progress)}% Complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
      
      <div 
        className="relative w-full aspect-[4/3] sm:aspect-[3/2] cursor-pointer group mt-4"
        onClick={() => !isFlipped && setIsFlipped(true)}
        onKeyDown={(event) => {
          if (!isFlipped && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            setIsFlipped(true);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={isFlipped ? "Flashcard answer" : "Reveal flashcard answer"}
        style={{ perspective: "1000px" }}
      >
        <div 
          className="relative w-full h-full"
          style={reducedMotion ? {} : { 
            transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
            transformStyle: "preserve-3d", 
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" 
          }}
        >
          {/* Front */}
          <Card 
            className="absolute inset-0 flex flex-col items-center justify-center p-6 sm:p-10 text-center border-2 hover:border-primary/50 transition-colors shadow-sm"
            style={reducedMotion ? { 
              opacity: isFlipped ? 0 : 1, 
              transition: "opacity 0.3s",
              pointerEvents: isFlipped ? "none" : "auto" 
            } : { 
              backfaceVisibility: "hidden" 
            }}
          >
             <h3 className="text-2xl sm:text-3xl font-medium tracking-tight text-foreground leading-snug">{card.front}</h3>
             {!isFlipped && <span className="absolute bottom-6 text-sm text-muted-foreground flex items-center gap-2"><Eye className="size-4" /> Tap to flip</span>}
          </Card>
          
          {/* Back */}
          <Card 
            className="absolute inset-0 flex flex-col items-center justify-center p-6 sm:p-10 text-center border-2 border-primary/30 bg-primary/5 shadow-sm"
            style={reducedMotion ? { 
              opacity: isFlipped ? 1 : 0, 
              transition: "opacity 0.3s", 
              pointerEvents: isFlipped ? "auto" : "none" 
            } : { 
              backfaceVisibility: "hidden", 
              transform: "rotateY(180deg)" 
            }}
          >
             <ScrollArea className="w-full h-full">
               <div className="flex items-center justify-center min-h-full py-4">
                 <p className="text-lg sm:text-xl text-foreground leading-relaxed whitespace-pre-wrap">{card.back}</p>
               </div>
             </ScrollArea>
          </Card>
        </div>
      </div>

      <div aria-hidden={!isFlipped} className={`w-full grid grid-cols-2 sm:grid-cols-4 gap-3 transition-all duration-300 ${isFlipped ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
        <Button disabled={isSubmitting} variant="outline" className="border-destructive/30 hover:bg-destructive/10 text-destructive h-12 text-sm uppercase tracking-wider font-semibold" onClick={(e) => { e.stopPropagation(); handleReview("again"); }}>Again</Button>
        <Button disabled={isSubmitting} variant="outline" className="border-orange-500/30 hover:bg-orange-500/10 text-orange-600 dark:text-orange-400 h-12 text-sm uppercase tracking-wider font-semibold" onClick={(e) => { e.stopPropagation(); handleReview("hard"); }}>Hard</Button>
        <Button disabled={isSubmitting} variant="outline" className="border-green-500/30 hover:bg-green-500/10 text-green-600 dark:text-green-400 h-12 text-sm uppercase tracking-wider font-semibold" onClick={(e) => { e.stopPropagation(); handleReview("good"); }}>Good</Button>
        <Button disabled={isSubmitting} variant="outline" className="border-primary/30 hover:bg-primary/10 text-primary h-12 text-sm uppercase tracking-wider font-semibold" onClick={(e) => { e.stopPropagation(); handleReview("easy"); }}>Easy</Button>
      </div>
    </div>
  );
}

function FillBlanksTab({ blanks }: { blanks: Deck["fillBlanks"] }) {
  if (!blanks || blanks.length === 0) return <div className="text-muted-foreground text-center py-20 border-dashed border rounded-xl">No fill-in-the-blank questions available.</div>;
  return (
    <div className="space-y-6 max-w-4xl">
      {blanks.map((b, i) => (
        <BlankItem key={b.id} blank={b} index={i} />
      ))}
    </div>
  );
}

function BlankItem({ blank, index }: { blank: Deck["fillBlanks"][0], index: number }) {
  const [value, setValue] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const isCorrect = value.trim().toLowerCase() === blank.answer.trim().toLowerCase();

  return (
    <Card className="hover:border-border transition-colors">
      <CardContent className="p-6">
        <div className="flex gap-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-bold text-muted-foreground">{index + 1}</div>
          <div className="space-y-4 flex-1">
            <p className="text-lg leading-relaxed text-foreground/90">{blank.prompt}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Input 
                value={value} 
                onChange={(e) => { setValue(e.target.value); setRevealed(false); }} 
                placeholder="Type your answer..." 
                 aria-label={`Answer for blank ${index + 1}`}
                className="w-full sm:max-w-xs"
                disabled={revealed}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !revealed && value.trim()) {
                    setRevealed(true);
                  }
                }}
              />
              {!revealed ? (
                <Button variant="secondary" onClick={() => setRevealed(true)} disabled={!value.trim()}>Check Answer</Button>
              ) : isCorrect ? (
                <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-500/30 border-green-500/30 px-3 py-1">Correct</Badge>
              ) : (
                <div className="flex items-center gap-3 bg-muted/50 p-2 px-4 rounded-lg border border-border/50">
                  <Badge variant="destructive" className="px-3 py-1">Incorrect</Badge>
                  <span className="text-sm text-muted-foreground">Answer: <span className="font-semibold text-foreground tracking-wide">{blank.answer}</span></span>
                </div>
              )}
              {blank.hint && !revealed && (
                <Button variant="ghost" size="sm" onClick={() => setShowHint(!showHint)} className="text-muted-foreground">Hint</Button>
              )}
            </div>
            {showHint && !revealed && (
              <p className="text-sm text-primary bg-primary/5 p-3 rounded-md border border-primary/10 mt-2">
                <span className="font-semibold uppercase tracking-wider text-[10px] block mb-1 opacity-70">Hint</span>
                {blank.hint}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickQuizTab({ quiz }: { quiz: Deck["quickQuiz"] }) {
  if (!quiz || quiz.length === 0) return <div className="text-muted-foreground text-center py-20 border-dashed border rounded-xl">No quiz questions available.</div>;
  return (
    <div className="space-y-6 max-w-4xl">
      {quiz.map((q, i) => (
        <QuizItem key={q.id} item={q} index={i} />
      ))}
    </div>
  );
}

function QuizItem({ item, index }: { item: Deck["quickQuiz"][0], index: number }) {
  const [selected, setSelected] = useState<string | null>(null);

  const isAnswered = selected !== null;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex gap-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-bold text-muted-foreground">{index + 1}</div>
          <div className="space-y-5 flex-1">
            <p className="text-lg font-medium text-foreground/90">{item.question}</p>
            <div className="grid gap-3">
              {item.options.map(opt => {
                const isThisSelected = selected === opt;
                const isThisAnswer = item.answer === opt;
                
                let btnClass = "justify-start h-auto py-3 px-4 whitespace-normal text-left transition-all ";
                if (!isAnswered) {
                  btnClass += "hover:bg-muted";
                } else if (isThisAnswer) {
                  btnClass += "bg-green-500/10 border-green-500/50 text-green-700 dark:text-green-400 shadow-sm";
                } else if (isThisSelected && !isThisAnswer) {
                  btnClass += "bg-destructive/10 border-destructive/50 text-destructive shadow-sm";
                } else {
                  btnClass += "opacity-40";
                }

                return (
                  <Button 
                    key={opt}
                    variant="outline"
                    className={btnClass}
                    onClick={() => !isAnswered && setSelected(opt)}
                    disabled={isAnswered && !isThisSelected && !isThisAnswer}
                  >
                    {opt}
                  </Button>
                )
              })}
            </div>
            {isAnswered && (
              <div className="rounded-lg bg-muted/40 p-4 mt-4 border border-border/50 animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wider">Explanation</p>
                <p className="text-sm text-foreground/80 leading-relaxed">{item.explanation}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ExamTab({ deckId }: { deckId: number }) {
  const [exam, setExam] = useState<{ questions: ExamQuestion[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState("10");
  const [types, setTypes] = useState(["multiple_choice", "true_false", "essay"]);
  const { toast } = useToast();

  const toggleType = (t: string) => {
    setTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const handleGenerate = async (): Promise<void> => {
    if (types.length === 0) {
      toast({ variant: "destructive", description: "Select at least one question type." });
      return;
    }
    setLoading(true);
    try {
      const qs = `count=${count}&types=${types.join(",")}`;
      const res = await apiFetch<{ questions: ExamQuestion[] }>(`/memorization/decks/${deckId}/exam?${qs}`);
      setExam(res);
    } catch (error: unknown) {
      toast({ variant: "destructive", description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  if (!exam) {
    return (
      <Card className="max-w-xl mx-auto mt-8 border-primary/20 shadow-sm">
        <CardHeader className="bg-muted/10 border-b pb-6">
          <CardTitle className="text-2xl">Configure Practice Exam</CardTitle>
          <CardDescription className="text-base mt-2">Generate a randomized exam to test your overall knowledge of this deck before the real thing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 pt-8">
          <div className="space-y-4">
            <Label className="text-base">Question Count</Label>
            <Select value={count} onValueChange={setCount}>
              <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 Questions</SelectItem>
                <SelectItem value="10">10 Questions</SelectItem>
                <SelectItem value="20">20 Questions</SelectItem>
                <SelectItem value="40">40 Questions</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-4">
            <Label className="text-base">Question Types</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-colors">
                <input type="checkbox" checked={types.includes("multiple_choice")} onChange={() => toggleType("multiple_choice")} className="size-4 text-primary rounded" />
                <span className="font-medium text-sm">Multiple Choice</span>
              </label>
              <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-colors">
                <input type="checkbox" checked={types.includes("true_false")} onChange={() => toggleType("true_false")} className="size-4 text-primary rounded" />
                <span className="font-medium text-sm">True / False</span>
              </label>
              <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-colors">
                <input type="checkbox" checked={types.includes("essay")} onChange={() => toggleType("essay")} className="size-4 text-primary rounded" />
                <span className="font-medium text-sm">Essay</span>
              </label>
            </div>
          </div>
          <Button className="w-full h-12 text-base" onClick={handleGenerate} disabled={loading}>
            {loading ? <Loader2 className="size-5 animate-spin mr-2" /> : <Play className="size-5 mr-2" />}
            Start Practice Exam
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center justify-between bg-muted/20 p-4 rounded-xl border border-border/50">
        <h3 className="text-xl font-semibold tracking-tight">Practice Exam</h3>
        <Button variant="outline" size="sm" onClick={() => setExam(null)} className="gap-2 text-muted-foreground"><RotateCcw className="size-3.5" /> Configure New Exam</Button>
      </div>
      <div className="space-y-8">
        {exam.questions.map((q, i) => (
          <ExamQuestionItem key={q.id || i} item={q} index={i} />
        ))}
      </div>
    </div>
  );
}

function ExamQuestionItem({ item, index }: { item: ExamQuestion, index: number }) {
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState("");

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex gap-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">{index + 1}</div>
          <div className="space-y-5 flex-1">
            <div className="flex items-start justify-between gap-4">
              <p className="text-lg font-medium text-foreground/90">{item.question}</p>
              <Badge variant="outline" className="shrink-0 uppercase text-[10px] tracking-wider text-muted-foreground bg-muted/10">{item.type.replace('_', ' ')}</Badge>
            </div>
            
            {!revealed ? (
              <div className="space-y-5">
                {item.type === "multiple_choice" || item.type === "true_false" ? (
                  <div className="grid gap-3">
                    {item.options?.map(opt => (
                      <label key={opt} className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-colors">
                        <input type="radio" name={`q-${index}`} value={opt} onChange={(e) => setAnswer(e.target.value)} className="size-4 text-primary" />
                        <span className="text-sm font-medium">{opt}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <Textarea placeholder="Draft your answer here to compare against the model solution..." className="min-h-32 text-sm leading-relaxed" value={answer} onChange={e => setAnswer(e.target.value)} />
                )}
                <Button onClick={() => setRevealed(true)} variant="secondary" className="w-full sm:w-auto h-11 px-6">Self-Assess Answer</Button>
              </div>
            ) : (
              <div className="rounded-lg bg-primary/5 p-6 space-y-5 border border-primary/10 animate-in fade-in duration-300">
                <div className="space-y-2">
                  <p className="text-xs font-bold text-primary uppercase tracking-wider">Correct Answer</p>
                  <p className="font-medium text-foreground text-lg">{item.answer}</p>
                </div>
                {item.explanation && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Explanation</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{item.explanation}</p>
                  </div>
                )}
                {item.type === "essay" && (
                  <div className="mt-6 pt-6 border-t border-primary/10 space-y-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Your Draft</p>
                    <p className="text-sm text-foreground/80 italic bg-background p-4 rounded-md border border-border/50">{answer || "No answer drafted."}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
