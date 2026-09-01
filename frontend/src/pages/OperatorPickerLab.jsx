import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { STORE } from "@/lib/brand";

const ease = [0.22, 1, 0.36, 1];

export const SHARED_OPERATORS = [
  { id: "youseline", name: "Youseline" },
  { id: "johan", name: "Johan" },
  { id: "noah", name: "Noah" },
  { id: "zachary", name: "Zachary" },
];

const SYSTEMS = [
  {
    id: "rollcall",
    letter: "A",
    name: "Floor roll call",
    blurb:
      "Full-screen Atelier wash. Big name tiles — “Who’s on the floor?” Fastest for a shared desk.",
  },
  {
    id: "ledger",
    letter: "B",
    name: "Ruled ledger",
    blurb:
      "Hairline rules and “On duty” list with a magenta rail. Boutique-ops precision.",
  },
  {
    id: "pin",
    letter: "C",
    name: "Pin + presence",
    blurb:
      "Compact modal over home — initials, light select, optional remember until sign-out.",
  },
];

function initials(name) {
  return (name || "?").slice(0, 1).toUpperCase();
}

export default function OperatorPickerLab() {
  const [active, setActive] = useState("rollcall");
  const [picked, setPicked] = useState(null);
  const [remember, setRemember] = useState(true);
  const system = SYSTEMS.find((s) => s.id === active) || SYSTEMS[0];

  return (
    <div className="min-h-screen bg-[var(--ee-bg)] text-[var(--ee-ink)]">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
        <div className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[var(--ee-magenta)]">
          Concepts · shared shop login
        </div>
        <h1 className="ee-page-title text-3xl sm:text-4xl mt-2">
          Who&apos;s logging in?
        </h1>
        <p className="mt-3 text-[15px] text-neutral-500 font-light max-w-xl leading-relaxed">
          After <code className="text-[13px]">shop@elegantexchange.co</code>{" "}
          signs in, pick who is on the floor so sales and intake stamp the right
          person. Reply with <strong>A</strong>, <strong>B</strong>, or{" "}
          <strong>C</strong> — production currently uses <strong>A</strong>.
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          {SYSTEMS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setActive(s.id);
                setPicked(null);
              }}
              className={`px-4 py-2.5 rounded-[8px] text-[12px] font-semibold tracking-[0.06em] uppercase transition-colors ${
                active === s.id
                  ? "bg-[var(--ee-magenta)] text-white"
                  : "bg-[var(--ee-panel)] border border-[var(--ee-sidebar-border)] text-neutral-600 hover:border-neutral-300"
              }`}
            >
              {s.letter} · {s.name}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[14px] text-neutral-500 font-light max-w-lg">
          {system.blurb}
        </p>

        <div className="mt-8 flex justify-center">
          <PhoneFrame>
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease }}
                className="h-full"
              >
                {active === "rollcall" && (
                  <RollCall picked={picked} onPick={setPicked} />
                )}
                {active === "ledger" && (
                  <Ledger picked={picked} onPick={setPicked} />
                )}
                {active === "pin" && (
                  <PinPresence
                    picked={picked}
                    onPick={setPicked}
                    remember={remember}
                    setRemember={setRemember}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </PhoneFrame>
        </div>

        {picked && (
          <p className="mt-6 text-center text-[13px] text-neutral-500 font-light">
            Selected in preview:{" "}
            <span className="text-[var(--ee-ink)] font-medium">{picked.name}</span>
            {active === "pin" && remember ? " · remembered until sign-out" : ""}
          </p>
        )}
      </div>
    </div>
  );
}

function PhoneFrame({ children }) {
  return (
    <div className="w-full max-w-[400px] aspect-[3/4.2] rounded-[28px] border-[10px] border-neutral-800 bg-neutral-800 shadow-[0_24px_60px_rgba(0,0,0,0.18)] overflow-hidden">
      <div className="h-full rounded-[18px] overflow-hidden bg-[var(--ee-bg)]">
        {children}
      </div>
    </div>
  );
}

function RollCall({ picked, onPick }) {
  return (
    <div
      className="h-full flex flex-col p-5"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 0%, #f5e8f2 0%, #f0f0f0 45%, #ebebeb 100%)",
      }}
    >
      <div className="flex-1 min-h-0 flex flex-col rounded-[16px] bg-[var(--ee-panel)] border border-[var(--ee-sidebar-border)] shadow-[0_8px_30px_rgba(139,31,107,0.06)] overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-[var(--ee-sidebar-border)]/80">
          <div className="text-[9px] tracking-[0.22em] uppercase font-semibold text-[var(--ee-magenta)]">
            {STORE.name}
          </div>
        </div>
        <div className="flex-1 flex flex-col px-5 py-6">
          <h2
            className="text-[1.65rem] leading-[1.15] font-semibold tracking-[-0.025em]"
            style={{ fontFamily: "Montserrat, system-ui, sans-serif" }}
          >
            Who&apos;s on the floor?
          </h2>
          <p className="mt-2 text-[13px] text-neutral-500 font-light">
            So we know who logged this shift&apos;s sales and drop-offs.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 flex-1 content-start">
            {SHARED_OPERATORS.map((p) => {
              const on = picked?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPick(p)}
                  className={`rounded-[12px] border px-3 py-6 text-center transition-colors ${
                    on
                      ? "border-[var(--ee-magenta)] bg-[var(--ee-magenta-soft)] text-[var(--ee-magenta)]"
                      : "border-[var(--ee-sidebar-border)] bg-white hover:border-neutral-300"
                  }`}
                >
                  <div
                    className="text-[1.15rem] font-semibold tracking-[-0.02em]"
                    style={{ fontFamily: "Montserrat, system-ui, sans-serif" }}
                  >
                    {p.name}
                  </div>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!picked}
            className="mt-4 w-full py-3.5 rounded-[10px] bg-[var(--ee-magenta)] text-white text-[14px] font-medium disabled:opacity-40 shadow-[0_6px_16px_rgba(139,31,107,0.22)]"
          >
            Continue as {picked?.name || "…"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Ledger({ picked, onPick }) {
  return (
    <div className="h-full flex flex-col bg-[var(--ee-panel)]">
      <div className="px-6 pt-5 pb-3 border-b border-[var(--ee-sidebar-border)]">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-[var(--ee-sidebar-border)]" />
          <div className="text-[9px] tracking-[0.18em] uppercase font-semibold text-neutral-400">
            Floor
          </div>
          <div className="h-px flex-1 bg-[var(--ee-sidebar-border)]" />
        </div>
        <div className="mt-3 text-[10px] tracking-[0.16em] uppercase font-semibold text-[var(--ee-magenta)]">
          On duty
        </div>
      </div>
      <div className="flex-1 flex flex-col px-6 py-6">
        <h2
          className="text-[1.5rem] font-semibold tracking-[-0.02em]"
          style={{ fontFamily: "Montserrat, system-ui, sans-serif" }}
        >
          Who&apos;s logging in?
        </h2>
        <p className="mt-2 text-[12px] text-neutral-500 font-light">
          Select your name. You can switch later from the sidebar.
        </p>
        <ul className="mt-5 space-y-2 flex-1">
          {SHARED_OPERATORS.map((p) => {
            const on = picked?.id === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onPick(p)}
                  className={`w-full text-left rounded-[8px] border pl-3 border-l-[3px] py-3.5 pr-3 bg-white transition-colors ${
                    on
                      ? "border-[var(--ee-sidebar-border)] border-l-[var(--ee-magenta)]"
                      : "border-[var(--ee-sidebar-border)] border-l-transparent hover:border-l-neutral-300"
                  }`}
                >
                  <span className="text-[15px] font-medium">{p.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          disabled={!picked}
          className="mt-4 w-full py-3 rounded-[8px] bg-[var(--ee-magenta)] text-white text-[11px] font-semibold tracking-[0.1em] uppercase disabled:opacity-40"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

function PinPresence({ picked, onPick, remember, setRemember }) {
  return (
    <div className="h-full relative bg-[var(--ee-bg)]">
      <div className="absolute inset-0 p-4 opacity-40 pointer-events-none">
        <div className="text-[10px] tracking-[0.16em] uppercase text-neutral-400 font-semibold">
          Home
        </div>
        <div className="mt-2 h-8 w-40 bg-neutral-200/80 rounded" />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="h-16 rounded-[8px] bg-white border border-[var(--ee-sidebar-border)]" />
          <div className="h-16 rounded-[8px] bg-white border border-[var(--ee-sidebar-border)]" />
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/20">
        <div className="w-full max-w-[320px] rounded-[14px] bg-[var(--ee-panel)] border border-[var(--ee-sidebar-border)] shadow-[0_16px_40px_rgba(0,0,0,0.12)] p-5">
          <div className="text-[9px] tracking-[0.2em] uppercase font-semibold text-[var(--ee-magenta)]">
            Presence
          </div>
          <h2
            className="mt-2 text-[1.35rem] font-semibold tracking-[-0.02em]"
            style={{ fontFamily: "Montserrat, system-ui, sans-serif" }}
          >
            Who&apos;s here?
          </h2>
          <p className="mt-1.5 text-[12px] text-neutral-500 font-light">
            Shared shop login — tag yourself for this session.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {SHARED_OPERATORS.map((p) => {
              const on = picked?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPick(p)}
                  className={`flex items-center gap-2.5 rounded-[10px] border px-2.5 py-2.5 text-left transition-colors ${
                    on
                      ? "border-[var(--ee-magenta)]/40 bg-[var(--ee-magenta-soft)]"
                      : "border-[var(--ee-sidebar-border)] bg-white hover:bg-neutral-50"
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0 ${
                      on
                        ? "bg-[var(--ee-magenta)] text-white"
                        : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {initials(p.name)}
                  </span>
                  <span className="text-[13px] font-medium truncate">{p.name}</span>
                </button>
              );
            })}
          </div>
          <label className="mt-4 flex items-center gap-2 text-[12px] text-neutral-500 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Remember until I sign out
          </label>
          <button
            type="button"
            disabled={!picked}
            className="mt-4 w-full py-3 rounded-[10px] bg-[var(--ee-magenta)] text-white text-[14px] font-medium disabled:opacity-40"
          >
            That&apos;s me
          </button>
        </div>
      </div>
    </div>
  );
}
