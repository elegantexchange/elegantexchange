import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api, fmtMoney, fmtDate, formatApiError } from "@/lib/api";
import StatusPill from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, Flag, Printer, Search, SlidersHorizontal, Upload, X } from "lucide-react";
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { CATEGORIES } from "@/lib/brand";
import { toast } from "sonner";
import ItemScanDialog from "@/components/ItemScanDialog";
import ItemMediaGallery from "@/components/ItemMediaGallery";

const STATUS_FILTERS = ["All", "Active", "Expiring Soon", "Expired", "Sold", "Donated", "Returned"];

const FLAG_LABELS = {
  missing_description: "Missing description",
  missing_rack: "Missing rack",
  missing_category: "Missing category",
  unknown_category: "Unknown category",
  missing_price: "Missing price",
  unparsed_price: "Unparsed price",
  missing_date_in: "No date in",
  unparsed_date_in: "Unparsed date in",
  consignor_created: "Consignor auto-created",
};

const TONES = {
  review: {
    label: "Needs review",
    ink: "#8a6a14",
    soft: "#faf6e9",
    border: "#ead9a8",
    accent: "#c4a35a",
    avatar: "#f3ead0",
  },
  attention: {
    label: "Attention",
    ink: "#9a3b3b",
    soft: "#faf0f0",
    border: "#e8c8c8",
    accent: "#c46b6b",
    avatar: "#f3e0e0",
  },
  active: {
    label: "On floor",
    ink: "#8b1f6b",
    soft: "#f8eef5",
    border: "#e8cfe0",
    accent: "#8b1f6b",
    avatar: "#f0dceb",
  },
  closed: {
    label: "Closed",
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

function flagLabel(flag) {
  return FLAG_LABELS[flag] || flag;
}

function toneFor(i, today, sevenAhead) {
  const flags = i.import_flags || [];
  if (i.needs_review || flags.length > 0) return TONES.review;
  if (
    i.status === "Expired" ||
    (i.status === "Active" &&
      i.period_end &&
      i.period_end <= sevenAhead &&
      i.period_end >= today)
  ) {
    return TONES.attention;
  }
  if (i.status === "Active") return TONES.active;
  return TONES.closed;
}

function initials(desc) {
  return (desc || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [rackFilter, setRackFilter] = useState("All");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [focusId, setFocusId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanSave, setScanSave] = useState(null);
  const [consignors, setConsignors] = useState([]);
  const [savingScan, setSavingScan] = useState(false);
  const fileRef = useRef(null);
  const nav = useNavigate();

  const load = () => api.get("/inventory").then((r) => setItems(r.data));
  useEffect(() => {
    load();
    api.get("/consignors").then((r) => setConsignors(r.data)).catch(() => {});
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const sevenAhead = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();

  const flaggedCount = useMemo(
    () => items.filter((i) => i.needs_review || (i.import_flags || []).length > 0).length,
    [items]
  );

  const activeCount = useMemo(
    () => items.filter((i) => i.status === "Active").length,
    [items]
  );

  const racks = useMemo(() => {
    const set = new Set();
    for (const i of items) {
      if (i.rack) set.add(i.rack);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return items.filter((i) => {
      if (flaggedOnly && !(i.needs_review || (i.import_flags || []).length)) {
        return false;
      }
      if (term) {
        const hay = `${i.item_id} ${i.text_id || ""} ${i.description} ${i.consignor_id} ${i.consignor_name} ${i.rack || ""} ${i.color || ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (categoryFilter !== "All" && i.category !== categoryFilter) return false;
      if (rackFilter !== "All" && (i.rack || "") !== rackFilter) return false;
      if (statusFilter === "All") return true;
      if (statusFilter === "Expiring Soon") {
        return i.status === "Active" && i.period_end <= sevenAhead && i.period_end >= today;
      }
      return i.status === statusFilter;
    });
  }, [items, q, statusFilter, categoryFilter, rackFilter, flaggedOnly, today, sevenAhead]);

  useEffect(() => {
    if (filtered.length === 0) {
      setFocusId(null);
      return;
    }
    if (!focusId || !filtered.some((i) => i.item_id === focusId)) {
      setFocusId(filtered[0].item_id);
    }
  }, [filtered, focusId]);

  const focused = useMemo(
    () => filtered.find((i) => i.item_id === focusId) || null,
    [filtered, focusId]
  );

  const allChecked = filtered.length > 0 && filtered.every((i) => selected.has(i.item_id));

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (allChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((i) => i.item_id)));
    }
  };

  const bulk = async (action, ids = [...selected]) => {
    if (!ids.length) return;
    try {
      await api.post("/inventory/bulk", { item_ids: ids, action });
      toast.success(`${ids.length} item(s) updated`);
      setSelected(new Set());
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const printTags = (ids) => {
    if (!ids?.length) return;
    window.open(`/print/tags?ids=${encodeURIComponent(ids.join(","))}`, "_blank", "noopener");
  };

  const onImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post("/inventory/import", form);
      setImportResult(res.data);
      await load();
      if (res.data.created > 0) {
        const extra = res.data.consignors_created
          ? ` · ${res.data.consignors_created} consignor${
              res.data.consignors_created === 1 ? "" : "s"
            } created`
          : "";
        toast.success(
          `Imported ${res.data.created} item${res.data.created === 1 ? "" : "s"}${extra}`
        );
      } else {
        toast.message("Import finished — no new items created");
      }
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setImporting(false);
    }
  };

  const saveScannedItem = async () => {
    if (!scanSave) return;
    const cid = (scanSave.consignor_id || "").trim();
    if (!cid) return toast.error("Choose a consignor ID");
    if (!scanSave.description?.trim()) return toast.error("Description is required");
    const price = Number(scanSave.asking_price);
    if (!(price > 0)) return toast.error("Enter a price greater than 0");
    setSavingScan(true);
    try {
      const { data } = await api.post("/inventory", {
        consignor_id: cid,
        description: scanSave.description.trim(),
        category: scanSave.category || "Other",
        size: scanSave.size || "",
        condition: scanSave.condition || "",
        asking_price: price,
        date_in: scanSave.date_in || undefined,
        rack: scanSave.rack || "",
        color: scanSave.color || "",
        text_id: scanSave.text_id || "",
      });
      toast.success(`Saved ${data.item_id}`);
      setScanSave(null);
      await load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setSavingScan(false);
    }
  };

  const focusedTone = focused ? toneFor(focused, today, sevenAhead) : null;

  const saveMedia = async (itemId, nextMedia) => {
    setItems((prev) =>
      prev.map((i) => (i.item_id === itemId ? { ...i, media: nextMedia } : i))
    );
    try {
      const { data } = await api.patch(`/inventory/${itemId}`, { media: nextMedia });
      if (data && Array.isArray(data.media)) {
        setItems((prev) =>
          prev.map((i) => (i.item_id === itemId ? { ...i, ...data } : i))
        );
      }
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
      load();
      throw e;
    }
  };

  const activeChips = [
    statusFilter !== "All" && {
      key: "status",
      label: statusFilter,
      testid: "chip-status",
      clear: () => setStatusFilter("All"),
    },
    rackFilter !== "All" && {
      key: "rack",
      label: `Rack ${rackFilter}`,
      testid: "chip-rack",
      clear: () => setRackFilter("All"),
    },
    categoryFilter !== "All" && {
      key: "category",
      label: categoryFilter,
      testid: "chip-category",
      clear: () => setCategoryFilter("All"),
    },
    flaggedOnly && {
      key: "review",
      label: flaggedCount > 0 ? `Needs review (${flaggedCount})` : "Needs review",
      testid: "chip-flagged",
      clear: () => setFlaggedOnly(false),
    },
  ].filter(Boolean);

  const clearAllFilters = () => {
    setStatusFilter("All");
    setRackFilter("All");
    setCategoryFilter("All");
    setFlaggedOnly(false);
  };

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-8 space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease }}
        className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4"
      >
        <div>
          <h1 data-testid="inventory-title" className="ee-page-title text-2xl">
            Inventory
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {items.length} item{items.length === 1 ? "" : "s"} · {activeCount} on floor
            {flaggedCount ? ` · ${flaggedCount} need review` : ""}
            {` · ${filtered.length} shown`}
          </p>
        </div>
        <div className="ee-page-actions">
          <Button
            type="button"
            variant="outline"
            data-testid="inventory-scan-item-btn"
            className="ee-btn-label rounded-[8px] border-[var(--ee-sidebar-border)]"
            onClick={() => setScanOpen(true)}
          >
            <Camera size={14} className="md:mr-1" />
            <span className="hidden md:inline">Scan item</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            data-testid="import-inventory-btn"
            className="ee-btn-label rounded-[8px] border-[var(--ee-sidebar-border)]"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={14} className="md:mr-1" />
            <span className="hidden md:inline">
              {importing ? "Importing…" : "Import CSV"}
            </span>
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            data-testid="import-inventory-file"
            onChange={onImportFile}
          />
        </div>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <Input
            data-testid="inventory-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search item, consignor, rack, color…"
            className="w-full pl-9 rounded-[8px] border-[var(--ee-sidebar-border)]"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              data-testid="add-filter-btn"
              className="ee-btn-label rounded-[8px] border-[var(--ee-sidebar-border)] shrink-0"
            >
              <SlidersHorizontal size={14} className="md:mr-1" />
              <span className="hidden sm:inline">Add filter</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger data-testid="filter-status-menu">
                Status
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-64 overflow-y-auto ee-scroll-hide">
                {STATUS_FILTERS.filter((f) => f !== "All").map((f) => (
                  <DropdownMenuItem
                    key={f}
                    data-testid={`filter-${f.toLowerCase().replace(/\s+/g, "-")}`}
                    onClick={() => setStatusFilter(f)}
                  >
                    {f}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger data-testid="filter-rack">Rack</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-64 overflow-y-auto ee-scroll-hide">
                {racks.length === 0 ? (
                  <DropdownMenuItem disabled>No racks yet</DropdownMenuItem>
                ) : (
                  racks.map((r) => (
                    <DropdownMenuItem key={r} onClick={() => setRackFilter(r)}>
                      {r}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger data-testid="filter-category">
                Category
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-64 overflow-y-auto ee-scroll-hide">
                {CATEGORIES.map((c) => (
                  <DropdownMenuItem key={c} onClick={() => setCategoryFilter(c)}>
                    {c}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid="filter-flagged-inventory-btn"
              onClick={() => setFlaggedOnly(true)}
            >
              <Flag size={14} className="mr-2" />
              Needs review
              {flaggedCount > 0 ? ` (${flaggedCount})` : ""}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="active-filter-chips">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              data-testid={chip.testid}
              onClick={chip.clear}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border border-[var(--ee-sidebar-border)] bg-black/[0.02] text-neutral-700 hover:border-[var(--ee-magenta)] transition-colors"
            >
              {chip.label}
              <X size={12} className="text-neutral-400" />
            </button>
          ))}
          <button
            type="button"
            data-testid="clear-all-filters"
            onClick={clearAllFilters}
            className="text-[11px] text-neutral-500 hover:text-[var(--ee-magenta)] px-1"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-neutral-600">
        {Object.values(TONES).map((t) => (
          <div key={t.label} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.accent }} />
            {t.label}
          </div>
        ))}
      </div>

      {selected.size > 0 && (
        <div
          data-testid="bulk-bar"
          className="bg-[var(--ee-magenta-soft)] border border-[var(--ee-magenta)] rounded-[11px] px-4 py-2 flex flex-col sm:flex-row sm:items-center gap-2"
        >
          <span className="text-sm font-semibold text-[var(--ee-magenta)] shrink-0">
            {selected.size} selected
          </span>
          <div className="ee-page-actions sm:ml-auto">
            <Button
              data-testid="bulk-sold"
              size="sm"
              variant="outline"
              className="ee-btn-label"
              onClick={() => bulk("sold")}
            >
              Mark Sold
            </Button>
            <Button
              data-testid="bulk-donated"
              size="sm"
              variant="outline"
              className="ee-btn-label"
              onClick={() => bulk("donated")}
            >
              Mark Donated
            </Button>
            <Button
              data-testid="bulk-returned"
              size="sm"
              variant="outline"
              className="ee-btn-label"
              onClick={() => bulk("returned")}
            >
              Mark Returned
            </Button>
            <Button
              data-testid="bulk-print"
              size="sm"
              className="ee-btn-label bg-[var(--ee-magenta)] text-white hover:bg-[#6f1655]"
              onClick={() => printTags([...selected])}
            >
              <Printer size={12} className="mr-1" /> Print Tags
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Dense list */}
        <div
          className={`${panel} overflow-hidden lg:w-[400px] xl:w-[440px] shrink-0 max-h-[70vh] flex flex-col`}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--ee-sidebar-border)] shrink-0">
            <Checkbox
              checked={allChecked}
              onCheckedChange={toggleAll}
              data-testid="inv-select-all"
            />
            <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-neutral-500">
              {filtered.length} shown
            </span>
          </div>
          <div
            data-testid="inventory-tbody"
            className="ee-scroll-hide overflow-y-auto flex-1 min-h-0"
          >
            <ul className="divide-y divide-[var(--ee-sidebar-border)]">
              {filtered.map((i) => {
                const tone = toneFor(i, today, sevenAhead);
                const flags = i.import_flags || [];
                const on = focusId === i.item_id;
                return (
                  <li key={i.item_id}>
                    <div
                      role="button"
                      tabIndex={0}
                      data-testid={`inv-row-${i.item_id}`}
                      onClick={() => setFocusId(i.item_id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setFocusId(i.item_id);
                        }
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors relative cursor-pointer ${
                        on ? "bg-black/[0.03]" : "hover:bg-black/[0.015]"
                      }`}
                    >
                      <span
                        className="absolute left-0 top-0 bottom-0 w-[2px]"
                        style={{ background: on ? tone.accent : "transparent" }}
                      />
                      <div
                        className="shrink-0"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          data-testid={`inv-check-${i.item_id}`}
                          checked={selected.has(i.item_id)}
                          onCheckedChange={() => toggle(i.item_id)}
                        />
                      </div>
                      {(i.media || [])[0] ? (
                        <div className="w-9 h-9 rounded-[7px] overflow-hidden shrink-0 bg-neutral-100 border border-[var(--ee-sidebar-border)]">
                          <img
                            src={i.media[0]}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : null}
                      <div className="min-w-0 flex-1 pl-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-semibold text-[13px] truncate">
                            {i.description}
                          </span>
                          {flags.length > 0 && (
                            <Flag size={10} className="text-amber-700 shrink-0" />
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-500 truncate mt-0.5">
                          {i.item_id} · {i.rack || "—"} · {i.status}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div
                          className="text-[13px] font-semibold tabular-nums"
                          style={{ color: tone.ink }}
                        >
                          {fmtMoney(i.asking_price)}
                        </div>
                        <div
                          className="text-[9px] uppercase tracking-[0.1em] font-semibold mt-0.5"
                          style={{ color: tone.ink }}
                        >
                          {tone.label}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="text-center text-sm text-neutral-400 py-12 font-light">
                  No items match.
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Detail panel */}
        <AnimatePresence mode="wait">
          {focused && focusedTone ? (
            <motion.div
              key={focused.item_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.35, ease }}
              className={`${panel} p-6 sm:p-8 flex-1 min-w-0`}
              data-testid="inventory-detail"
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
                    initials(focused.description)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="ee-page-title text-2xl truncate">
                        {focused.description}
                      </h2>
                      <p className="text-sm text-neutral-500 mt-1 tabular-nums">
                        {focused.item_id}
                        {focused.category ? ` · ${focused.category}` : ""}
                        {focused.color ? ` · ${focused.color}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className="text-2xl font-bold tabular-nums"
                        style={{ color: focusedTone.ink }}
                      >
                        {fmtMoney(focused.asking_price)}
                      </div>
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
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <ItemMediaGallery
                  media={focused.media || []}
                  onChange={(next) => saveMedia(focused.item_id, next)}
                />
              </div>

              <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                {[
                  ["Status", <StatusPill key="s" status={focused.status} />],
                  ["Rack", focused.rack || "—"],
                  ["Size", focused.size || "—"],
                  ["Date in", fmtDate(focused.date_in)],
                  ["Period end", fmtDate(focused.period_end)],
                  ["Text ID", focused.text_id || "—"],
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
                  [
                    "Flags",
                    (focused.import_flags || []).length
                      ? (focused.import_flags || []).map(flagLabel).join(", ")
                      : "None",
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <div className="text-[10px] tracking-[0.14em] uppercase text-neutral-500 font-semibold">
                      {label}
                    </div>
                    <div className="mt-1 font-medium min-w-0">{value}</div>
                  </div>
                ))}
              </div>

              {(focused.import_flags || []).length > 0 && (
                <div className="mt-5 rounded-[11px] border border-amber-200 bg-amber-50 p-3">
                  <div className="text-[10px] tracking-[0.14em] uppercase text-amber-800 font-semibold flex items-center gap-1">
                    <Flag size={11} /> Needs review
                  </div>
                  <ul className="mt-1.5 text-sm text-amber-900 space-y-0.5">
                    {focused.import_flags.map((f) => (
                      <li key={f}>{flagLabel(f)}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-8 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="ee-btn-label rounded-[8px] bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
                  onClick={() => printTags([focused.item_id])}
                >
                  <Printer size={13} className="mr-1" /> Print tag
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="ee-btn-label rounded-[8px] border-[var(--ee-sidebar-border)]"
                  onClick={() => bulk("sold", [focused.item_id])}
                >
                  Mark sold
                </Button>
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
              Select an item to inspect.
            </div>
          )}
        </AnimatePresence>
      </div>

      <ItemScanDialog
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        confirmLabel="Continue to save"
        onConfirm={(draft) => {
          setScanOpen(false);
          setScanSave({ ...draft });
        }}
      />

      <Dialog open={!!scanSave} onOpenChange={(o) => !o && setScanSave(null)}>
        <DialogContent data-testid="scan-save-dialog" className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save scanned item</DialogTitle>
            <DialogDescription>
              Confirm the consignor, then save to inventory.
            </DialogDescription>
          </DialogHeader>
          {scanSave && (
            <div className="space-y-3 text-sm">
              <div>
                <Label className="text-[10px] tracking-[0.14em] uppercase">Consignor</Label>
                <Select
                  value={scanSave.consignor_id || ""}
                  onValueChange={(v) =>
                    setScanSave((s) => ({ ...s, consignor_id: v }))
                  }
                >
                  <SelectTrigger data-testid="scan-save-consignor">
                    <SelectValue placeholder="Select consignor" />
                  </SelectTrigger>
                  <SelectContent>
                    {scanSave.consignor_id &&
                      !consignors.some(
                        (c) => c.consignor_id === scanSave.consignor_id
                      ) && (
                        <SelectItem value={scanSave.consignor_id}>
                          Unknown · {scanSave.consignor_id} (fix before save)
                        </SelectItem>
                      )}
                    {consignors.map((c) => (
                      <SelectItem key={c.consignor_id} value={c.consignor_id}>
                        {c.full_name} · {c.consignor_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-neutral-600 font-light">
                <span className="font-semibold text-neutral-900">{scanSave.description}</span>
                {scanSave.asking_price ? ` · $${scanSave.asking_price}` : ""}
                {scanSave.color ? ` · ${scanSave.color}` : ""}
                {scanSave.rack ? ` · ${scanSave.rack}` : ""}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="ee-btn-label"
              onClick={() => setScanSave(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              data-testid="scan-save-confirm"
              className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
              disabled={savingScan}
              onClick={saveScannedItem}
            >
              {savingScan ? "Saving…" : "Save item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!importResult} onOpenChange={(o) => !o && setImportResult(null)}>
        <DialogContent data-testid="inventory-import-summary-dialog" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import summary</DialogTitle>
            <DialogDescription>
              Incomplete rows are still imported and flagged for review. Items sync to
              consignors by ID (or unique name).
            </DialogDescription>
          </DialogHeader>
          {importResult && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  ["Created", importResult.created],
                  ["Flagged", importResult.flagged || 0],
                  ["Consignors", importResult.consignors_created || 0],
                  ["Skipped", importResult.skipped],
                  ["Errors", importResult.errors?.length || 0],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="border border-[var(--ee-sidebar-border)] rounded-[11px] p-3"
                  >
                    <div className="text-[10px] uppercase tracking-[0.14em] text-neutral-500 font-semibold">
                      {label}
                    </div>
                    <div className="text-2xl font-semibold mt-1">{value}</div>
                  </div>
                ))}
              </div>

              {importResult.created_consignor_ids?.length > 0 && (
                <p className="text-neutral-600 font-light">
                  New consignors: {importResult.created_consignor_ids.join(", ")}
                </p>
              )}

              {(importResult.flagged_rows?.length > 0 ||
                importResult.skipped_rows?.length > 0 ||
                importResult.errors?.length > 0) && (
                <div className="max-h-48 overflow-y-auto ee-scroll-hide border border-[var(--ee-sidebar-border)] rounded-[11px] divide-y divide-[var(--ee-sidebar-border)]">
                  {importResult.flagged_rows?.map((f) => (
                    <div key={`f-${f.row}-${f.item_id}`} className="px-3 py-2 text-amber-800">
                      Row {f.row} ({f.item_id} → {f.consignor_id}):{" "}
                      {(f.flags || []).map(flagLabel).join(", ")}
                    </div>
                  ))}
                  {importResult.skipped_rows?.map((s) => (
                    <div key={`s-${s.row}-${s.reason}`} className="px-3 py-2 text-neutral-600">
                      Row {s.row}: {s.reason}
                      {s.matched_id ? ` (${s.matched_id})` : ""}
                    </div>
                  ))}
                  {importResult.errors?.map((err) => (
                    <div key={`e-${err.row}-${err.reason}`} className="px-3 py-2 text-red-700">
                      Row {err.row}: {err.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              data-testid="inventory-import-summary-close"
              className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
              onClick={() => setImportResult(null)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
