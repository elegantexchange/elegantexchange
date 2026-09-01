import { STORE } from "@/lib/brand";
import { SHARED_OPERATORS } from "@/lib/operator";

/**
 * Production picker — System A (Floor roll call).
 */
export default function OperatorRollCall({ onSelect }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col p-4 sm:p-6"
      data-testid="operator-picker"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 0%, #f5e8f2 0%, #f0f0f0 45%, #ebebeb 100%)",
      }}
    >
      <div className="flex-1 min-h-0 flex flex-col max-w-lg mx-auto w-full rounded-[16px] bg-[var(--ee-panel)] border border-[var(--ee-sidebar-border)] shadow-[0_8px_30px_rgba(139,31,107,0.06)] overflow-hidden">
        <div className="px-5 sm:px-7 pt-5 pb-3 border-b border-[var(--ee-sidebar-border)]/80 shrink-0">
          <div className="text-[10px] tracking-[0.22em] uppercase font-semibold text-[var(--ee-magenta)]">
            {STORE.name}
          </div>
        </div>
        <div className="flex-1 flex flex-col px-5 sm:px-7 py-6 sm:py-8">
          <h1
            className="text-3xl sm:text-4xl leading-[1.12] font-semibold tracking-[-0.025em] text-[var(--ee-ink)]"
            style={{ fontFamily: "Montserrat, system-ui, sans-serif" }}
          >
            Who&apos;s on the floor?
          </h1>
          <p className="mt-3 text-[15px] text-neutral-500 font-light leading-relaxed max-w-md">
            Shared shop login — pick your name so sales and drop-offs are tagged
            to you.
          </p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SHARED_OPERATORS.map((p) => (
              <button
                key={p.id}
                type="button"
                data-testid={`operator-pick-${p.id}`}
                onClick={() => onSelect(p)}
                className="rounded-[12px] border border-[var(--ee-sidebar-border)] bg-white hover:border-[var(--ee-magenta)]/40 hover:bg-[var(--ee-magenta-soft)]/50 px-4 py-8 text-center transition-colors"
              >
                <span
                  className="text-xl font-semibold tracking-[-0.02em]"
                  style={{ fontFamily: "Montserrat, system-ui, sans-serif" }}
                >
                  {p.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
