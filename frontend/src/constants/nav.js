import {
  LayoutDashboard,
  Users,
  Package,
  Receipt,
  Wallet,
  BarChart3,
  Settings as SettingsIcon,
} from "lucide-react";

export const NAV_SECTIONS = [
  {
    id: "floor",
    label: "Floor",
    items: [
      { to: "/", label: "Home", icon: LayoutDashboard, testid: "nav-home" },
      { to: "/inventory", label: "Inventory", icon: Package, testid: "nav-inventory" },
      { to: "/sales", label: "Sales", icon: Receipt, testid: "nav-sales" },
    ],
  },
  {
    id: "accounts",
    label: "Accounts",
    items: [
      { to: "/consignors", label: "Consignors", icon: Users, testid: "nav-consignors" },
      {
        to: "/payouts",
        label: "Payouts",
        icon: Wallet,
        testid: "nav-payouts",
        roles: ["admin"],
      },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    items: [
      {
        to: "/analytics",
        label: "Analytics",
        icon: BarChart3,
        testid: "nav-analytics",
        roles: ["admin", "manager"],
      },
    ],
  },
  {
    id: "settings",
    label: null,
    items: [
      {
        to: "/settings",
        label: "Settings",
        icon: SettingsIcon,
        testid: "nav-settings",
      },
    ],
  },
];

export const NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);
