import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { LoginPage } from "./components/LoginPage";
import { AuthProvider, useAuth } from "./lib/auth";
import { AnalyticsPage } from "./pages/Analytics";
import { ChannelsPage } from "./pages/Channels";
import { GeneratePage } from "./pages/Generate";
import { MonetizationPage } from "./pages/Monetization";
import { OverviewPage } from "./pages/Overview";
import { ReviewPage } from "./pages/Review";
import { SetupPage } from "./pages/Setup";
import { VideoReviewPage } from "./pages/VideoReview";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <OverviewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/setup"
        element={
          <ProtectedRoute>
            <SetupPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/review/:videoId"
        element={
          <ProtectedRoute>
            <VideoReviewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/review"
        element={
          <ProtectedRoute>
            <ReviewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/generate"
        element={
          <ProtectedRoute>
            <GeneratePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/channels"
        element={
          <ProtectedRoute>
            <ChannelsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/monetization"
        element={
          <ProtectedRoute>
            <MonetizationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <AnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
