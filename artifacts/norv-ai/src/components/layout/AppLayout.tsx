import { Link, useLocation, Redirect } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useLang } from "@/context/LanguageContext";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Video,
  MessageSquare,
  FileText,
  Terminal,
  BrainCircuit,
  Compass,
  UserCircle,
  CreditCard,
  Layers3,
  MessageSquareHeart,
  LogOut,
  Shield,
  Loader2,
  Sun,
  Moon,
  Languages,
  BookMarked,
} from "lucide-react";
import { ReactNode } from "react";
import { useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { AccessCountdown } from "@/components/AccessCountdown";

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t, isRTL } = useLang();
  const [location] = useLocation();
  const logoutMutation = useLogout();

  const mainNavItems = [
    { titleKey: "dashboard" as const, url: "/dashboard", icon: LayoutDashboard },
    { titleKey: "lectures" as const, url: "/lectures", icon: Video },
    { titleKey: "aiChatbot" as const, url: "/chat", icon: MessageSquare },
    { titleKey: "smartSummary" as const, url: "/summary", icon: FileText },
    { titleKey: "codeDebugger" as const, url: "/debug", icon: Terminal },
    { titleKey: "quizGenerator" as const, url: "/quiz", icon: BrainCircuit },
    { titleKey: "careerAdvisor" as const, url: "/career", icon: Compass },
    { titleKey: "studyHub" as const, url: "/study-hub", icon: Layers3 },
    { titleKey: "memorizationPlan" as const, url: "/memorization", icon: BookMarked },
  ];

  const secondaryNavItems = [
    { titleKey: "profile" as const, url: "/profile", icon: UserCircle },
    { titleKey: "subscription" as const, url: "/subscription", icon: CreditCard },
    { titleKey: "feedback" as const, url: "/feedback", icon: MessageSquareHeart },
  ];

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => logout(),
      onError: () => logout(),
    });
  };

  const isPublicRoute = ["/login", "/register"].includes(location);
  const isSetupRoute = location === "/setup";

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && !isPublicRoute) return <Redirect to="/login" replace />;
  if (user && !user.setupComplete && !isSetupRoute) return <Redirect to="/setup" replace />;
  if (user && user.setupComplete && (isPublicRoute || isSetupRoute)) return <Redirect to="/dashboard" replace />;

  if (isPublicRoute || isSetupRoute) {
    return (
      <main className="min-h-screen bg-background">
        {/* Theme/Lang toggles on public pages */}
        <div className="absolute top-4 end-4 flex gap-2 z-50">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full h-9 w-9"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleLang}
            className="rounded-full h-9 w-9 font-bold text-xs"
            title="Toggle Arabic / English"
          >
            {lang === "en" ? "AR" : "EN"}
          </Button>
        </div>
        {children}
      </main>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar variant="inset" side={isRTL ? "right" : "left"} className="border-e border-sidebar-border/50">
        <SidebarHeader className="flex h-16 items-center justify-center border-b border-sidebar-border px-6">
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-primary-foreground">
              <BrainCircuit className="size-5" />
            </div>
            <span className="text-sidebar-foreground">Norv</span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{t("learningTools")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainNavItems.map((item) => (
                  <SidebarMenuItem key={item.titleKey}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url || location.startsWith(item.url + "/")}
                      tooltip={t(item.titleKey)}
                    >
                      <Link href={item.url} className="flex items-center gap-2">
                        <item.icon className="size-4" />
                        <span>{t(item.titleKey)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>{t("settings")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {secondaryNavItems.map((item) => (
                  <SidebarMenuItem key={item.titleKey}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      tooltip={t(item.titleKey)}
                    >
                      <Link href={item.url} className="flex items-center gap-2">
                        <item.icon className="size-4" />
                        <span>{t(item.titleKey)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}

                {user?.role === "admin" && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location.startsWith("/admin")}
                      tooltip={t("adminPanel")}
                    >
                      <Link href="/admin" className="flex items-center gap-2">
                        <Shield className="size-4 text-primary" />
                        <span className="text-primary font-medium">{t("adminPanel")}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-4">
          <AccessCountdown />
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted font-bold text-muted-foreground uppercase">
              {user?.fullName?.charAt(0) || "U"}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="truncate text-sm font-medium text-sidebar-foreground">{user?.fullName}</span>
              <span className="truncate text-xs text-sidebar-foreground/70">{user?.specialization || user?.role}</span>
            </div>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleLogout}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="size-4" />
                <span>{t("logout")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="flex flex-col flex-1 min-w-0 bg-background">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border/40 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger className="-ms-1" />
          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLang}
              className="h-8 gap-1.5 rounded-full px-3 text-xs font-semibold"
              title="Toggle Arabic / English"
            >
              <Languages className="size-3.5" />
              {lang === "en" ? "العربية" : "English"}
            </Button>
            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8 rounded-full"
              title={theme === "dark" ? "Switch to light" : "Switch to dark"}
            >
              {theme === "dark"
                ? <Sun className="size-4 text-yellow-400" />
                : <Moon className="size-4" />
              }
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 bg-muted/20">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
