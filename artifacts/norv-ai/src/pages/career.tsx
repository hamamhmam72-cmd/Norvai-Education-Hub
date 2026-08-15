import { useGetCareerRecommendations } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { 
  Compass, Briefcase, GraduationCap, Code2, AlertCircle, 
  ArrowRight, CheckCircle2, Loader2, Target, TrendingUp, Sparkles,
  BookOpen,
  Clock
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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
