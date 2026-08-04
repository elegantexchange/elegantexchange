import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, fmtMoney, formatApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
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
import { Download, Flag, Plus, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import IntakeDialog from "@/components/IntakeDialog";

const FLAG_LABELS = {
  missing_name: "Missing name",
  missing_contact: "Missing contact",
  missing_drop_off_date: "No drop-off date",
  unparsed_drop_off_date: "Unparsed drop-off date",
};

function flagLabel(flag) {
  return FLAG_LABELS[flag] || flag;
}

export default function Consignors() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [params, setParams] = useSearchParams();
  const [openIntake, setOpenIntake] = useState(
    params.get("intake") === "1" || params.get("new") === "1"
  );
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);
  const intakePresetMode = params.get("new") === "1" ? "new" : "existing";
  const nav = useNavigate();

  const load = () => api.get("/consignors").then((r) => setList(r.data));
  useEffect(() => {
    load();
  }, []);

  const flaggedCount = useMemo(
    () => list.filter((c) => c.needs_review || (c.import_flags || []).length > 0).length,
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
    <div className="px-6 md:px-10 py-8">
      <PageHeader
        title="Consignors"
        subtitle={`${list.length} consignor${list.length === 1 ? "" : "s"} on file${
          flaggedCount ? ` · ${flaggedCount} need review` : ""
        }`}
        testid="consignors-title"
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              data-testid="download-consignor-template-btn"
              className="ee-btn-label"
              onClick={downloadTemplate}
            >
              <Download size={14} className="md:mr-1" />
              <span className="hidden md:inline">Template</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              data-testid="import-consignors-btn"
              className="ee-btn-label"
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
              className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
              onClick={() => setOpenIntake(true)}
            >
              <Plus size={14} className="md:mr-1" />
              <span className="hidden md:inline">New Drop-Off</span>
            </Button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
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
            className="w-full pl-9"
          />
        </div>
        <Button
          type="button"
          variant={flaggedOnly ? "default" : "outline"}
          data-testid="filter-flagged-btn"
          className={`ee-btn-label shrink-0 ${
            flaggedOnly
              ? "bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
              : ""
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

      <div className="bg-white border border-[var(--ee-border)] rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-neutral-50 border-b border-[var(--ee-border)]">
              <tr>
                {["ID", "Name", "Phone", "Email", "Flags", "Active Items", "Total Owed", "Payout"].map((h) => (
                  <th key={h} className="ee-table-header text-left px-3 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody data-testid="consignors-tbody">
              {filtered.map((c) => {
                const flags = c.import_flags || [];
                return (
                  <tr
                    key={c.consignor_id}
                    data-testid={`consignor-row-${c.consignor_id}`}
                    className="border-b border-[var(--ee-border)] last:border-0 ee-row-alt hover:bg-[var(--ee-magenta-soft)]/40 cursor-pointer"
                    onClick={() => nav(`/consignors/${c.consignor_id}`)}
                  >
                    <td className="px-3 py-2.5 font-semibold">{c.consignor_id}</td>
                    <td className="px-3 py-2.5">{c.full_name}</td>
                    <td className="px-3 py-2.5 text-neutral-600">{c.phone || "—"}</td>
                    <td
                      className="px-3 py-2.5 text-neutral-600 max-w-[200px] truncate"
                      title={c.email || undefined}
                    >
                      {c.email || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {flags.length > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
                          title={flags.map(flagLabel).join(", ")}
                        >
                          <Flag size={10} />
                          {flags.length}
                        </span>
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">{c.active_items}</td>
                    <td className="px-3 py-2.5 font-semibold text-[var(--ee-magenta)]">
                      {fmtMoney(c.total_owed)}
                    </td>
                    <td className="px-3 py-2.5 text-neutral-600">{c.payout_method}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-neutral-400 py-10 text-sm font-light">
                    No consignors match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <IntakeDialog
        open={openIntake}
        presetMode={intakePresetMode}
        onClose={() => {
          setOpenIntake(false);
          params.delete("intake");
          params.delete("new");
          setParams(params);
        }}
        onDone={() => load()}
      />

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
                  <div key={label} className="border border-[var(--ee-border)] rounded-md p-3">
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
                <div className="max-h-48 overflow-y-auto border border-[var(--ee-border)] rounded-md divide-y divide-[var(--ee-border)]">
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
