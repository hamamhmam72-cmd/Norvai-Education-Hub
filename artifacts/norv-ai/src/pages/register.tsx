import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BrainCircuit, CheckCircle2, Loader2, ArrowRight, MapPin, University } from "lucide-react";
import { useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JORDAN_GOVERNORATES, JORDANIAN_UNIVERSITIES } from "@/data/jordan";

const registerSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  governorate: z.string().optional(),
  university: z.string().optional(),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const registerMutation = useRegister();

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      username: "",
      password: "",
      governorate: "",
      university: "",
    },
  });

  const onSubmit = (data: RegisterForm) => {
    registerMutation.mutate(
      { data },
      {
        onSuccess: (res) => {
          login(res.token, res.user);
          toast({ title: "Account created!", description: "Let's set up your profile." });
          setLocation("/setup");
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Registration Failed",
            description: err.message || "Failed to create account.",
          });
        },
      }
    );
  };

  return (
    <div className="flex min-h-screen">
      {/* Brand Panel */}
      <div className="hidden w-1/2 flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3 text-2xl font-bold tracking-tight">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BrainCircuit className="size-6" />
          </div>
          <span>Norv</span>
        </div>
        
        <div className="max-w-md">
          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tighter text-sidebar-primary-foreground">
            Start Your Journey.
          </h1>
          <ul className="space-y-4 text-sidebar-foreground/80">
            {[
              "Join a community of focused IT students",
              "Get AI-powered learning recommendations",
              "Track your skills and progress",
              "Prepare for your tech career",
            ].map((feature, i) => (
              <li key={i} className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-primary" />
                <span className="text-lg">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <p className="text-sm text-sidebar-foreground/50">
          © {new Date().getFullYear()} Norv. All rights reserved.
        </p>
      </div>

      {/* Form Panel */}
      <div className="flex w-full flex-col items-center justify-center bg-background p-6 lg:w-1/2">
        <div className="w-full max-w-md space-y-8">
          <div className="flex items-center gap-3 text-2xl font-bold tracking-tight lg:hidden mb-8">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BrainCircuit className="size-6" />
            </div>
            <span>Norv</span>
          </div>

          <Card className="border-border/50 shadow-lg shadow-black/5">
            <CardHeader className="space-y-2 text-center">
              <CardTitle className="text-3xl font-bold tracking-tight">Create Account</CardTitle>
              <CardDescription>
                Sign up to start learning smarter.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="governorate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2"><MapPin className="size-4 text-primary" />Governorate</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select governorate" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {JORDAN_GOVERNORATES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="university"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2"><University className="size-4 text-primary" />University</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select university" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {JORDANIAN_UNIVERSITIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="johndoe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full h-11 text-base font-semibold group"
                    disabled={registerMutation.isPending}
                  >
                    {registerMutation.isPending ? (
                      <Loader2 className="mr-2 size-5 animate-spin" />
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="ms-2 size-5 transition-transform rtl:rotate-180 group-hover:translate-x-1" />
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 text-center text-sm">
              <div className="text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="font-semibold text-primary hover:underline">
                  Sign in
                </Link>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
