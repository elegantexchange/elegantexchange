import { useEffect, useMemo, useState } from "react";
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
  const nav = useNavigate();

  const load = () => api.get("/sales").then((r) => setSales(r.data));
  const loadSquare = () =>
    api.get("/square/status").then((r) => setSquare(r.data)).catch(() => null);
  useEffect(() => {
    load();
    if (showFinance) loadSquare();
  }, [showFinance]);

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
        s.item_id.toLowerCase().includes(t) ||
        s.consignor_id.toLowerCase().includes(t) ||
        (s.consignor_name || "").toLowerCase().includes(t) ||
        (s.description || "").toLowerCase().includes(t)
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
        label: payoutFilter === "Pending" ? "Payout pending" : "Paid out",
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
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-8 space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease }}
        className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4"
      >
        <div>
          <h1 data-testid="sales-title" className="ee-page-title text-2xl">
            Sales
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {sales.length} sale{sales.length === 1 ? "" : "s"} · {fmtMoney(totalSales)} total
            {showFinance ? ` · ${fmtMoney(totalStore)} store` : ""} · {filtered.length}{" "}
            shown
          </p>
        </div>
        <div className="ee-page-actions">
          {showFinance && square?.connected && (
            <Button
              data-testid="sync-square-btn"
              variant="outline"
              className="ee-btn-label rounded-[8px] border-[var(--ee-sidebar-border)]"
              disabled={syncing}
              onClick={sync}
            >
              <RefreshCw size={14} className={`md:mr-1 ${syncing ? "animate-spin" : ""}`} />
              <span className="hidden md:inline">Sync Square</span>
            </Button>
          )}
          <Button
            data-testid="open-new-sale-btn"
            className="ee-btn-label rounded-[8px] bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
            onClick={() => setOpen(true)}
          >
            <Plus size={14} className="md:mr-1" />
            <span className="hidden md:inline">Log Sale</span>
          </Button>
        </div>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
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
                <span className="hidden sm:inline">Add filter</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setPayoutFilter("Pending")}>
                Payout pending
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPayoutFilter("Paid")}>
                Paid out
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
            Clear all
          </button>
        </div>
      )}

      {showFinance ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-neutral-600">
          {[TONES.pending, TONES.paid].map((t) => (
            <div key={t.label} className="inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: t.accent }}
              />
              {t.label}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col lg:flex-row gap-4">
        <div
          className={`${panel} overflow-hidden lg:w-[400px] xl:w-[440px] shrink-0 max-h-[70vh] flex flex-col`}
        >
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
              className={`${panel} p-6 sm:p-8 flex-1 min-w-0`}
              data-testid="sales-detail"
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-14 h-14 rounded-[11px] flex items-center justify-center text-[15px] font-bold shrink-0 overflow-hidden"
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="ee-page-title text-2xl truncate">
                        {focused.description || focused.item_id}
                      </h2>
                      <p className="text-sm text-neutral-500 mt-1">
                        {fmtDate(focused.sale_date)} · {focused.item_id}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className="text-2xl font-bold tabular-nums"
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

              <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                {(retailView
                  ? [
                      [
                        "Consignor",
                        <button
                          key="c"
                          type="button"
                          onClick={() => nav(`/consignors/${focused.consignor_id}`)}
                          className="hover:text-[var(--ee-magenta)] text-left truncate"
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
                          className="hover:text-[var(--ee-magenta)] text-left truncate"
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
                  <div key={label} className="min-w-0">
                    <div className="text-[10px] tracking-[0.14em] uppercase text-neutral-500 font-semibold">
                      {label}
                    </div>
                    <div className="mt-1 font-medium min-w-0">{value}</div>
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
              className={`${panel} p-8 flex-1 min-w-0 flex items-center justify-center text-sm text-neutral-400`}
            >
              Select a sale to inspect.
            </div>
          )}
        </AnimatePresence>
      </div>

      <LogSaleDialog
        open={open}
        retailView={retailView}
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

function LogSaleDialog({ open, onClose, onCreated, retailView }) {
  const [items, setItems] = useState([]);
  const [itemId, setItemId] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      api.get("/inventory").then((r) =>
        setItems(r.data.filter((i) => i.status === "Active"))
      );
      setItemId("");
      setSalePrice("");
      setNotes("");
      setSearch("");
    }
  }, [open]);

  const filtered = useMemo(() => {
    const t = search.toLowerCase().trim();
    if (!t) return items.slice(0, 30);
    return items
      .filter(
        (i) =>
          i.item_id.toLowerCase().includes(t) ||
          i.description.toLowerCase().includes(t)
      )
      .slice(0, 30);
  }, [items, search]);

  const selected = items.find((i) => i.item_id === itemId);
  const price = Number(salePrice) || 0;
  const consignorPct = splitPctForItem(selected);
  const storePct = Math.round((100 - consignorPct) * 100) / 100;
  const consignorCut = Math.round(price * consignorPct) / 100;
  const storeCut = Math.round((price - consignorCut) * 100) / 100;

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

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveModalContent className="max-w-xl" data-testid="log-sale-dialog">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle className="ee-section-header text-xl">
            Log Sale
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <div>
          <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
            Item (Active only)
          </Label>
          <Input
            data-testid="sale-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by item ID or description…"
            className="mt-1"
          />
          <div className="mt-2 max-h-48 overflow-y-auto border border-[var(--ee-sidebar-border)] rounded-[8px] ee-scroll-hide">
            {filtered.map((i) => (
              <button
                key={i.item_id}
                type="button"
                data-testid={`sale-pick-${i.item_id}`}
                onClick={() => {
                  setItemId(i.item_id);
                  if (!salePrice) setSalePrice(String(i.asking_price));
                }}
                className={`w-full text-left px-3 py-2 text-sm border-b last:border-0 border-[var(--ee-sidebar-border)] hover:bg-[var(--ee-magenta-soft)] ${
                  itemId === i.item_id ? "bg-[var(--ee-magenta-soft)]" : ""
                }`}
              >
                <div className="flex justify-between gap-2">
                  <span>
                    <span className="font-semibold">{i.item_id}</span> · {i.description}
                  </span>
                  <span className="text-neutral-500">{fmtMoney(i.asking_price)}</span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-sm text-neutral-400 font-light">
                No active items match.
              </div>
            )}
          </div>
        </div>

        <div className={`grid gap-3 mt-2 ${retailView ? "grid-cols-1" : "grid-cols-2"}`}>
          <div>
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
              Sale Price
            </Label>
            <Input
              data-testid="sale-price"
              type="number"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          {!retailView ? (
            <div className="bg-[var(--ee-magenta-soft)] border border-[var(--ee-sidebar-border)] rounded-[8px] p-2 text-xs">
              <div className="flex justify-between">
                <span className="uppercase tracking-wider text-[10px] text-neutral-600 font-semibold">
                  Store ({storePct}%)
                </span>
                <span className="font-semibold">{fmtMoney(storeCut)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="uppercase tracking-wider text-[10px] text-[var(--ee-magenta)] font-semibold">
                  Consignor ({consignorPct}%)
                </span>
                <span className="font-semibold text-[var(--ee-magenta)]">
                  {fmtMoney(consignorCut)}
                </span>
              </div>
              {!selected && (
                <div className="text-[10px] text-neutral-500 mt-1.5">
                  Select an item to see its locked split.
                </div>
              )}
            </div>
          ) : null}
        </div>
        <div>
          <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
            Notes
          </Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        {selected && (
          <div className="text-xs text-neutral-500 font-light">
            Selected:{" "}
            <span className="font-semibold text-neutral-700">{selected.item_id}</span> ·{" "}
            {selected.description}
          </div>
        )}
        <ResponsiveModalFooter>
          <Button variant="outline" className="ee-btn-label" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-testid="sale-submit"
            disabled={busy}
            onClick={submit}
            className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
          >
            Log Sale
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
