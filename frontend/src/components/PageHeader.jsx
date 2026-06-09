export default function PageHeader({ title, subtitle, actions, testid }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-6 md:mb-7">
      <div className="min-w-0">
        <div className="text-[10px] tracking-[0.22em] uppercase text-[var(--ee-magenta)] font-semibold">
          The Elegant Exchange
        </div>
        <h1
          data-testid={testid || "page-title"}
          className="ee-page-title text-3xl md:text-4xl mt-1 whitespace-nowrap"
        >
          {title}
        </h1>
        {subtitle ? (
          <p className="text-sm text-neutral-500 mt-1 font-light truncate">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
