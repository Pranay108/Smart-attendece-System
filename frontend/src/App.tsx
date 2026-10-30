import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { StudentsPage } from './pages/StudentsPage';
import { SessionsPage } from './pages/SessionsPage';
import { MediaProcessingPage } from './pages/MediaProcessingPage';
import { AttendanceReviewPage } from './pages/AttendanceReviewPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { EngagementPage } from './pages/EngagementPage';
import { AgentPage } from './pages/AgentPage';
import { RefreshCw } from 'lucide-react';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-xs">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-blue-600" />
        <span>Authenticating faculty portal...</span>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  const { token, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-xs">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-blue-600" />
        <span>Authenticating faculty portal...</span>
      </div>
    );
  }
  if (token) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />


          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="sessions" element={<SessionsPage />} />
            <Route path="sessions/:sessionId/attendance" element={<AttendanceReviewPage />} />
            <Route path="media-processing" element={<MediaProcessingPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="engagement" element={<EngagementPage />} />
            <Route path="agent" element={<AgentPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
