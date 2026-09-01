import { useState } from "react";
import {
  Compass,
  LayoutDashboard,
  LogOut,
  Package,
  PanelLeftClose,
  Receipt,
  Settings as SettingsIcon,
  Users,
} from "lucide-react";
import { LOGO_URL, STORE } from "@/lib/brand";

const VARIATIONS = [
  {
    id: "crown",
    name: "Crown mark",
    blurb: "Large centered logo; guide and collapse sit on a thin row above.",
  },
  {
    id: "stack",
    name: "Stacked lockup",
    blurb: "Full-width mark with tools tucked top-right — biggest logo of the three.",
  },
  {
    id: "rail",
    name: "Left rail",
    blurb: "Wide logo left-aligned under the tool row for clear reading.",
  },
];

const NAV = [
  {
    label: "Floor",
    items: [
      { label: "Home", icon: LayoutDashboard, active: true },
      { label: "Inventory", icon: Package },
      { label: "Sales", icon: Receipt },
    ],
  },
  {
    label: "Accounts",
    items: [{ label: "Consignors", icon: Users }],
  },
  {
    label: null,
    items: [{ label: "Settings", icon: SettingsIcon }],
  },
];

function NavBody() {
  return (
    <nav className="flex-1 min-h-0 overflow-y-auto px-2 pb-3 pt-0">
      {NAV.map((section, i) => (
        <div
          key={section.label || "settings"}
          className={
            section.label
              ? i === 0
                ? ""
                : "mt-3"
              : "mt-3 pt-3 border-t border-[var(--ee-sidebar-border)]"
          }
        >
          {section.label ? (
            <div className="flex items-center gap-2 px-2 mb-1.5">
              <div className="h-px flex-1 bg-[var(--ee-sidebar-border)]" />
              <div className="text-[10px] tracking-[0.16em] uppercase font-semibold text-neutral-400 shrink-0">
                {section.label}
              </div>
              <div className="h-px flex-1 bg-[var(--ee-sidebar-border)]" />
            </div>
          ) : null}
          <div className="space-y-0.5">
            {section.items.map(({ label, icon: Icon, active }) => (
              <div
                key={label}
                className={`flex items-center gap-2.5 px-2.5 py-[7px] text-[13.5px] rounded-[6px] ${
                  active
                    ? "bg-[var(--ee-sidebar-active)] text-[var(--ee-ink)] font-medium"
                    : "text-neutral-600"
                }`}
              >
                <Icon
                  size={16}
                  strokeWidth={1.7}
                  className="shrink-0 text-neutral-500"
                />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Footer({ showStoreName = true }) {
  return (
    <div className="px-2 pb-3 pt-1 border-t border-[var(--ee-sidebar-border)] space-y-0.5">
      <div className="min-w-0 px-2.5 py-[7px] rounded-[6px]">
        {showStoreName ? (
          <div className="text-[13px] font-semibold text-[var(--ee-ink)] truncate leading-[1.25]">
            {STORE.name}
          </div>
        ) : null}
        <div
          className={`text-[11px] text-neutral-500 truncate leading-[1.25] ${
            showStoreName ? "mt-0.5" : ""
          }`}
        >
          Tai
        </div>
        <div className="text-[10px] tracking-[0.14em] uppercase font-semibold text-neutral-400 mt-0.5">
          Retail
        </div>
      </div>
      <div className="flex items-center gap-2.5 px-2.5 py-[7px] text-[13.5px] text-neutral-600">
        <LogOut size={16} strokeWidth={1.7} className="text-neutral-500" />
        <span>Sign out</span>
      </div>
    </div>
  );
}

function ToolBtn({ children, label }) {
  return (
    <span
      className="shrink-0 p-1.5 rounded-md text-neutral-500"
      aria-label={label}
      title={label}
    >
      {children}
    </span>
  );
}

/** Full-bleed wordmark — contain so type stays sharp */
function BrandLogo({ className = "", align = "center" }) {
  return (
    <img
      src={LOGO_URL}
      alt={STORE.name}
      className={`w-full object-contain ${
        align === "left" ? "object-left" : "object-center"
      } ${className}`}
    />
  );
}

function Shell({ header, showStoreName = true }) {
  return (
    <aside className="flex flex-col w-[260px] shrink-0 h-[580px] overflow-hidden bg-[var(--ee-panel)] rounded-[11px] border border-[var(--ee-sidebar-border)]">
      {header}
      <NavBody />
      <Footer showStoreName={showStoreName} />
    </aside>
  );
}

/** Tools on top row; large logo centered below */
function CrownMark() {
  return (
    <Shell
      header={
        <div className="px-3 pt-2.5 pb-3 border-b border-[var(--ee-sidebar-border)]">
          <div className="flex items-center justify-between">
            <ToolBtn label="Guide">
              <Compass size={15} strokeWidth={1.75} />
            </ToolBtn>
            <ToolBtn label="Hide sidebar">
              <PanelLeftClose size={15} strokeWidth={1.75} />
            </ToolBtn>
          </div>
          <div className="mt-2 px-1">
            <BrandLogo className="h-[52px]" />
          </div>
        </div>
      }
    />
  );
}

/** Largest mark — tools overlay top-right */
function StackedLockup() {
  return (
    <Shell
      showStoreName={false}
      header={
        <div className="relative px-3 pt-2.5 pb-3 border-b border-[var(--ee-sidebar-border)]">
          <div className="absolute top-2 right-2 flex items-center gap-0.5 z-10">
            <ToolBtn label="Guide">
              <Compass size={15} strokeWidth={1.75} />
            </ToolBtn>
            <ToolBtn label="Hide sidebar">
              <PanelLeftClose size={15} strokeWidth={1.75} />
            </ToolBtn>
          </div>
          <div className="pr-14 pt-1">
            <BrandLogo align="left" className="h-[58px]" />
          </div>
          <p className="text-[10px] tracking-[0.14em] uppercase font-semibold text-neutral-400 mt-2 px-0.5">
            Staff workspace
          </p>
        </div>
      }
    />
  );
}

/** Tool row, then wide left-aligned logo */
function LeftRail() {
  return (
    <Shell
      header={
        <div className="px-3 pt-2.5 pb-3 border-b border-[var(--ee-sidebar-border)]">
          <div className="flex items-center justify-end gap-0.5">
            <ToolBtn label="Guide">
              <Compass size={15} strokeWidth={1.75} />
            </ToolBtn>
            <ToolBtn label="Hide sidebar">
              <PanelLeftClose size={15} strokeWidth={1.75} />
            </ToolBtn>
          </div>
          <div className="mt-1.5">
            <BrandLogo align="left" className="h-[48px]" />
          </div>
        </div>
      }
    />
  );
}

export default function SidebarLogoVariations() {
  const [active, setActive] = useState("crown");

  return (
    <div className="min-h-screen bg-[var(--ee-bg)] px-4 sm:px-6 md:px-10 py-8 space-y-5">
      <div>
        <p className="text-[10px] tracking-[0.18em] uppercase font-semibold text-neutral-500">
          Local preview
        </p>
        <h1 className="ee-page-title text-2xl mt-1">Sidebar logo</h1>
        <p className="text-sm text-neutral-500 mt-1 max-w-xl">
          Larger, full-width marks so the wordmark stays readable. Pick one to
          ship.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {VARIATIONS.map((v) => {
          const on = active === v.id;
          return (
            <button
              key={v.id}
              type="button"
              data-testid={`sidebar-logo-${v.id}`}
              onClick={() => setActive(v.id)}
              className={`text-left rounded-[8px] border px-3 py-2 max-w-xs transition-colors ${
                on
                  ? "border-[var(--ee-magenta)] bg-[var(--ee-magenta-soft)]"
                  : "border-[var(--ee-sidebar-border)] bg-[var(--ee-panel)] hover:border-neutral-300"
              }`}
            >
              <div className="text-[13px] font-semibold">{v.name}</div>
              <div className="text-[11px] text-neutral-500 mt-0.5 leading-snug">
                {v.blurb}
              </div>
            </button>
          );
        })}
      </div>

      <div
        data-testid="sidebar-logo-stage"
        className="rounded-[11px] border border-[var(--ee-sidebar-border)] bg-[var(--ee-bg)] p-6 flex justify-center md:justify-start"
      >
        {active === "crown" && <CrownMark />}
        {active === "stack" && <StackedLockup />}
        {active === "rail" && <LeftRail />}
      </div>
    </div>
  );
}
