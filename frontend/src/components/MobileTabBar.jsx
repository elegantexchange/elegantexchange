import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Package,
  Receipt,
  Wallet,
  BarChart3,
  Settings as SettingsIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const ITEMS = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/consignors", label: "Consignors", icon: Users },
  { to: "/inventory", label: "Items", icon: Package },
  { to: "/sales", label: "Sales", icon: Receipt },
  { to: "/payouts", label: "Payouts", icon: Wallet, ownerOnly: true },
  { to: "/analytics", label: "Analytics", icon: BarChart3, ownerOnly: true },
  { to: "/settings", label: "Settings", icon: SettingsIcon, ownerOnly: true },
];

export default function MobileTabBar() {
  const { user } = useAuth();
  const items = ITEMS.filter((i) => !i.ownerOnly || user?.role === "owner");
  return (
    <nav
      data-testid="mobile-tabbar"
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[var(--ee-border)] flex"
    >
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] uppercase tracking-wider ${
              isActive ? "text-[var(--ee-magenta)]" : "text-neutral-500"
            }`
          }
        >
          <Icon size={18} strokeWidth={1.8} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
