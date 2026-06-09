import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Package,
  Receipt,
  Wallet,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { LOGO_URL, STORE } from "@/lib/brand";

const ITEMS = [
  { to: "/", label: "Home", icon: LayoutDashboard, testid: "nav-home" },
  { to: "/consignors", label: "Consignors", icon: Users, testid: "nav-consignors" },
  { to: "/inventory", label: "Inventory", icon: Package, testid: "nav-inventory" },
  { to: "/sales", label: "Sales", icon: Receipt, testid: "nav-sales" },
  { to: "/payouts", label: "Payouts", icon: Wallet, testid: "nav-payouts", ownerOnly: true },
  { to: "/analytics", label: "Analytics", icon: BarChart3, testid: "nav-analytics", ownerOnly: true },
  { to: "/settings", label: "Settings", icon: SettingsIcon, testid: "nav-settings", ownerOnly: true },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const items = ITEMS.filter((i) => !i.ownerOnly || user?.role === "owner");

  return (
    <aside
      data-testid="sidebar"
      className="hidden md:flex flex-col w-[260px] shrink-0 border-r border-[var(--ee-border)] bg-white"
    >
      <div className="px-6 pt-7 pb-5">
        <img
          src={LOGO_URL}
          alt={STORE.name}
          className="w-full max-w-[180px] mx-auto"
        />
        <div className="text-center text-[10px] tracking-[0.18em] uppercase text-neutral-500 mt-1">
          Back of Haus
        </div>
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
        <div className="text-[11px] text-neutral-500 uppercase tracking-wider">
          Signed in as
        </div>
        <div data-testid="user-name" className="text-sm font-semibold mt-0.5">
          {user?.name}
        </div>
        <div className="text-xs text-neutral-500">{user?.email}</div>
        <div className="text-[10px] tracking-[0.18em] uppercase text-[var(--ee-magenta)] mt-1 font-semibold">
          {user?.role}
        </div>
        <button
          data-testid="logout-btn"
          onClick={async () => {
            await logout();
            nav("/login");
          }}
          className="mt-3 w-full text-[11px] font-semibold uppercase tracking-[0.08em] border border-[var(--ee-border)] rounded px-3 py-2 hover:bg-neutral-50 inline-flex items-center justify-center gap-2"
        >
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </aside>
  );
}
