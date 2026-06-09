import { useEffect, useState, useMemo } from "react";
import { api, fmtMoney } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
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

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["Metric", "Value"],
      ["Period", period],
      ["Total Sales", data.total_sales],
      ["Store Revenue (50%)", data.store_revenue],
      ["Items Sold", data.items_sold],
      ["Avg Sale Price", data.avg_sale_price],
      ["Sell-through Rate (%)", data.sell_through_rate],
      ["Avg Days to Sell", data.avg_days_to_sell],
      ["Expiring Soon", data.expiring_soon],
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
    <div className="px-6 md:px-10 py-8">
      <PageHeader
        title="Analytics"
        subtitle="Performance across the boutique."
        testid="analytics-title"
        actions={
          <Button
            data-testid="export-csv"
            variant="outline"
            className="ee-btn-label"
            onClick={exportCsv}
          >
            <Download size={14} className="mr-1" /> Export CSV
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {RANGES.map(([k, label]) => (
          <button
            key={k}
            data-testid={`range-${k}`}
            onClick={() => setPeriod(k)}
            className={`text-[10px] uppercase tracking-[0.14em] font-semibold px-3 py-1.5 rounded border ${
              period === k
                ? "bg-[var(--ee-magenta)] text-white border-[var(--ee-magenta)]"
                : "border-[var(--ee-border)] text-neutral-600 hover:text-[var(--ee-magenta)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Sales" value={fmtMoney(data?.total_sales)} sub={`${data?.items_sold ?? 0} items`} accent testid="analytics-total-sales" />
        <StatCard label="Store Revenue" value={fmtMoney(data?.store_revenue)} sub="Your 50% cut" />
        <StatCard label="Avg Sale Price" value={fmtMoney(data?.avg_sale_price)} />
        <StatCard label="Sell-through" value={`${data?.sell_through_rate ?? 0}%`} sub={`Avg ${data?.avg_days_to_sell ?? 0} days to sell`} />
      </div>

      {/* Trend chart */}
      <section className="bg-white border border-[var(--ee-border)] rounded-md p-5 mt-6">
        <h2 className="ee-section-header text-base mb-3">Sales Trend · Daily</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#888" }} axisLine={{ stroke: "#ddd" }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#888" }} axisLine={{ stroke: "#ddd" }} tickLine={false} />
              <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="amount" stroke="#8B1F6B" strokeWidth={2.5} dot={{ r: 3, fill: "#8B1F6B" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        <section className="bg-white border border-[var(--ee-border)] rounded-md p-5">
          <h2 className="ee-section-header text-base mb-3">Revenue by Category</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.revenue_by_category || []} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="category" tick={{ fontSize: 10, fill: "#888" }} axisLine={{ stroke: "#ddd" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#888" }} axisLine={{ stroke: "#ddd" }} tickLine={false} />
                <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {(data?.revenue_by_category || []).map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white border border-[var(--ee-border)] rounded-md p-5">
          <h2 className="ee-section-header text-base mb-3">Active Items by Category</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.active_by_category || []} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="category" tick={{ fontSize: 10, fill: "#888" }} axisLine={{ stroke: "#ddd" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#888" }} axisLine={{ stroke: "#ddd" }} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {(data?.active_by_category || []).map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        <section className="bg-white border border-[var(--ee-border)] rounded-md p-5">
          <h2 className="ee-section-header text-base mb-3">Top Consignors · Revenue</h2>
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--ee-border)]">
              <tr>
                {["Consignor", "Items", "Revenue"].map((h) => (
                  <th key={h} className="ee-table-header text-left py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.top_consignors || []).map((c) => (
                <tr key={c.consignor_id} className="border-b last:border-0 border-[var(--ee-border)]">
                  <td className="py-2">
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-[10px] text-neutral-500 tracking-wider">{c.consignor_id}</div>
                  </td>
                  <td className="py-2">{c.items}</td>
                  <td className="py-2 font-semibold text-[var(--ee-magenta)]">{fmtMoney(c.revenue)}</td>
                </tr>
              ))}
              {(!data?.top_consignors || data.top_consignors.length === 0) && (
                <tr><td colSpan={3} className="py-6 text-center text-neutral-400 text-sm font-light">No sales yet.</td></tr>
              )}
            </tbody>
          </table>
        </section>
        <section className="bg-white border border-[var(--ee-border)] rounded-md p-5">
          <h2 className="ee-section-header text-base mb-3">Financial Summary</h2>
          <div className="space-y-3 text-sm">
            <Row label="Store revenue (50% cut)" value={fmtMoney(data?.store_revenue)} accent />
            <Row label="Total paid out" value={fmtMoney(data?.total_paid_out)} />
            <Row label="Pending obligations" value={fmtMoney(data?.pending_obligations)} accent />
            <Row label="Expiring within 7 days" value={data?.expiring_soon ?? 0} />
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value, accent }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0 border-[var(--ee-border)]">
      <span className="text-neutral-600">{label}</span>
      <span className={`font-semibold ${accent ? "text-[var(--ee-magenta)]" : ""}`}>{value}</span>
    </div>
  );
}
