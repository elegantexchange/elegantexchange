import { Outlet, Navigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
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
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileNav />
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
