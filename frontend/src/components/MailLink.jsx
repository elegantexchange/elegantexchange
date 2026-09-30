export default function MailLink({ email, className = "" }) {
  const value = (email || "").trim();
  if (!value) return null;
  const href = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? `mailto:${value}` : "";
  if (!href) {
    return <span className={className}>{value}</span>;
  }
  return (
    <a
      href={href}
      onClick={(e) => e.stopPropagation()}
      className={`underline-offset-2 hover:underline hover:text-[var(--ee-magenta)] ${className}`}
    >
      {value}
    </a>
  );
}
