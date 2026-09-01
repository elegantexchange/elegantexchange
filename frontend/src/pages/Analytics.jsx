import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { api, fmtMoney } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Download } from "lucide-react";
import { toast } from "sonner";

const RANGES = [
  ["today", "Today"],
  ["week", "This Week"],
  ["month", "This Month"],
  ["all", "All Time"],
];

const PALETTE = ["#8B1F6B", "#C76BA8", "#5C5C5C", "#D89B4A", "#3F8F7B", "#B85299"];

const ease = [0.22, 1, 0.36, 1];
const panel =
  "rounded-[11px] border border-[var(--ee-sidebar-border)] bg-[var(--ee-panel)]";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.55, ease },
  }),
};

const chartTooltip = {
  fontSize: 12,
  border: "1px solid #e8e8e8",
  borderRadius: 8,
  background: "#fcfcfc",
};

export default function Analytics() {
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/analytics?period=${period}`).then((r) => setData(r.data));
  }, [period]);

  const trendData = useMemo(
    () => (data?.trend || []).map((d) => ({ ...d, label: d.date.slice(5) })),
    [data]
  );

  const periodLabel = RANGES.find(([k]) => k === period)?.[1] ?? period;

  const secondaryStats = [
    {
      label: "Store revenue",
      value: fmtMoney(data?.store_revenue),
      sub: "Your store cut",
      accent: true,
    },
    {
      label: "On the floor",
      value: fmtMoney(data?.on_floor_value),
      sub: `${data?.active_items ?? 0} active items · asking $`,
      accent: true,
    },
    {
      label: "Avg sale price",
      value: fmtMoney(data?.avg_sale_price),
      sub: `${data?.items_sold ?? 0} items sold`,
    },
    {
      label: "Sell-through",
      value: `${data?.sell_through_rate ?? 0}%`,
      sub: `Avg ${data?.avg_days_to_sell ?? 0} days to sell`,
    },
  ];

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["Metric", "Value"],
      ["Period", period],
      ["Total Sales", data.total_sales],
      ["Store Revenue", data.store_revenue],
      ["Items Sold", data.items_sold],
      ["Avg Sale Price", data.avg_sale_price],
      ["Sell-through Rate (%)", data.sell_through_rate],
      ["Avg Days to Sell", data.avg_days_to_sell],
      ["Expiring Soon", data.expiring_soon],
      ["Active Items On Floor", data.active_items],
      ["Inventory On Floor ($)", data.on_floor_value],
      ["Pending Obligations", data.pending_obligations],
      ["Total Paid Out", data.total_paid_out],
      [],
      ["Revenue By Category", ""],
      ...(data.revenue_by_category || []).map((r) => [r.category, r.amount]),
      [],
      ["Active Items By Category", ""],
      ...(data.active_by_category || []).map((r) => [r.category, r.count]),
      [],
      ["Top Consignors", "Revenue"],
      ...(data.top_consignors || []).map((c) => [c.name, c.revenue]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-8 space-y-4 md:space-y-5 min-w-0 overflow-x-clip">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
        className="space-y-3 min-w-0"
      >
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <h1 data-testid="analytics-title" className="ee-page-title text-2xl">
              Analytics
            </h1>
            <p className="text-[13px] text-neutral-500 mt-0.5 break-words">
              {periodLabel}
              {data ? ` · ${data.items_sold ?? 0} items sold` : ""}
            </p>
          </div>
          <div className="ee-page-actions shrink-0">
            <Button
              data-testid="export-csv"
              type="button"
              variant="ghost"
              className="ee-btn-label rounded-[8px] text-neutral-600 h-9 px-2.5"
              onClick={exportCsv}
              title="Export CSV"
            >
              <Download size={14} className="md:mr-1" />
              <span className="hidden lg:inline">Export</span>
            </Button>
          </div>
        </div>
        <div
          className="inline-flex flex-wrap rounded-[8px] border border-[var(--ee-sidebar-border)] bg-[var(--ee-panel)] p-0.5"
          role="group"
          aria-label="Analytics range"
        >
          {RANGES.map(([k, label]) => (
            <button
              key={k}
              type="button"
              data-testid={`range-${k}`}
              onClick={() => setPeriod(k)}
              className={`text-[11px] font-semibold tracking-[0.06em] uppercase px-2.5 py-1.5 rounded-[6px] transition-colors ${
                period === k
                  ? "bg-[var(--ee-magenta)] text-white"
                  : "text-neutral-600 hover:bg-black/[0.03]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Hero — total sales */}
      <motion.div
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.65, ease }}
        className={`${panel} p-6 sm:p-8`}
      >
        <div className="text-[10px] tracking-[0.22em] uppercase text-neutral-500 font-semibold">
          Total sales · {periodLabel}
        </div>
        <motion.div
          data-testid="analytics-total-sales"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.6, ease }}
          className="mt-2 text-5xl sm:text-6xl font-bold tracking-tight text-[var(--ee-magenta)] tabular-nums"
        >
          {data ? fmtMoney(data.total_sales) : "—"}
        </motion.div>
        <p className="mt-2 text-sm text-neutral-500">
          Boutique performance for the selected range
        </p>
      </motion.div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {secondaryStats.map((stat, i) => (
          <motion.div
            key={stat.label}
            custom={i}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            whileHover={{ y: -3 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            className={`${panel} p-4 sm:p-5`}
          >
            <div className="text-[10px] tracking-[0.18em] uppercase text-neutral-500 font-semibold">
              {stat.label}
            </div>
            <div
              className={`text-2xl font-bold tracking-tight mt-1.5 tabular-nums ${
                stat.accent ? "text-[var(--ee-magenta)]" : "text-[var(--ee-ink)]"
              }`}
            >
              {stat.value}
            </div>
            <div className="text-xs text-neutral-500 mt-1">{stat.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Trend */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.65, ease }}
        className={`${panel} p-4 sm:p-5 min-w-0`}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="ee-section-header text-base">Sales trend · daily</h2>
          <span className="text-[10px] uppercase tracking-[0.14em] text-neutral-500 font-semibold">
            {periodLabel}
          </span>
        </div>
        <div className="ee-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ececec" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#8a8a8a" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={8}
              />
              <YAxis
                width={48}
                tick={{ fontSize: 10, fill: "#8a8a8a" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
              />
              <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={chartTooltip} />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#8B1F6B"
                strokeWidth={2.4}
                dot={{ r: 3, fill: "#8B1F6B", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive
                animationDuration={1100}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.section>

      {/* Category charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.65, ease }}
          className={`${panel} p-4 sm:p-5 min-w-0`}
        >
          <h2 className="ee-section-header text-base mb-3">Revenue by category</h2>
          <div className="ee-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data?.revenue_by_category || []}
                margin={{ top: 12, right: 12, bottom: 28, left: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#ececec" vertical={false} />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 9, fill: "#8a8a8a" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={52}
                />
                <YAxis
                  width={48}
                  tick={{ fontSize: 10, fill: "#8a8a8a" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                />
                <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={chartTooltip} />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={900}>
                  {(data?.revenue_by_category || []).map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, duration: 0.65, ease }}
          className={`${panel} p-4 sm:p-5 min-w-0`}
        >
          <h2 className="ee-section-header text-base mb-3">Active items by category</h2>
          <div className="ee-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data?.active_by_category || []}
                margin={{ top: 12, right: 12, bottom: 28, left: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#ececec" vertical={false} />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 9, fill: "#8a8a8a" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={52}
                />
                <YAxis
                  width={48}
                  tick={{ fontSize: 10, fill: "#8a8a8a" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={chartTooltip} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={900}>
                  {(data?.active_by_category || []).map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.44, duration: 0.65, ease }}
          className={`${panel} p-5`}
        >
          <h2 className="ee-section-header text-base mb-3">Top consignors · revenue</h2>
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--ee-sidebar-border)]">
              <tr>
                {["Consignor", "Items", "Revenue"].map((h) => (
                  <th key={h} className="ee-table-header text-left py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.top_consignors || []).map((c, i) => (
                <motion.tr
                  key={c.consignor_id}
                  custom={i}
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                  className="border-b last:border-0 border-[var(--ee-sidebar-border)] ee-row-alt"
                >
                  <td className="py-2.5">
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-[10px] text-neutral-500 tracking-wider">
                      {c.consignor_id}
                    </div>
                  </td>
                  <td className="py-2.5 tabular-nums">{c.items}</td>
                  <td className="py-2.5 font-semibold text-[var(--ee-magenta)] tabular-nums">
                    {fmtMoney(c.revenue)}
                  </td>
                </motion.tr>
              ))}
              {(!data?.top_consignors || data.top_consignors.length === 0) && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-neutral-400 text-sm font-light">
                    No sales yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.65, ease }}
          className={`${panel} p-5`}
        >
          <h2 className="ee-section-header text-base mb-3">Financial summary</h2>
          <div className="space-y-1 text-sm">
            <Row label="Store revenue" value={fmtMoney(data?.store_revenue)} accent />
            <Row
              label="Inventory on the floor"
              value={fmtMoney(data?.on_floor_value)}
              accent
            />
            <Row label="Active items" value={data?.active_items ?? 0} />
            <Row label="Total paid out" value={fmtMoney(data?.total_paid_out)} />
            <Row
              label="Pending obligations"
              value={fmtMoney(data?.pending_obligations)}
              accent
            />
            <Row label="Expiring within 7 days" value={data?.expiring_soon ?? 0} />
          </div>
        </motion.section>
      </div>
    </div>
  );
}

function Row({ label, value, accent }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0 border-[var(--ee-sidebar-border)]">
      <span className="text-neutral-600">{label}</span>
      <span
        className={`font-semibold tabular-nums ${accent ? "text-[var(--ee-magenta)]" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
