import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Compass, Menu, LogOut, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTour } from "@/context/TourContext";
import { LOGO_URL, STORE } from "@/lib/brand";
import { NAV_SECTIONS } from "@/constants/nav";
import { hasRole, roleOf } from "@/lib/auth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const { startTour } = useTour();
  const nav = useNavigate();

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((i) => !i.roles || hasRole(user, ...i.roles)),
  })).filter((section) => section.items.length > 0);

  return (
    <>
      <header
        data-testid="mobile-header"
        className="md:hidden sticky top-0 z-20 flex items-center justify-between gap-3 px-3 py-2.5 bg-[var(--ee-sidebar)] border-b border-[var(--ee-sidebar-border)]"
      >
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={LOGO_URL}
            alt=""
            className="w-3.5 h-3.5 rounded-[3px] object-cover shrink-0 self-center"
          />
          <span className="text-[13px] font-semibold text-[var(--ee-ink)] truncate leading-none">
            {STORE.name}
          </span>
        </div>
        <button
          type="button"
          data-testid="mobile-menu-btn"
          onClick={() => setOpen(true)}
          className="shrink-0 p-2 -mr-1 rounded-md hover:bg-[var(--ee-sidebar-hover)] text-neutral-600"
          aria-label="Open menu"
        >
          <Menu size={20} strokeWidth={1.75} />
        </button>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-[280px] p-0 flex flex-col bg-[var(--ee-sidebar)] border-[var(--ee-sidebar-border)] [&>button]:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>

          <div className="flex items-center justify-between px-3 pt-3 pb-1">
            <button
              type="button"
              data-testid="mobile-guide-btn"
              onClick={() => {
                setOpen(false);
                startTour(roleOf(user));
              }}
              className="p-1.5 rounded-md text-neutral-500 hover:bg-[var(--ee-sidebar-hover)]"
              aria-label="Guide"
              title="Guide"
            >
              <Compass size={16} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-md text-neutral-500 hover:bg-[var(--ee-sidebar-hover)]"
              aria-label="Close menu"
            >
              <X size={16} />
            </button>
          </div>

          <nav className="flex-1 min-h-0 overflow-y-auto px-2 pb-3">
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
                      <div className="text-[10px] tracking-[0.16em] uppercase font-semibold text-neutral-400 shrink-0">
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
                        onClick={() => setOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-2.5 py-2 text-[14px] rounded-[6px] transition-colors ${
                            isActive
                              ? "bg-[var(--ee-sidebar-active)] text-[var(--ee-ink)] font-medium"
                              : "text-neutral-600 hover:bg-[var(--ee-sidebar-hover)] hover:text-[var(--ee-ink)]"
                          }`
                        }
                      >
                        <Icon size={17} strokeWidth={1.7} className="text-neutral-500" />
                        <span>{label}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </nav>

          <div className="px-2 pb-3 pt-1 border-t border-[var(--ee-sidebar-border)] space-y-0.5">
            <div className="min-w-0 px-2.5 py-2 rounded-[6px]">
              <div className="text-[13px] font-semibold truncate leading-[1.25]">
                {STORE.name}
              </div>
              <div className="text-[11px] text-neutral-500 truncate leading-[1.25] mt-0.5">
                {user?.name || "Boutique"}
              </div>
            </div>
            <button
              data-testid="mobile-logout-btn"
              onClick={async () => {
                setOpen(false);
                await logout();
                nav("/login");
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-[14px] rounded-[6px] text-neutral-600 hover:bg-[var(--ee-sidebar-hover)] hover:text-[var(--ee-ink)]"
            >
              <LogOut size={17} strokeWidth={1.7} className="text-neutral-500" />
              Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
