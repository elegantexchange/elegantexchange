export default function PageHeader({ title, subtitle, actions, testid }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 mb-6 md:mb-7">
      <div className="col-span-2 text-[10px] tracking-[0.22em] uppercase text-[var(--ee-magenta)] font-semibold">
        The Elegant Exchange
      </div>
      <h1
        data-testid={testid || "page-title"}
        className="col-span-2 lg:col-span-1 ee-page-title text-3xl md:text-4xl mt-1 whitespace-nowrap"
      >
        {title}
      </h1>
      {subtitle ? (
        <p className="text-sm text-neutral-500 mt-1 font-light truncate min-w-0 self-center">
          {subtitle}
        </p>
      ) : null}
      {actions ? (
        <div
          className={`ee-page-actions shrink-0 justify-self-end self-center col-start-2 ${
            subtitle
              ? "row-start-3 lg:row-start-2 lg:row-span-2 lg:self-end"
              : "row-start-3 col-span-2 lg:row-start-2 lg:col-span-1 lg:self-end"
          }`}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}
