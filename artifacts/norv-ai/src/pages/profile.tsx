import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  useUpdateProfile, 
  useChangePassword,
  useGetDashboardStats 
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  UserCircle, Settings, Shield, Save, Loader2, 
  BookOpen, Award, BrainCircuit, Terminal, TrendingUp, Key
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
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

const profileSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  university: z.string().optional(),
  major: z.string().optional(),
  yearOfStudy: z.coerce.number().min(1).max(6).optional(),
  specialization: z.string().optional(),
  skillLevel: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type PasswordForm = z.infer<typeof passwordSchema>;

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  
  const [knownLanguages, setKnownLanguages] = useState<string[]>(user?.knownLanguages || []);
  
  const { data: stats } = useGetDashboardStats();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      university: user?.university || "",
      major: user?.major || "",
      yearOfStudy: user?.yearOfStudy || 1,
      specialization: user?.specialization || "",
      skillLevel: user?.skillLevel || "beginner",
    },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Keep local state in sync if user object changes
  useEffect(() => {
    if (user) {
      profileForm.reset({
        fullName: user.fullName || "",
        university: user.university || "",
        major: user.major || "",
        yearOfStudy: user.yearOfStudy || 1,
        specialization: user.specialization || "",
        skillLevel: user.skillLevel || "beginner",
      });
      setKnownLanguages(user.knownLanguages || []);
    }
  }, [user, profileForm]);

  const onProfileSubmit = (data: ProfileForm) => {
    updateProfile.mutate(
      { data: { ...data, knownLanguages } },
      {
        onSuccess: (updatedUser) => {
          updateUser(updatedUser);
          toast({ title: "Profile updated", description: "Your changes have been saved." });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Update failed", description: err.message });
        }
      }
    );
  };

  const onPasswordSubmit = (data: PasswordForm) => {
    changePassword.mutate(
      { data: { currentPassword: data.currentPassword, newPassword: data.newPassword } },
      {
        onSuccess: () => {
          toast({ title: "Password changed", description: "Your password has been successfully updated." });
          passwordForm.reset();
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Change failed", description: err.message });
        }
      }
    );
  };

  const toggleLanguage = (lang: string) => {
    setKnownLanguages(prev => 
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-500 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile, preferences, and security.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          
          {/* Profile Form */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="bg-sidebar/5 border-b border-border/50">
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="size-5 text-primary" />
                Personal Information
              </CardTitle>
              <CardDescription>Update your academic and personal details.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <Form {...profileForm}>
                <form id="profile-form" onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <FormField
                      control={profileForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input value={user?.username || ""} disabled className="bg-muted" />
                      </FormControl>
                    </FormItem>
                  </div>
                  
                  <Separator />
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Academic Details</h3>
                  
                  <div className="grid sm:grid-cols-2 gap-6">
                    <FormField
                      control={profileForm.control}
                      name="university"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>University</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={profileForm.control}
                        name="major"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Major</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={profileForm.control}
                        name="yearOfStudy"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Year</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} max={6} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <FormField
                      control={profileForm.control}
                      name="specialization"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Specialization</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select area" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {SPECIALIZATIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="skillLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Skill Level</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="beginner">Beginner</SelectItem>
                              <SelectItem value="intermediate">Intermediate</SelectItem>
                              <SelectItem value="advanced">Advanced</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="space-y-3 pt-2">
                    <FormLabel>Known Languages & Tools</FormLabel>
                    <div className="flex flex-wrap gap-2">
                      {LANGUAGES.map((lang) => {
                        const isSelected = knownLanguages.includes(lang);
                        return (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => toggleLanguage(lang)}
                            className={cn(
                              "px-3 py-1.5 rounded-full border transition-all text-xs font-medium",
                              isSelected 
                                ? "bg-primary text-primary-foreground border-primary" 
                                : "bg-background border-border hover:border-primary/50"
                            )}
                          >
                            {lang}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="bg-muted/30 p-6 border-t border-border/50 flex justify-end">
              <Button 
                type="submit" 
                form="profile-form" 
                disabled={updateProfile.isPending}
                className="px-6"
              >
                {updateProfile.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                Save Changes
              </Button>
            </CardFooter>
          </Card>

          {/* Security Form */}
          <Card className="border-border/50 shadow-sm border-destructive/20">
            <CardHeader className="bg-destructive/5 border-b border-destructive/10">
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Shield className="size-5" />
                Security
              </CardTitle>
              <CardDescription>Update your password to keep your account secure.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <Form {...passwordForm}>
                <form id="password-form" onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4 max-w-md">
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </CardContent>
            <CardFooter className="bg-muted/30 p-6 border-t border-border/50 flex justify-end">
              <Button 
                type="submit" 
                form="password-form" 
                variant="destructive"
                disabled={changePassword.isPending}
                className="px-6"
              >
                {changePassword.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Key className="mr-2 size-4" />}
                Update Password
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-6">
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <div className="h-24 bg-sidebar w-full relative">
              <div className="absolute inset-0 bg-primary/20" />
            </div>
            <div className="px-6 pb-6 relative">
              <div className="size-20 rounded-xl bg-background border-4 border-background shadow-sm -mt-10 mb-4 flex items-center justify-center bg-muted text-3xl font-bold uppercase text-muted-foreground">
                {user?.fullName?.charAt(0) || "U"}
              </div>
              <h2 className="text-xl font-bold">{user?.fullName}</h2>
              <p className="text-muted-foreground text-sm">{user?.specialization || "Student"}</p>
              
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2"><BookOpen className="size-4" /> Lectures</span>
                  <span className="font-semibold">{stats?.completedLectures || 0}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2"><Award className="size-4" /> Quizzes</span>
                  <span className="font-semibold">{stats?.quizzesTaken || 0}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2"><Terminal className="size-4" /> Code Debugs</span>
                  <span className="font-semibold">{stats?.debugSessions || 0}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2"><TrendingUp className="size-4 text-primary" /> Avg Score</span>
                  <span className="font-bold text-primary">{stats?.avgQuizScore || 0}%</span>
                </div>
              </div>
            </div>
          </Card>
          
          <Card className="border-border/50 shadow-sm bg-primary/5 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <BrainCircuit className="size-8 text-primary shrink-0" />
                <div>
                  <h3 className="font-bold text-primary mb-1">AI Learns With You</h3>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    Keeping your profile updated helps Norv_ai generate better quizzes, tailored explanations, and accurate career advice.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
