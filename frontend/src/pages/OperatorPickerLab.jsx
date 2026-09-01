import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ease = [0.22, 1, 0.36, 1];

export const SHARED_OPERATORS = [
  { id: "youseline", name: "Youseline" },
  { id: "johan", name: "Johan" },
  { id: "noah", name: "Noah" },
  { id: "zachary", name: "Zachary" },
];

const SYSTEMS = [
  {
    id: "ledger",
    letter: "B",
    name: "Ruled",
    blurb: "Hairline rules, PRESENCE label, magenta rail.",
  },
  {
    id: "glass",
    letter: "D",
    name: "Glass",
    blurb:
      "Frosted panel over a soft atelier wash — translucent list, light refraction edge.",
  },
  {
    id: "neomorph",
    letter: "E",
    name: "Neomorph",
    blurb:
      "Soft clay extrusion — pressed-in names, raised confirm. Quiet tactile floor UI.",
  },
  {
    id: "ink",
    letter: "F",
    name: "Ink rail",
    blurb:
      "Near-black field, single magenta tick, type-led list. Night-counter energy.",
  },
];

const GLASS_SUBTITLES = [
  {
    id: "1",
    label: "1",
    text: "Your name rides with every sale and drop-off.",
  },
  {
    id: "2",
    label: "2",
    text: "One tap — everything you log today is yours.",
  },
  {
    id: "3",
    label: "3",
    text: "Floor credit for the shared shop login.",
  },
  {
    id: "4",
    label: "4",
    text: "We'll stamp your work until you switch or sign out.",
  },
  {
    id: "5",
    label: "5",
    text: "So the boutique knows whose hands were on it.",
  },
  {
    id: "5a",
    label: "5a",
    text: "So we know whose hands moved the floor today.",
  },
  {
    id: "5b",
    label: "5b",
    text: "So every piece logged has a name behind it.",
  },
  {
    id: "5c",
    label: "5c",
    text: "So the room remembers who was here.",
  },
  {
    id: "5d",
    label: "5d",
    text: "So sales and drop-offs carry the right hands.",
  },
  {
    id: "5e",
    label: "5e",
    text: "So the boutique can follow the touch, not just the login.",
  },
  {
    id: "6",
    label: "6",
    text: "Quiet check-in before you open the floor.",
  },
  {
    id: "7",
    label: "7",
    text: "Attribution for sales, intake, and client drop-offs.",
  },
  {
    id: "8",
    label: "8",
    text: "Say hello — then go make the room move.",
  },
];

export default function OperatorPickerLab() {
  const [active, setActive] = useState("glass");
  const [picked, setPicked] = useState(null);
  const [subtitleId, setSubtitleId] = useState("5c");
  const system = SYSTEMS.find((s) => s.id === active) || SYSTEMS[0];
  const glassSubtitle =
    GLASS_SUBTITLES.find((s) => s.id === subtitleId) || GLASS_SUBTITLES[0];

  return (
    <div className="min-h-screen bg-[var(--ee-bg)] text-[var(--ee-ink)]">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
        <div className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[var(--ee-magenta)]">
          Concepts · ledger family
        </div>
        <h1 className="ee-page-title text-3xl sm:text-4xl mt-2">
          Presence picker
        </h1>
        <p className="mt-3 text-[15px] text-neutral-500 font-light max-w-xl leading-relaxed">
          Glass presence is shipping with subtitle{" "}
          <strong>5c</strong>: “So the room remembers who was here.” Other tabs
          stay for reference.
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
                key={active === "glass" ? `glass-${subtitleId}` : active}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease }}
                className="h-full"
              >
                {active === "ledger" && (
                  <LedgerRuled picked={picked} onPick={setPicked} />
                )}
                {active === "glass" && (
                  <LedgerGlass
                    picked={picked}
                    onPick={setPicked}
                    subtitle={glassSubtitle.text}
                  />
                )}
                {active === "neomorph" && (
                  <LedgerNeomorph picked={picked} onPick={setPicked} />
                )}
                {active === "ink" && (
                  <LedgerInk picked={picked} onPick={setPicked} />
                )}
              </motion.div>
            </AnimatePresence>
          </PhoneFrame>
        </div>

        {active === "glass" && (
          <div className="mt-8 max-w-xl mx-auto">
            <div className="text-[10px] tracking-[0.16em] uppercase font-semibold text-neutral-400 text-center">
              Glass subtitle options
            </div>
            <div className="mt-3 space-y-2">
              {GLASS_SUBTITLES.map((s) => {
                const on = subtitleId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSubtitleId(s.id)}
                    className={`w-full text-left rounded-[10px] border px-4 py-3 transition-colors ${
                      on
                        ? "border-[var(--ee-magenta)]/40 bg-[var(--ee-magenta-soft)]/60"
                        : "border-[var(--ee-sidebar-border)] bg-[var(--ee-panel)] hover:border-neutral-300"
                    }`}
                  >
                    <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[var(--ee-magenta)]">
                      {s.label}
                    </span>
                    <span className="mt-1 block text-[14px] text-[var(--ee-ink)] font-light leading-snug">
                      {s.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {picked && (
          <p className="mt-6 text-center text-[13px] text-neutral-500 font-light">
            Selected in preview:{" "}
            <span className="text-[var(--ee-ink)] font-medium">{picked.name}</span>
            {active === "glass" ? ` · subtitle ${subtitleId}` : ""}
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

function LedgerRuled({ picked, onPick }) {
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
          Presence
        </div>
      </div>
      <div className="flex-1 flex flex-col px-6 py-6">
        <h2
          className="text-[1.5rem] font-semibold tracking-[-0.02em]"
          style={{ fontFamily: "Montserrat, system-ui, sans-serif" }}
        >
          Who&apos;s logging in?
        </h2>
        <ul className="mt-6 space-y-2 flex-1">
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

function LedgerGlass({ picked, onPick, subtitle }) {
  return (
    <div
      className="h-full flex flex-col p-4 relative overflow-hidden"
      style={{
        background:
          "radial-gradient(90% 70% at 20% 0%, #f3dcec 0%, transparent 55%), radial-gradient(80% 60% at 100% 100%, #e8e4f0 0%, transparent 50%), linear-gradient(165deg, #f2f2f2 0%, #ebe8ef 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute -top-8 -right-6 w-40 h-40 rounded-full opacity-50"
        style={{
          background:
            "radial-gradient(circle, rgba(139,31,107,0.18) 0%, transparent 70%)",
        }}
      />
      <div
        className="flex-1 min-h-0 flex flex-col rounded-[18px] overflow-hidden border border-white/60"
        style={{
          background: "rgba(255,255,255,0.42)",
          backdropFilter: "blur(18px) saturate(1.35)",
          WebkitBackdropFilter: "blur(18px) saturate(1.35)",
          boxShadow:
            "0 8px 32px rgba(80,40,70,0.08), inset 0 1px 0 rgba(255,255,255,0.75)",
        }}
      >
        <div className="px-5 pt-5 pb-2">
          <div className="text-[9px] tracking-[0.2em] uppercase font-semibold text-[var(--ee-magenta)]/90">
            Presence
          </div>
          <h2
            className="mt-3 text-[1.25rem] sm:text-[1.35rem] font-semibold tracking-[-0.02em] text-[var(--ee-ink)]"
            style={{ fontFamily: "Montserrat, system-ui, sans-serif" }}
          >
            Who&apos;s logging in?
          </h2>
          {subtitle ? (
            <p className="mt-1.5 text-[12px] text-neutral-600/90 font-light leading-relaxed">
              {subtitle}
            </p>
          ) : null}
        </div>
        <ul className="flex-1 px-4 pb-2 space-y-1.5">
          {SHARED_OPERATORS.map((p) => {
            const on = picked?.id === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onPick(p)}
                  className={`w-full text-left rounded-[12px] px-3.5 py-3.5 transition-all ${
                    on
                      ? "bg-white/75 shadow-[0_4px_16px_rgba(139,31,107,0.12)] ring-1 ring-[var(--ee-magenta)]/25"
                      : "bg-white/25 hover:bg-white/45"
                  }`}
                >
                  <span className="text-[15px] font-medium">{p.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="p-4 pt-2">
          <button
            type="button"
            disabled={!picked}
            className="w-full py-3 rounded-[12px] text-[11px] font-semibold tracking-[0.1em] uppercase disabled:opacity-40 text-white"
            style={{
              background: "rgba(139,31,107,0.88)",
              backdropFilter: "blur(8px)",
              boxShadow: "0 6px 20px rgba(139,31,107,0.28)",
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function LedgerNeomorph({ picked, onPick }) {
  const clay = "#e8e6ea";
  const softOut =
    "8px 8px 16px rgba(166,160,175,0.45), -6px -6px 14px rgba(255,255,255,0.9)";
  const softIn =
    "inset 5px 5px 10px rgba(166,160,175,0.35), inset -4px -4px 10px rgba(255,255,255,0.85)";

  return (
    <div
      className="h-full flex flex-col px-5 py-5"
      style={{ background: clay }}
    >
      <div className="text-[9px] tracking-[0.2em] uppercase font-semibold text-[var(--ee-magenta)]">
        Presence
      </div>
      <h2
        className="mt-3 text-[1.45rem] font-semibold tracking-[-0.02em]"
        style={{ fontFamily: "Montserrat, system-ui, sans-serif" }}
      >
        Who&apos;s logging in?
      </h2>
      <ul className="mt-6 space-y-3 flex-1">
        {SHARED_OPERATORS.map((p) => {
          const on = picked?.id === p.id;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPick(p)}
                className="w-full text-left rounded-[14px] px-4 py-3.5 transition-all"
                style={{
                  background: clay,
                  boxShadow: on ? softIn : softOut,
                  color: on ? "var(--ee-magenta)" : "var(--ee-ink)",
                }}
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
        className="mt-2 w-full py-3.5 rounded-[14px] text-[11px] font-semibold tracking-[0.1em] uppercase disabled:opacity-40"
        style={{
          background: clay,
          color: picked ? "var(--ee-magenta)" : "#9a96a0",
          boxShadow: softOut,
        }}
      >
        Confirm
      </button>
    </div>
  );
}

function LedgerInk({ picked, onPick }) {
  return (
    <div
      className="h-full flex flex-col"
      style={{
        background:
          "linear-gradient(180deg, #1a181c 0%, #121014 55%, #0e0c10 100%)",
      }}
    >
      <div className="px-6 pt-6 pb-2">
        <div className="flex items-center gap-3">
          <div
            className="w-1 h-1 rounded-full"
            style={{ background: "var(--ee-magenta)" }}
          />
          <div className="text-[9px] tracking-[0.22em] uppercase font-semibold text-[var(--ee-magenta)]">
            Presence
          </div>
        </div>
        <h2
          className="mt-4 text-[1.5rem] font-semibold tracking-[-0.02em] text-[#f4f2f5]"
          style={{ fontFamily: "Montserrat, system-ui, sans-serif" }}
        >
          Who&apos;s logging in?
        </h2>
      </div>
      <ul className="flex-1 px-6 mt-4">
        {SHARED_OPERATORS.map((p, i) => {
          const on = picked?.id === p.id;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPick(p)}
                className="w-full text-left flex items-center gap-3 py-4 border-b transition-colors"
                style={{
                  borderColor: "rgba(255,255,255,0.08)",
                  borderBottomWidth: i === SHARED_OPERATORS.length - 1 ? 0 : 1,
                }}
              >
                <span
                  className="w-[3px] self-stretch rounded-full shrink-0 transition-colors"
                  style={{
                    background: on ? "var(--ee-magenta)" : "transparent",
                    minHeight: 22,
                  }}
                />
                <span
                  className="text-[16px] font-medium tracking-[-0.01em]"
                  style={{
                    color: on ? "#fff" : "rgba(255,255,255,0.55)",
                  }}
                >
                  {p.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="p-6 pt-2">
        <button
          type="button"
          disabled={!picked}
          className="w-full py-3 rounded-[8px] text-[11px] font-semibold tracking-[0.12em] uppercase disabled:opacity-35"
          style={{
            background: "var(--ee-magenta)",
            color: "#fff",
          }}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
