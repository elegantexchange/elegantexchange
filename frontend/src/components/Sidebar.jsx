import { NavLink, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { LOGO_URL, STORE } from "@/lib/brand";
import { NAV_ITEMS } from "@/constants/nav";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const items = NAV_ITEMS.filter((i) => !i.ownerOnly || user?.role === "owner");

  return (
    <aside
      data-testid="sidebar"
      className="hidden md:flex flex-col w-[260px] shrink-0 border-r border-[var(--ee-border)] bg-white h-screen sticky top-0 overflow-y-auto"
    >
      <div className="px-5 pt-6 pb-4 bg-transparent">
        <img
          src={LOGO_URL}
          alt={STORE.name}
          className="w-full max-w-[220px] h-24 mx-auto object-cover object-center bg-transparent"
        />
      </div>
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {items.map(({ to, label, icon: Icon, testid }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            data-testid={testid}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm rounded-r-md border-l-[3px] transition-colors ${
                isActive
                  ? "border-[var(--ee-magenta)] text-[var(--ee-magenta)] bg-[var(--ee-magenta-soft)] font-semibold"
                  : "border-transparent text-neutral-700 hover:text-[var(--ee-magenta)] hover:bg-[var(--ee-magenta-soft)]/40"
              }`
            }
          >
            <Icon size={16} strokeWidth={1.8} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-[var(--ee-border)] p-4">
        <button
          data-testid="logout-btn"
          onClick={async () => {
            await logout();
            nav("/login");
          }}
          className="w-full text-[11px] font-semibold uppercase tracking-[0.08em] border border-[var(--ee-border)] rounded px-3 py-2 hover:bg-neutral-50 inline-flex items-center justify-center gap-2"
        >
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </aside>
  );
}
