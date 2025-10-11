import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Agenda from "./pages/Agenda";
import Clients from "./pages/Clients";
import Projects from "./pages/Projects";
import ClientDetail from "./pages/ClientDetail";
import ClientFinancialDetail from "./pages/ClientFinancialDetail";
import ProjectDetail from "./pages/ProjectDetail";
import Financeiro from "./pages/Financeiro";
import Settings from "./pages/Settings";
import UserProjects from "./pages/UserProjects";
import UnifiedUserManagement from "./pages/UnifiedUserManagement";
import WhatsAppTestPage from "./pages/WhatsAppTest";
import Reports from "./pages/Reports";
import CoordinatorPhases from "./pages/CoordinatorPhases";
import RulesAndFeatures from "./pages/RulesAndFeatures";
import Marketing from "./pages/Marketing";
import PaymentPortal from "./pages/PaymentPortal";

import Login from "./pages/auth/Login";
import AdminLogin from "./pages/auth/AdminLogin";
import Forgot from "./pages/auth/ForgotPassword";
import TwoFA from "./pages/auth/TwoFA";
import NotFound from "./pages/NotFound";
import GoogleDriveCallback from "./pages/GoogleDriveCallback";
import { AuthProvider, ProtectedRoute, AdminRoute } from "./state/auth";
import Signup from "./pages/auth/Signup";
import { ThemeProvider } from "next-themes";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider 
      attribute="class" 
      defaultTheme="light" 
      enableSystem={false} 
      themes={["light","dark"]}
      disableTransitionOnChange={false}
      storageKey="theme-preference"
    >
      <TooltipProvider>
        <Toaster />
        <SonnerToaster />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/admin-login" element={<AdminLogin />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot" element={<Forgot />} />
              <Route path="/2fa" element={<TwoFA />} />
              <Route path="/google-drive-callback" element={<GoogleDriveCallback />} />
              <Route path="/pay/:token" element={<PaymentPortal />} />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="agenda" element={<Agenda />} />
                <Route path="projects" element={<Projects />} />
                <Route path="clients" element={<Clients />} />
                <Route path="chat" element={<Chat />} />
                <Route path="clients/:id" element={<ClientDetail />} />
                <Route path="client-financial/:clientId" element={<AdminRoute><ClientFinancialDetail /></AdminRoute>} />
                <Route path="projects/:id" element={<ProjectDetail />} />
                <Route path="financeiro" element={<AdminRoute><Financeiro /></AdminRoute>} />
                <Route path="user-projects" element={<UserProjects />} />
                <Route path="coordinator-phases" element={<CoordinatorPhases />} />
                <Route path="settings" element={<Settings />} />
                <Route path="reports" element={<Reports />} />
                <Route path="rules-features" element={<RulesAndFeatures />} />
                <Route path="marketing" element={<Marketing />} />
                <Route path="whatsapp-test" element={<WhatsAppTestPage />} />
                <Route path="users" element={<AdminRoute><UnifiedUserManagement /></AdminRoute>} />
                
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
