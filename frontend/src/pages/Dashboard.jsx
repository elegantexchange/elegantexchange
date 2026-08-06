import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api, fmtMoney, fmtDate, fmtDateTime } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Receipt,
  Users,
  AlertTriangle,
  Clock,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
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

function startOfWeekIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 Sun … 6 Sat
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  return d.toISOString();
}

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

  const weekActivity = useMemo(() => {
    const start = startOfWeekIso();
    return (data?.activity || []).filter((a) => {
      if (!a?.ts) return false;
      return a.ts >= start || a.ts.slice(0, 10) >= start.slice(0, 10);
    });
  }, [data]);

  const salesDelta = useMemo(() => {
    if (!data?.trend?.this?.length) return null;
    const days = data.trend.this;
    const todayAmt = data.sales_today ?? 0;
    const yesterdayAmt = days.length >= 2 ? days[days.length - 2].amount : 0;
    if (yesterdayAmt <= 0) return todayAmt > 0 ? 100 : null;
    return ((todayAmt - yesterdayAmt) / yesterdayAmt) * 100;
  }, [data]);

  const alertCount =
    (data?.alerts.expiring_soon?.length || 0) +
    (data?.alerts.expired?.length || 0) +
    (data?.alerts.stale_balances?.length || 0);

  const secondaryStats = [
    {
      label: "Active items",
      value: data?.active_items ?? "—",
      sub: "On the floor",
      testid: "stat-active-items",
    },
    {
      label: "Payouts owed",
      value: fmtMoney(data?.payouts_owed),
      sub: "Pending balances",
      testid: "stat-payouts-owed",
      accent: true,
    },
    {
      label: "Consignors",
      value: data?.total_consignors ?? "—",
      sub: "Active relationships",
      testid: "stat-total-consignors",
    },
  ];

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-8 space-y-5 md:space-y-6">
      <h1 data-testid="dashboard-title" className="sr-only">
        Home
      </h1>

      {/* Hero — sales today */}
      <motion.div
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.65, ease }}
        className={`${panel} p-6 sm:p-8`}
      >
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="text-[10px] tracking-[0.22em] uppercase text-neutral-500 font-semibold">
              Sales today
            </div>
            <div className="mt-2 flex items-baseline gap-3 flex-wrap">
              <motion.div
                data-testid="stat-sales-today"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.6, ease }}
                className="text-5xl sm:text-6xl font-bold tracking-tight text-[var(--ee-magenta)] tabular-nums"
              >
                {data ? fmtMoney(data.sales_today) : "—"}
              </motion.div>
              {salesDelta != null && (
                <motion.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.28, duration: 0.45 }}
                  className={`inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-0.5 rounded-md border ${
                    salesDelta >= 0
                      ? "text-emerald-700 bg-emerald-50 border-emerald-100"
                      : "text-rose-700 bg-rose-50 border-rose-100"
                  }`}
                >
                  {salesDelta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {salesDelta >= 0 ? "+" : ""}
                  {salesDelta.toFixed(1)}% vs yesterday
                </motion.span>
              )}
            </div>
            <p className="mt-2 text-sm text-neutral-500">
              Square + manual · boutique floor
            </p>
          </div>

          <div className="ee-page-actions">
            <motion.div
              custom={0}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              whileHover={{ y: -2 }}
            >
              <Button
                data-testid="quick-new-intake"
                variant="outline"
                className="ee-btn-label rounded-[8px] border-[var(--ee-sidebar-border)]"
                onClick={() => nav("/consignors?intake=1")}
              >
                <Plus size={14} className="md:mr-1" />
                <span className="hidden md:inline">New Drop Off</span>
              </Button>
            </motion.div>
            <motion.div
              custom={1}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              whileHover={{ y: -2 }}
            >
              <Button
                data-testid="quick-log-sale"
                variant="outline"
                className="ee-btn-label rounded-[8px] border-[var(--ee-sidebar-border)]"
                onClick={() => nav("/sales?new=1")}
              >
                <Receipt size={14} className="md:mr-1" />
                <span className="hidden md:inline">Log Sale</span>
              </Button>
            </motion.div>
            <motion.div
              custom={2}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              whileHover={{ y: -2 }}
            >
              <Button
                data-testid="quick-add-consignor"
                className="ee-btn-label rounded-[8px] bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
                onClick={() => nav("/consignors?new=1")}
              >
                <Users size={14} className="md:mr-1" />
                <span className="hidden md:inline">Add Consignor</span>
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {secondaryStats.map((stat, i) => (
          <motion.div
            key={stat.label}
            data-testid={stat.testid}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Trend chart — frame sized to chart, not stretched by activity */}
        <motion.section
          data-testid="trend-chart-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.65, ease }}
          className={`${panel} p-3 sm:p-3.5 lg:col-span-2 min-w-0 lg:h-[17rem] flex flex-col`}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2 shrink-0">
            <h2 className="ee-section-header text-base shrink-0">Sales trend</h2>
            <div className="ee-btn-group">
              {[
                ["week", "This Week"],
                ["month", "This Month"],
                ["all", "All Time"],
              ].map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  data-testid={`trend-${k}`}
                  onClick={() => setPeriod(k)}
                  className={`text-[10px] uppercase tracking-[0.14em] font-semibold px-2.5 py-1 rounded-[6px] border transition-colors ${
                    period === k
                      ? "bg-[var(--ee-magenta)] text-white border-[var(--ee-magenta)]"
                      : "border-[var(--ee-sidebar-border)] text-neutral-600 hover:text-[var(--ee-magenta)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-[12rem] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
                  width={44}
                  tick={{ fontSize: 10, fill: "#8a8a8a" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    border: "1px solid #e8e8e8",
                    borderRadius: 8,
                    background: "#fcfcfc",
                  }}
                  formatter={(v) => fmtMoney(v)}
                />
                <Legend
                  wrapperStyle={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                  iconSize={10}
                />
                <Line
                  type="monotone"
                  dataKey="lastPeriod"
                  name="Previous"
                  stroke="#c9c9c9"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive
                  animationDuration={900}
                />
                <Line
                  type="monotone"
                  dataKey="thisPeriod"
                  name="Current"
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

        {/* Activity feed — same height as trend; this week only; scroll without bar */}
        <motion.section
          data-testid="activity-feed"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, duration: 0.65, ease }}
          className={`${panel} p-3 sm:p-3.5 flex flex-col min-h-[16rem] lg:h-[17rem]`}
        >
          <h2 className="ee-section-header text-base mb-2 shrink-0">Recent activity</h2>
          <ul className="ee-scroll-hide flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-0.5">
            {weekActivity.map((a, idx) => (
              <motion.li
                key={`${a.ts}-${idx}`}
                custom={idx}
                variants={fadeUp}
                initial="hidden"
                animate="show"
                className="flex gap-3 text-sm group"
              >
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--ee-magenta)] shrink-0 transition-transform duration-300 group-hover:scale-125" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] truncate">{a.label}</div>
                  <div className="text-[11px] text-neutral-500 font-light truncate">
                    {a.sub} · {fmtDateTime(a.ts)}
                  </div>
                </div>
              </motion.li>
            ))}
            {weekActivity.length === 0 && (
              <li className="text-sm text-neutral-400 font-light">No activity this week.</li>
            )}
          </ul>
        </motion.section>
      </div>

      {/* Alerts */}
      <motion.section
        data-testid="alerts-panel"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42, duration: 0.65, ease }}
        className={`ee-alerts-panel ${panel} p-4 sm:p-5 min-w-0 border-[var(--ee-magenta)]`}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-4">
          <AlertTriangle size={16} className="text-[var(--ee-magenta)] shrink-0" />
          <h2 className="ee-section-header text-base">
            Needs attention
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
                <li
                  key={b.consignor_id}
                  className="flex items-baseline justify-between gap-3 min-w-0"
                >
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
      </motion.section>

    </div>
  );
}
