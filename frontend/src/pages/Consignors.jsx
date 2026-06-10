import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, fmtMoney, formatApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { PAYOUT_METHODS, CATEGORIES, CONDITIONS } from "@/lib/brand";
import IntakeDialog from "@/components/IntakeDialog";

export default function Consignors() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [params, setParams] = useSearchParams();
  const [openNew, setOpenNew] = useState(params.get("new") === "1");
  const [openIntake, setOpenIntake] = useState(params.get("intake") === "1");
  const nav = useNavigate();

  const load = () => api.get("/consignors").then((r) => setList(r.data));
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    if (!term) return list;
    return list.filter(
      (c) =>
        c.full_name.toLowerCase().includes(term) ||
        c.consignor_id.toLowerCase().includes(term) ||
        (c.phone || "").toLowerCase().includes(term) ||
        (c.email || "").toLowerCase().includes(term)
    );
  }, [list, q]);

  return (
    <div className="px-6 md:px-10 py-8">
      <PageHeader
        title="Consignors"
        subtitle={`${list.length} consignor${list.length === 1 ? "" : "s"} on file`}
        testid="consignors-title"
        actions={
          <>
            <Button
              data-testid="open-intake-btn"
              variant="outline"
              className="ee-btn-label"
              onClick={() => setOpenIntake(true)}
            >
              <Plus size={14} className="md:mr-1" />
              <span className="hidden md:inline">New Intake</span>
            </Button>
            <Button
              data-testid="open-new-consignor-btn"
              className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
              onClick={() => setOpenNew(true)}
            >
              <Plus size={14} className="md:mr-1" />
              <span className="hidden md:inline">Add Consignor</span>
            </Button>
          </>
        }
      />

      <div className="flex items-center gap-2 mb-4 max-w-md">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <Input
            data-testid="consignors-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, ID, phone, email…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="bg-white border border-[var(--ee-border)] rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-neutral-50 border-b border-[var(--ee-border)]">
              <tr>
                {["ID", "Name", "Phone", "Email", "Active Items", "Total Owed", "Payout"].map((h) => (
                  <th key={h} className="ee-table-header text-left px-3 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody data-testid="consignors-tbody">
              {filtered.map((c) => (
                <tr
                  key={c.consignor_id}
                  data-testid={`consignor-row-${c.consignor_id}`}
                  className="border-b border-[var(--ee-border)] last:border-0 ee-row-alt hover:bg-[var(--ee-magenta-soft)]/40 cursor-pointer"
                  onClick={() => nav(`/consignors/${c.consignor_id}`)}
                >
                  <td className="px-3 py-2.5 font-semibold">{c.consignor_id}</td>
                  <td className="px-3 py-2.5">{c.full_name}</td>
                  <td className="px-3 py-2.5 text-neutral-600">{c.phone || "—"}</td>
                  <td className="px-3 py-2.5 text-neutral-600 max-w-[200px] truncate" title={c.email || undefined}>{c.email || "—"}</td>
                  <td className="px-3 py-2.5">{c.active_items}</td>
                  <td className="px-3 py-2.5 font-semibold text-[var(--ee-magenta)]">
                    {fmtMoney(c.total_owed)}
                  </td>
                  <td className="px-3 py-2.5 text-neutral-600">{c.payout_method}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-neutral-400 py-10 text-sm font-light">
                    No consignors match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NewConsignorDialog
        open={openNew}
        onClose={() => {
          setOpenNew(false);
          params.delete("new");
          setParams(params);
        }}
        onCreated={(c) => {
          load();
          nav(`/consignors/${c.consignor_id}`);
        }}
      />
      <IntakeDialog
        open={openIntake}
        onClose={() => {
          setOpenIntake(false);
          params.delete("intake");
          setParams(params);
        }}
        onDone={() => load()}
      />
    </div>
  );
}

function NewConsignorDialog({ open, onClose, onCreated }) {
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    address: "",
    payout_method: "Cash",
    payout_details: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setForm({ ...form, [k]: v });

  const submit = async () => {
    if (!form.full_name.trim()) {
      toast.error("Name is required");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/consignors", form);
      toast.success(`${data.consignor_id} created`);
      onCreated(data);
      onClose();
      setForm({
        full_name: "",
        phone: "",
        email: "",
        address: "",
        payout_method: "Cash",
        payout_details: "",
        notes: "",
      });
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" data-testid="new-consignor-dialog">
        <DialogHeader>
          <DialogTitle className="ee-section-header text-xl">
            New Consignor
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
              Full Name
            </Label>
            <Input
              data-testid="new-consignor-name"
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
              Phone
            </Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
              Email
            </Label>
            <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
              Address
            </Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div>
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
              Payout Method
            </Label>
            <Select
              value={form.payout_method}
              onValueChange={(v) => set("payout_method", v)}
            >
              <SelectTrigger data-testid="new-consignor-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYOUT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
              Payout Details
            </Label>
            <Input
              value={form.payout_details}
              onChange={(e) => set("payout_details", e.target.value)}
              placeholder="Zelle # / Venmo handle / etc."
            />
          </div>
          <div className="col-span-2">
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
              Notes
            </Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="ee-btn-label">
            Cancel
          </Button>
          <Button
            data-testid="new-consignor-submit"
            onClick={submit}
            disabled={busy}
            className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
