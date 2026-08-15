import { useState } from "react";
import { useLocation } from "wouter";
import { BrainCircuit, BookOpen, ChevronRight, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { useCompleteSetup, SetupInputSkillLevel } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const SPECIALIZATIONS = [
  "Programming & Development",
  "Web Development",
  "Computer Networks",
  "Cybersecurity",
  "AI & Machine Learning",
  "Software Engineering",
  "Databases",
  "General IT",
];

const LANGUAGES = [
  "Python", "JavaScript", "Java", "C++", "C", "TypeScript", 
  "Go", "Rust", "PHP", "Swift", "Kotlin", "SQL", "R", "MATLAB"
];

const SKILL_QUESTIONS = [
  {
    question: "How comfortable are you with writing code from scratch?",
    options: [
      { text: "I've never done it or need heavy guidance.", value: "beginner" },
      { text: "I can write small scripts and functions.", value: "intermediate" },
      { text: "I build complete applications regularly.", value: "advanced" },
    ]
  },
  {
    question: "What's your experience with data structures & algorithms?",
    options: [
      { text: "What are those?", value: "beginner" },
      { text: "I know arrays, lists, and basic sorting.", value: "intermediate" },
      { text: "I can optimize time/space complexity.", value: "advanced" },
    ]
  },
  {
    question: "Have you worked with external APIs or databases?",
    options: [
      { text: "No, mostly local logic.", value: "beginner" },
      { text: "Yes, basic fetch/SQL queries.", value: "intermediate" },
      { text: "Yes, I design and integrate complex systems.", value: "advanced" },
    ]
  }
];

export default function Setup() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const { updateUser } = useAuth();
  const { toast } = useToast();
  const completeSetupMutation = useCompleteSetup();

  const [formData, setFormData] = useState({
    university: "",
    major: "",
    yearOfStudy: "",
    specialization: "",
    skillAnswers: [] as string[],
    knownLanguages: [] as string[],
  });

  const progress = ((step - 1) / 5) * 100;

  const nextStep = () => setStep((s) => Math.min(s + 1, 6));
  
  const calculateSkillLevel = (): SetupInputSkillLevel => {
    let score = 0;
    formData.skillAnswers.forEach((ans) => {
      if (ans === "intermediate") score += 1;
      if (ans === "advanced") score += 2;
    });
    if (score >= 4) return "advanced";
    if (score >= 2) return "intermediate";
    return "beginner";
  };

  const finishSetup = () => {
    const payload = {
      university: formData.university,
      major: formData.major,
      yearOfStudy: parseInt(formData.yearOfStudy) || 1,
      specialization: formData.specialization,
      skillLevel: calculateSkillLevel(),
      knownLanguages: formData.knownLanguages,
    };

    completeSetupMutation.mutate(
      { data: payload },
      {
        onSuccess: (user) => {
          updateUser(user);
          setLocation("/dashboard");
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Setup Failed",
            description: err.message || "Could not complete setup.",
          });
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex items-center justify-center gap-2">
          <BrainCircuit className="size-8 text-primary" />
          <h1 className="text-2xl font-bold">Norv_ai Setup</h1>
        </div>

        <Card className="shadow-lg shadow-black/5 overflow-hidden">
          {step > 1 && step < 6 && (
            <Progress value={progress} className="h-1.5 rounded-none rounded-t-lg bg-muted/50" />
          )}
          <CardContent className="p-8 md:p-12">
            
            {/* Step 1: Welcome */}
            {step === 1 && (
              <div className="text-center space-y-6">
                <div className="mx-auto size-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <BookOpen className="size-10 text-primary" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight">Welcome to your AI Copilot</h2>
                <p className="text-muted-foreground text-lg">
                  Let's personalize Norv_ai to your studies. We just need a few details to tailor your curriculum, quizzes, and career advice.
                </p>
                <div className="pt-6">
                  <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base group" onClick={nextStep}>
                    Get Started
                    <ArrowRight className="ml-2 size-5 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Academic Info */}
            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight">Academic Details</h2>
                  <p className="text-muted-foreground">Tell us where and what you're studying.</p>
                </div>
                
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="university">University</Label>
                    <Input 
                      id="university" 
                      placeholder="e.g. MIT, Stanford, Al-Balqa" 
                      value={formData.university}
                      onChange={(e) => setFormData({...formData, university: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="major">Major / Degree</Label>
                    <Input 
                      id="major" 
                      placeholder="e.g. Computer Science, Software Engineering" 
                      value={formData.major}
                      onChange={(e) => setFormData({...formData, major: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year">Year of Study</Label>
                    <Input 
                      id="year" 
                      type="number"
                      min="1" max="6"
                      placeholder="e.g. 1, 2, 3" 
                      value={formData.yearOfStudy}
                      onChange={(e) => setFormData({...formData, yearOfStudy: e.target.value})}
                    />
                  </div>
                </div>

                <div className="pt-6 flex justify-end">
                  <Button size="lg" onClick={nextStep} disabled={!formData.university || !formData.major}>
                    Continue <ChevronRight className="ml-2 size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Specialization */}
            {step === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight">Primary Focus</h2>
                  <p className="text-muted-foreground">What area of IT interests you the most right now?</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
                  {SPECIALIZATIONS.map((spec) => (
                    <button
                      key={spec}
                      onClick={() => setFormData({...formData, specialization: spec})}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left",
                        formData.specialization === spec 
                          ? "border-primary bg-primary/5 shadow-sm" 
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      )}
                    >
                      <span className="font-medium">{spec}</span>
                      {formData.specialization === spec && <CheckCircle2 className="size-5 text-primary" />}
                    </button>
                  ))}
                </div>

                <div className="pt-6 flex justify-end">
                  <Button size="lg" onClick={nextStep} disabled={!formData.specialization}>
                    Continue <ChevronRight className="ml-2 size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Skill Assessment */}
            {step === 4 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight">Quick Assessment</h2>
                  <p className="text-muted-foreground">Let's gauge your current skill level to personalize content.</p>
                </div>
                
                <div className="space-y-8">
                  {SKILL_QUESTIONS.map((q, i) => (
                    <div key={i} className="space-y-3">
                      <Label className="text-base font-semibold">{i + 1}. {q.question}</Label>
                      <div className="space-y-2">
                        {q.options.map((opt) => {
                          const isSelected = formData.skillAnswers[i] === opt.value;
                          return (
                            <button
                              key={opt.value}
                              onClick={() => {
                                const newAnswers = [...formData.skillAnswers];
                                newAnswers[i] = opt.value;
                                setFormData({...formData, skillAnswers: newAnswers});
                              }}
                              className={cn(
                                "w-full flex items-center p-3 rounded-lg border transition-all text-left",
                                isSelected
                                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                  : "border-border hover:bg-muted/50"
                              )}
                            >
                              <div className={cn(
                                "size-4 rounded-full border mr-3 flex-shrink-0 flex items-center justify-center",
                                isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                              )}>
                                {isSelected && <div className="size-1.5 bg-white rounded-full" />}
                              </div>
                              <span className={isSelected ? "font-medium" : ""}>{opt.text}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 flex justify-end">
                  <Button size="lg" onClick={nextStep} disabled={formData.skillAnswers.filter(Boolean).length < 3}>
                    Continue <ChevronRight className="ml-2 size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 5: Known Languages */}
            {step === 5 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight">Languages & Tools</h2>
                  <p className="text-muted-foreground">Select the programming languages you already know.</p>
                </div>
                
                <div className="flex flex-wrap gap-2 pt-4">
                  {LANGUAGES.map((lang) => {
                    const isSelected = formData.knownLanguages.includes(lang);
                    return (
                      <button
                        key={lang}
                        onClick={() => {
                          if (isSelected) {
                            setFormData({
                              ...formData, 
                              knownLanguages: formData.knownLanguages.filter(l => l !== lang)
                            });
                          } else {
                            setFormData({
                              ...formData, 
                              knownLanguages: [...formData.knownLanguages, lang]
                            });
                          }
                        }}
                        className={cn(
                          "px-4 py-2 rounded-full border transition-all text-sm font-medium",
                          isSelected 
                            ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                            : "bg-background border-border hover:border-primary/50 hover:bg-muted text-foreground"
                        )}
                      >
                        {lang}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-8 flex justify-end">
                  <Button size="lg" onClick={nextStep}>
                    Finish Setup <ChevronRight className="ml-2 size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 6: Success */}
            {step === 6 && (
              <div className="text-center space-y-6 animate-in zoom-in duration-500">
                <div className="mx-auto size-24 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
                  <CheckCircle2 className="size-12 text-green-600 dark:text-green-500" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight">You're All Set!</h2>
                <p className="text-muted-foreground text-lg max-w-sm mx-auto">
                  Your profile has been tailored. We've built your learning path and calibrated your AI assistant.
                </p>
                <div className="pt-6">
                  <Button 
                    size="lg" 
                    className="w-full sm:w-auto h-12 px-8 text-base group" 
                    onClick={finishSetup}
                    disabled={completeSetupMutation.isPending}
                  >
                    {completeSetupMutation.isPending ? (
                      <Loader2 className="mr-2 size-5 animate-spin" />
                    ) : (
                      <>
                        Launch Dashboard
                        <ArrowRight className="ml-2 size-5 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
