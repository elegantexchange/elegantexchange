import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Menu, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { LOGO_URL, STORE } from "@/lib/brand";
import { NAV_ITEMS } from "@/constants/nav";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const items = NAV_ITEMS.filter((i) => !i.ownerOnly || user?.role === "owner");

  return (
    <>
      <header
        data-testid="mobile-header"
        className="md:hidden sticky top-0 z-20 flex items-center justify-end px-4 py-3 bg-white border-b border-[var(--ee-border)]"
      >
        <button
          type="button"
          data-testid="mobile-menu-btn"
          onClick={() => setOpen(true)}
          className="shrink-0 p-2 -mr-2 rounded-md hover:bg-neutral-50 text-neutral-700"
          aria-label="Open menu"
        >
          <Menu size={22} strokeWidth={1.8} />
        </button>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-[280px] p-0 flex flex-col border-[var(--ee-border)]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>

          <nav className="flex-1 min-h-0 flex flex-col px-5 pt-6 pb-0">
            <div className="space-y-0.5 overflow-y-auto flex-1 min-h-0">
              {items.map(({ to, label, icon: Icon, testid }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  data-testid={testid}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 text-sm rounded-l-md border-r-[3px] transition-colors ${
                      isActive
                        ? "border-[var(--ee-magenta)] text-[var(--ee-magenta)] bg-[var(--ee-magenta-soft)] font-semibold"
                        : "border-transparent text-neutral-700 hover:text-[var(--ee-magenta)] hover:bg-[var(--ee-magenta-soft)]/40"
                    }`
                  }
                >
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
            <div className="pt-6 pb-2 flex justify-center shrink-0">
              <img
                src={LOGO_URL}
                alt={STORE.name}
                className="w-full max-w-[200px] h-20 object-cover object-center"
              />
            </div>
          </nav>

          <div className="border-t border-[var(--ee-border)] p-4">
            <button
              data-testid="mobile-logout-btn"
              onClick={async () => {
                setOpen(false);
                await logout();
                nav("/login");
              }}
              className="w-full text-[11px] font-semibold uppercase tracking-[0.08em] border border-[var(--ee-border)] rounded px-3 py-2.5 hover:bg-neutral-50 inline-flex items-center justify-center gap-2"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
