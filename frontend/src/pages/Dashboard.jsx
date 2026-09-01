import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api, fmtMoney, fmtDate, fmtDateTime, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Receipt,
  Users,
  UserPlus,
  Home,
  AlertTriangle,
  Clock,
  TrendingDown,
  TrendingUp,
  Gift,
  RotateCcw,
  Check,
  ExternalLink,
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
import { useAuth } from "@/context/AuthContext";
import { isAdmin } from "@/lib/auth";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ResponsiveModal";
import { toast } from "sonner";
import IntakeDialog from "@/components/IntakeDialog";

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
  const { user } = useAuth();
  const showPayouts = isAdmin(user);
  const [data, setData] = useState(null);
  const [pendingDropOffs, setPendingDropOffs] = useState([]);
  const [period, setPeriod] = useState("week");
  const [dropOffOpen, setDropOffOpen] = useState(false);
  const [houseIntakeOpen, setHouseIntakeOpen] = useState(false);
  const [attentionKind, setAttentionKind] = useState(null);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const nav = useNavigate();

  const unpaidBalances = useMemo(() => {
    const alerts = data?.alerts || {};
    return alerts.pending_balances || alerts.stale_balances || [];
  }, [data]);

  const reloadAlerts = () => {
    api.get(`/dashboard?period=${period}`).then((r) => setData(r.data));
    api
      .get("/drop-offs?status=needs_assessment")
      .then((r) => setPendingDropOffs(r.data || []))
      .catch(() => setPendingDropOffs([]));
  };

  useEffect(() => {
    api.get(`/dashboard?period=${period}`).then((r) => setData(r.data));
  }, [period]);

  useEffect(() => {
    api
      .get("/drop-offs?status=needs_assessment")
      .then((r) => setPendingDropOffs(r.data || []))
      .catch(() => setPendingDropOffs([]));
  }, []);

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
    pendingDropOffs.length +
    (data?.alerts.expiring_soon?.length || 0) +
    (data?.alerts.expired?.length || 0) +
    (showPayouts ? unpaidBalances.length : 0);

  const secondaryStats = [
    {
      label: "Active items",
      value: data?.active_items ?? "—",
      sub: "On the floor",
      testid: "stat-active-items",
    },
    showPayouts && {
      label: "Payouts owed",
      value: fmtMoney(data?.payouts_owed),
      sub:
        unpaidBalances.length > 0
          ? `${unpaidBalances.length} unsettled`
          : "Pending balances",
      testid: "stat-payouts-owed",
      accent: true,
      onClick: () => nav("/payouts"),
    },
    {
      label: "Consignors",
      value: data?.total_consignors ?? "—",
      sub: "Active relationships",
      testid: "stat-total-consignors",
      onClick: () => nav("/consignors"),
    },
  ].filter(Boolean);

  const activityPreview = activityExpanded
    ? weekActivity
    : weekActivity.slice(0, 5);
  const activityMore = weekActivity.length - 5;

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
                className="ee-btn-label rounded-[8px] bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
                onClick={() => setDropOffOpen(true)}
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
          </div>
        </div>
      </motion.div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {secondaryStats.map((stat, i) => {
          const Comp = stat.onClick ? "button" : "div";
          return (
            <motion.div
              key={stat.label}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              whileHover={{ y: -3 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
            >
              <Comp
                type={stat.onClick ? "button" : undefined}
                data-testid={stat.testid}
                onClick={stat.onClick}
                className={`${panel} p-4 sm:p-5 w-full text-left ${
                  stat.onClick ? "cursor-pointer hover:border-[var(--ee-magenta)]/40" : ""
                }`}
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
              </Comp>
            </motion.div>
          );
        })}
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
            {activityPreview.map((a, idx) => (
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
            {!activityExpanded && activityMore > 0 ? (
              <li>
                <button
                  type="button"
                  data-testid="activity-show-more"
                  onClick={() => setActivityExpanded(true)}
                  className="text-[11px] text-[var(--ee-magenta)] font-semibold"
                >
                  +{activityMore} more
                </button>
              </li>
            ) : null}
            {activityExpanded && weekActivity.length > 5 ? (
              <li>
                <button
                  type="button"
                  onClick={() => setActivityExpanded(false)}
                  className="text-[11px] text-neutral-500 font-semibold hover:text-[var(--ee-magenta)]"
                >
                  Show less
                </button>
              </li>
            ) : null}
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
            <button
              type="button"
              data-testid="attention-open-assessment"
              onClick={() => setAttentionKind("assessment")}
              className="w-full text-[10px] tracking-[0.18em] uppercase text-neutral-500 font-semibold flex items-center gap-1.5 hover:text-[var(--ee-magenta)] text-left"
            >
              <Users size={12} className="shrink-0" /> Awaiting assessment
              {pendingDropOffs.length > 0 ? (
                <span className="ee-alerts-col-meta">{pendingDropOffs.length}</span>
              ) : null}
            </button>
            <ul className="ee-alerts-list space-y-2 text-sm ee-scroll-hide">
              {pendingDropOffs.slice(0, 5).map((d) => (
                <li key={d.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => nav(`/drop-off/${d.id}/assess`)}
                    className="text-left w-full hover:text-[var(--ee-magenta)]"
                  >
                    <div className="text-[13px] leading-snug font-medium">
                      {d.consignor_name || d.consignor_id}
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      {d.consignor_id}
                      {d.signed_at ? ` · signed ${fmtDateTime(d.signed_at)}` : ""}
                    </div>
                  </button>
                </li>
              ))}
              {pendingDropOffs.length === 0 && (
                <li className="text-xs text-neutral-400 font-light">All clear.</li>
              )}
              {pendingDropOffs.length > 5 ? (
                <li>
                  <button
                    type="button"
                    onClick={() => setAttentionKind("assessment")}
                    className="text-[11px] text-[var(--ee-magenta)] font-semibold"
                  >
                    +{pendingDropOffs.length - 5} more
                  </button>
                </li>
              ) : null}
            </ul>
          </div>
          <div className="min-w-0">
            <button
              type="button"
              data-testid="attention-open-expiring"
              onClick={() => setAttentionKind("expiring")}
              className="w-full text-[10px] tracking-[0.18em] uppercase text-neutral-500 font-semibold flex items-center gap-1.5 hover:text-[var(--ee-magenta)] text-left"
            >
              <Clock size={12} className="shrink-0" /> Expiring · 7 days
              {(data?.alerts.expiring_soon || []).length > 0 ? (
                <span className="ee-alerts-col-meta">
                  {(data?.alerts.expiring_soon || []).length}
                </span>
              ) : null}
            </button>
            <ul className="ee-alerts-list space-y-2 text-sm ee-scroll-hide">
              {(data?.alerts.expiring_soon || []).slice(0, 5).map((i) => (
                <li key={i.item_id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setAttentionKind("expiring")}
                    className="w-full text-left hover:text-[var(--ee-magenta)]"
                  >
                    <div className="text-[13px] leading-snug">
                      <span className="font-medium">{i.item_id}</span>
                      <span className="text-neutral-600"> · {i.description}</span>
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      {fmtDate(i.period_end)}
                    </div>
                  </button>
                </li>
              ))}
              {(!data?.alerts.expiring_soon || data.alerts.expiring_soon.length === 0) && (
                <li className="text-xs text-neutral-400 font-light">All clear.</li>
              )}
              {(data?.alerts.expiring_soon || []).length > 5 ? (
                <li>
                  <button
                    type="button"
                    onClick={() => setAttentionKind("expiring")}
                    className="text-[11px] text-[var(--ee-magenta)] font-semibold"
                  >
                    +{data.alerts.expiring_soon.length - 5} more
                  </button>
                </li>
              ) : null}
            </ul>
          </div>
          <div className="min-w-0">
            <button
              type="button"
              data-testid="attention-open-expired"
              onClick={() => setAttentionKind("expired")}
              className="w-full text-[10px] tracking-[0.18em] uppercase text-neutral-500 font-semibold flex items-center gap-1.5 hover:text-[var(--ee-magenta)] text-left"
            >
              <TrendingDown size={12} className="shrink-0" /> Expired · no resolution
              {(data?.alerts.expired || []).length > 0 ? (
                <span className="ee-alerts-col-meta">
                  {(data?.alerts.expired || []).length}
                </span>
              ) : null}
            </button>
            <ul className="ee-alerts-list space-y-2 text-sm ee-scroll-hide">
              {(data?.alerts.expired || []).slice(0, 5).map((i) => (
                <li key={i.item_id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setAttentionKind("expired")}
                    className="w-full text-left hover:text-[var(--ee-magenta)]"
                  >
                    <div className="text-[13px] leading-snug">
                      <span className="font-medium">{i.item_id}</span>
                      <span className="text-neutral-600"> · {i.description}</span>
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      {fmtDate(i.period_end)}
                    </div>
                  </button>
                </li>
              ))}
              {(!data?.alerts.expired || data.alerts.expired.length === 0) && (
                <li className="text-xs text-neutral-400 font-light">All clear.</li>
              )}
              {(data?.alerts.expired || []).length > 5 ? (
                <li>
                  <button
                    type="button"
                    onClick={() => setAttentionKind("expired")}
                    className="text-[11px] text-[var(--ee-magenta)] font-semibold"
                  >
                    +{data.alerts.expired.length - 5} more
                  </button>
                </li>
              ) : null}
            </ul>
          </div>
          {showPayouts ? (
            <div className="min-w-0">
              <button
                type="button"
                data-testid="attention-open-unpaid"
                onClick={() => setAttentionKind("unpaid")}
                className="w-full text-[10px] tracking-[0.18em] uppercase text-neutral-500 font-semibold flex items-center gap-1.5 hover:text-[var(--ee-magenta)] text-left"
              >
                <Clock size={12} className="shrink-0" /> Payouts owed
                {unpaidBalances.length > 0 ? (
                  <span className="ee-alerts-col-meta">{unpaidBalances.length}</span>
                ) : null}
              </button>
              <ul className="ee-alerts-list space-y-2 text-sm ee-scroll-hide">
                {unpaidBalances.slice(0, 5).map((b) => (
                  <li key={b.consignor_id} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setAttentionKind("unpaid")}
                      className="w-full flex items-baseline justify-between gap-3 text-left hover:text-[var(--ee-magenta)]"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{b.full_name}</span>
                        {b.days_pending != null ? (
                          <span className="block text-xs text-neutral-500 mt-0.5">
                            {b.days_pending}d unpaid · {b.consignor_id}
                          </span>
                        ) : (
                          <span className="block text-xs text-neutral-500 mt-0.5">
                            {b.consignor_id}
                          </span>
                        )}
                      </span>
                      <span className="text-[var(--ee-magenta)] text-xs shrink-0 font-semibold tabular-nums">
                        {fmtMoney(b.balance)}
                      </span>
                    </button>
                  </li>
                ))}
                {unpaidBalances.length === 0 && (
                  <li className="text-xs text-neutral-400 font-light">All clear.</li>
                )}
                {unpaidBalances.length > 5 ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => setAttentionKind("unpaid")}
                      className="text-[11px] text-[var(--ee-magenta)] font-semibold"
                    >
                      +{unpaidBalances.length - 5} more
                    </button>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>
      </motion.section>

      <DropOffStartDialog
        open={dropOffOpen}
        onClose={() => setDropOffOpen(false)}
        onHouseItems={() => {
          setDropOffOpen(false);
          setHouseIntakeOpen(true);
        }}
      />
      <IntakeDialog
        open={houseIntakeOpen}
        onClose={() => setHouseIntakeOpen(false)}
        presetMode="house"
        onDone={reloadAlerts}
      />
      <AttentionResolveDialog
        kind={attentionKind}
        onClose={() => setAttentionKind(null)}
        onResolved={reloadAlerts}
        pendingDropOffs={pendingDropOffs}
        expiring={data?.alerts?.expiring_soon || []}
        expired={data?.alerts?.expired || []}
        unpaid={unpaidBalances}
      />
    </div>
  );
}

function DropOffStartDialog({ open, onClose, onHouseItems }) {
  const nav = useNavigate();
  const [list, setList] = useState([]);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [who, setWho] = useState("consignor"); // consignor | house

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setBusyId(null);
    setWho("consignor");
    api
      .get("/consignors")
      .then((r) => setList(r.data || []))
      .catch(() => setList([]));
  }, [open]);

  const query = search.toLowerCase().trim();
  const listOpen = query.length > 0;
  const filtered = useMemo(() => {
    if (!query) return [];
    return list
      .filter((c) => {
        const hay = `${c.full_name || ""} ${c.consignor_id || ""} ${c.phone || ""} ${c.email || ""}`.toLowerCase();
        return hay.includes(query);
      })
      .slice(0, 30);
  }, [list, query]);

  const startExisting = async (c) => {
    setBusyId(c.consignor_id);
    try {
      const { data } = await api.post("/drop-offs", {
        consignor_id: c.consignor_id,
      });
      onClose();
      nav(`/drop-off/${data.id}/assess`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
      setBusyId(null);
    }
  };

  const addNew = () => {
    onClose();
    nav("/drop-off");
  };

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveModalContent className="max-w-md" data-testid="drop-off-start-dialog">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle className="ee-section-header text-xl">
            New Drop Off
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>

        <div className="space-y-3">
          <p className="text-[13px] text-neutral-500">Who is this drop for?</p>

          <div
            className="inline-flex w-full rounded-[8px] border border-[var(--ee-sidebar-border)] p-0.5 bg-[var(--ee-panel)]"
            role="tablist"
            aria-label="Drop for"
          >
            {[
              ["consignor", "Consignor", UserPlus],
              ["house", "House", Home],
            ].map(([id, label, Icon]) => {
              const on = who === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  data-testid={`drop-off-who-${id}`}
                  onClick={() => setWho(id)}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-[6px] text-[11px] font-semibold tracking-[0.06em] uppercase transition-colors ${
                    on
                      ? "bg-[var(--ee-magenta)] text-white"
                      : "text-neutral-600 hover:bg-black/[0.03]"
                  }`}
                >
                  <Icon size={13} />
                  {label}
                </button>
              );
            })}
          </div>

          {who === "consignor" ? (
            <>
              <div>
                <Input
                  data-testid="drop-off-consignor-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, ID, phone…"
                  autoFocus
                />
                <AnimatePresence initial={false}>
                  {listOpen ? (
                    <motion.div
                      key="drop-results"
                      initial={{ height: 0, opacity: 0, marginTop: 0 }}
                      animate={{ height: "auto", opacity: 1, marginTop: 8 }}
                      exit={{ height: 0, opacity: 0, marginTop: 0 }}
                      transition={{ duration: 0.28, ease }}
                      className="overflow-hidden"
                    >
                      <motion.div
                        initial={{ y: -6 }}
                        animate={{ y: 0 }}
                        exit={{ y: -4 }}
                        transition={{ duration: 0.28, ease }}
                        className="max-h-44 overflow-y-auto border border-[var(--ee-sidebar-border)] rounded-[8px] ee-scroll-hide bg-[var(--ee-panel)] shadow-[0_8px_24px_rgba(0,0,0,0.04)]"
                      >
                        {filtered.map((c, idx) => (
                          <motion.button
                            key={c.consignor_id}
                            type="button"
                            data-testid={`drop-off-pick-${c.consignor_id}`}
                            disabled={Boolean(busyId)}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              delay: Math.min(idx, 8) * 0.02,
                              duration: 0.2,
                              ease,
                            }}
                            onClick={() => startExisting(c)}
                            className="w-full text-left px-3 py-2 text-sm border-b last:border-0 border-[var(--ee-sidebar-border)] hover:bg-[var(--ee-magenta-soft)] disabled:opacity-60"
                          >
                            <div className="font-semibold truncate">
                              {c.full_name || "—"}
                              {busyId === c.consignor_id ? "…" : ""}
                            </div>
                            <div className="text-[11px] text-neutral-500 truncate mt-0.5">
                              {c.consignor_id}
                              {c.phone ? ` · ${c.phone}` : ""}
                            </div>
                          </motion.button>
                        ))}
                        {filtered.length === 0 && (
                          <div className="px-3 py-3 text-sm text-neutral-400 font-light">
                            No consignors match.
                          </div>
                        )}
                      </motion.div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <button
                type="button"
                data-testid="drop-off-add-new"
                onClick={addNew}
                className="w-full flex items-center gap-2.5 rounded-[8px] border border-dashed border-[var(--ee-sidebar-border)] px-3 py-3 text-left hover:border-[var(--ee-magenta)] hover:bg-[var(--ee-magenta-soft)] transition-colors"
              >
                <span className="w-8 h-8 rounded-full bg-[var(--ee-magenta-soft)] text-[var(--ee-magenta)] flex items-center justify-center shrink-0">
                  <UserPlus size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--ee-ink)]">
                    Add new consignor
                  </span>
                  <span className="block text-[12px] text-neutral-500 mt-0.5">
                    Full intake on this device
                  </span>
                </span>
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="rounded-[8px] border border-[var(--ee-sidebar-border)] bg-black/[0.02] px-3 py-3 text-[13px] text-neutral-600">
                Tags as{" "}
                <span className="font-semibold text-[var(--ee-ink)]">In House</span>.
                No agreement. Sold pieces stay 100% store.
              </div>
              <button
                type="button"
                data-testid="drop-off-add-house-items"
                onClick={onHouseItems}
                className="w-full ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white rounded-[8px] py-3 text-sm font-semibold"
              >
                Add house items
              </button>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              variant="ghost"
              className="ee-btn-label text-neutral-600"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

const ATTENTION_META = {
  assessment: {
    title: "Awaiting assessment",
    blurb: "Open a drop-off to price it on the floor.",
  },
  expiring: {
    title: "Expiring · 7 days",
    blurb: "Select pieces, then mark donated or returned.",
  },
  expired: {
    title: "Expired · no resolution",
    blurb: "Select pieces, then mark donated or returned.",
  },
  unpaid: {
    title: "Payouts owed",
    blurb: "Unsettled balances — process from here or open Payouts.",
  },
};

function AttentionResolveDialog({
  kind,
  onClose,
  onResolved,
  pendingDropOffs,
  expiring,
  expired,
  unpaid,
}) {
  const nav = useNavigate();
  const open = Boolean(kind);
  const meta = ATTENTION_META[kind] || ATTENTION_META.assessment;
  const canBulkResolve = kind === "expiring" || kind === "expired";

  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [busyKey, setBusyKey] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    if (!open || !kind) return;
    let next = [];
    if (kind === "assessment") next = pendingDropOffs || [];
    else if (kind === "expiring") next = expiring || [];
    else if (kind === "expired") next = expired || [];
    else if (kind === "unpaid") next = unpaid || [];
    setRows(next);
    setSelected(new Set());
    setBusyKey(null);
    setBulkBusy(false);
  }, [open, kind, pendingDropOffs, expiring, expired, unpaid]);

  const allSelected =
    canBulkResolve && rows.length > 0 && rows.every((r) => selected.has(r.item_id));
  const selectedCount = selected.size;

  const toggleOne = (itemId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.item_id)));
  };

  const removeIds = (ids) => {
    const idSet = new Set(ids);
    setRows((prev) => prev.filter((r) => !idSet.has(r.item_id)));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    onResolved?.();
  };

  const removeRow = (key) => {
    setRows((prev) => prev.filter((r) => rowKey(kind, r) !== key));
    onResolved?.();
  };

  const assess = (row) => {
    onClose();
    nav(`/drop-off/${row.id}/assess`);
  };

  const bulkSelected = async (action) => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      await api.post("/inventory/bulk", { item_ids: ids, action });
      toast.success(
        action === "donated"
          ? `Donated ${ids.length} item${ids.length === 1 ? "" : "s"}`
          : `Returned ${ids.length} item${ids.length === 1 ? "" : "s"}`
      );
      removeIds(ids);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setBulkBusy(false);
    }
  };

  const resolvePayout = async (row) => {
    const key = rowKey(kind, row);
    setBusyKey(key);
    try {
      await api.post("/payouts", {
        consignor_id: row.consignor_id,
        amount: Number(row.balance),
        method: "Cash",
        notes: "Marked resolved — full balance",
      });
      toast.success(`Resolved ${row.full_name}`);
      removeRow(key);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setBusyKey(null);
    }
  };

  const openPayouts = () => {
    onClose();
    nav("/payouts");
  };

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveModalContent
        className="max-w-lg"
        data-testid="attention-resolve-dialog"
      >
        <ResponsiveModalHeader>
          <ResponsiveModalTitle className="ee-section-header text-xl">
            {meta.title}
            <span className="ml-2 text-[10px] tracking-[0.18em] uppercase text-[var(--ee-magenta)] font-semibold align-middle">
              {rows.length}
            </span>
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>

        <div className="space-y-3">
          <p className="text-[13px] text-neutral-500">{meta.blurb}</p>

          {canBulkResolve && rows.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  data-testid="attention-select-all"
                  onClick={toggleAll}
                  className="inline-flex items-center gap-2 text-[12px] font-semibold text-neutral-600 hover:text-[var(--ee-magenta)]"
                >
                  <span
                    className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 ${
                      allSelected
                        ? "bg-[var(--ee-magenta)] border-[var(--ee-magenta)] text-white"
                        : selectedCount > 0
                          ? "border-[var(--ee-magenta)] bg-[var(--ee-magenta-soft)]"
                          : "border-[var(--ee-sidebar-border)]"
                    }`}
                    aria-hidden
                  >
                    {allSelected ? <Check size={11} strokeWidth={3} /> : null}
                    {!allSelected && selectedCount > 0 ? (
                      <span className="w-1.5 h-1.5 rounded-sm bg-[var(--ee-magenta)]" />
                    ) : null}
                  </span>
                  {allSelected ? "Clear" : "Select all"}
                </button>
                <span className="text-[11px] text-neutral-500 tabular-nums">
                  {selectedCount} selected
                </span>
              </div>
              <div
                className="flex gap-2"
                data-testid="attention-bulk-bar"
              >
                <Button
                  type="button"
                  size="sm"
                  disabled={bulkBusy || selectedCount === 0}
                  data-testid="attention-bulk-donated"
                  onClick={() => bulkSelected("donated")}
                  className="ee-btn-label h-9 flex-1 rounded-[7px] bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white disabled:opacity-40"
                >
                  <Gift size={13} className="mr-1" />
                  Donated
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={bulkBusy || selectedCount === 0}
                  data-testid="attention-bulk-returned"
                  onClick={() => bulkSelected("returned")}
                  className="ee-btn-label h-9 flex-1 rounded-[7px] border-[var(--ee-sidebar-border)] disabled:opacity-40"
                >
                  <RotateCcw size={13} className="mr-1" />
                  Returned
                </Button>
              </div>
            </div>
          ) : null}

          {rows.length === 0 ? (
            <p className="text-sm text-neutral-400 font-light py-6 text-center">
              All clear.
            </p>
          ) : (
            <AttentionCards
              kind={kind}
              rows={rows}
              busyKey={busyKey}
              selectable={canBulkResolve}
              selected={selected}
              onToggle={toggleOne}
              onAssess={assess}
              onResolve={resolvePayout}
              onOpenPayouts={openPayouts}
            />
          )}
        </div>

        <ResponsiveModalFooter>
          <Button
            type="button"
            variant="ghost"
            className="ee-btn-label text-neutral-600"
            onClick={onClose}
          >
            Close
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

function rowKey(kind, row) {
  if (!row) return null;
  if (kind === "assessment") return `d:${row.id}`;
  if (kind === "unpaid") return `c:${row.consignor_id}`;
  return `i:${row.item_id}`;
}

function rowTitle(kind, row) {
  if (kind === "assessment") return row.consignor_name || row.consignor_id;
  if (kind === "unpaid") return row.full_name;
  return row.item_id;
}

function rowSub(kind, row) {
  if (kind === "assessment") {
    return `${row.consignor_id}${
      row.signed_at ? ` · signed ${fmtDateTime(row.signed_at)}` : ""
    }`;
  }
  if (kind === "unpaid") {
    return row.days_pending != null
      ? `${row.days_pending}d unpaid · ${row.consignor_id}`
      : row.consignor_id;
  }
  return `${row.description || "—"}${
    row.period_end ? ` · ${fmtDate(row.period_end)}` : ""
  }`;
}

function AttentionCards({
  kind,
  rows,
  busyKey,
  selectable,
  selected,
  onToggle,
  onAssess,
  onResolve,
  onOpenPayouts,
}) {
  return (
    <ul
      className="max-h-[min(52vh,440px)] overflow-y-auto ee-scroll-hide space-y-2"
      data-testid="attention-layout-cards"
    >
      {rows.map((row, idx) => {
        const key = rowKey(kind, row);
        const isOn = selectable && selected.has(row.item_id);
        const busy = busyKey === key;

        return (
          <motion.li
            key={key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx, 10) * 0.03, duration: 0.28, ease }}
            className={`rounded-[9px] border bg-[var(--ee-panel)] p-3.5 transition-colors ${
              isOn
                ? "border-[var(--ee-magenta)] bg-[var(--ee-magenta-soft)]"
                : "border-[var(--ee-sidebar-border)]"
            }`}
          >
            {selectable ? (
              <button
                type="button"
                data-testid={`attention-select-${row.item_id}`}
                onClick={() => onToggle(row.item_id)}
                className="w-full flex items-start gap-3 text-left"
                aria-pressed={isOn}
              >
                <span
                  className={`mt-0.5 w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 ${
                    isOn
                      ? "bg-[var(--ee-magenta)] border-[var(--ee-magenta)] text-white"
                      : "border-[var(--ee-sidebar-border)]"
                  }`}
                  aria-hidden
                >
                  {isOn ? <Check size={11} strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold truncate">
                    {rowTitle(kind, row)}
                  </span>
                  <span className="block text-[12px] text-neutral-500 mt-0.5">
                    {rowSub(kind, row)}
                  </span>
                </span>
              </button>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold truncate">
                    {rowTitle(kind, row)}
                  </div>
                  <div className="text-[12px] text-neutral-500 mt-0.5">
                    {rowSub(kind, row)}
                  </div>
                  {kind === "assessment" ? (
                    <div className="mt-3">
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        data-testid={`attention-assess-${row.id}`}
                        onClick={() => onAssess(row)}
                        className="ee-btn-label h-8 rounded-[7px] bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
                      >
                        Assess now
                      </Button>
                    </div>
                  ) : null}
                  {kind === "unpaid" ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        data-testid={`attention-resolve-${row.consignor_id}`}
                        onClick={() => onResolve(row)}
                        className="ee-btn-label h-8 rounded-[7px] bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
                      >
                        <Check size={13} className="mr-1" />
                        Mark resolved
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={onOpenPayouts}
                        className="ee-btn-label h-8 rounded-[7px] border-[var(--ee-sidebar-border)]"
                      >
                        <ExternalLink size={13} className="mr-1" />
                        Payouts
                      </Button>
                    </div>
                  ) : null}
                </div>
                {kind === "unpaid" ? (
                  <span className="text-[var(--ee-magenta)] font-bold tabular-nums shrink-0">
                    {fmtMoney(row.balance)}
                  </span>
                ) : null}
              </div>
            )}
          </motion.li>
        );
      })}
    </ul>
  );
}
