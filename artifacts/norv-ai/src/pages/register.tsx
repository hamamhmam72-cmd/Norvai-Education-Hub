import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BrainCircuit, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
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
const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80, "Full name is too long")
    .regex(/^[\p{L}\p{M}][\p{L}\p{M}' -]*[\p{L}\p{M}]$/u, "Use letters, spaces, apostrophes, or hyphens only"),
  username: z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_]{2,29}$/, "Start with a letter; use 3-30 letters, numbers, or underscores"),
  password: z.string().min(8, "Use at least 8 characters").max(72, "Use no more than 72 characters")
    .regex(/[A-Z]/, "Add one uppercase letter")
    .regex(/[a-z]/, "Add one lowercase letter")
    .regex(/[0-9]/, "Add one number")
    .regex(/[^A-Za-z0-9\s]/, "Add one special character")
    .regex(/^\S+$/, "Do not use spaces"),
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
    },
  });

  const onSubmit = (data: RegisterForm) => {
    if (registerMutation.isPending) return;
    registerMutation.mutate(
      { data: { ...data, fullName: data.fullName.trim().replace(/\s+/g, " "), username: data.username.trim() } },
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
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input autoComplete="username" placeholder="johndoe" maxLength={30} {...field} />
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
                            <Input type="password" autoComplete="new-password" placeholder="••••••••" maxLength={72} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Use 8–72 characters with uppercase and lowercase letters, a number, and a special character.
                    </p>
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
