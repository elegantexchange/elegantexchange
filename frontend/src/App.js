import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@/App.css";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import SidebarLogoVariations from "@/pages/SidebarLogoVariations";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import Consignors from "@/pages/Consignors";
import ConsignorDetail from "@/pages/ConsignorDetail";
import Inventory from "@/pages/Inventory";
import Sales from "@/pages/Sales";
import Payouts from "@/pages/Payouts";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";
import TourPreview from "@/pages/TourPreview";
import TagPrint from "@/pages/TagPrint";
import DropOffClient from "@/pages/DropOffClient";
import DropOffAssess from "@/pages/DropOffAssess";
import DropOffTypeformConcepts from "@/pages/DropOffTypeformConcepts";
import OperatorPickerLab from "@/pages/OperatorPickerLab";
import OperatorScreensPreview from "@/pages/OperatorScreensPreview";
import { hasRole, needsOnboarding } from "@/lib/auth";
import { needsOperatorPick, readOperator } from "@/lib/operator";

function RoleGate({ roles, children }) {
  const { user } = useAuth();
  if (!user) return null;
  if (!hasRole(user, ...roles)) return <Navigate to="/" replace />;
  return children;
}

function OnboardingRoute({ preview = false }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-500 text-sm">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!preview && !needsOnboarding(user)) return <Navigate to="/" replace />;
  return <Onboarding preview={preview} />;
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-500 text-sm">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (needsOnboarding(user)) return <Navigate to="/onboarding" replace />;
  // Presence pick + thank-you splash live in Layout (after sign-in only)
  if (needsOperatorPick(user) && !readOperator()) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/sidebar-logo-concepts"
              element={<SidebarLogoVariations />}
            />
            <Route
              path="/drop-off-concepts"
              element={<DropOffTypeformConcepts />}
            />
            <Route path="/operator-concepts" element={<OperatorPickerLab />} />
            <Route
              path="/operator-screens"
              element={<OperatorScreensPreview />}
            />
            <Route path="/onboarding" element={<OnboardingRoute />} />
            <Route
              path="/onboarding-preview"
              element={<OnboardingRoute preview />}
            />
            <Route path="/print/tags" element={<TagPrint />} />
            {/* Client iPad Typeform — outside staff chrome / welcome splash */}
            <Route
              path="/drop-off"
              element={
                <RequireAuth>
                  <DropOffClient />
                </RequireAuth>
              }
            />
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="/drop-off/:id/assess" element={<DropOffAssess />} />
              <Route path="/consignors" element={<Consignors />} />
              <Route path="/consignors/:id" element={<ConsignorDetail />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/sales" element={<Sales />} />
              <Route
                path="/payouts"
                element={
                  <RoleGate roles={["admin"]}>
                    <Payouts />
                  </RoleGate>
                }
              />
              <Route
                path="/analytics"
                element={
                  <RoleGate roles={["admin", "manager"]}>
                    <Analytics />
                  </RoleGate>
                }
              />
              <Route path="/settings" element={<Settings />} />
              <Route path="/tour-preview" element={<TourPreview />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
