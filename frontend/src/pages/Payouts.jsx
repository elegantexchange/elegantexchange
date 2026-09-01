import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api, fmtMoney, fmtDate, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ResponsiveModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PAYOUT_METHODS } from "@/lib/brand";
import { toast } from "sonner";
import { Search, SlidersHorizontal, Wallet, X } from "lucide-react";

const TONES = {
  overdue: {
    label: "Overdue · 14d+",
    ink: "#9a3b3b",
    soft: "#faf0f0",
    border: "#e8c8c8",
    accent: "#c46b6b",
    avatar: "#f3e0e0",
  },
  due: {
    label: "Ready to pay",
    ink: "#8b1f6b",
    soft: "#f8eef5",
    border: "#e8cfe0",
    accent: "#8b1f6b",
    avatar: "#f0dceb",
  },
  fresh: {
    label: "Recent sale",
    ink: "#3d6b52",
    soft: "#f3f8f4",
    border: "#d5e5da",
    accent: "#6f9a7e",
    avatar: "#e4f0e8",
  },
};

const ease = [0.22, 1, 0.36, 1];
const panel =
  "rounded-[11px] border border-[var(--ee-sidebar-border)] bg-[var(--ee-panel)]";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: Math.min(i, 12) * 0.04, duration: 0.5, ease },
  }),
};

function daysPending(r) {
  if (typeof r.days_pending === "number") return r.days_pending;
  const oldest = r.oldest_sale;
  if (!oldest) return null;
  try {
    const d = new Date(`${String(oldest).slice(0, 10)}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.floor((today - d) / 86400000);
  } catch {
    return null;
  }
}

function toneFor(r) {
  const days = daysPending(r);
  if (days == null || days >= 14) return TONES.overdue;
  if (days <= 7) return TONES.fresh;
  return TONES.due;
}

function initials(name) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Payouts() {
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [active, setActive] = useState(null);
  const [q, setQ] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const load = async () => {
    const [queueRes, historyRes] = await Promise.all([
      api.get("/payouts/queue"),
      api.get("/payouts/history"),
    ]);
    setQueue(queueRes.data);
    setHistory(historyRes.data);
  };

  useEffect(() => {
    load();
  }, []);

  const totalOwed = useMemo(
    () => queue.reduce((sum, r) => sum + (r.balance_owed || 0), 0),
    [queue]
  );

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return queue.filter((r) => {
      const days = daysPending(r);
      if (overdueOnly && !(days != null && days >= 14)) return false;
      if (!term) return true;
      return `${r.full_name} ${r.consignor_id} ${r.payout_method || ""}`
        .toLowerCase()
        .includes(term);
    });
  }, [queue, q, overdueOnly]);

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-8 space-y-4 min-w-0 overflow-x-clip">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
        className="space-y-3 min-w-0"
      >
        <div className="min-w-0">
          <h1 data-testid="payouts-title" className="ee-page-title text-2xl">
            Payouts
          </h1>
          <p className="text-[13px] text-neutral-500 mt-0.5 break-words">
            {queue.length} in queue
            {queue.length > 0 ? ` · ${fmtMoney(totalOwed)} ready to pay` : ""}
            {overdueOnly ? ` · ${filtered.length} overdue` : ""}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center min-w-0">
          <div className="relative w-full min-w-0 flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search consignor…"
              data-testid="payouts-search"
              className="w-full pl-9 rounded-[8px] border-[var(--ee-sidebar-border)]"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                data-testid="payouts-filter-btn"
                className="ee-btn-label rounded-[8px] border-[var(--ee-sidebar-border)] shrink-0"
              >
                <SlidersHorizontal size={14} className="md:mr-1" />
                <span className="hidden sm:inline">Filter</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                data-testid="filter-overdue"
                onClick={() => setOverdueOnly(true)}
              >
                Overdue · 14d+
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="filter-all-payouts"
                onClick={() => setOverdueOnly(false)}
              >
                All in queue
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {overdueOnly ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOverdueOnly(false)}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border border-[var(--ee-sidebar-border)] bg-black/[0.02] text-neutral-700 hover:border-[var(--ee-magenta)]"
            >
              Overdue · 14d+
              <X size={12} className="text-neutral-400" />
            </button>
            <button
              type="button"
              onClick={() => setOverdueOnly(false)}
              className="text-[11px] text-neutral-500 hover:text-[var(--ee-magenta)] px-1"
            >
              Clear
            </button>
          </div>
        ) : null}
      </motion.div>

      <div
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
        data-testid="payout-queue"
      >
        {filtered.map((r, idx) => {
          const tone = toneFor(r);
          return (
            <motion.article
              key={r.consignor_id}
              custom={idx}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              whileHover={{ y: -4 }}
              className={`${panel} p-5`}
              data-testid={`payout-card-${r.consignor_id}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-11 h-11 rounded-[10px] flex items-center justify-center text-[12px] font-bold shrink-0"
                  style={{
                    background: tone.avatar,
                    color: tone.ink,
                    boxShadow: `inset 0 0 0 1px ${tone.border}`,
                  }}
                >
                  {initials(r.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{r.full_name}</div>
                      <div className="text-[11px] text-neutral-500 tabular-nums mt-0.5">
                        {r.consignor_id} · {r.payout_method || "—"}
                      </div>
                    </div>
                    <span
                      className="text-[9px] uppercase tracking-[0.12em] font-semibold px-1.5 py-0.5 rounded border shrink-0"
                      style={{
                        color: tone.ink,
                        background: tone.soft,
                        borderColor: tone.border,
                      }}
                    >
                      {tone.label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <div className="text-[10px] tracking-[0.16em] uppercase text-neutral-500 font-semibold">
                    Balance
                  </div>
                  <div
                    className="text-xl font-bold tabular-nums mt-0.5"
                    style={{ color: tone.ink }}
                  >
                    {fmtMoney(r.balance_owed)}
                  </div>
                </div>
                <div className="text-right text-[11px] text-neutral-500">
                  <div>
                    {r.items_sold} item{r.items_sold === 1 ? "" : "s"}
                  </div>
                  <div>
                    {(() => {
                      const d = daysPending(r);
                      if (d == null) return "Pending sale";
                      if (d >= 14) return `${d}d unpaid`;
                      return `${d}d since sale`;
                    })()}
                  </div>
                  {(r.expired_items || 0) > 0 ? (
                    <div className="text-amber-800 font-medium mt-0.5">
                      {r.expired_items} expired
                    </div>
                  ) : null}
                </div>
              </div>

              <Button
                data-testid={`payout-row-btn-${r.consignor_id}`}
                onClick={() => setActive(r)}
                className="mt-4 w-full ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
              >
                <Wallet size={13} className="mr-1" /> Process
              </Button>
            </motion.article>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className={`${panel} py-12 text-center text-sm text-neutral-400 font-light`}>
          {queue.length === 0
            ? "No balances yet. Owed comes from recorded sales and imported balances (Sold items or a balance_owed column on consignors)."
            : "No payouts match this search."}
        </div>
      )}

      <div className="pt-2">
        <h2 className="ee-section-header text-base mb-3">History</h2>
        <div className={`${panel} overflow-hidden`}>
          <ul
            className="divide-y divide-[var(--ee-sidebar-border)] max-h-[28rem] overflow-y-auto ee-scroll-hide"
            data-testid="payout-history"
          >
            {history.map((p) => (
              <li
                key={p.id}
                className="px-4 py-3 flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">
                    {p.consignor_name}
                    {p.consignor_id ? (
                      <span className="text-neutral-500 font-normal">
                        {" "}
                        · {p.consignor_id}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[11px] text-neutral-500 truncate">
                    {fmtDate(p.date_paid)} · {p.method}
                    {p.processed_by ? ` · ${p.processed_by}` : ""}
                    {p.notes ? ` · ${p.notes}` : ""}
                  </div>
                </div>
                <div className="font-semibold tabular-nums text-[var(--ee-magenta)] shrink-0">
                  {fmtMoney(p.amount)}
                </div>
              </li>
            ))}
            {history.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-neutral-400 font-light">
                No payouts yet.
              </li>
            )}
          </ul>
        </div>
      </div>

      <ProcessDialog
        active={active}
        onClose={() => setActive(null)}
        onDone={() => {
          setActive(null);
          load();
        }}
      />
    </div>
  );
}

function ProcessDialog({ active, onClose, onDone }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [squareConnected, setSquareConnected] = useState(false);

  useEffect(() => {
    if (active) {
      setAmount(String(active.balance_owed));
      setMethod(active.payout_method || "Cash");
      setNotes("");
    }
  }, [active]);

  useEffect(() => {
    api
      .get("/square/status")
      .then((r) => setSquareConnected(Boolean(r.data?.connected)))
      .catch(() => setSquareConnected(false));
  }, []);

  if (!active) return null;

  const methods = squareConnected
    ? PAYOUT_METHODS
    : PAYOUT_METHODS.filter((m) => m !== "Square");

  const submit = async (override = {}) => {
    setBusy(true);
    try {
      const payMethod = override.method || method;
      const payAmount =
        override.amount != null ? override.amount : Number(amount);
      const payNotes =
        override.notes != null
          ? override.notes
          : notes;
      await api.post("/payouts", {
        consignor_id: active.consignor_id,
        amount: payAmount,
        method: payMethod,
        notes: payNotes,
      });
      toast.success(
        override.success || `Paid ${active.full_name}`
      );
      onDone();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveModal open={!!active} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveModalContent className="max-w-md" data-testid="process-payout-dialog">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle className="ee-section-header text-xl flex items-center gap-2">
            <Wallet size={18} className="text-[var(--ee-magenta)]" /> Process Payout
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <div className="space-y-3">
          <div className="border border-[var(--ee-border)] rounded-[8px] p-3">
            <div className="text-[10px] tracking-[0.18em] uppercase text-neutral-600 font-semibold">
              {active.consignor_id} · {active.full_name}
            </div>
            <div className="text-xs text-neutral-600 mt-1">Balance owed</div>
            <div className="text-3xl font-bold text-[var(--ee-magenta)]">
              {fmtMoney(active.balance_owed)}
            </div>
            {(active.expired_items || 0) > 0 ? (
              <div className="mt-2 text-[11px] text-amber-800 font-medium">
                {active.expired_items} expired item
                {active.expired_items === 1 ? "" : "s"} still on floor
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              data-testid="payout-mark-resolved"
              className="ee-btn-label rounded-[8px] border-[var(--ee-sidebar-border)]"
              onClick={() =>
                submit({
                  amount: Number(active.balance_owed),
                  method: active.payout_method || "Cash",
                  notes: notes || "Marked resolved — full balance",
                  success: `Resolved ${active.full_name}`,
                })
              }
            >
              Mark resolved
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !squareConnected}
              data-testid="payout-via-square"
              className="ee-btn-label rounded-[8px] border-[var(--ee-sidebar-border)] disabled:opacity-40"
              title={
                squareConnected
                  ? "Record full payout sent via Square"
                  : "Connect Square in Settings first"
              }
              onClick={() =>
                submit({
                  amount: Number(active.balance_owed),
                  method: "Square",
                  notes: notes || "Processed via Square",
                  success: `Square payout recorded for ${active.full_name}`,
                })
              }
            >
              Pay via Square
            </Button>
          </div>
          {!squareConnected ? (
            <p className="text-[11px] text-neutral-500 font-light">
              Connect Square in Settings to enable Pay via Square.
            </p>
          ) : (
            <p className="text-[11px] text-neutral-500 font-light">
              Pay via Square records the payout after you send it in Square —
              it does not move money from this screen.
            </p>
          )}
          <div>
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
              Amount
            </Label>
            <Input
              data-testid="payout-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
              Method
            </Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger data-testid="payout-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {methods.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
              Notes
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <ResponsiveModalFooter>
          <Button variant="outline" className="ee-btn-label" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-testid="payout-submit"
            disabled={busy}
            onClick={() => submit()}
            className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
          >
            Confirm Payout
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
