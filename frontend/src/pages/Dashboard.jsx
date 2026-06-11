import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fmtMoney, fmtDate, fmtDateTime } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Plus, Receipt, Users, AlertTriangle, Clock, TrendingDown } from "lucide-react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState("week");
  const nav = useNavigate();

  useEffect(() => {
    api.get(`/dashboard?period=${period}`).then((r) => setData(r.data));
  }, [period]);

  const chartData = useMemo(() => {
    if (!data) return [];
    const t = data.trend.this;
    const p = data.trend.previous;
    return t.map((cur, i) => ({
      label: cur.day.slice(5),
      thisPeriod: cur.amount,
      lastPeriod: (p[i] || {}).amount || 0,
    }));
  }, [data]);

  const alertCount =
    (data?.alerts.expiring_soon?.length || 0) +
    (data?.alerts.expired?.length || 0) +
    (data?.alerts.stale_balances?.length || 0);

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-8">
      <PageHeader
        title="Home"
        subtitle="Today at the boutique."
        testid="dashboard-title"
        actions={
          <>
            <Button
              data-testid="quick-new-intake"
              variant="outline"
              className="ee-btn-label"
              onClick={() => nav("/consignors?intake=1")}
            >
              <Plus size={14} className="md:mr-1" />
              <span className="hidden md:inline">New Intake</span>
            </Button>
            <Button
              data-testid="quick-log-sale"
              variant="outline"
              className="ee-btn-label"
              onClick={() => nav("/sales?new=1")}
            >
              <Receipt size={14} className="md:mr-1" />
              <span className="hidden md:inline">Log Sale</span>
            </Button>
            <Button
              data-testid="quick-add-consignor"
              className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
              onClick={() => nav("/consignors?new=1")}
            >
              <Users size={14} className="md:mr-1" />
              <span className="hidden md:inline">Add Consignor</span>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Sales Today"
          value={fmtMoney(data?.sales_today)}
          sub="Logged via Square + manual"
          accent
          testid="stat-sales-today"
        />
        <StatCard
          label="Active Items"
          value={data?.active_items ?? "—"}
          sub="On the floor right now"
          testid="stat-active-items"
        />
        <StatCard
          label="Payouts Owed"
          value={fmtMoney(data?.payouts_owed)}
          sub="Pending consignor balances"
          accent
          testid="stat-payouts-owed"
        />
        <StatCard
          label="Total Consignors"
          value={data?.total_consignors ?? "—"}
          sub="Active relationships"
          testid="stat-total-consignors"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-7">
        {/* Trend chart */}
        <section
          data-testid="trend-chart-card"
          className="lg:col-span-2 min-w-0 bg-white border border-[var(--ee-border)] rounded-md p-4 sm:p-5"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
            <h2 className="ee-section-header text-base shrink-0">Sales Trend</h2>
            <div className="ee-btn-group">
              {[
                ["week", "This Week"],
                ["month", "This Month"],
                ["all", "All Time"],
              ].map(([k, label]) => (
                <button
                  key={k}
                  data-testid={`trend-${k}`}
                  onClick={() => setPeriod(k)}
                  className={`text-[10px] uppercase tracking-[0.14em] font-semibold px-2.5 py-1 rounded border ${
                    period === k
                      ? "bg-[var(--ee-magenta)] text-white border-[var(--ee-magenta)]"
                      : "border-[var(--ee-border)] text-neutral-600 hover:text-[var(--ee-magenta)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="ee-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#888" }}
                  axisLine={{ stroke: "#ddd" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={8}
                />
                <YAxis
                  width={48}
                  tick={{ fontSize: 10, fill: "#888" }}
                  axisLine={{ stroke: "#ddd" }}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    border: "1px solid #ddd",
                    borderRadius: 4,
                  }}
                  formatter={(v) => fmtMoney(v)}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}
                  iconSize={10}
                />
                <Line
                  type="monotone"
                  dataKey="lastPeriod"
                  name="Previous"
                  stroke="#bbb"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="thisPeriod"
                  name="Current"
                  stroke="#8B1F6B"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#8B1F6B" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Activity feed */}
        <section
          data-testid="activity-feed"
          className="bg-white border border-[var(--ee-border)] rounded-md p-5"
        >
          <h2 className="ee-section-header text-base mb-3">Recent Activity</h2>
          <ul className="space-y-3">
            {(data?.activity || []).map((a, idx) => (
              <li key={idx} className="flex gap-3 text-sm">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--ee-magenta)] shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] truncate">{a.label}</div>
                  <div className="text-xs text-neutral-500 font-light truncate">
                    {a.sub} · {fmtDateTime(a.ts)}
                  </div>
                </div>
              </li>
            ))}
            {(!data?.activity || data.activity.length === 0) && (
              <li className="text-sm text-neutral-400 font-light">
                No recent activity.
              </li>
            )}
          </ul>
        </section>
      </div>

      {/* Alerts */}
      <section
        data-testid="alerts-panel"
        className="ee-alerts-panel mt-6 bg-white border border-[var(--ee-magenta)] rounded-md p-4 sm:p-5 min-w-0"
        style={{ borderWidth: 1.5 }}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-4">
          <AlertTriangle size={16} className="text-[var(--ee-magenta)] shrink-0" />
          <h2 className="ee-section-header text-base">
            Needs Attention
            <span className="ml-2 text-[10px] tracking-[0.18em] uppercase text-[var(--ee-magenta)]">
              {alertCount} item{alertCount === 1 ? "" : "s"}
            </span>
          </h2>
        </div>
        <div className="ee-alerts-grid">
          <div className="min-w-0">
            <div className="text-[10px] tracking-[0.18em] uppercase text-neutral-500 font-semibold flex items-center gap-1.5">
              <Clock size={12} className="shrink-0" /> Expiring · 7 days
            </div>
            <ul className="mt-2.5 space-y-2 text-sm">
              {(data?.alerts.expiring_soon || []).slice(0, 5).map((i) => (
                <li key={i.item_id} className="min-w-0">
                  <div className="text-[13px] leading-snug">
                    <span className="font-medium">{i.item_id}</span>
                    <span className="text-neutral-600"> · {i.description}</span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">{fmtDate(i.period_end)}</div>
                </li>
              ))}
              {(!data?.alerts.expiring_soon || data.alerts.expiring_soon.length === 0) && (
                <li className="text-xs text-neutral-400 font-light">All clear.</li>
              )}
            </ul>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] tracking-[0.18em] uppercase text-neutral-500 font-semibold flex items-center gap-1.5">
              <TrendingDown size={12} className="shrink-0" /> Expired · no resolution
            </div>
            <ul className="mt-2.5 space-y-2 text-sm">
              {(data?.alerts.expired || []).slice(0, 5).map((i) => (
                <li key={i.item_id} className="min-w-0">
                  <div className="text-[13px] leading-snug">
                    <span className="font-medium">{i.item_id}</span>
                    <span className="text-neutral-600"> · {i.description}</span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">{fmtDate(i.period_end)}</div>
                </li>
              ))}
              {(!data?.alerts.expired || data.alerts.expired.length === 0) && (
                <li className="text-xs text-neutral-400 font-light">All clear.</li>
              )}
            </ul>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] tracking-[0.18em] uppercase text-neutral-500 font-semibold flex items-center gap-1.5">
              <Clock size={12} className="shrink-0" /> Unpaid · 14+ days
            </div>
            <ul className="mt-2.5 space-y-2 text-sm">
              {(data?.alerts.stale_balances || []).slice(0, 5).map((b) => (
                <li key={b.consignor_id} className="flex items-baseline justify-between gap-3 min-w-0">
                  <span className="min-w-0 truncate">{b.full_name}</span>
                  <span className="text-[var(--ee-magenta)] text-xs shrink-0 font-semibold tabular-nums">
                    {fmtMoney(b.balance)}
                  </span>
                </li>
              ))}
              {(!data?.alerts.stale_balances || data.alerts.stale_balances.length === 0) && (
                <li className="text-xs text-neutral-400 font-light">All clear.</li>
              )}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
