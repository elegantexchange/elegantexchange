import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api, fmtMoney, fmtPhone, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Download,
  Flag,
  LayoutGrid,
  List,
  Mail,
  Phone,
  Rows3,
  Search,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { isManagerOrAdmin } from "@/lib/auth";

const FLAG_LABELS = {
  missing_name: "Missing name",
  missing_contact: "Missing contact",
  missing_drop_off_date: "No drop-off date",
  unparsed_drop_off_date: "Unparsed drop-off date",
  expired_items: "Expired items on floor",
};

const TONES = {
  review: {
    key: "review",
    label: "Needs review",
    ink: "#8a6a14",
    soft: "#faf6e9",
    border: "#ead9a8",
    avatar: "#f3ead0",
  },
  owed: {
    key: "owed",
    label: "Payout due",
    ink: "#8b1f6b",
    soft: "#f8eef5",
    border: "#e8cfe0",
    avatar: "#f0dceb",
  },
  on_floor: {
    key: "on_floor",
    label: "On floor",
    ink: "#2f5a7a",
    soft: "#eef4f8",
    border: "#c8dae6",
    avatar: "#dde8f0",
  },
  settled: {
    key: "settled",
    label: "Settled",
    ink: "#3d6b52",
    soft: "#f3f8f4",
    border: "#d5e5da",
    avatar: "#e4f0e8",
  },
};

const VIEW_KEY = "ee_consignors_view_v2";
const VIEWS = [
  { id: "list", label: "List", icon: List },
  { id: "cards", label: "Cards", icon: LayoutGrid },
  { id: "ledger", label: "Ledger", icon: Rows3 },
];

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

function flagLabel(flag) {
  return FLAG_LABELS[flag] || flag;
}

function needsName(c) {
  const flags = c.import_flags || [];
  if (flags.includes("missing_name")) return true;
  const name = (c.full_name || "").trim();
  if (!name || name.length < 2) return true;
  // Import placeholders — treat as unnamed
  if (/^\(name needed\b/i.test(name)) return true;
  if (/^unassigned\b/i.test(name)) return true;
  if (/^consignor\s+\d+/i.test(name)) return true;
  return false;
}

function displayName(c) {
  return needsName(c) ? "Needs name" : c.full_name;
}

function displayFlags(c) {
  return derivedFlags(c).filter((f) => f !== "missing_name");
}

function hasContact(c) {
  return Boolean((c.phone || "").trim() || (c.email || "").trim());
}

function derivedFlags(c) {
  const flags = [...(c.import_flags || [])];
  if (!hasContact(c) && !flags.includes("missing_contact")) {
    flags.push("missing_contact");
  }
  return flags;
}

function floorCount(c) {
  const n = c.floor_items ?? c.active_items;
  return typeof n === "number" ? n : 0;
}

/** Active items still in period (not expired). */
function liveCount(c) {
  if (typeof c.live_items === "number") return c.live_items;
  return Math.max(0, floorCount(c) - (c.expired_items || 0));
}

function floorCaption(c) {
  const live = liveCount(c);
  const expired = c.expired_items || 0;
  if (live <= 0 && expired <= 0) return "0 on floor";
  const parts = [];
  if (live > 0) parts.push(`${live} active`);
  if (expired > 0) parts.push(`${expired} expired`);
  return parts.join(" · ");
}

function toneFor(c, showFinance) {
  const flags = derivedFlags(c);
  const expired = (c.expired_items || 0) > 0;
  const needsReview = c.needs_review || flags.length > 0 || expired;
  const payoutDue = showFinance && (c.total_owed || 0) > 0;
  const onFloor = liveCount(c) > 0;
  if (needsReview) return TONES.review;
  if (payoutDue) return TONES.owed;
  if (onFloor) return TONES.on_floor;
  return TONES.settled;
}

function isSettledFloor(c, showFinance) {
  const payoutDue = showFinance && (c.total_owed || 0) > 0;
  return !payoutDue && liveCount(c) <= 0 && (c.expired_items || 0) <= 0;
}

function pillsFor(c, showFinance) {
  const flags = derivedFlags(c);
  const expired = (c.expired_items || 0) > 0;
  const needsReview = c.needs_review || flags.length > 0 || expired;
  const payoutDue = showFinance && (c.total_owed || 0) > 0;
  const onFloor = liveCount(c) > 0;
  const pills = [];
  if (needsReview) pills.push(TONES.review);
  if (payoutDue) pills.push(TONES.owed);
  if (onFloor) pills.push(TONES.on_floor);
  else if (isSettledFloor(c, showFinance)) pills.push(TONES.settled);
  if (!pills.length) pills.push(TONES.settled);
  return pills;
}

function primaryTone(c, showFinance) {
  return pillsFor(c, showFinance)[0] || TONES.settled;
}

function firstNameKey(name) {
  return ((name || "").trim().split(/\s+/)[0] || "").toLowerCase();
}

function idSortKey(id) {
  const digits = String(id || "").replace(/\D/g, "");
  if (digits) return [0, Number(digits), String(id || "")];
  return [1, 0, String(id || "").toLowerCase()];
}

function initials(c) {
  if (needsName(c)) {
    const digits = String(c.consignor_id || "").replace(/\D/g, "");
    if (digits.length >= 2) return digits.slice(-2);
    return "?";
  }
  return (c.full_name || "")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function StatusPill({ tone }) {
  return (
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
  );
}

function readView() {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (VIEWS.some((x) => x.id === v)) return v;
  } catch {
    /* ignore */
  }
  return "list";
}

export default function Consignors() {
  const { user } = useAuth();
  const showFinance = isManagerOrAdmin(user);
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [toneFilter, setToneFilter] = useState(null); // review | owed | on_floor | settled | null
  const [expiredOnly, setExpiredOnly] = useState(false);
  // Default: named consignors only. Filter → Needs name to see placeholders.
  const [needsNameOnly, setNeedsNameOnly] = useState(false);
  const [namedOnly, setNamedOnly] = useState(true);
  const [sortBy, setSortBy] = useState("name"); // name | id
  const [view, setView] = useState(readView);
  const [params] = useSearchParams();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);
  const nav = useNavigate();

  const load = () => api.get("/consignors").then((r) => setList(r.data));
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (params.get("intake") === "1" || params.get("new") === "1") {
      nav("/drop-off", { replace: true });
    }
  }, [params, nav]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  // Hide leftover automated test stubs until hygiene removes them
  const baseList = useMemo(
    () =>
      list.filter(
        (c) => !/^auto\s+id\s+skip\s+test\b/i.test(c.full_name || "")
      ),
    [list]
  );

  const flaggedCount = useMemo(
    () =>
      baseList.filter((c) => {
        const flags = derivedFlags(c);
        return (
          c.needs_review ||
          flags.length > 0 ||
          (c.expired_items || 0) > 0
        );
      }).length,
    [baseList]
  );

  const needsNameCount = useMemo(
    () => baseList.filter((c) => needsName(c)).length,
    [baseList]
  );

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    const rows = baseList.filter((c) => {
      if (needsNameOnly) {
        if (!needsName(c)) return false;
      } else if (namedOnly && needsName(c)) {
        return false;
      }
      if (expiredOnly && !(c.expired_items > 0)) return false;
      const tone = toneFor(c, showFinance);
      if (toneFilter === "review") {
        if (tone.key !== "review") return false;
      } else if (toneFilter === "owed") {
        if (!((c.total_owed || 0) > 0)) return false;
      } else if (toneFilter === "on_floor") {
        if (liveCount(c) <= 0) return false;
      } else if (toneFilter === "settled") {
        // Paid up with no active (non-expired) floor items — independent of review flags
        if (!isSettledFloor(c, showFinance)) return false;
      }
      if (!term) return true;
      const phoneDigits = (c.phone || "").replace(/\D/g, "");
      const termDigits = term.replace(/\D/g, "");
      return (
        (c.full_name || "").toLowerCase().includes(term) ||
        displayName(c).toLowerCase().includes(term) ||
        (c.consignor_id || "").toLowerCase().includes(term) ||
        (c.phone || "").toLowerCase().includes(term) ||
        (termDigits && phoneDigits.includes(termDigits)) ||
        (c.email || "").toLowerCase().includes(term)
      );
    });

    const byId = (a, b) => {
      const ka = idSortKey(a.consignor_id);
      const kb = idSortKey(b.consignor_id);
      if (ka[0] !== kb[0]) return ka[0] - kb[0];
      if (ka[1] !== kb[1]) return ka[1] - kb[1];
      return ka[2].localeCompare(kb[2]);
    };
    const byName = (a, b) => {
      const fa = firstNameKey(a.full_name);
      const fb = firstNameKey(b.full_name);
      if (fa !== fb) return fa.localeCompare(fb);
      const na = (a.full_name || "").toLowerCase();
      const nb = (b.full_name || "").toLowerCase();
      if (na !== nb) return na.localeCompare(nb);
      return byId(a, b);
    };

    const sorted = [...rows];
    if (sortBy === "id") {
      sorted.sort(byId);
    } else {
      sorted.sort(byName);
    }
    return sorted;
  }, [
    baseList,
    q,
    toneFilter,
    expiredOnly,
    needsNameOnly,
    namedOnly,
    showFinance,
    sortBy,
  ]);

  const activeChips = useMemo(() => {
    const chips = [];
    if (needsNameOnly) {
      chips.push({
        key: "needs-name",
        label: "Needs name",
        clear: () => {
          setNeedsNameOnly(false);
          setNamedOnly(true);
        },
      });
    } else if (!namedOnly) {
      chips.push({
        key: "all-names",
        label: "All consignors",
        clear: () => setNamedOnly(true),
      });
    }
    if (toneFilter === "review") {
      chips.push({
        key: "tone-review",
        label: "Needs review",
        clear: () => setToneFilter(null),
      });
    }
    if (toneFilter === "owed") {
      chips.push({
        key: "tone-owed",
        label: "Payout due",
        clear: () => setToneFilter(null),
      });
    }
    if (toneFilter === "on_floor") {
      chips.push({
        key: "tone-on-floor",
        label: "On floor",
        clear: () => setToneFilter(null),
      });
    }
    if (toneFilter === "settled") {
      chips.push({
        key: "tone-settled",
        label: "Settled",
        clear: () => setToneFilter(null),
      });
    }
    if (expiredOnly) {
      chips.push({
        key: "expired",
        label: "Expired items",
        clear: () => setExpiredOnly(false),
      });
    }
    return chips;
  }, [toneFilter, expiredOnly, needsNameOnly, namedOnly]);

  const clearAllFilters = () => {
    setToneFilter(null);
    setExpiredOnly(false);
    setNeedsNameOnly(false);
    setNamedOnly(true);
  };

  const downloadTemplate = async () => {
    try {
      const res = await api.get("/consignors/import/template", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "consignors-import-template.csv";
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Template downloaded");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const onImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post("/consignors/import", form);
      setImportResult(res.data);
      await load();
      if (res.data.created > 0) {
        toast.success(
          `Imported ${res.data.created} consignor${res.data.created === 1 ? "" : "s"}`
        );
      } else {
        toast.message("Import finished — no new consignors created");
      }
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setImporting(false);
    }
  };

  const open = (id) => nav(`/consignors/${id}`);

  const metaLine = (
    <>
      {filtered.length} consignor{filtered.length === 1 ? "" : "s"}
      {showFinance && filtered.length > 0
        ? ` · ${fmtMoney(filtered.reduce((sum, c) => sum + (c.total_owed || 0), 0))} owed`
        : ""}
      {needsNameCount ? (
        <>
          {" · "}
          <button
            type="button"
            data-testid="consignors-meta-needs-name"
            onClick={() => {
              setNeedsNameOnly(true);
              setNamedOnly(false);
            }}
            className="text-[var(--ee-magenta)] font-medium hover:underline"
          >
            {needsNameCount} need a name
          </button>
        </>
      ) : null}
      {flaggedCount ? ` · ${flaggedCount} need review` : ""}
    </>
  );

  const viewToggle = (
    <div
      className="inline-flex shrink-0 rounded-[8px] border border-[var(--ee-sidebar-border)] bg-[var(--ee-panel)] p-0.5"
      role="group"
      aria-label="Consignor view"
    >
      {VIEWS.map(({ id, label, icon: Icon }) => {
        const on = view === id;
        return (
          <button
            key={id}
            type="button"
            data-testid={`consignors-view-${id}`}
            onClick={() => setView(id)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-[11px] font-semibold tracking-[0.06em] uppercase transition-colors ${
              on
                ? "bg-[var(--ee-magenta)] text-white"
                : "text-neutral-600 hover:bg-black/[0.03]"
            }`}
            title={label}
          >
            <Icon size={14} strokeWidth={1.75} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );

  const sortToggle = (
    <div
      className="inline-flex shrink-0 rounded-[8px] border border-[var(--ee-sidebar-border)] bg-[var(--ee-panel)] p-0.5"
      role="group"
      aria-label="Sort consignors"
    >
      {[
        ["name", "Name"],
        ["id", "ID"],
      ].map(([id, label]) => {
        const on = sortBy === id;
        return (
          <button
            key={id}
            type="button"
            data-testid={`consignors-sort-${id}`}
            onClick={() => setSortBy(id)}
            className={`px-2.5 py-1.5 rounded-[6px] text-[11px] font-semibold tracking-[0.06em] uppercase transition-colors ${
              on
                ? "bg-[var(--ee-magenta)] text-white"
                : "text-neutral-600 hover:bg-black/[0.03]"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  const filterMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          data-testid="consignors-add-filter-btn"
          className="ee-btn-label rounded-[8px] border-[var(--ee-sidebar-border)] shrink-0"
        >
          <SlidersHorizontal size={14} className="md:mr-1" />
          <span className="hidden sm:inline">Filter</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10.5rem] p-1">
        {[
          ["filter-needs-name", "Needs name", () => {
            setNeedsNameOnly(true);
            setNamedOnly(false);
          }],
          ["filter-needs-review", "Needs review", () => setToneFilter("review")],
          showFinance && [
            "filter-payout-due",
            "Payout due",
            () => setToneFilter("owed"),
          ],
          ["filter-on-floor", "On floor", () => setToneFilter("on_floor")],
          ["filter-settled", "Settled", () => setToneFilter("settled")],
          ["filter-expired-items", "Expired items", () => setExpiredOnly(true)],
          ["filter-all-names", "All consignors", () => {
            setNeedsNameOnly(false);
            setNamedOnly(false);
          }],
        ]
          .filter(Boolean)
          .map(([id, label, onClick]) => (
            <DropdownMenuItem
              key={id}
              data-testid={id}
              onClick={onClick}
              className="text-[13px] cursor-pointer"
            >
              {label}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const importActions = (
    <>
      <Button
        type="button"
        variant="ghost"
        data-testid="download-consignor-template-btn"
        className="ee-btn-label rounded-[8px] text-neutral-600 h-9 px-2.5"
        onClick={downloadTemplate}
        title="Download template"
      >
        <Download size={14} className="md:mr-1" />
        <span className="hidden lg:inline">Template</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        data-testid="import-consignors-btn"
        className="ee-btn-label rounded-[8px] text-neutral-600 h-9 px-2.5"
        disabled={importing}
        onClick={() => fileRef.current?.click()}
        title="Import CSV"
      >
        <Upload size={14} className="md:mr-1" />
        <span className="hidden lg:inline">
          {importing ? "Importing…" : "Import"}
        </span>
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        data-testid="import-consignors-file"
        onChange={onImportFile}
      />
    </>
  );

  const searchField = (
    <div className="relative w-full min-w-0 flex-1">
      <Search
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
      />
      <Input
        data-testid="consignors-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, ID, phone, email…"
        className="w-full pl-9 rounded-[8px] border-[var(--ee-sidebar-border)]"
      />
    </div>
  );

  const activeChipRow =
    activeChips.length > 0 ? (
      <div
        className="flex flex-wrap items-center gap-1.5"
        data-testid="consignors-active-filter-chips"
      >
        {activeChips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={chip.clear}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border border-[var(--ee-sidebar-border)] bg-black/[0.02] text-neutral-700 hover:border-[var(--ee-magenta)] transition-colors"
          >
            {chip.label}
            <X size={12} className="text-neutral-400" />
          </button>
        ))}
        <button
          type="button"
          data-testid="consignors-clear-all-filters"
          onClick={clearAllFilters}
          className="text-[11px] text-neutral-500 hover:text-[var(--ee-magenta)] px-1"
        >
          Clear
        </button>
      </div>
    ) : null;

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
            <h1 data-testid="consignors-title" className="ee-page-title text-2xl">
              Consignors
            </h1>
            <p className="text-[13px] text-neutral-500 mt-0.5 break-words">
              {metaLine}
            </p>
          </div>
          <div className="ee-page-actions shrink-0">{importActions}</div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center min-w-0">
          {searchField}
          {sortToggle}
          {viewToggle}
          {filterMenu}
        </div>
        {activeChipRow}
      </motion.div>

      {view === "cards" && (
        <div
          data-testid="consignors-tbody"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 min-w-0"
        >
          {filtered.map((c, i) => {
            const flags = displayFlags(c);
            const tone = primaryTone(c, showFinance);
            const pills = pillsFor(c, showFinance);
            return (
              <motion.button
                key={c.consignor_id}
                type="button"
                data-testid={`consignor-row-${c.consignor_id}`}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                animate="show"
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                onClick={() => open(c.consignor_id)}
                className={`${panel} p-5 text-left cursor-pointer min-w-0`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="w-11 h-11 rounded-[10px] flex items-center justify-center text-[13px] font-bold shrink-0"
                    style={{
                      background: tone.avatar,
                      color: tone.ink,
                      boxShadow: `inset 0 0 0 1px ${tone.border}`,
                    }}
                  >
                    {initials(c)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-[var(--ee-ink)] truncate">
                          {displayName(c)}
                        </div>
                        <div className="text-[11px] text-neutral-500 tabular-nums mt-0.5">
                          {c.consignor_id}
                          {(c.expired_items || 0) > 0
                            ? ` · ${c.expired_items} expired`
                            : ""}
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1 shrink-0 max-w-[50%]">
                        {pills.map((p) => (
                          <StatusPill key={p.key} tone={p} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between gap-3">
                  {showFinance ? (
                    <div>
                      <div className="text-[10px] tracking-[0.16em] uppercase text-neutral-500 font-semibold">
                        Owed
                      </div>
                      <div
                        className="text-xl font-bold tabular-nums mt-0.5"
                        style={{
                          color: (c.total_owed || 0) > 0 ? tone.ink : "#a3a3a3",
                        }}
                      >
                        {fmtMoney(c.total_owed)}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-[10px] tracking-[0.16em] uppercase text-neutral-500 font-semibold">
                        On floor
                      </div>
                      <div
                        className="text-xl font-bold tabular-nums mt-0.5"
                        style={{ color: tone.ink }}
                      >
                        {floorCount(c)}
                      </div>
                    </div>
                  )}
                  <div className="text-right text-[11px] text-neutral-500">
                    {showFinance ? (
                      <>
                        <div>{floorCaption(c)}</div>
                        <div>{c.payout_method || "—"}</div>
                      </>
                    ) : (
                      <div>{floorCaption(c)}</div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-black/[0.06] space-y-1.5 text-[12px] text-neutral-600">
                  <div className="flex items-center gap-2 min-w-0">
                    <Phone size={12} className="shrink-0 text-neutral-400" />
                    <span className="truncate">
                      {c.phone ? fmtPhone(c.phone) : "No phone"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail size={12} className="shrink-0 text-neutral-400" />
                    <span className="truncate" title={c.email || undefined}>
                      {c.email || "No email"}
                    </span>
                  </div>
                  {flags.length > 0 && (
                    <div
                      className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] font-semibold text-amber-800 pt-0.5"
                      title={flags.map(flagLabel).join(", ")}
                    >
                      <Flag size={10} />
                      {flags.map(flagLabel).join(" · ")}
                    </div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {view === "list" && (
        <div
          data-testid="consignors-tbody"
          className={`${panel} overflow-hidden min-w-0`}
        >
          <ul className="divide-y divide-[var(--ee-sidebar-border)]">
            {filtered.map((c) => {
              const flags = displayFlags(c);
              const tone = primaryTone(c, showFinance);
              const pills = pillsFor(c, showFinance);
              return (
                <li key={c.consignor_id}>
                  <button
                    type="button"
                    data-testid={`consignor-row-${c.consignor_id}`}
                    onClick={() => open(c.consignor_id)}
                    className="w-full text-left px-3 sm:px-4 py-3 flex items-center gap-3 hover:bg-black/[0.02] transition-colors min-w-0"
                  >
                    <div
                      className="w-9 h-9 rounded-[8px] flex items-center justify-center text-[12px] font-bold shrink-0"
                      style={{
                        background: tone.avatar,
                        color: tone.ink,
                        boxShadow: `inset 0 0 0 1px ${tone.border}`,
                      }}
                    >
                      {initials(c)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="font-semibold text-[13px] truncate">
                          {displayName(c)}
                        </span>
                        {pills.map((p) => (
                          <StatusPill key={p.key} tone={p} />
                        ))}
                      </div>
                      <div className="text-[11px] text-neutral-500 truncate mt-0.5">
                        {c.consignor_id}
                        {c.phone ? ` · ${fmtPhone(c.phone)}` : ""}
                        {(c.expired_items || 0) > 0
                          ? ` · ${c.expired_items} expired`
                          : ""}
                        {flags.length
                          ? ` · ${flags.map(flagLabel).join(", ")}`
                          : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {showFinance ? (
                        <>
                          <div
                            className="text-[13px] font-semibold tabular-nums"
                            style={{
                              color:
                                (c.total_owed || 0) > 0 ? tone.ink : "#a3a3a3",
                            }}
                          >
                            {fmtMoney(c.total_owed)}
                          </div>
                          <div className="text-[10px] text-neutral-500 mt-0.5">
                            {floorCaption(c)}
                          </div>
                        </>
                      ) : (
                        <div
                          className="text-[13px] font-semibold tabular-nums"
                          style={{ color: tone.ink }}
                        >
                          {floorCount(c)}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {view === "ledger" && (
        <div
          data-testid="consignors-tbody"
          className={`${panel} overflow-x-auto min-w-0`}
        >
          <table className="w-full text-left text-[13px] min-w-[640px]">
            <thead>
              <tr className="border-b border-[var(--ee-sidebar-border)] text-[10px] uppercase tracking-[0.14em] text-neutral-500 font-semibold">
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-3 py-2.5 font-semibold">ID</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold text-right">On floor</th>
                {showFinance ? (
                  <th className="px-3 py-2.5 font-semibold text-right">Owed</th>
                ) : null}
                <th className="px-4 py-2.5 font-semibold">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ee-sidebar-border)]">
              {filtered.map((c) => {
                const tone = primaryTone(c, showFinance);
                const pills = pillsFor(c, showFinance);
                return (
                  <tr
                    key={c.consignor_id}
                    data-testid={`consignor-row-${c.consignor_id}`}
                    onClick={() => open(c.consignor_id)}
                    className="cursor-pointer hover:bg-black/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-[var(--ee-ink)] max-w-[200px] truncate">
                      {displayName(c)}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-neutral-500">
                      {c.consignor_id}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {pills.map((p) => (
                          <StatusPill key={p.key} tone={p} />
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-neutral-600">
                      {floorCaption(c)}
                    </td>
                    {showFinance ? (
                      <td
                        className="px-3 py-3 text-right tabular-nums font-semibold"
                        style={{
                          color: (c.total_owed || 0) > 0 ? tone.ink : "#a3a3a3",
                        }}
                      >
                        {fmtMoney(c.total_owed)}
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-neutral-600 max-w-[220px] truncate">
                      {c.phone ? fmtPhone(c.phone) : c.email || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center text-neutral-400 py-12 text-sm font-light">
          No consignors match.
        </div>
      )}

      <Dialog open={!!importResult} onOpenChange={(o) => !o && setImportResult(null)}>
        <DialogContent data-testid="import-summary-dialog" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import summary</DialogTitle>
            <DialogDescription>
              Incomplete rows are still imported and flagged for review.
            </DialogDescription>
          </DialogHeader>
          {importResult && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ["Created", importResult.created],
                  ["Flagged", importResult.flagged || 0],
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

              {importResult.created_ids?.length > 0 && (
                <p className="text-neutral-600 font-light">
                  Created IDs: {importResult.created_ids.join(", ")}
                </p>
              )}

              {(importResult.flagged_rows?.length > 0 ||
                importResult.skipped_rows?.length > 0 ||
                importResult.errors?.length > 0) && (
                <div className="max-h-48 overflow-y-auto border border-[var(--ee-sidebar-border)] rounded-[11px] divide-y divide-[var(--ee-sidebar-border)]">
                  {importResult.flagged_rows?.map((f) => (
                    <div key={`f-${f.row}-${f.consignor_id}`} className="px-3 py-2 text-amber-800">
                      Row {f.row} ({f.consignor_id}):{" "}
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
              data-testid="import-summary-close"
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
