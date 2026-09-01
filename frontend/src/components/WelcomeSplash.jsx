import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LOGO_URL, STORE } from "@/lib/brand";

const ease = [0.22, 1, 0.36, 1];

function firstName(name) {
  const part = (name || "").trim().split(/\s+/)[0];
  return part || "there";
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function InkLine({ drawing }) {
  return (
    <div className="w-40 h-px bg-neutral-200 relative overflow-hidden">
      <motion.div
        className="absolute inset-y-0 left-0 bg-[var(--ee-magenta)]"
        initial={{ width: "0%" }}
        animate={
          drawing
            ? { width: ["0%", "100%", "100%"] }
            : { width: "100%" }
        }
        transition={
          drawing
            ? { duration: 1.45, ease: "easeInOut", times: [0, 0.88, 1] }
            : { duration: 0.25 }
        }
      />
    </div>
  );
}

/**
 * Logo hold: ink line under the mark while auth loads, then greeting
 * settles underneath with the logo still in place.
 */
export default function WelcomeSplash({ user, authLoading = false, onDone }) {
  const ready = !authLoading && !!user;
  const [phase, setPhase] = useState(ready ? "greeting" : "loading");
  const name = firstName(user?.name);
  const hello = timeGreeting();

  useEffect(() => {
    setPhase(ready ? "greeting" : "loading");
  }, [ready]);

  useEffect(() => {
    if (phase !== "greeting") return undefined;
    const t = window.setTimeout(() => onDone?.(), 2400);
    return () => window.clearTimeout(t);
  }, [phase, onDone]);

  return (
    <button
      type="button"
      data-testid="welcome-splash"
      onClick={() => {
        if (phase === "greeting") onDone?.();
      }}
      className="min-h-screen w-full flex flex-col items-center justify-center px-6 bg-[var(--ee-panel)] cursor-default"
      aria-label={
        phase === "loading" ? "Loading" : `${hello}, ${name}. Continue.`
      }
    >
      <img
        src={LOGO_URL}
        alt={STORE.name}
        className="w-48 h-[68px] object-cover object-center mb-6"
      />
      <InkLine drawing={phase === "loading"} />
      <div className="mt-8 min-h-[120px] flex items-start justify-center">
        <AnimatePresence mode="wait">
          {phase === "loading" ? (
            <motion.p
              key="load"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="text-[10px] tracking-[0.22em] uppercase font-semibold text-neutral-400"
            >
              Preparing workspace
            </motion.p>
          ) : (
            <motion.div
              key="greet"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease }}
              className="flex flex-col items-center text-center"
            >
              <h1 className="ee-page-title text-3xl sm:text-4xl">
                {hello}, {name}
              </h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.5 }}
                className="text-sm text-neutral-500 mt-3 font-light"
              >
                Thank you for being here
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </button>
  );
}
