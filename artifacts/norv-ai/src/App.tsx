import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';

// Pages
import NotFound from '@/pages/not-found';
import Login from '@/pages/login';
import Register from '@/pages/register';
import Setup from '@/pages/setup';
import Dashboard from '@/pages/dashboard';
import Lectures from '@/pages/lectures';
import Chat from '@/pages/chat';
import SmartSummary from '@/pages/summary';
import CodeDebugger from '@/pages/debug';
import QuizGenerator from '@/pages/quiz';
import CareerAdvisor from '@/pages/career';
import Profile from '@/pages/profile';
import Subscription from '@/pages/subscription';
import AdminPanel from '@/pages/admin';

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={() => null} />
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/setup" component={Setup} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/lectures" component={Lectures} />
          <Route path="/chat" component={Chat} />
          <Route path="/summary" component={SmartSummary} />
          <Route path="/debug" component={CodeDebugger} />
          <Route path="/quiz" component={QuizGenerator} />
          <Route path="/career" component={CareerAdvisor} />
          <Route path="/profile" component={Profile} />
          <Route path="/subscription" component={Subscription} />
          <Route path="/admin" component={AdminPanel} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </AppLayout>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <AuthProvider>
                <Router />
              </AuthProvider>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
