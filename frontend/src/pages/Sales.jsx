import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api, fmtMoney, fmtDate, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ResponsiveModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { isManagerOrAdmin, roleOf } from "@/lib/auth";
import {
  buildSquarePosChargeUrl,
  canOpenSquarePos,
  parseSquarePosCallback,
} from "@/lib/squarePos";

const TONES = {
  pending: {
    label: "Payout pending",
    ink: "#8b1f6b",
    soft: "#f8eef5",
    border: "#e8cfe0",
    accent: "#8b1f6b",
    avatar: "#f0dceb",
  },
  paid: {
    label: "Paid out",
    ink: "#3d6b52",
    soft: "#f3f8f4",
    border: "#d5e5da",
    accent: "#6f9a7e",
    avatar: "#e4f0e8",
  },
  unmatched: {
    label: "Square · unmatched",
    ink: "#9a3b3b",
    soft: "#faf0f0",
    border: "#e8c8c8",
    accent: "#c46b6b",
    avatar: "#f3e0e0",
  },
  sale: {
    label: "Sold",
    ink: "#8b1f6b",
    soft: "#f8eef5",
    border: "#e8cfe0",
    accent: "#8b1f6b",
    avatar: "#f0dceb",
  },
};

const ease = [0.22, 1, 0.36, 1];
const panel =
  "rounded-[11px] border border-[var(--ee-sidebar-border)] bg-[var(--ee-panel)]";

function toneFor(s, retailView) {
  if (s.source === "square_unmatched" || s.payout_status === "Unmatched") {
    return TONES.unmatched;
  }
  if (retailView) return TONES.sale;
  return s.payout_status === "Paid" ? TONES.paid : TONES.pending;
}

function initials(name) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function splitPctForItem(item) {
  const pct = item?.consignor_split_pct;
  if (pct == null || Number.isNaN(Number(pct))) return 50;
  return Number(pct);
}

export default function Sales() {
  const { user } = useAuth();
  const retailView = roleOf(user) === "retail";
  const showFinance = isManagerOrAdmin(user);
  const [sales, setSales] = useState([]);
  const [q, setQ] = useState("");
  const [payoutFilter, setPayoutFilter] = useState("All");
  const [focusId, setFocusId] = useState(null);
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.get("new") === "1");
  const [square, setSquare] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const posCallbackHandled = useRef(false);
  const nav = useNavigate();

  const load = () => api.get("/sales").then((r) => setSales(r.data));
  const loadSquare = () =>
    api.get("/square/status").then((r) => setSquare(r.data)).catch(() => null);
  useEffect(() => {
    load();
    loadSquare();
  }, []);

  // Pull Square payments into Sales when connected (matched + unmatched)
  useEffect(() => {
    if (!showFinance || !square?.connected) return;
    let cancelled = false;
    (async () => {
      try {
        await api.post("/square/sync");
        if (!cancelled) load();
      } catch {
        /* keep existing list if sync fails */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showFinance, square?.connected]);

  // Square Point of Sale returns here with ?data=… (iOS) or com.squareup.pos.* (Android)
  useEffect(() => {
    if (posCallbackHandled.current) return;
    const cb = parseSquarePosCallback(params);
    if (!cb?.state) return;
    posCallbackHandled.current = true;

    const clearPosParams = () => {
      const next = new URLSearchParams(params);
      [
        "data",
        "com.squareup.pos.ERROR_CODE",
        "com.squareup.pos.ERROR_DESCRIPTION",
        "com.squareup.pos.SERVER_TRANSACTION_ID",
        "com.squareup.pos.CLIENT_TRANSACTION_ID",
        "com.squareup.pos.REQUEST_METADATA",
      ].forEach((k) => next.delete(k));
      setParams(next, { replace: true });
    };

    (async () => {
      try {
        const { data } = await api.post("/square/charge/complete", {
          state: cb.state,
          status: cb.status,
          transaction_id: cb.transaction_id,
          client_transaction_id: cb.client_transaction_id,
          error_code: cb.error_code,
        });
        if (data.ok && data.sale) {
          toast.success(
            `Sale charged · ${data.sale.item_id}${
              data.idempotent ? " (already recorded)" : ""
            }`
          );
          load();
        } else if (data.canceled) {
          toast.message(
            cb.error_code === "payment_canceled" ||
              cb.error_code === "TRANSACTION_CANCELED"
              ? "Square charge canceled — item still Active"
              : `Square charge failed${cb.error_code ? ` (${cb.error_code})` : ""}`
          );
        }
      } catch (e) {
        toast.error(formatApiError(e.response?.data?.detail) || e.message);
      } finally {
        clearPosParams();
      }
    })();
  }, [params, setParams]);

  const filtered = useMemo(() => {
    const t = q.toLowerCase().trim();
    return sales.filter((s) => {
      if (
        showFinance &&
        payoutFilter !== "All" &&
        s.payout_status !== payoutFilter
      ) {
        return false;
      }
      if (!t) return true;
      return (
        (s.item_id || "").toLowerCase().includes(t) ||
        (s.consignor_id || "").toLowerCase().includes(t) ||
        (s.consignor_name || "").toLowerCase().includes(t) ||
        (s.description || "").toLowerCase().includes(t) ||
        (s.notes || "").toLowerCase().includes(t) ||
        (s.square_transaction_id || "").toLowerCase().includes(t)
      );
    });
  }, [sales, q, payoutFilter, showFinance]);

  useEffect(() => {
    if (filtered.length === 0) {
      setFocusId(null);
      return;
    }
    if (!focusId || !filtered.some((s) => s.id === focusId)) {
      setFocusId(filtered[0].id);
    }
  }, [filtered, focusId]);

  const focused = useMemo(
    () => filtered.find((s) => s.id === focusId) || null,
    [filtered, focusId]
  );

  const totalSales = sales.reduce((acc, s) => acc + s.sale_price, 0);
  const totalStore = sales.reduce((acc, s) => acc + (s.store_cut || 0), 0);

  const activeChips = [
    showFinance &&
      payoutFilter !== "All" && {
        key: "payout",
        label:
          payoutFilter === "Pending"
            ? "Payout pending"
            : payoutFilter === "Unmatched"
              ? "Square unmatched"
              : "Paid out",
        clear: () => setPayoutFilter("All"),
      },
  ].filter(Boolean);

  const sync = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post("/square/sync");
      toast.success(`Synced · ${data.matched} matched, ${data.unmatched} need review`);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setSyncing(false);
    }
  };

  const focusedTone = focused ? toneFor(focused, retailView) : null;

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-8 space-y-4 min-w-0 overflow-x-clip">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
        className="space-y-3 min-w-0"
      >
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <h1 data-testid="sales-title" className="ee-page-title text-2xl">
              Sales
            </h1>
            <p className="text-[13px] text-neutral-500 mt-0.5 break-words">
              {sales.length} sale{sales.length === 1 ? "" : "s"} · {fmtMoney(totalSales)}{" "}
              total
              {showFinance ? ` · ${fmtMoney(totalStore)} store` : ""} · {filtered.length}{" "}
              shown
              <span className="text-neutral-400"> · Square + logged</span>
            </p>
          </div>
          <div className="ee-page-actions shrink-0">
            {showFinance && square?.connected && (
              <Button
                data-testid="sync-square-btn"
                type="button"
                variant="ghost"
                className="ee-btn-label rounded-[8px] text-neutral-600 h-9 px-2.5"
                disabled={syncing}
                onClick={sync}
                title="Sync Square"
              >
                <RefreshCw
                  size={14}
                  className={`md:mr-1 ${syncing ? "animate-spin" : ""}`}
                />
                <span className="hidden lg:inline">Sync</span>
              </Button>
            )}
            <Button
              data-testid="open-new-sale-btn"
              type="button"
              className="ee-btn-label rounded-[8px] bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white h-9"
              onClick={() => setOpen(true)}
            >
              <Plus size={14} className="md:mr-1" />
              <span className="hidden sm:inline">Log Sale</span>
            </Button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center min-w-0">
          <div className="relative w-full min-w-0 flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <Input
              data-testid="sales-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search item, consignor, description…"
              className="w-full pl-9 rounded-[8px] border-[var(--ee-sidebar-border)]"
            />
          </div>
          {showFinance ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  data-testid="sales-add-filter-btn"
                  className="ee-btn-label rounded-[8px] border-[var(--ee-sidebar-border)] shrink-0"
                >
                  <SlidersHorizontal size={14} className="md:mr-1" />
                  <span className="hidden sm:inline">Filter</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setPayoutFilter("Pending")}>
                  Payout pending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPayoutFilter("Paid")}>
                  Paid out
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPayoutFilter("Unmatched")}>
                  Square unmatched
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border border-[var(--ee-sidebar-border)] bg-black/[0.02] text-neutral-700 hover:border-[var(--ee-magenta)]"
              >
                {chip.label}
                <X size={12} className="text-neutral-400" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPayoutFilter("All")}
              className="text-[11px] text-neutral-500 hover:text-[var(--ee-magenta)] px-1"
            >
              Clear
            </button>
          </div>
        )}
      </motion.div>

      <div className="ee-split-row">
        <div className={`${panel} ee-split-list`}>
          <div className="px-3 py-2 border-b border-[var(--ee-sidebar-border)] text-[10px] uppercase tracking-[0.14em] font-semibold text-neutral-500 shrink-0">
            {filtered.length} shown
          </div>
          <div data-testid="sales-tbody" className="ee-scroll-hide overflow-y-auto flex-1 min-h-0">
            <ul className="divide-y divide-[var(--ee-sidebar-border)]">
              {filtered.map((s) => {
                const tone = toneFor(s, retailView);
                const on = focusId === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setFocusId(s.id)}
                      className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors relative ${
                        on ? "bg-black/[0.03]" : "hover:bg-black/[0.015]"
                      }`}
                    >
                      <span
                        className="absolute left-0 top-0 bottom-0 w-[2px]"
                        style={{ background: on ? tone.accent : "transparent" }}
                      />
                      <div className="min-w-0 flex-1 pl-1">
                        <div className="font-semibold text-[13px] truncate">
                          {s.description || s.item_id}
                        </div>
                        <div className="text-[10px] text-neutral-500 truncate mt-0.5">
                          {fmtDate(s.sale_date)} · {s.consignor_name || s.consignor_id}
                          {s.operator_name ? ` · Logged by ${s.operator_name}` : ""}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div
                          className="text-[13px] font-semibold tabular-nums"
                          style={{ color: tone.ink }}
                        >
                          {fmtMoney(s.sale_price)}
                        </div>
                        {!retailView ? (
                          <div
                            className="text-[9px] uppercase tracking-[0.1em] font-semibold mt-0.5"
                            style={{ color: tone.ink }}
                          >
                            {tone.label}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="text-center text-sm text-neutral-400 py-12 font-light">
                  No sales match.
                </li>
              )}
            </ul>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {focused && focusedTone ? (
            <motion.div
              key={focused.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.35, ease }}
              className={`${panel} ee-detail-panel p-5 sm:p-6 lg:p-8`}
              data-testid="sales-detail"
            >
              <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                <div
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-[11px] flex items-center justify-center text-[15px] font-bold shrink-0 overflow-hidden"
                  style={{
                    background: focusedTone.avatar,
                    color: focusedTone.ink,
                    boxShadow: `inset 0 0 0 1px ${focusedTone.border}`,
                  }}
                >
                  {(focused.media || [])[0] ? (
                    <img
                      src={focused.media[0]}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    initials(focused.consignor_name)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="ee-detail-header">
                    <div className="min-w-0">
                      <h2 className="ee-page-title text-xl sm:text-2xl truncate">
                        {focused.description || focused.item_id}
                      </h2>
                      <p className="text-sm text-neutral-500 mt-1 truncate">
                        {fmtDate(focused.sale_date)} · {focused.item_id}
                      </p>
                    </div>
                    <div className="ee-detail-price shrink-0">
                      <div
                        className="text-xl sm:text-2xl font-bold tabular-nums"
                        style={{ color: focusedTone.ink }}
                      >
                        {fmtMoney(focused.sale_price)}
                      </div>
                      {!retailView ? (
                        <span
                          className="inline-flex mt-1 text-[9px] uppercase tracking-[0.12em] font-semibold px-1.5 py-0.5 rounded border"
                          style={{
                            color: focusedTone.ink,
                            background: focusedTone.soft,
                            borderColor: focusedTone.border,
                          }}
                        >
                          {focusedTone.label}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="ee-meta-grid mt-8">
                {(retailView
                  ? [
                      [
                        "Consignor",
                        <button
                          key="c"
                          type="button"
                          onClick={() => nav(`/consignors/${focused.consignor_id}`)}
                          className="block w-full max-w-full hover:text-[var(--ee-magenta)] text-left truncate"
                        >
                          {focused.consignor_name} · {focused.consignor_id}
                        </button>,
                      ],
                      ["Sale price", fmtMoney(focused.sale_price)],
                      ["Sold", fmtDate(focused.sale_date)],
                      ...(focused.operator_name
                        ? [["Logged by", focused.operator_name]]
                        : []),
                    ]
                  : [
                      [
                        "Consignor",
                        <button
                          key="c"
                          type="button"
                          onClick={() => nav(`/consignors/${focused.consignor_id}`)}
                          className="block w-full max-w-full hover:text-[var(--ee-magenta)] text-left truncate"
                        >
                          {focused.consignor_name} · {focused.consignor_id}
                        </button>,
                      ],
                      ["Sale price", fmtMoney(focused.sale_price)],
                      ["Store cut", fmtMoney(focused.store_cut)],
                      ["Consignor cut", fmtMoney(focused.consignor_cut)],
                      [
                        "Split",
                        focused.consignor_split_pct != null
                          ? `${focused.consignor_split_pct}% consignor`
                          : "Legacy 50%",
                      ],
                      ["Payout", focused.payout_status],
                      ...(focused.operator_name
                        ? [["Logged by", focused.operator_name]]
                        : []),
                      ["Notes", focused.notes || "—"],
                    ]
                ).map(([label, value]) => (
                  <div key={label} className="ee-meta-cell">
                    <div className="ee-meta-label">{label}</div>
                    <div className="ee-meta-value">{value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <Button
                  type="button"
                  variant="outline"
                  className="ee-btn-label rounded-[8px] border-[var(--ee-sidebar-border)]"
                  onClick={() => nav(`/consignors/${focused.consignor_id}`)}
                >
                  View consignor
                </Button>
              </div>
            </motion.div>
          ) : (
            <div
              className={`${panel} ee-detail-panel p-8 flex items-center justify-center text-sm text-neutral-400`}
            >
              Select a sale to inspect.
            </div>
          )}
        </AnimatePresence>
      </div>

      <LogSaleDialog
        open={open}
        retailView={retailView}
        square={square}
        onClose={() => {
          setOpen(false);
          params.delete("new");
          setParams(params);
        }}
        onCreated={() => load()}
      />
    </div>
  );
}

function LogSaleDialog({ open, onClose, onCreated, retailView, square }) {
  const [items, setItems] = useState([]);
  const [itemId, setItemId] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [charging, setCharging] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const squareReady = Boolean(square?.connected && square?.application_id);
  const onPosDevice = canOpenSquarePos();
  const canCharge = squareReady && onPosDevice;
  const query = search.toLowerCase().trim();
  const listOpen = query.length > 0;

  useEffect(() => {
    if (open) {
      api.get("/inventory").then((r) =>
        setItems(
          r.data.filter((i) => i.status === "Active" || i.status === "Expired")
        )
      );
      setItemId("");
      setSalePrice("");
      setNotes("");
      setSearch("");
      setShowNotes(false);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query) return [];
    return items
      .filter(
        (i) =>
          i.item_id.toLowerCase().includes(query) ||
          i.description.toLowerCase().includes(query)
      )
      .slice(0, 30);
  }, [items, query]);

  const selected = items.find((i) => i.item_id === itemId);
  const price = Number(salePrice) || 0;
  const consignorPct = splitPctForItem(selected);
  const storePct = Math.round((100 - consignorPct) * 100) / 100;
  const consignorCut = Math.round(price * consignorPct) / 100;
  const storeCut = Math.round((price - consignorCut) * 100) / 100;

  const pickItem = (i) => {
    setItemId(i.item_id);
    setSalePrice(String(i.asking_price ?? ""));
    setSearch("");
  };

  const submit = async () => {
    if (!itemId) return toast.error("Choose an item");
    if (!price || price <= 0) return toast.error("Enter a sale price");
    setBusy(true);
    try {
      await api.post("/sales", { item_id: itemId, sale_price: price, notes });
      toast.success(`Sale logged · ${itemId}`);
      onCreated?.();
      onClose();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  const chargeWithSquare = async () => {
    if (!itemId) return toast.error("Choose an item");
    if (!price || price <= 0) return toast.error("Enter a sale price");
    if (!canCharge) return;
    setCharging(true);
    try {
      const { data } = await api.post("/square/charge", {
        item_id: itemId,
        sale_price: price,
        notes,
      });
      const url = buildSquarePosChargeUrl(data);
      onClose();
      window.location.href = url;
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
      setCharging(false);
    }
  };

  let chargeHint = "";
  if (!square?.configured) {
    chargeHint = "Square isn’t configured on the server yet.";
  } else if (!squareReady) {
    chargeHint = "Connect Square in Settings to charge on the Stand.";
  } else if (!onPosDevice) {
    chargeHint = "Open EE on the Square Stand iPad to charge.";
  }

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveModalContent className="max-w-md" data-testid="log-sale-dialog">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle className="ee-section-header text-xl">
            Log Sale
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>

        <div className="space-y-3">
          <div>
            <Input
              data-testid="sale-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Item ID or description…"
              autoFocus
            />
            <AnimatePresence initial={false}>
              {listOpen ? (
                <motion.div
                  key="sale-results"
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
                    {filtered.map((i, idx) => (
                      <motion.button
                        key={i.item_id}
                        type="button"
                        data-testid={`sale-pick-${i.item_id}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: Math.min(idx, 8) * 0.02,
                          duration: 0.2,
                          ease,
                        }}
                        onClick={() => pickItem(i)}
                        className={`w-full text-left px-3 py-2 text-sm border-b last:border-0 border-[var(--ee-sidebar-border)] hover:bg-[var(--ee-magenta-soft)] ${
                          itemId === i.item_id ? "bg-[var(--ee-magenta-soft)]" : ""
                        }`}
                      >
                        <div className="flex justify-between gap-2 min-w-0">
                          <span className="truncate">
                            <span className="font-semibold">{i.item_id}</span>
                            <span className="text-neutral-500"> · {i.description}</span>
                          </span>
                          <span className="text-neutral-500 shrink-0 tabular-nums">
                            {fmtMoney(i.asking_price)}
                          </span>
                        </div>
                      </motion.button>
                    ))}
                    {filtered.length === 0 && (
                      <div className="px-3 py-3 text-sm text-neutral-400 font-light">
                        No active items match.
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {selected ? (
              <motion.div
                key={selected.item_id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25, ease }}
                className="space-y-2"
              >
                <div className="flex items-center gap-3">
                  <Input
                    data-testid="sale-price"
                    type="number"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="Price"
                    className="flex-1 tabular-nums"
                  />
                  <button
                    type="button"
                    className="text-[12px] font-semibold text-neutral-700 shrink-0 hover:text-[var(--ee-magenta)]"
                    onClick={() => {
                      setItemId("");
                      setSalePrice("");
                      setSearch("");
                    }}
                    title="Change item"
                  >
                    {selected.item_id}
                  </button>
                </div>
                {!retailView ? (
                  <p className="text-[12px] text-neutral-500 tabular-nums">
                    Split {storePct}/{consignorPct} · store {fmtMoney(storeCut)} ·
                    consignor{" "}
                    <span className="text-[var(--ee-magenta)] font-medium">
                      {fmtMoney(consignorCut)}
                    </span>
                  </p>
                ) : null}
              </motion.div>
            ) : (
              <motion.p
                key="hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[12px] text-neutral-400"
              >
                Search for a piece, then set the price.
              </motion.p>
            )}
          </AnimatePresence>

          {showNotes ? (
            <div>
              <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
                Notes
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1"
                placeholder="Optional"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNotes(true)}
              className="text-[12px] text-neutral-500 hover:text-[var(--ee-magenta)] text-left"
            >
              + Add note
            </button>
          )}

          {chargeHint ? (
            <p className="text-[11px] text-neutral-400" data-testid="square-charge-hint">
              {chargeHint}
            </p>
          ) : null}

          <ResponsiveModalFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="ee-btn-label text-neutral-600"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              data-testid="sale-submit"
              variant="outline"
              disabled={busy || charging}
              onClick={submit}
              className="ee-btn-label rounded-[8px] border-[var(--ee-sidebar-border)]"
            >
              Log only
            </Button>
            <Button
              type="button"
              data-testid="sale-charge-square"
              disabled={busy || charging || !canCharge}
              onClick={chargeWithSquare}
              className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
              title={chargeHint || "Charge with Square POS"}
            >
              {charging ? "Opening…" : "Charge"}
            </Button>
          </ResponsiveModalFooter>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
