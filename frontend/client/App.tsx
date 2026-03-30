import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LangProvider } from "@/contexts/LangContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/** Redirect unauthenticated users to /login */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) {
    return <LoadingScreen />;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!profile?.profileCompleted) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

/** Redirect authenticated users away from /login */
function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <LoadingScreen />;
  }
  return user ? <Navigate to="/" replace /> : <>{children}</>;
}

function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.profileCompleted) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-background">
      <div className="flex gap-1.5">
        {[0, 0.15, 0.3].map((delay, i) => (
          <div key={i} className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: `${delay}s` }} />
        ))}
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LangProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              <Route path="/login" element={
                <AuthRoute>
                  <Login />
                </AuthRoute>
              } />
              <Route path="/onboarding" element={
                <OnboardingRoute>
                  <Onboarding />
                </OnboardingRoute>
              } />
              <Route path="/" element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LangProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
