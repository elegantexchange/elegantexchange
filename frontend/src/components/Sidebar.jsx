import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Compass, LogOut, PanelLeftClose } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useShell } from "@/context/ShellContext";
import { useTour } from "@/context/TourContext";
import { STORE } from "@/lib/brand";
import { NAV_SECTIONS } from "@/constants/nav";
import { hasRole, roleOf } from "@/lib/auth";
import RolePreviewMenu from "@/components/RolePreviewMenu";
import { needsOperatorPick, readOperator } from "@/lib/operator";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { sidebarOpen, setSidebarOpen } = useShell();
  const { startTour } = useTour();
  const nav = useNavigate();
  const operator = needsOperatorPick(user) ? readOperator() : null;

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((i) => !i.roles || hasRole(user, ...i.roles)),
  })).filter((section) => section.items.length > 0);

  if (!sidebarOpen) return null;

  return (
    <aside
      data-testid="sidebar"
      className="hidden md:flex flex-col w-[200px] lg:w-[244px] shrink-0 h-[calc(100vh-0.25rem)] sticky top-0.5 overflow-hidden bg-[var(--ee-panel)] rounded-[11px] border border-[var(--ee-sidebar-border)]"
    >
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <button
          type="button"
          data-testid="sidebar-guide-btn"
          onClick={() => startTour(roleOf(user))}
          className="shrink-0 p-1.5 rounded-md text-neutral-500 hover:bg-[var(--ee-sidebar-hover)] hover:text-[var(--ee-ink)] transition-colors"
          aria-label="Guide"
          title="Guide"
        >
          <Compass size={15} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          data-testid="sidebar-collapse-btn"
          onClick={() => setSidebarOpen(false)}
          className="shrink-0 p-1.5 rounded-md text-neutral-500 hover:bg-[var(--ee-sidebar-hover)] hover:text-[var(--ee-ink)] transition-colors"
          aria-label="Hide sidebar"
          title="Hide sidebar"
        >
          <PanelLeftClose size={15} strokeWidth={1.75} />
        </button>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto px-2 pb-3 pt-0">
        <div>
          {sections.map((section, i) => (
            <div
              key={section.id}
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
                  <div className="text-[10px] tracking-[0.16em] uppercase font-semibold text-neutral-400 shrink-0 select-none">
                    {section.label}
                  </div>
                  <div className="h-px flex-1 bg-[var(--ee-sidebar-border)]" />
                </div>
              ) : null}
              <div className="space-y-0.5">
                {section.items.map(({ to, label, icon: Icon, testid }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === "/"}
                    data-testid={testid}
                    className={({ isActive }) =>
                      `group flex items-center gap-2.5 px-2.5 py-[7px] text-[13.5px] rounded-[6px] transition-colors duration-100 ${
                        isActive
                          ? "bg-[var(--ee-sidebar-active)] text-[var(--ee-ink)] font-medium"
                          : "text-neutral-600 hover:bg-[var(--ee-sidebar-hover)] hover:text-[var(--ee-ink)]"
                      }`
                    }
                  >
                    <Icon
                      size={16}
                      strokeWidth={1.7}
                      className="shrink-0 text-neutral-500 group-hover:text-neutral-700"
                    />
                    <span className="truncate">{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className="px-2 pb-3 pt-1 border-t border-[var(--ee-sidebar-border)] space-y-0.5">
        <div className="min-w-0 px-2.5 py-[7px] rounded-[6px]">
          <div className="text-[13px] font-semibold text-[var(--ee-ink)] truncate leading-[1.25]">
            {STORE.name}
          </div>
          <div className="text-[11px] text-neutral-500 truncate leading-[1.25] mt-0.5">
            {operator?.name || user?.name || "Boutique"}
          </div>
          <RolePreviewMenu />
        </div>
        <button
          data-testid="logout-btn"
          onClick={async () => {
            await logout();
            nav("/login");
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-[7px] text-[13.5px] rounded-[6px] text-neutral-600 hover:bg-[var(--ee-sidebar-hover)] hover:text-[var(--ee-ink)] transition-colors"
        >
          <LogOut size={16} strokeWidth={1.7} className="shrink-0 text-neutral-500" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
