import { Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import useAuth from "./hooks/useAuth";
import AppLayout from "./layouts/AppLayout";
import Login from "./pages/Auth/Login";
import LogoLoadingScreen from "./components/Layout/Feedback/LogoLoadingScreen";

// Guarded: auth must finish before protected routes render, so the app does not flash business pages.
const AppLoadingScreen = () => <LogoLoadingScreen />;

const AppContent = () => {
  const { authLoading, isAccessReady } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return <AppLoadingScreen />;
  }

  if (!isAccessReady) {
    return <Login />;
  }

  if (location.pathname === "/login") {
    return <Navigate to="/dashboard" replace />;
  }

  return <AppLayout />;
};

const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
