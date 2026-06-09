export default function PageHeader({ title, subtitle, actions, testid }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-7">
      <div>
        <div className="text-[10px] tracking-[0.22em] uppercase text-[var(--ee-magenta)] font-semibold">
          The Elegant Exchange
        </div>
        <h1
          data-testid={testid || "page-title"}
          className="ee-page-title text-3xl md:text-4xl mt-1"
        >
          {title}
        </h1>
        {subtitle ? (
          <p className="text-sm text-neutral-500 mt-1 font-light">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
