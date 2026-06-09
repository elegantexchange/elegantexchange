export default function StatusPill({ status }) {
  const map = {
    Active: "ee-status-active",
    Sold: "ee-status-sold",
    Donated: "ee-status-donated",
    Returned: "ee-status-returned",
    Expired: "ee-status-expired",
  };
  return (
    <span
      data-testid={`status-${(status || "").toLowerCase()}`}
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-[0.12em] ${
        map[status] || "ee-status-active"
      }`}
    >
      {status}
    </span>
  );
}
