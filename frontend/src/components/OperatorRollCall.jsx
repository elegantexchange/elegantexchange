import { useState } from "react";
import { SHARED_OPERATORS } from "@/lib/operator";

/**
 * Production picker — Glass presence (D5c).
 * Responsive: content-sized card on desktop, full-safe mobile.
 * Pass embedded to nest inside preview frames (absolute instead of fixed).
 */
export default function OperatorRollCall({ onSelect, embedded = false }) {
  const [picked, setPicked] = useState(null);

  return (
    <div
      className={`${
        embedded ? "absolute inset-0" : "fixed inset-0 z-[70]"
      } flex items-center justify-center p-3 sm:p-8`}
      data-testid="operator-picker"
      style={{
        background:
          "radial-gradient(90% 70% at 20% 0%, #f3dcec 0%, transparent 55%), radial-gradient(80% 60% at 100% 100%, #e8e4f0 0%, transparent 50%), linear-gradient(165deg, #f2f2f2 0%, #ebe8ef 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute -top-10 -right-8 w-56 h-56 rounded-full opacity-50"
        style={{
          background:
            "radial-gradient(circle, rgba(139,31,107,0.18) 0%, transparent 70%)",
        }}
      />
      <div
        className="relative w-full max-w-[420px] max-h-[min(720px,100dvh-1.5rem)] sm:max-h-[min(680px,90vh)] flex flex-col rounded-[16px] sm:rounded-[18px] overflow-hidden border border-white/60"
        style={{
          background: "rgba(255,255,255,0.48)",
          backdropFilter: "blur(18px) saturate(1.35)",
          WebkitBackdropFilter: "blur(18px) saturate(1.35)",
          boxShadow:
            "0 8px 32px rgba(80,40,70,0.08), inset 0 1px 0 rgba(255,255,255,0.75)",
        }}
      >
        <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-1 shrink-0">
          <div className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[var(--ee-magenta)]">
            Presence
          </div>
          <h1
            className="mt-2.5 sm:mt-3 text-[1.25rem] sm:text-[1.35rem] leading-[1.2] font-semibold tracking-[-0.02em] text-[var(--ee-ink)]"
            style={{ fontFamily: "Montserrat, system-ui, sans-serif" }}
          >
            Who&apos;s logging in?
          </h1>
          <p className="mt-1.5 text-[12px] sm:text-[12.5px] text-neutral-600 font-light leading-relaxed">
            So the room remembers who was here.
          </p>
        </div>
        <ul className="flex-1 min-h-0 px-3.5 sm:px-5 py-3 space-y-1.5 overflow-y-auto overscroll-contain">
          {SHARED_OPERATORS.map((p) => {
            const on = picked?.id === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  data-testid={`operator-pick-${p.id}`}
                  onClick={() => setPicked(p)}
                  className={`w-full text-left rounded-[11px] sm:rounded-[12px] px-3.5 sm:px-4 py-3.5 sm:py-4 transition-all ${
                    on
                      ? "bg-white/80 shadow-[0_4px_16px_rgba(139,31,107,0.12)] ring-1 ring-[var(--ee-magenta)]/30"
                      : "bg-white/30 hover:bg-white/50 active:bg-white/55"
                  }`}
                >
                  <span
                    className="text-[16px] sm:text-[17px] font-medium tracking-[-0.01em]"
                    style={{ fontFamily: "Montserrat, system-ui, sans-serif" }}
                  >
                    {p.name}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div
          className="p-3.5 sm:p-5 pt-2 shrink-0"
          style={{ paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            data-testid="operator-confirm-btn"
            disabled={!picked}
            onClick={() => picked && onSelect(picked)}
            className="w-full py-3.5 rounded-[12px] text-[11px] font-semibold tracking-[0.1em] uppercase disabled:opacity-35 text-white transition-opacity"
            style={{
              background: "var(--ee-magenta)",
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
