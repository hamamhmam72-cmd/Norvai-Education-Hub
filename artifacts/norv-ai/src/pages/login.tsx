import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BrainCircuit, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { useLogin } from "@workspace/api-client-react";
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

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(
      { data },
      {
        onSuccess: (res) => {
          login(res.token, res.user);
          toast({ title: "Welcome back!", description: "Successfully logged in." });
          if (!res.user.setupComplete) {
            setLocation("/setup");
          } else {
            setLocation("/dashboard");
          }
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Login Failed",
            description: err.message || "Invalid username or password.",
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
          <span>Norv_ai</span>
        </div>
        
        <div className="max-w-md">
          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tighter text-sidebar-primary-foreground">
            Your Personal IT Study Partner.
          </h1>
          <ul className="space-y-4 text-sidebar-foreground/80">
            {[
              "Smart AI Chatbot trained on your curriculum",
              "Instant code debugging & analysis",
              "Auto-generated quizzes to test knowledge",
              "Personalized career and learning paths",
            ].map((feature, i) => (
              <li key={i} className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-primary" />
                <span className="text-lg">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <p className="text-sm text-sidebar-foreground/50">
          © {new Date().getFullYear()} Norv_ai. All rights reserved.
        </p>
      </div>

      {/* Form Panel */}
      <div className="flex w-full flex-col items-center justify-center bg-background p-6 lg:w-1/2">
        <div className="w-full max-w-md space-y-8">
          <div className="flex items-center gap-3 text-2xl font-bold tracking-tight lg:hidden mb-8">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BrainCircuit className="size-6" />
            </div>
            <span>Norv_ai</span>
          </div>

          <Card className="border-border/50 shadow-lg shadow-black/5">
            <CardHeader className="space-y-2 text-center">
              <CardTitle className="text-3xl font-bold tracking-tight">Sign In</CardTitle>
              <CardDescription>
                Enter your username and password to access your dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your username" {...field} />
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
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? (
                      <Loader2 className="mr-2 size-5 animate-spin" />
                    ) : (
                      <>
                        Sign In
                        <ArrowRight className="ml-2 size-5 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 text-center text-sm">
              <div className="text-muted-foreground">
                Don't have an account?{" "}
                <Link href="/register" className="font-semibold text-primary hover:underline">
                  Create one
                </Link>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
