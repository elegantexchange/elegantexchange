import { useState } from "react";
import { SHARED_OPERATORS } from "@/lib/operator";

/**
 * Production picker — Glass presence (D5c).
 */
export default function OperatorRollCall({ onSelect }) {
  const [picked, setPicked] = useState(null);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col p-4 sm:p-6 relative overflow-hidden"
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
        className="flex-1 min-h-0 flex flex-col max-w-lg mx-auto w-full rounded-[18px] overflow-hidden border border-white/60"
        style={{
          background: "rgba(255,255,255,0.42)",
          backdropFilter: "blur(18px) saturate(1.35)",
          WebkitBackdropFilter: "blur(18px) saturate(1.35)",
          boxShadow:
            "0 8px 32px rgba(80,40,70,0.08), inset 0 1px 0 rgba(255,255,255,0.75)",
        }}
      >
        <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-2 shrink-0">
          <div className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[var(--ee-magenta)]/90">
            Presence
          </div>
          <h1
            className="mt-3 text-3xl sm:text-4xl leading-[1.12] font-semibold tracking-[-0.025em] text-[var(--ee-ink)]"
            style={{ fontFamily: "Montserrat, system-ui, sans-serif" }}
          >
            Who&apos;s logging in?
          </h1>
          <p className="mt-2.5 text-[15px] text-neutral-600/90 font-light leading-relaxed max-w-md">
            So the room remembers who was here.
          </p>
        </div>
        <ul className="flex-1 px-4 sm:px-5 pb-2 space-y-1.5 overflow-y-auto">
          {SHARED_OPERATORS.map((p) => {
            const on = picked?.id === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  data-testid={`operator-pick-${p.id}`}
                  onClick={() => setPicked(p)}
                  className={`w-full text-left rounded-[12px] px-4 py-4 sm:py-[1.15rem] transition-all ${
                    on
                      ? "bg-white/75 shadow-[0_4px_16px_rgba(139,31,107,0.12)] ring-1 ring-[var(--ee-magenta)]/25"
                      : "bg-white/25 hover:bg-white/45"
                  }`}
                >
                  <span
                    className="text-[17px] sm:text-lg font-medium tracking-[-0.01em]"
                    style={{ fontFamily: "Montserrat, system-ui, sans-serif" }}
                  >
                    {p.name}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="p-4 sm:p-5 pt-2 shrink-0">
          <button
            type="button"
            data-testid="operator-confirm-btn"
            disabled={!picked}
            onClick={() => picked && onSelect(picked)}
            className="w-full py-3.5 rounded-[12px] text-[11px] font-semibold tracking-[0.1em] uppercase disabled:opacity-40 text-white"
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
