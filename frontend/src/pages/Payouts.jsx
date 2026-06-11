import { useEffect, useState } from "react";
import { api, fmtMoney, fmtDate, formatApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
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
import { PAYOUT_METHODS } from "@/lib/brand";
import { toast } from "sonner";
import { Wallet } from "lucide-react";

export default function Payouts() {
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [active, setActive] = useState(null);

  const load = async () => {
    const [q, h] = await Promise.all([
      api.get("/payouts/queue"),
      api.get("/payouts/history"),
    ]);
    setQueue(q.data);
    setHistory(h.data);
  };
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="px-6 md:px-10 py-8">
      <PageHeader title="Payouts" testid="payouts-title" />

      <div className="bg-white border border-[var(--ee-border)] rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-neutral-50 border-b border-[var(--ee-border)]">
              <tr>
                {["Consignor", "Items Sold", "Balance Owed", "Method", "Days Since Last Payout", ""].map((h) => (
                  <th key={h} className="ee-table-header text-left px-3 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody data-testid="payout-queue-tbody">
              {queue.map((r) => (
                <tr key={r.consignor_id} className="border-b border-[var(--ee-border)] last:border-0 ee-row-alt">
                  <td className="px-3 py-2.5 font-semibold">
                    {r.full_name}
                    <span className="text-neutral-500 font-normal"> · {r.consignor_id}</span>
                  </td>
                  <td className="px-3 py-2.5">{r.items_sold}</td>
                  <td className="px-3 py-2.5 font-semibold text-[var(--ee-magenta)]">{fmtMoney(r.balance_owed)}</td>
                  <td className="px-3 py-2.5">{r.payout_method}</td>
                  <td className="px-3 py-2.5 text-neutral-600">
                    {r.days_since_last_payout == null ? "Never" : `${r.days_since_last_payout}d`}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      data-testid={`payout-row-btn-${r.consignor_id}`}
                      size="sm"
                      className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
                      onClick={() => setActive(r)}
                    >
                      Process
                    </Button>
                  </td>
                </tr>
              ))}
              {queue.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-sm text-neutral-400 py-10 font-light">
                    Nothing to pay out — all settled.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="ee-section-header text-base mt-8 mb-3">History</h2>
      <div className="bg-white border border-[var(--ee-border)] rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-neutral-50 border-b border-[var(--ee-border)]">
              <tr>
                {["Date", "Consignor", "Amount", "Method", "Processed By", "Notes"].map((h) => (
                  <th key={h} className="ee-table-header text-left px-3 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((p) => (
                <tr key={p.id} className="border-b border-[var(--ee-border)] last:border-0 ee-row-alt">
                  <td className="px-3 py-2.5">{fmtDate(p.date_paid)}</td>
                  <td className="px-3 py-2.5 font-semibold">
                    {p.consignor_name}
                    {p.consignor_id ? (
                      <span className="text-neutral-500 font-normal"> · {p.consignor_id}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 font-semibold">{fmtMoney(p.amount)}</td>
                  <td className="px-3 py-2.5">{p.method}</td>
                  <td className="px-3 py-2.5 text-neutral-600 max-w-[180px] truncate" title={p.processed_by}>{p.processed_by}</td>
                  <td className="px-3 py-2.5 text-neutral-500 text-xs max-w-[160px] truncate" title={p.notes || undefined}>{p.notes || "—"}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={6} className="text-center text-sm text-neutral-400 py-8 font-light">No payouts yet.</td></tr>
              )}
            </tbody>
          </table>
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

  useEffect(() => {
    if (active) {
      setAmount(String(active.balance_owed));
      setMethod(active.payout_method || "Cash");
      setNotes("");
    }
  }, [active]);

  if (!active) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await api.post("/payouts", {
        consignor_id: active.consignor_id,
        amount: Number(amount),
        method,
        notes,
      });
      toast.success(`Paid ${active.full_name}`);
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
          <div className="bg-[var(--ee-magenta-soft)] border border-[var(--ee-border)] rounded p-3">
            <div className="text-[10px] tracking-[0.18em] uppercase text-neutral-600 font-semibold">
              {active.consignor_id} · {active.full_name}
            </div>
            <div className="text-xs text-neutral-600 mt-1">
              Balance owed
            </div>
            <div className="text-3xl font-bold text-[var(--ee-magenta)]">
              {fmtMoney(active.balance_owed)}
            </div>
          </div>
          <div>
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">Amount</Label>
            <Input
              data-testid="payout-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger data-testid="payout-method"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYOUT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <ResponsiveModalFooter>
          <Button variant="outline" className="ee-btn-label" onClick={onClose}>Cancel</Button>
          <Button
            data-testid="payout-submit"
            disabled={busy}
            onClick={submit}
            className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
          >
            Confirm Payout
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
