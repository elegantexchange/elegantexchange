import { Outlet, Navigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import MobileTabBar from "@/components/MobileTabBar";
import { useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";

export default function Layout() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-500 text-sm">
        Loading…
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="min-h-screen flex w-full">
      <Sidebar />
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <Outlet />
      </main>
      <MobileTabBar />
      <Toaster position="top-right" />
    </div>
  );
}
