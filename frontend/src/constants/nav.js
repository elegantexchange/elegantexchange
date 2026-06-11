import {
  LayoutDashboard,
  Users,
  Package,
  Receipt,
  Wallet,
  BarChart3,
  Settings as SettingsIcon,
} from "lucide-react";

export const NAV_ITEMS = [
  { to: "/", label: "Home", icon: LayoutDashboard, testid: "nav-home" },
  { to: "/consignors", label: "Consignors", icon: Users, testid: "nav-consignors" },
  { to: "/inventory", label: "Inventory", icon: Package, testid: "nav-inventory" },
  { to: "/sales", label: "Sales", icon: Receipt, testid: "nav-sales" },
  { to: "/payouts", label: "Payouts", icon: Wallet, testid: "nav-payouts", ownerOnly: true },
  { to: "/analytics", label: "Analytics", icon: BarChart3, testid: "nav-analytics", ownerOnly: true },
  { to: "/settings", label: "Settings", icon: SettingsIcon, testid: "nav-settings", ownerOnly: true },
];
