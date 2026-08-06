import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Store, UserRound, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  ChapterBody,
  SETTINGS_CHAPTERS,
  chaptersForUser,
} from "@/components/settings/SettingsPanels";
import { ROLE_LABELS, roleOf } from "@/lib/auth";
import { toast } from "sonner";

const ease = [0.22, 1, 0.36, 1];
const panel =
  "rounded-[11px] border border-[var(--ee-sidebar-border)] bg-[var(--ee-panel)]";

const ICONS = {
  account: UserRound,
  shop: Store,
  team: Users,
};

export default function Settings() {
  const { user } = useAuth();
  const chapters = useMemo(() => chaptersForUser(user), [user]);
  const [open, setOpen] = useState({ account: true, shop: false, team: false });
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    const flag = params.get("square");
    if (flag === "connected") {
      toast.success("Square connected");
      setOpen((o) => ({ ...o, shop: true }));
    } else if (flag === "error") toast.error("Square OAuth failed");
    else if (flag === "invalid_state") toast.error("Square OAuth state mismatch");
    else if (flag === "token_error") toast.error("Square token exchange failed");
    if (flag) {
      params.delete("square");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-6xl mx-auto">
      <h1 data-testid="settings-title" className="sr-only">
        Settings
      </h1>
      <div className={`overflow-hidden ${panel}`} data-testid="settings-identity-cascade">
        <div className="relative px-5 md:px-8 py-6 border-b border-[var(--ee-sidebar-border)] overflow-hidden">
          <div
            className="absolute inset-0 opacity-90"
            style={{
              background:
                "linear-gradient(135deg, #f7eef4 0%, #fcfcfc 45%, #f3f6f4 100%)",
            }}
          />
          <div className="relative">
            <div className="text-[10px] tracking-[0.22em] uppercase font-semibold text-neutral-500">
              Signed in
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                {user?.name || "Account"}
              </h2>
              <span className="mb-0.5 text-[10px] tracking-[0.16em] uppercase font-semibold px-2 py-1 rounded-[6px] bg-white/80 border border-[var(--ee-sidebar-border)] text-[var(--ee-magenta)]">
                {ROLE_LABELS[roleOf(user)] || roleOf(user)}
              </span>
            </div>
            <p className="text-sm text-neutral-600 mt-1">{user?.email}</p>
          </div>
        </div>

        <div>
          {chapters.map((c, i) => {
            const Icon = ICONS[c.id] || UserRound;
            const isOpen = !!open[c.id];
            const meta = SETTINGS_CHAPTERS.find((x) => x.id === c.id);
            return (
              <div
                key={c.id}
                className="border-b last:border-b-0 border-[var(--ee-sidebar-border)]"
                style={{ marginLeft: `${Math.min(i, 2) * 10}px` }}
              >
                <button
                  type="button"
                  data-testid={`settings-chapter-${c.id}`}
                  onClick={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}
                  className="w-full flex items-center justify-between gap-3 px-5 md:px-8 py-4 text-left hover:bg-black/[0.02]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[11px] tabular-nums text-neutral-400 font-semibold w-6">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Icon size={16} className="text-[var(--ee-magenta)] shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold">{meta?.label || c.label}</div>
                      <div className="text-[12px] text-neutral-500 font-light">
                        {meta?.blurb || c.blurb}
                      </div>
                    </div>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-neutral-400 shrink-0 transition-transform duration-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 md:px-8 pb-6 pl-14 md:pl-[4.5rem]">
                        <ChapterBody chapterId={c.id} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
