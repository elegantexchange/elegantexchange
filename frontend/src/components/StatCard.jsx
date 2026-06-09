export default function StatCard({ label, value, sub, accent = false, testid }) {
  return (
    <div
      data-testid={testid}
      className="bg-white border border-[var(--ee-border)] rounded-md p-5 flex flex-col gap-1.5"
    >
      <div className="text-[10px] tracking-[0.18em] uppercase text-neutral-500 font-semibold">
        {label}
      </div>
      <div
        className={`text-3xl font-bold tracking-tight ${
          accent ? "text-[var(--ee-magenta)]" : "text-[var(--ee-ink)]"
        }`}
      >
        {value}
      </div>
      {sub ? <div className="text-xs text-neutral-500 font-light">{sub}</div> : null}
    </div>
  );
}
