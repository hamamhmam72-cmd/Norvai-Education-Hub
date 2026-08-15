import { useState } from "react";
import { 
  useGenerateQuiz, 
  useSubmitQuiz,
  useGetQuizAttempts,
  QuizGenerateInputQuizType,
  Quiz,
  QuizResult
} from "@workspace/api-client-react";
import { 
  BrainCircuit, Wand2, ChevronRight, CheckCircle2, XCircle,
  Loader2, RefreshCcw, LayoutList, Trophy
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const QUIZ_TYPES: { value: QuizGenerateInputQuizType; label: string }[] = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "true_false", label: "True / False" },
  { value: "coding", label: "Coding Snippets" },
  { value: "mixed", label: "Mixed Format" },
];

export default function QuizGenerator() {
  const { toast } = useToast();
  
  // State
  const [step, setStep] = useState<"setup" | "taking" | "results">("setup");
  
  // Setup state
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  const [quizType, setQuizType] = useState<QuizGenerateInputQuizType>("multiple_choice");
  const [questionCount, setQuestionCount] = useState([5]);
  
  // Quiz state
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  
  // Result state
  const [result, setResult] = useState<QuizResult | null>(null);

  // Mutations
  const generateQuiz = useGenerateQuiz();
  const submitQuiz = useSubmitQuiz();

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !topic.trim()) {
      toast({ variant: "destructive", description: "Provide material text or a topic." });
      return;
    }

    generateQuiz.mutate(
      { data: { text, topic, quizType, questionCount: questionCount[0] } },
      {
        onSuccess: (res) => {
          setQuiz(res);
          setAnswers(new Array(res.questions?.length || 0).fill(""));
          setCurrentQuestionIdx(0);
          setStep("taking");
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Generation failed", description: err.message });
        }
      }
    );
  };

  const handleAnswer = (answer: string) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestionIdx] = answer;
    setAnswers(newAnswers);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIdx < (quiz?.questions?.length || 0) - 1) {
      setCurrentQuestionIdx(idx => idx + 1);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIdx > 0) {
      setCurrentQuestionIdx(idx => idx - 1);
    }
  };

  const handleSubmit = () => {
    if (!quiz || answers.some(a => !a)) {
      toast({ variant: "destructive", description: "Please answer all questions." });
      return;
    }

    submitQuiz.mutate(
      { id: quiz.id, data: { answers } },
      {
        onSuccess: (res) => {
          setResult(res);
          setStep("results");
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Submission failed", description: err.message });
        }
      }
    );
  };

  const resetGenerator = () => {
    setStep("setup");
    setQuiz(null);
    setResult(null);
    setText("");
    setAnswers([]);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      
      {/* Step 1: Setup */}
      {step === "setup" && (
        <>
          <div className="text-center mb-8">
            <div className="mx-auto size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <BrainCircuit className="size-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Quiz Generator</h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Turn any topic or study material into a custom quiz instantly.
            </p>
          </div>

          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-6 sm:p-8">
              <form onSubmit={handleGenerate} className="space-y-8">
                
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Quiz Topic (Optional)</Label>
                    <Input 
                      placeholder="e.g. React Hooks, OSI Model..."
                      value={topic}
                      onChange={e => setTopic(e.target.value)}
                      className="h-11"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Format</Label>
                    <Select value={quizType} onValueChange={(val: QuizGenerateInputQuizType) => setQuizType(val)}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUIZ_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-semibold">Number of Questions</Label>
                    <span className="font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                      {questionCount[0]}
                    </span>
                  </div>
                  <Slider 
                    value={questionCount} 
                    onValueChange={setQuestionCount} 
                    min={3} 
                    max={15} 
                    step={1}
                    className="py-4"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-semibold">Source Material</Label>
                  <Textarea 
                    placeholder="Paste your notes or reading material here... (If left blank, AI will generate based on the topic alone)"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    className="min-h-[150px] resize-y"
                  />
                </div>

                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full h-12 text-lg font-semibold group"
                  disabled={generateQuiz.isPending || (!text.trim() && !topic.trim())}
                >
                  {generateQuiz.isPending ? (
                    <><Loader2 className="mr-2 size-5 animate-spin" /> Generating Quiz...</>
                  ) : (
                    <><Wand2 className="mr-2 size-5 transition-transform group-hover:scale-110" /> Generate Quiz</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}

      {/* Step 2: Taking Quiz */}
      {step === "taking" && quiz && quiz.questions && (
        <div className="max-w-3xl mx-auto mt-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">{quiz.topic} Quiz</h2>
              <p className="text-muted-foreground text-sm">Question {currentQuestionIdx + 1} of {quiz.questions.length}</p>
            </div>
            <Badge variant="outline" className="text-sm px-3 py-1 capitalize">
              {quiz.quizType.replace("_", " ")}
            </Badge>
          </div>

          <Progress value={((currentQuestionIdx) / quiz.questions.length) * 100} className="h-2 mb-8" />

          <Card className="border-border/50 shadow-md">
            <CardHeader className="bg-sidebar/5 border-b border-border/50 pb-6">
              <CardTitle className="text-xl leading-relaxed font-semibold">
                {currentQuestionIdx + 1}. {quiz.questions[currentQuestionIdx].question}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {quiz.questions[currentQuestionIdx].options.map((opt, i) => {
                  const isSelected = answers[currentQuestionIdx] === opt;
                  return (
                    <button
                      key={i}
                      onClick={() => handleAnswer(opt)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-3",
                        isSelected 
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm" 
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "mt-0.5 size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                        isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                      )}>
                        {isSelected && <div className="size-2 bg-white rounded-full" />}
                      </div>
                      <span className={cn(
                        "text-base leading-snug",
                        isSelected ? "font-medium text-foreground" : "text-muted-foreground"
                      )}>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 p-6 flex justify-between items-center border-t border-border/50">
              <Button 
                variant="outline" 
                onClick={handlePrevQuestion}
                disabled={currentQuestionIdx === 0}
              >
                Previous
              </Button>
              
              {currentQuestionIdx === quiz.questions.length - 1 ? (
                <Button 
                  onClick={handleSubmit} 
                  disabled={!answers[currentQuestionIdx] || submitQuiz.isPending}
                  className="font-bold px-8 bg-green-600 hover:bg-green-700 text-white"
                >
                  {submitQuiz.isPending ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                  Submit Quiz
                </Button>
              ) : (
                <Button 
                  onClick={handleNextQuestion}
                  disabled={!answers[currentQuestionIdx]}
                  className="px-8"
                >
                  Next <ChevronRight className="size-4 ml-1" />
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Step 3: Results */}
      {step === "results" && result && quiz && (
        <div className="max-w-3xl mx-auto mt-8 space-y-8 animate-in zoom-in-95 duration-500">
          <Card className="border-border/50 shadow-lg text-center overflow-hidden">
            <div className={cn(
              "h-32 flex items-center justify-center",
              result.percentage >= 80 ? "bg-green-500/20" : result.percentage >= 60 ? "bg-yellow-500/20" : "bg-red-500/20"
            )}>
              <Trophy className={cn(
                "size-16",
                result.percentage >= 80 ? "text-green-600" : result.percentage >= 60 ? "text-yellow-600" : "text-red-600"
              )} />
            </div>
            <CardContent className="pt-8 pb-10">
              <h2 className="text-3xl font-bold mb-2">Quiz Completed!</h2>
              <div className="flex items-end justify-center gap-2 mb-6">
                <span className="text-6xl font-extrabold tracking-tighter">{Math.round(result.percentage)}%</span>
                <span className="text-xl text-muted-foreground mb-1">score</span>
              </div>
              <p className="text-lg text-muted-foreground mb-8">
                You got {result.score} out of {result.totalQuestions} questions right.
              </p>
              
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={resetGenerator}>
                  <RefreshCcw className="size-4 mr-2" /> Create Another
                </Button>
                <Button asChild>
                  <a href="#review"><LayoutList className="size-4 mr-2" /> Review Answers</a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div id="review" className="space-y-6 pt-4">
            <h3 className="text-2xl font-bold tracking-tight">Answer Review</h3>
            <div className="space-y-4">
              {result.feedback.map((item, i) => {
                const question = quiz.questions?.find(q => q.id === item.questionId);
                return (
                  <Card key={i} className={cn(
                    "border-l-4 overflow-hidden",
                    item.correct ? "border-l-green-500" : "border-l-red-500"
                  )}>
                    <CardHeader className="bg-sidebar/5 pb-4">
                      <div className="flex items-start gap-3">
                        {item.correct ? (
                          <CheckCircle2 className="size-5 text-green-500 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="size-5 text-red-500 shrink-0 mt-0.5" />
                        )}
                        <CardTitle className="text-base font-semibold leading-relaxed">
                          {i + 1}. {question?.question}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 bg-background">
                      <div className="space-y-3">
                        {!item.correct && (
                          <div className="text-sm p-3 rounded-md bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20">
                            <span className="font-semibold block mb-1">Your Answer:</span>
                            {item.yourAnswer}
                          </div>
                        )}
                        <div className={cn(
                          "text-sm p-3 rounded-md border",
                          item.correct 
                            ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20" 
                            : "bg-green-500/5 text-green-700 dark:text-green-400 border-green-500/20"
                        )}>
                          <span className="font-semibold block mb-1">Correct Answer:</span>
                          {item.correctAnswer}
                        </div>
                        {item.explanation && (
                          <div className="mt-4 text-sm text-muted-foreground p-4 bg-muted/50 rounded-md border border-border/50">
                            <span className="font-semibold text-foreground block mb-1">Explanation:</span>
                            {item.explanation}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
