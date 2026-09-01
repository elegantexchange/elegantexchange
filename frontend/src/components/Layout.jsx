import { useCallback, useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { PanelLeft } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { useAuth } from "@/context/AuthContext";
import { ShellProvider, useShell } from "@/context/ShellContext";
import { TourProvider } from "@/context/TourContext";
import { Toaster } from "@/components/ui/sonner";
import { needsOnboarding } from "@/lib/auth";
import ProductTour from "@/components/ProductTour";
import WelcomeSplash from "@/components/WelcomeSplash";
import OperatorRollCall from "@/components/OperatorRollCall";
import {
  needsOperatorPick,
  readOperator,
  writeOperator,
} from "@/lib/operator";

function ShellChrome() {
  const { sidebarOpen, setSidebarOpen } = useShell();

  return (
    <div className="min-h-screen flex w-full min-w-0 overflow-x-clip bg-[var(--ee-panel)] md:gap-0.5 md:p-0.5 md:bg-[var(--ee-bg)]">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col min-h-screen md:min-h-[calc(100vh-0.25rem)] relative overflow-x-clip">
        {!sidebarOpen && (
          <button
            type="button"
            data-testid="sidebar-expand-btn"
            onClick={() => setSidebarOpen(true)}
            className="hidden md:inline-flex absolute top-3 left-3 z-20 p-1.5 rounded-md text-neutral-500 hover:bg-black/[0.04] hover:text-[var(--ee-ink)] transition-colors"
            aria-label="Show sidebar"
            title="Show sidebar"
          >
            <PanelLeft size={16} strokeWidth={1.75} />
          </button>
        )}

        <MobileNav />
        <main className="flex-1 min-w-0">
          <div className="bg-[var(--ee-panel)] min-h-screen md:min-h-[calc(100vh-0.25rem)] md:rounded-[11px] md:border md:border-[var(--ee-sidebar-border)] md:overflow-hidden min-w-0 overflow-x-clip">
            <Outlet />
          </div>
        </main>
      </div>
      <ProductTour />
      <Toaster position="top-right" />
    </div>
  );
}

export default function Layout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [greeted, setGreeted] = useState(false);
  const [operator, setOperator] = useState(() => readOperator());
  const finishGreeting = useCallback(() => setGreeted(true), []);
  const onOperatorSelect = useCallback((person) => {
    writeOperator(person);
    setOperator(person);
  }, []);

  if (!loading && !user) return <Navigate to="/login" replace />;
  if (user && needsOnboarding(user) && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // Auth still resolving — logo hold only
  if (loading && !user) {
    return <WelcomeSplash user={null} authLoading onDone={() => {}} />;
  }
  if (!user) return null;

  // shop@: presence pick only after sign-in, before thank-you splash
  if (needsOperatorPick(user) && !operator) {
    return <OperatorRollCall onSelect={onOperatorSelect} />;
  }

  if (!greeted && !needsOnboarding(user)) {
    const splashUser =
      needsOperatorPick(user) && operator
        ? { ...user, name: operator.name }
        : user;
    return (
      <WelcomeSplash
        user={splashUser}
        authLoading={false}
        onDone={finishGreeting}
      />
    );
  }

  return (
    <ShellProvider>
      <TourProvider>
        <ShellChrome />
      </TourProvider>
    </ShellProvider>
  );
}
