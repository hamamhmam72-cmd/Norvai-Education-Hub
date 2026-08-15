import { useState } from "react";
import { useLocation } from "wouter";
import { 
  useGetLectures, 
  useGetCurricula,
  useSaveLecture,
  useUnsaveLecture,
  useCompleteLecture,
  Lecture,
  LectureDifficulty
} from "@workspace/api-client-react";
import { 
  Search, Video, Play, Bookmark, BookmarkCheck, CheckCircle2, Clock, 
  Filter, BookOpen, Loader2
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetLecturesQueryKey } from "@workspace/api-client-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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

export default function Lectures() {
  const [search, setSearch] = useState("");
  const [specialization, setSpecialization] = useState<string>("all");
  const [difficulty, setDifficulty] = useState<string>("all");
  const [curriculumId, setCurriculumId] = useState<string>("all");
  const [savedFilter, setSavedFilter] = useState<string>("all");
  
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queryParams = {
    search: search || undefined,
    specialization: specialization !== "all" ? specialization : undefined,
    difficulty: difficulty !== "all" ? difficulty : undefined,
    curriculumId: curriculumId !== "all" ? parseInt(curriculumId) : undefined,
    saved: savedFilter !== "all" ? savedFilter : undefined,
  };

  const { data: lectures, isLoading } = useGetLectures(queryParams);
  const { data: curricula } = useGetCurricula();

  const saveMutation = useSaveLecture();
  const unsaveMutation = useUnsaveLecture();
  const completeMutation = useCompleteLecture();

  const handleToggleSave = (e: React.MouseEvent, lecture: Lecture) => {
    e.stopPropagation();
    const mutation = lecture.isSaved ? unsaveMutation : saveMutation;
    mutation.mutate(
      { id: lecture.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetLecturesQueryKey() });
          toast({ 
            title: lecture.isSaved ? "Removed from saved" : "Saved to library", 
            description: lecture.title 
          });
          if (selectedLecture?.id === lecture.id) {
            setSelectedLecture({...selectedLecture, isSaved: !lecture.isSaved});
          }
        }
      }
    );
  };

  const handleToggleComplete = (lecture: Lecture) => {
    if (lecture.isCompleted) return;
    completeMutation.mutate(
      { id: lecture.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetLecturesQueryKey() });
          toast({ 
            title: "Lecture Completed", 
            description: "Great job! Progress updated." 
          });
          if (selectedLecture?.id === lecture.id) {
            setSelectedLecture({...selectedLecture, isCompleted: true});
          }
        }
      }
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lecture Library</h1>
          <p className="text-muted-foreground mt-1">Discover, save, and learn from curated content.</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="Search lectures..." 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <Select value={specialization} onValueChange={setSpecialization}>
            <SelectTrigger>
              <div className="flex items-center gap-2 truncate">
                <Filter className="size-4 text-muted-foreground" />
                <SelectValue placeholder="Specialization" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Topics</SelectItem>
              {SPECIALIZATIONS.map(spec => (
                <SelectItem key={spec} value={spec}>{spec}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger>
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Difficulty</SelectItem>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>

          <Select value={curriculumId} onValueChange={setCurriculumId}>
            <SelectTrigger>
              <SelectValue placeholder="Curriculum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Curricula</SelectItem>
              {curricula?.map(c => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={savedFilter} onValueChange={setSavedFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Lectures</SelectItem>
              <SelectItem value="true">Saved Only</SelectItem>
              <SelectItem value="false">Unsaved</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({length: 8}).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : lectures && lectures.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {lectures.map(lecture => (
            <Card 
              key={lecture.id} 
              className="overflow-hidden hover-elevate transition-all border-border/50 flex flex-col group cursor-pointer"
              onClick={() => setSelectedLecture(lecture)}
            >
              <div className="aspect-video relative overflow-hidden bg-muted">
                <img 
                  src={`https://img.youtube.com/vi/${lecture.youtubeId}/hqdefault.jpg`} 
                  alt={lecture.title}
                  className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                
                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="size-12 rounded-full bg-primary/90 text-white flex items-center justify-center shadow-lg backdrop-blur-sm">
                    <Play className="size-5 ml-1" />
                  </div>
                </div>

                <div className="absolute top-2 right-2 flex gap-1">
                  <button 
                    onClick={(e) => handleToggleSave(e, lecture)}
                    className="size-8 rounded-md bg-black/60 hover:bg-black/80 backdrop-blur-md flex items-center justify-center text-white transition-colors"
                  >
                    {lecture.isSaved ? (
                      <BookmarkCheck className="size-4 text-primary" />
                    ) : (
                      <Bookmark className="size-4" />
                    )}
                  </button>
                </div>
                
                {lecture.isCompleted && (
                  <div className="absolute top-2 left-2 px-2 py-1 rounded bg-green-500/90 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1">
                    <CheckCircle2 className="size-3" />
                    Completed
                  </div>
                )}
                
                <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md text-white text-xs px-2 py-1 rounded font-medium flex items-center gap-1">
                  <Clock className="size-3" />
                  {lecture.durationMinutes || "10"}:00
                </div>
              </div>
              <CardContent className="p-4 flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={lecture.difficulty === 'advanced' ? 'destructive' : lecture.difficulty === 'intermediate' ? 'default' : 'secondary'} className="text-[10px] uppercase font-semibold">
                    {lecture.difficulty}
                  </Badge>
                  <span className="text-xs text-muted-foreground truncate">{lecture.specialization}</span>
                </div>
                <h3 className="font-semibold line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                  {lecture.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                  <BookOpen className="size-3" />
                  {lecture.instructor || "Unknown Instructor"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed bg-transparent shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <Video className="size-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-bold text-sidebar-foreground">No lectures found</h3>
            <p className="text-muted-foreground mt-2 max-w-sm">
              We couldn't find any lectures matching your current filters. Try adjusting your search criteria.
            </p>
            <Button 
              variant="outline" 
              className="mt-6"
              onClick={() => {
                setSearch(""); setSpecialization("all"); setDifficulty("all"); setCurriculumId("all"); setSavedFilter("all");
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Video Player Modal */}
      <Dialog open={!!selectedLecture} onOpenChange={(open) => !open && setSelectedLecture(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background border-border/50">
          {selectedLecture && (
            <>
              <div className="aspect-video w-full bg-black">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${selectedLecture.youtubeId}?autoplay=1`}
                  title={selectedLecture.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
              <div className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                  <div>
                    <DialogTitle className="text-2xl font-bold">{selectedLecture.title}</DialogTitle>
                    <DialogDescription className="mt-2 text-base">
                      {selectedLecture.description || `A ${selectedLecture.difficulty} lecture by ${selectedLecture.instructor}.`}
                    </DialogDescription>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button 
                      variant="outline"
                      onClick={(e) => handleToggleSave(e, selectedLecture)}
                    >
                      {selectedLecture.isSaved ? (
                        <><BookmarkCheck className="mr-2 size-4 text-primary" /> Saved</>
                      ) : (
                        <><Bookmark className="mr-2 size-4" /> Save</>
                      )}
                    </Button>
                    <Button 
                      variant={selectedLecture.isCompleted ? "secondary" : "default"}
                      onClick={() => handleToggleComplete(selectedLecture)}
                      disabled={selectedLecture.isCompleted || completeMutation.isPending}
                    >
                      {selectedLecture.isCompleted ? (
                        <><CheckCircle2 className="mr-2 size-4 text-green-500" /> Completed</>
                      ) : (
                        <><CheckCircle2 className="mr-2 size-4" /> Mark Complete</>
                      )}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{selectedLecture.specialization}</Badge>
                  <Badge variant="outline">{selectedLecture.curriculumName || "Standalone"}</Badge>
                  <span className="text-sm text-muted-foreground flex items-center ml-auto">
                    <BookOpen className="size-4 mr-1" />
                    {selectedLecture.instructor}
                  </span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
