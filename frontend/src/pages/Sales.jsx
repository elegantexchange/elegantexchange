import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, fmtMoney, fmtDate, formatApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [q, setQ] = useState("");
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.get("new") === "1");
  const [square, setSquare] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const load = () => api.get("/sales").then((r) => setSales(r.data));
  const loadSquare = () => api.get("/square/status").then((r) => setSquare(r.data)).catch(() => null);
  useEffect(() => {
    load();
    loadSquare();
  }, []);

  const filtered = useMemo(() => {
    const t = q.toLowerCase().trim();
    if (!t) return sales;
    return sales.filter(
      (s) =>
        s.item_id.toLowerCase().includes(t) ||
        s.consignor_id.toLowerCase().includes(t) ||
        (s.consignor_name || "").toLowerCase().includes(t) ||
        (s.description || "").toLowerCase().includes(t)
    );
  }, [sales, q]);

  const totalSales = sales.reduce((acc, s) => acc + s.sale_price, 0);
  const totalStore = sales.reduce((acc, s) => acc + s.store_cut, 0);

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

  return (
    <div className="px-6 md:px-10 py-8">
      <PageHeader
        title="Sales"
        subtitle={`${sales.length} sale${sales.length === 1 ? "" : "s"} · ${fmtMoney(totalSales)} total · ${fmtMoney(totalStore)} store revenue`}
        testid="sales-title"
        actions={
          <>
            {square?.connected && (
              <Button
                data-testid="sync-square-btn"
                variant="outline"
                className="ee-btn-label"
                disabled={syncing}
                onClick={sync}
              >
                <RefreshCw size={14} className={`md:mr-1 ${syncing ? "animate-spin" : ""}`} />
                <span className="hidden md:inline">Sync Square</span>
              </Button>
            )}
            <Button
              data-testid="open-new-sale-btn"
              className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
              onClick={() => setOpen(true)}
            >
              <Plus size={14} className="md:mr-1" />
              <span className="hidden md:inline">Log Sale</span>
            </Button>
          </>
        }
      />

      <div className="relative max-w-md mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <Input
          data-testid="sales-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search item, consignor, description…"
          className="pl-9"
        />
      </div>

      <div className="bg-white border border-[var(--ee-border)] rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-neutral-50 border-b border-[var(--ee-border)]">
              <tr>
                {["Date", "Item ID", "Consignor", "Description", "Sale Price", "Store Cut", "Consignor Cut", "Payout", "Notes"].map((h) => (
                  <th key={h} className="ee-table-header text-left px-3 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody data-testid="sales-tbody">
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-[var(--ee-border)] last:border-0 ee-row-alt">
                  <td className="px-3 py-2.5">{fmtDate(s.sale_date)}</td>
                  <td className="px-3 py-2.5 font-semibold">{s.item_id}</td>
                  <td className="px-3 py-2.5">
                    {s.consignor_name}
                    <span className="text-neutral-500 font-normal"> · {s.consignor_id}</span>
                  </td>
                  <td className="px-3 py-2.5 text-neutral-700 max-w-[220px] truncate" title={s.description}>{s.description}</td>
                  <td className="px-3 py-2.5 font-semibold">{fmtMoney(s.sale_price)}</td>
                  <td className="px-3 py-2.5 text-neutral-700">{fmtMoney(s.store_cut)}</td>
                  <td className="px-3 py-2.5 text-[var(--ee-magenta)] font-semibold">{fmtMoney(s.consignor_cut)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-0.5 rounded ${s.payout_status === "Paid" ? "ee-status-sold" : "ee-status-donated"}`}>
                      {s.payout_status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-neutral-500 text-xs max-w-[160px] truncate" title={s.notes || undefined}>{s.notes || "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center text-sm text-neutral-400 py-12 font-light">No sales yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LogSaleDialog
        open={open}
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

function LogSaleDialog({ open, onClose, onCreated }) {
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
  const storeCut = Math.round(price * 50) / 100;
  const consignorCut = Math.round((price - storeCut) * 100) / 100;

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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl" data-testid="log-sale-dialog">
        <DialogHeader>
          <DialogTitle className="ee-section-header text-xl">Log Sale</DialogTitle>
        </DialogHeader>
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
          <div className="mt-2 max-h-48 overflow-y-auto border border-[var(--ee-border)] rounded">
            {filtered.map((i) => (
              <button
                key={i.item_id}
                data-testid={`sale-pick-${i.item_id}`}
                onClick={() => {
                  setItemId(i.item_id);
                  if (!salePrice) setSalePrice(String(i.asking_price));
                }}
                className={`w-full text-left px-3 py-2 text-sm border-b last:border-0 border-[var(--ee-border)] hover:bg-[var(--ee-magenta-soft)] ${
                  itemId === i.item_id ? "bg-[var(--ee-magenta-soft)]" : ""
                }`}
              >
                <div className="flex justify-between gap-2">
                  <span><span className="font-semibold">{i.item_id}</span> · {i.description}</span>
                  <span className="text-neutral-500">{fmtMoney(i.asking_price)}</span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-sm text-neutral-400 font-light">No active items match.</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">Sale Price</Label>
            <Input
              data-testid="sale-price"
              type="number"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="bg-[var(--ee-magenta-soft)] border border-[var(--ee-border)] rounded-md p-2 text-xs">
            <div className="flex justify-between">
              <span className="uppercase tracking-wider text-[10px] text-neutral-600 font-semibold">
                Store (50%)
              </span>
              <span className="font-semibold">{fmtMoney(storeCut)}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="uppercase tracking-wider text-[10px] text-[var(--ee-magenta)] font-semibold">
                Consignor (50%)
              </span>
              <span className="font-semibold text-[var(--ee-magenta)]">
                {fmtMoney(consignorCut)}
              </span>
            </div>
          </div>
        </div>
        <div>
          <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
        {selected && (
          <div className="text-xs text-neutral-500 font-light">
            Selected: <span className="font-semibold text-neutral-700">{selected.item_id}</span> · {selected.description}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" className="ee-btn-label" onClick={onClose}>Cancel</Button>
          <Button
            data-testid="sale-submit"
            disabled={busy}
            onClick={submit}
            className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
          >
            Log Sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
