import { useEffect, type ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import DashboardPage from '@/pages/DashboardPage';
import ProfilePage from '@/pages/ProfilePage';
import OnboardingPage from '@/pages/OnboardingPage';
import SettingsPage from '@/pages/SettingsPage';
import LandingPage from '@/pages/LandingPage';
import { useAuthStore } from '@/stores/useAuthStore';
import { useThemeStore } from '@/stores/useThemeStore';
import Toaster from '@/components/ui/Toaster';

import ProjectsPage from '@/pages/ProjectsPage';
import DeploymentsPage from '@/pages/DeploymentsPage';
import WorkspacePage from '@/pages/WorkspacePage';
import React from 'react';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: any) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ color: 'white', padding: '2rem', backgroundColor: '#990000', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2>Workspace Crashed</h2>
          <pre>{this.state.error.message}</pre>
          <pre style={{ marginTop: '1rem', whiteSpace: 'pre-wrap' }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const user = useAuthStore((state) => state.user);

  // Wait for Supabase session check to complete before redirecting
  // CRITICAL FIX: If we just returned from OAuth, the URL will have a hash with tokens.
  // We MUST wait for Supabase to parse it, even if isInitializing is briefly false.
  const hasAuthHash = window.location.hash.includes('access_token=') || window.location.hash.includes('error=');

  if (isInitializing || hasAuthHash) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[var(--bg-canvas)]">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to onboarding if not completed (and allow for optional chaining in case user struct is partial)
  if (!user?.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}

function OnboardingRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const user = useAuthStore((state) => state.user);

  const hasAuthHash = window.location.hash.includes('access_token=') || window.location.hash.includes('error=');

  if (isInitializing || hasAuthHash) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[var(--bg-canvas)]">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If already onboarded, go to dashboard
  if (user?.onboardingCompleted) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  const initializeAuth = useAuthStore((state) => state.initialize);

  const { theme } = useThemeStore();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/onboarding"
          element={
            <OnboardingRoute>
              <OnboardingPage />
            </OnboardingRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <ProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/deployments"
          element={
            <ProtectedRoute>
              <DeploymentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace"
          element={<Navigate to="/dashboard" replace />}
        />
        <Route
          path="/workspace/:projectId"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <WorkspacePage />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<LandingPage />} />
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;
