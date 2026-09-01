export default function PageHeader({ title, subtitle, actions, testid }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 mb-6 md:mb-8 min-w-0">
      <h1
        data-testid={testid || "page-title"}
        className="col-span-2 lg:col-span-1 ee-page-title text-[28px] md:text-[32px] leading-tight tracking-[-0.02em] truncate min-w-0"
      >
        {title}
      </h1>
      {subtitle ? (
        <p className="text-[13px] text-neutral-500 mt-0.5 font-normal truncate min-w-0 self-center">
          {subtitle}
        </p>
      ) : null}
      {actions ? (
        <div
          className={`ee-page-actions shrink-0 justify-self-end self-center col-start-2 max-w-full ${
            subtitle
              ? "row-start-2 lg:row-start-1 lg:row-span-2 lg:self-center"
              : "row-start-2 col-span-2 lg:row-start-1 lg:col-span-1 lg:self-center"
          }`}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}
