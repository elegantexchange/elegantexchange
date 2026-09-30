import { fmtPhone } from "@/lib/api";
import { telHref } from "@/lib/consignorForm";

export default function PhoneLink({ number, className = "" }) {
  const label = fmtPhone(number) || (number || "").trim();
  if (!label) return null;
  const href = telHref(number);
  if (!href) {
    return <span className={className}>{label}</span>;
  }
  return (
    <a
      href={href}
      onClick={(e) => e.stopPropagation()}
      className={`underline-offset-2 hover:underline hover:text-[var(--ee-magenta)] ${className}`}
    >
      {label}
    </a>
  );
}
