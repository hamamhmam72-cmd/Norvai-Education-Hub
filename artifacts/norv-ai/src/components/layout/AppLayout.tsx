import { Link, useLocation, Redirect } from "wouter";
import { useAuth } from "@/context/AuthContext";
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
  LogOut,
  Shield,
  Loader2,
} from "lucide-react";
import { ReactNode } from "react";
import { useLogout } from "@workspace/api-client-react";

const mainNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Lectures", url: "/lectures", icon: Video },
  { title: "AI Chatbot", url: "/chat", icon: MessageSquare },
  { title: "Smart Summary", url: "/summary", icon: FileText },
  { title: "Code Debugger", url: "/debug", icon: Terminal },
  { title: "Quiz Generator", url: "/quiz", icon: BrainCircuit },
  { title: "Career Advisor", url: "/career", icon: Compass },
];

const secondaryNavItems = [
  { title: "Profile", url: "/profile", icon: UserCircle },
  { title: "Subscription", url: "/subscription", icon: CreditCard },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const [location] = useLocation();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => logout(),
      onError: () => logout()
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

  // Redirects
  if (!user && !isPublicRoute) {
    return <Redirect to="/login" replace />;
  }

  if (user && !user.setupComplete && !isSetupRoute && !isPublicRoute) {
    return <Redirect to="/setup" replace />;
  }

  if (user && user.setupComplete && isPublicRoute) {
    return <Redirect to="/dashboard" replace />;
  }

  // Admin trying to access student pages? Admin panel is just another page, no strict isolation needed yet except /admin protection which we'll handle in the admin page itself or here.
  // We'll protect /admin in the App Router or here. Let's do it in the Router.

  if (isPublicRoute || isSetupRoute) {
    return <main className="min-h-screen bg-background">{children}</main>;
  }

  return (
    <SidebarProvider>
      <Sidebar variant="inset" className="border-r border-sidebar-border/50">
        <SidebarHeader className="flex h-16 items-center justify-center border-b border-sidebar-border px-6">
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight text-sidebar-primary-foreground">
            <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-primary-foreground">
              <BrainCircuit className="size-5" />
            </div>
            <span className="text-sidebar-foreground">Norv_ai</span>
          </div>
        </SidebarHeader>
        
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Learning Tools</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={location === item.url || location.startsWith(item.url + "/")}
                      tooltip={item.title}
                    >
                      <Link href={item.url} className="flex items-center gap-2">
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Settings</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {secondaryNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={location === item.url}
                      tooltip={item.title}
                    >
                      <Link href={item.url} className="flex items-center gap-2">
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                
                {user?.role === "admin" && (
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      asChild 
                      isActive={location.startsWith("/admin")}
                      tooltip="Admin Panel"
                    >
                      <Link href="/admin" className="flex items-center gap-2">
                        <Shield className="size-4 text-primary" />
                        <span className="text-primary font-medium">Admin Panel</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-4">
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
                <span>Log out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      
      <SidebarInset className="flex flex-col flex-1 min-w-0 bg-background">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border/40 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger className="-ml-1" />
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 bg-muted/20">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
