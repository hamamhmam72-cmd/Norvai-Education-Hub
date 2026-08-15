import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { 
  useGetDashboardStats, 
  useGetRecentActivity, 
  useGetRecommendedLectures 
} from "@workspace/api-client-react";
import { 
  BrainCircuit, BookOpen, MessageSquare, Terminal, 
  FileText, Compass, Video, Play, Award, 
  ArrowRight, TrendingUp, Clock, Code2
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: recent, isLoading: recentLoading } = useGetRecentActivity();
  const { data: recommended, isLoading: recommendedLoading } = useGetRecommendedLectures();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const completedLectures = stats?.completedLectures || 0;
  const totalLecturesTarget = 50; // Arbitrary goal for progress display
  const progressPercent = Math.min((completedLectures / totalLecturesTarget) * 100, 100);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-sidebar p-8 text-sidebar-foreground shadow-sm">
        <div className="relative z-10 grid gap-6 md:grid-cols-2 md:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-sidebar-primary-foreground sm:text-4xl">
              {getGreeting()}, {user?.fullName?.split(" ")[0]}
            </h1>
            <p className="mt-2 text-sidebar-foreground/80 text-lg">
              {user?.specialization} • Level: <span className="capitalize text-primary-foreground font-medium">{user?.skillLevel}</span>
            </p>
            <div className="mt-6 flex items-center gap-4">
              <Button asChild variant="secondary" className="font-semibold shadow-sm">
                <Link href="/chat">
                  <MessageSquare className="mr-2 size-4" />
                  Ask AI Tutor
                </Link>
              </Button>
              <Button asChild className="bg-primary/20 text-primary-foreground hover:bg-primary/30 border-transparent">
                <Link href="/lectures">
                  <Play className="mr-2 size-4" />
                  Continue Learning
                </Link>
              </Button>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="rounded-xl bg-sidebar-accent/50 p-6 backdrop-blur-sm border border-sidebar-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-sidebar-foreground/80">Path Progress</span>
                <span className="text-sm font-bold text-primary-foreground">{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-2 bg-sidebar-border [&>div]:bg-primary" />
              <p className="mt-3 text-xs text-sidebar-foreground/60">
                {completedLectures} / {totalLecturesTarget} modules completed. Keep it up!
              </p>
            </div>
          </div>
        </div>
        {/* Decorative background elements */}
        <div className="absolute -right-20 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 size-80 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      {/* Stats Grid */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({length: 6}).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard title="Saved Lectures" value={stats?.savedLectures} icon={BookOpen} />
          <StatCard title="Completed" value={stats?.completedLectures} icon={Award} />
          <StatCard title="Chat Sessions" value={stats?.chatSessions} icon={MessageSquare} />
          <StatCard title="Quizzes Taken" value={stats?.quizzesTaken} icon={BrainCircuit} />
          <StatCard title="Avg Score" value={`${stats?.avgQuizScore}%`} icon={TrendingUp} />
          <StatCard title="Debugs" value={stats?.debugSessions} icon={Terminal} />
        </div>
      )}

      {/* Quick Tools */}
      <div>
        <h2 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2">
          <Compass className="size-5 text-primary" />
          Study Tools
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <ToolCard 
            title="Lectures" 
            desc="Curated video content" 
            icon={Video} 
            href="/lectures" 
            color="bg-blue-500/10 text-blue-600 dark:text-blue-400" 
          />
          <ToolCard 
            title="AI Chatbot" 
            desc="Ask technical questions" 
            icon={MessageSquare} 
            href="/chat" 
            color="bg-purple-500/10 text-purple-600 dark:text-purple-400" 
          />
          <ToolCard 
            title="Code Debug" 
            desc="Analyze & fix snippets" 
            icon={Code2} 
            href="/debug" 
            color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
          />
          <ToolCard 
            title="Smart Summary" 
            desc="Condense long texts" 
            icon={FileText} 
            href="/summary" 
            color="bg-orange-500/10 text-orange-600 dark:text-orange-400" 
          />
          <ToolCard 
            title="Quiz Gen" 
            desc="Test your knowledge" 
            icon={BrainCircuit} 
            href="/quiz" 
            color="bg-pink-500/10 text-pink-600 dark:text-pink-400" 
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Recommended Lectures */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Play className="size-5 text-primary" />
              Recommended for You
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/lectures">View All <ArrowRight className="ml-1 size-4" /></Link>
            </Button>
          </div>
          
          {recommendedLoading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <Skeleton className="h-64 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
          ) : recommended && recommended.length > 0 ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {recommended.slice(0, 4).map(lecture => (
                <Link key={lecture.id} href={`/lectures?id=${lecture.id}`}>
                  <Card className="overflow-hidden hover-elevate transition-all border-border/50 h-full flex flex-col group cursor-pointer">
                    <div className="aspect-video relative overflow-hidden bg-muted">
                      <img 
                        src={`https://img.youtube.com/vi/${lecture.youtubeId}/hqdefault.jpg`} 
                        alt={lecture.title}
                        className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                      <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md text-white text-xs px-2 py-1 rounded font-medium flex items-center gap-1">
                        <Clock className="size-3" />
                        {lecture.durationMinutes || "10"}m
                      </div>
                    </div>
                    <CardContent className="p-4 flex-1">
                      <h3 className="font-semibold line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                        {lecture.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{lecture.instructor}</p>
                    </CardContent>
                    <CardFooter className="p-4 pt-0 flex justify-between items-center">
                      <Badge variant="secondary" className="font-normal capitalize shadow-sm">
                        {lecture.difficulty}
                      </Badge>
                      <Badge variant="outline" className="font-normal border-primary/20 bg-primary/5 text-primary">
                        {lecture.specialization}
                      </Badge>
                    </CardFooter>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="border-dashed bg-transparent shadow-none">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Video className="size-10 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No recommendations yet.</p>
                <Button variant="link" asChild className="mt-2"><Link href="/lectures">Browse lectures</Link></Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent Activity */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="size-5 text-primary" />
            Recent Activity
          </h2>
          
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-0">
              {recentLoading ? (
                <div className="p-4 space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : recent && (recent.recentLectures.length > 0 || recent.recentChats.length > 0 || recent.recentQuizzes.length > 0) ? (
                <div className="divide-y divide-border/50">
                  {recent.recentLectures.slice(0, 3).map(l => (
                    <div key={`l-${l.id}`} className="p-4 flex items-start gap-3 hover:bg-muted/50 transition-colors">
                      <div className="mt-0.5 rounded bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
                        <Video className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium line-clamp-1">{l.title}</p>
                        <p className="text-xs text-muted-foreground">Watched {new Date(l.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                  {recent.recentChats.slice(0, 2).map(c => (
                    <div key={`c-${c.id}`} className="p-4 flex items-start gap-3 hover:bg-muted/50 transition-colors">
                      <div className="mt-0.5 rounded bg-purple-500/10 p-2 text-purple-600 dark:text-purple-400">
                        <MessageSquare className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium line-clamp-1">{c.title || "AI Session"}</p>
                        <p className="text-xs text-muted-foreground">Chatted {new Date(c.updatedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                  {recent.recentQuizzes.slice(0, 2).map(q => (
                    <div key={`q-${q.id}`} className="p-4 flex items-start gap-3 hover:bg-muted/50 transition-colors">
                      <div className="mt-0.5 rounded bg-pink-500/10 p-2 text-pink-600 dark:text-pink-400">
                        <BrainCircuit className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium line-clamp-1">{q.topic} Quiz</p>
                        <p className="text-xs text-muted-foreground">Score: {q.bestScore}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center">
                  <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Clock className="size-6 text-muted-foreground/50" />
                  </div>
                  No recent activity found.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon }: { title: string, value: React.ReactNode, icon: any }) {
  return (
    <Card className="border-border/50 shadow-sm hover-elevate transition-all">
      <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
        <div className="flex justify-between items-start mb-2">
          <span className="text-sm font-medium text-muted-foreground leading-tight">{title}</span>
          <Icon className="size-4 text-primary/50" />
        </div>
        <span className="text-2xl sm:text-3xl font-bold tracking-tight">{value !== undefined ? value : "-"}</span>
      </CardContent>
    </Card>
  );
}

function ToolCard({ title, desc, icon: Icon, href, color }: { title: string, desc: string, icon: any, href: string, color: string }) {
  return (
    <Link href={href}>
      <Card className="h-full border-border/50 shadow-sm hover:border-primary/50 transition-all cursor-pointer group">
        <CardContent className="p-5 flex flex-col items-start">
          <div className={cn("size-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", color)}>
            <Icon className="size-5" />
          </div>
          <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">{title}</h3>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
