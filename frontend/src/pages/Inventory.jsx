import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fmtMoney, fmtDate, formatApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
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
import { Camera, Download, Flag, Printer, Search, Upload } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CATEGORIES } from "@/lib/brand";
import { toast } from "sonner";
import ItemScanDialog from "@/components/ItemScanDialog";

const STATUS_FILTERS = ["All", "Active", "Expiring Soon", "Expired", "Sold", "Donated", "Returned"];
const FILTER_PILL_W = "w-[9.75rem]";
const FILTER_PILL_CLASS =
  "shrink-0 whitespace-nowrap text-[10px] uppercase tracking-[0.14em] font-semibold px-3 py-1.5 rounded border";

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

function flagLabel(flag) {
  return FLAG_LABELS[flag] || flag;
}

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [rackFilter, setRackFilter] = useState("All");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [selected, setSelected] = useState(new Set());
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

  const bulk = async (action) => {
    if (selected.size === 0) return;
    try {
      await api.post("/inventory/bulk", { item_ids: [...selected], action });
      toast.success(`${selected.size} item(s) updated`);
      setSelected(new Set());
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const printTags = () => {
    if (selected.size === 0) return;
    const ids = [...selected].join(",");
    window.open(`/print/tags?ids=${encodeURIComponent(ids)}`, "_blank", "noopener");
  };

  const downloadTemplate = async () => {
    try {
      const res = await api.get("/inventory/import/template", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "inventory-import-template.csv";
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

  return (
    <div className="px-6 md:px-10 py-8">
      <PageHeader
        title="Inventory"
        subtitle={`${items.length} item${items.length === 1 ? "" : "s"} tracked${
          flaggedCount ? ` · ${flaggedCount} need review` : ""
        }`}
        testid="inventory-title"
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              data-testid="inventory-scan-item-btn"
              className="ee-btn-label"
              onClick={() => setScanOpen(true)}
            >
              <Camera size={14} className="md:mr-1" />
              <span className="hidden md:inline">Scan item</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              data-testid="download-inventory-template-btn"
              className="ee-btn-label"
              onClick={downloadTemplate}
            >
              <Download size={14} className="md:mr-1" />
              <span className="hidden md:inline">Template</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              data-testid="import-inventory-btn"
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
              data-testid="import-inventory-file"
              onChange={onImportFile}
            />
            <div className="relative shrink-0">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
              />
              <Input
                data-testid="inventory-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search inventory"
                className={`h-auto ${FILTER_PILL_W} pl-7 pr-3 py-1.5 text-[10px] uppercase tracking-[0.14em] font-semibold rounded border border-[var(--ee-border)] shadow-none text-neutral-600 hover:text-[var(--ee-magenta)] focus-visible:ring-1`}
              />
            </div>
          </div>
        }
      />

      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            data-testid={`filter-${f.toLowerCase().replace(/\s+/g, "-")}`}
            onClick={() => setStatusFilter(f)}
            className={`${FILTER_PILL_CLASS} ${
              statusFilter === f
                ? "bg-[var(--ee-magenta)] text-white border-[var(--ee-magenta)]"
                : "border-[var(--ee-border)] text-neutral-600 hover:text-[var(--ee-magenta)]"
            }`}
          >
            {f}
          </button>
        ))}
        <div className="shrink-0">
          <Select value={rackFilter} onValueChange={setRackFilter}>
            <SelectTrigger
              data-testid="filter-rack"
              className={`${FILTER_PILL_CLASS} h-auto ${FILTER_PILL_W} gap-1.5 shadow-none [&_svg]:h-3 [&_svg]:w-3 [&_svg]:opacity-70 ${
                rackFilter !== "All"
                  ? "bg-[var(--ee-magenta)] text-white border-[var(--ee-magenta)] hover:bg-[var(--ee-magenta)] hover:text-white"
                  : "border-[var(--ee-border)] text-neutral-600 hover:text-[var(--ee-magenta)]"
              }`}
            >
              <SelectValue placeholder="All racks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All racks</SelectItem>
              {racks.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="shrink-0">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger
              data-testid="filter-category"
              className={`${FILTER_PILL_CLASS} h-auto ${FILTER_PILL_W} gap-1.5 shadow-none [&_svg]:h-3 [&_svg]:w-3 [&_svg]:opacity-70 ${
                categoryFilter !== "All"
                  ? "bg-[var(--ee-magenta)] text-white border-[var(--ee-magenta)] hover:bg-[var(--ee-magenta)] hover:text-white"
                  : "border-[var(--ee-border)] text-neutral-600 hover:text-[var(--ee-magenta)]"
              }`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button
          type="button"
          data-testid="filter-flagged-inventory-btn"
          onClick={() => setFlaggedOnly((v) => !v)}
          className={`${FILTER_PILL_CLASS} inline-flex items-center gap-1 ${
            flaggedOnly
              ? "bg-[var(--ee-magenta)] text-white border-[var(--ee-magenta)]"
              : "border-[var(--ee-border)] text-neutral-600 hover:text-[var(--ee-magenta)]"
          }`}
        >
          <Flag size={10} />
          Needs review
          {flaggedCount > 0 && <span className="opacity-80">({flaggedCount})</span>}
        </button>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div
          data-testid="bulk-bar"
          className="bg-[var(--ee-magenta-soft)] border border-[var(--ee-magenta)] rounded-md px-4 py-2 mb-4 flex flex-col sm:flex-row sm:items-center gap-2"
        >
          <span className="text-sm font-semibold text-[var(--ee-magenta)] shrink-0">
            {selected.size} selected
          </span>
          <div className="ee-page-actions sm:ml-auto">
            <Button data-testid="bulk-sold" size="sm" variant="outline" className="ee-btn-label" onClick={() => bulk("sold")}>Mark Sold</Button>
            <Button data-testid="bulk-donated" size="sm" variant="outline" className="ee-btn-label" onClick={() => bulk("donated")}>Mark Donated</Button>
            <Button data-testid="bulk-returned" size="sm" variant="outline" className="ee-btn-label" onClick={() => bulk("returned")}>Mark Returned</Button>
            <Button data-testid="bulk-print" size="sm" className="ee-btn-label bg-[var(--ee-magenta)] text-white hover:bg-[#6f1655]" onClick={printTags}>
              <Printer size={12} className="mr-1" /> Print Tags
            </Button>
          </div>
        </div>
      )}

      <div className="bg-white border border-[var(--ee-border)] rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-neutral-50 border-b border-[var(--ee-border)]">
              <tr>
                <th className="px-3 py-3 w-8">
                  <Checkbox checked={allChecked} onCheckedChange={toggleAll} data-testid="inv-select-all" />
                </th>
                {["Status", "Item ID", "Text ID", "Consignor", "Description", "Rack", "Color", "Size", "Price", "Date In", "Flags"].map((h) => (
                  <th key={h} className="ee-table-header text-left px-3 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody data-testid="inventory-tbody">
              {filtered.map((i) => {
                const flags = i.import_flags || [];
                return (
                  <tr key={i.item_id} className="border-b border-[var(--ee-border)] last:border-0 ee-row-alt">
                    <td className="px-3 py-2.5">
                      <Checkbox
                        data-testid={`inv-check-${i.item_id}`}
                        checked={selected.has(i.item_id)}
                        onCheckedChange={() => toggle(i.item_id)}
                      />
                    </td>
                    <td className="px-3 py-2.5"><StatusPill status={i.status} /></td>
                    <td className="px-3 py-2.5 font-semibold">{i.item_id}</td>
                    <td className="px-3 py-2.5 text-neutral-600">{i.text_id || "—"}</td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => nav(`/consignors/${i.consignor_id}`)}
                        className="text-left hover:text-[var(--ee-magenta)] whitespace-nowrap"
                      >
                        {i.consignor_name}
                        <span className="text-neutral-500 font-normal"> · {i.consignor_id}</span>
                      </button>
                    </td>
                    <td className="px-3 py-2.5 max-w-[220px] truncate" title={i.description}>{i.description}</td>
                    <td className="px-3 py-2.5 text-neutral-600">{i.rack || "—"}</td>
                    <td className="px-3 py-2.5 text-neutral-600">{i.color || "—"}</td>
                    <td className="px-3 py-2.5 text-neutral-600">{i.size || "—"}</td>
                    <td className="px-3 py-2.5 font-semibold">{fmtMoney(i.asking_price)}</td>
                    <td className="px-3 py-2.5 text-neutral-600">{fmtDate(i.date_in)}</td>
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
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={12} className="text-center text-sm text-neutral-400 py-12 font-light">No items match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
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
                  <div key={label} className="border border-[var(--ee-border)] rounded-md p-3">
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
                <div className="max-h-48 overflow-y-auto border border-[var(--ee-border)] rounded-md divide-y divide-[var(--ee-border)]">
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
