import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api, fmtMoney, formatApiError } from "@/lib/api";
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
import { Download, Flag, Mail, Phone, Plus, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { isManagerOrAdmin } from "@/lib/auth";

const FLAG_LABELS = {
  missing_name: "Missing name",
  missing_contact: "Missing contact",
  missing_drop_off_date: "No drop-off date",
  unparsed_drop_off_date: "Unparsed drop-off date",
};

const TONES = {
  review: {
    label: "Needs review",
    ink: "#8a6a14",
    soft: "#faf6e9",
    border: "#ead9a8",
    avatar: "#f3ead0",
  },
  owed: {
    label: "Balance owed",
    ink: "#8b1f6b",
    soft: "#f8eef5",
    border: "#e8cfe0",
    avatar: "#f0dceb",
  },
  settled: {
    label: "Settled",
    ink: "#3d6b52",
    soft: "#f3f8f4",
    border: "#d5e5da",
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

function flagLabel(flag) {
  return FLAG_LABELS[flag] || flag;
}

function toneFor(c, showFinance) {
  const flags = c.import_flags || [];
  if (c.needs_review || flags.length > 0) return TONES.review;
  if (showFinance && (c.total_owed || 0) > 0) return TONES.owed;
  return TONES.settled;
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

export default function Consignors() {
  const { user } = useAuth();
  const showFinance = isManagerOrAdmin(user);
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [params] = useSearchParams();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);
  const nav = useNavigate();

  const load = () => api.get("/consignors").then((r) => setList(r.data));
  useEffect(() => {
    load();
  }, []);

  // Legacy staff intake URLs → client Typeform
  useEffect(() => {
    if (params.get("intake") === "1" || params.get("new") === "1") {
      nav("/drop-off", { replace: true });
    }
  }, [params, nav]);

  const flaggedCount = useMemo(
    () => list.filter((c) => c.needs_review || (c.import_flags || []).length > 0).length,
    [list]
  );

  const totalOwed = useMemo(
    () => list.reduce((sum, c) => sum + (c.total_owed || 0), 0),
    [list]
  );

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return list.filter((c) => {
      if (flaggedOnly && !(c.needs_review || (c.import_flags || []).length)) {
        return false;
      }
      if (!term) return true;
      return (
        c.full_name.toLowerCase().includes(term) ||
        c.consignor_id.toLowerCase().includes(term) ||
        (c.phone || "").toLowerCase().includes(term) ||
        (c.email || "").toLowerCase().includes(term)
      );
    });
  }, [list, q, flaggedOnly]);

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

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-8 space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease }}
        className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4"
      >
        <div>
          <h1 data-testid="consignors-title" className="ee-page-title text-2xl">
            Consignors
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {list.length} consignor{list.length === 1 ? "" : "s"} on file
            {showFinance && list.length > 0 ? ` · ${fmtMoney(totalOwed)} owed` : ""}
            {flaggedCount ? ` · ${flaggedCount} need review` : ""}
          </p>
        </div>
        <div className="ee-page-actions">
          <Button
            type="button"
            variant="outline"
            data-testid="download-consignor-template-btn"
            className="ee-btn-label rounded-[8px] border-[var(--ee-sidebar-border)]"
            onClick={downloadTemplate}
          >
            <Download size={14} className="md:mr-1" />
            <span className="hidden md:inline">Template</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            data-testid="import-consignors-btn"
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
            data-testid="import-consignors-file"
            onChange={onImportFile}
          />
          <Button
            data-testid="open-intake-btn"
            className="ee-btn-label rounded-[8px] bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
            onClick={() => nav("/drop-off")}
          >
            <Plus size={14} className="md:mr-1" />
            <span className="hidden md:inline">New Drop Off</span>
          </Button>
        </div>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative w-full">
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
        <Button
          type="button"
          variant={flaggedOnly ? "default" : "outline"}
          data-testid="filter-flagged-btn"
          className={`ee-btn-label shrink-0 rounded-[8px] ${
            flaggedOnly
              ? "bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
              : "border-[var(--ee-sidebar-border)]"
          }`}
          onClick={() => setFlaggedOnly((v) => !v)}
        >
          <Flag size={14} className="md:mr-1" />
          <span className="hidden md:inline">Needs review</span>
          {flaggedCount > 0 && (
            <span className="ml-1 text-[10px] opacity-80">({flaggedCount})</span>
          )}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-neutral-600">
        {Object.values(TONES).map((t) => (
          <div key={t.label} className="inline-flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: t.ink }}
            />
            {t.label}
          </div>
        ))}
      </div>

      <div
        data-testid="consignors-tbody"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
      >
        {filtered.map((c, i) => {
          const flags = c.import_flags || [];
          const tone = toneFor(c, showFinance);
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
              onClick={() => nav(`/consignors/${c.consignor_id}`)}
              className={`${panel} p-5 text-left cursor-pointer`}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-11 h-11 rounded-[10px] flex items-center justify-center text-[13px] font-bold shrink-0"
                  style={{
                    background: tone.avatar,
                    color: tone.ink,
                    boxShadow: `inset 0 0 0 1px ${tone.border}`,
                  }}
                >
                  {initials(c.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--ee-ink)] truncate">
                        {c.full_name}
                      </div>
                      <div className="text-[11px] text-neutral-500 tabular-nums mt-0.5">
                        {c.consignor_id}
                      </div>
                    </div>
                    {(showFinance || flags.length > 0) ? (
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
                    ) : null}
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
                    <div className="text-xl font-bold tabular-nums mt-0.5" style={{ color: tone.ink }}>
                      {c.active_items}
                    </div>
                  </div>
                )}
                <div className="text-right text-[11px] text-neutral-500">
                  {showFinance ? (
                    <>
                      <div>{c.active_items} active</div>
                      <div>{c.payout_method || "—"}</div>
                    </>
                  ) : (
                    <div>{c.active_items} active item{c.active_items === 1 ? "" : "s"}</div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-black/[0.06] space-y-1.5 text-[12px] text-neutral-600">
                <div className="flex items-center gap-2 min-w-0">
                  <Phone size={12} className="shrink-0 text-neutral-400" />
                  <span className="truncate">{c.phone || "No phone"}</span>
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
