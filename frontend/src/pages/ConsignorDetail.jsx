import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, fmtMoney, fmtDate, fmtPhone, formatApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import StatusPill from "@/components/StatusPill";
import IntakeDialog from "@/components/IntakeDialog";
import { ArrowLeft, Pencil, Plus, FileText, Mail, Phone, MapPin, Download, Flag } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { isAdmin, isManagerOrAdmin, roleOf } from "@/lib/auth";

const EDIT_PAYOUT_METHODS = ["Cash", "Check", "Zelle", "Venmo", "Store Credit", "Square"];

const FLAG_LABELS = {
  missing_name: "Missing name",
  missing_contact: "Missing contact",
  missing_drop_off_date: "No drop-off date",
  unparsed_drop_off_date: "Unparsed drop-off date",
};

export default function ConsignorDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const retailView = roleOf(user) === "retail";
  const showFinance = isManagerOrAdmin(user);
  const canEdit = isAdmin(user);
  const [data, setData] = useState(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(
    () => api.get(`/consignors/${id}`).then((r) => setData(r.data)),
    [id]
  );

  useEffect(() => {
    load().catch((e) => {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    });
  }, [load]);

  if (!data) {
    return <div className="px-10 py-8 text-sm text-neutral-500">Loading…</div>;
  }

  return (
    <div className="px-6 md:px-10 py-8">
      <button
        onClick={() => nav("/consignors")}
        className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 hover:text-[var(--ee-magenta)] inline-flex items-center gap-1 mb-3"
      >
        <ArrowLeft size={12} /> All consignors
      </button>
      <PageHeader
        title={
          (data.import_flags || []).includes("missing_name") ||
          !(data.full_name || "").trim() ||
          /^\(name needed\b/i.test(data.full_name || "") ||
          /^unassigned\b/i.test(data.full_name || "") ||
          /^consignor\s+\d+/i.test(data.full_name || "")
            ? "Needs name"
            : data.full_name
        }
        subtitle={`Consignor ${data.consignor_id}`}
        testid="consignor-detail-title"
        actions={
          <div className="flex items-center gap-2">
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                data-testid="consignor-edit-btn"
                className="ee-btn-label rounded-[8px] border-[var(--ee-sidebar-border)]"
                onClick={() => setEditOpen(true)}
              >
                <Pencil size={14} className="md:mr-1" />
                <span className="hidden md:inline">Edit</span>
              </Button>
            ) : null}
            <Button
              data-testid="consignor-detail-intake"
              className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
              onClick={() => setIntakeOpen(true)}
            >
              <Plus size={14} className="md:mr-1" />
              <span className="hidden md:inline">New Drop Off</span>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <section className="bg-white border border-[var(--ee-border)] rounded-md p-5 lg:col-span-2">
          <h2 className="ee-section-header text-base mb-3">Contact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 text-sm min-w-0">
            <div className="flex items-center gap-2 text-neutral-700 min-w-0">
              <Phone size={13} className="text-neutral-400 shrink-0" />
              <span className="truncate">
                {data.phone ? fmtPhone(data.phone) : "—"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-neutral-700 min-w-0">
              <Mail size={13} className="text-neutral-400 shrink-0" />
              <span className="truncate">{data.email || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-neutral-700 sm:col-span-2 min-w-0">
              <MapPin size={13} className="text-neutral-400 shrink-0" />
              <span className="break-words">{data.address || "—"}</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-sm border-t border-[var(--ee-border)] pt-4 min-w-0">
            {showFinance ? (
              <>
                <div className="min-w-0">
                  <div className="text-[10px] tracking-[0.18em] uppercase text-neutral-500 font-semibold">
                    Payout Method
                  </div>
                  <div className="break-words">{data.payout_method}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] tracking-[0.18em] uppercase text-neutral-500 font-semibold">
                    Payout Details
                  </div>
                  <div className="break-words">{data.payout_details || "—"}</div>
                </div>
              </>
            ) : null}
            <div className="min-w-0">
              <div className="text-[10px] tracking-[0.18em] uppercase text-neutral-500 font-semibold">
                Expired items
              </div>
              <div className="break-words">{data.expiry_action || "—"}</div>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] tracking-[0.18em] uppercase text-neutral-500 font-semibold">
                Drop-off date
              </div>
              <div className="break-words">
                {data.date_of_drop_off
                  ? data.date_of_drop_off.length === 10
                    ? fmtDate(data.date_of_drop_off)
                    : data.date_of_drop_off
                  : "—"}
              </div>
            </div>
            {data.notes ? (
              <div className="sm:col-span-2">
                <div className="text-[10px] tracking-[0.18em] uppercase text-neutral-500 font-semibold">
                  Notes
                </div>
                <div className="font-light whitespace-pre-wrap">{data.notes}</div>
              </div>
            ) : null}
          </div>
          {(data.import_flags || []).length > 0 && (
            <div
              data-testid="consignor-flags"
              className="mt-4 border border-amber-200 bg-amber-50 rounded-md p-3"
            >
              <div className="text-[10px] tracking-[0.18em] uppercase text-amber-800 font-semibold inline-flex items-center gap-1 mb-2">
                <Flag size={11} /> Needs review
              </div>
              <ul className="text-sm text-amber-900 space-y-1">
                {data.import_flags.map((f) => (
                  <li key={f}>{FLAG_LABELS[f] || f}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
        <section className="bg-white border border-[var(--ee-magenta)] rounded-md p-5" style={{ borderWidth: 1.5 }}>
          {showFinance ? (
            <>
              <div className="text-[10px] tracking-[0.18em] uppercase text-[var(--ee-magenta)] font-semibold">
                Balance Owed
              </div>
              <div data-testid="consignor-balance" className="text-4xl font-bold text-[var(--ee-magenta)] mt-1">
                {fmtMoney(data.total_owed)}
              </div>
              <div className="text-xs text-neutral-500 font-light mt-1">
                {data.active_items} active item{data.active_items === 1 ? "" : "s"} on the floor
              </div>
            </>
          ) : (
            <>
              <div className="text-[10px] tracking-[0.18em] uppercase text-[var(--ee-magenta)] font-semibold">
                On the floor
              </div>
              <div data-testid="consignor-active-items" className="text-4xl font-bold text-[var(--ee-magenta)] mt-1">
                {data.active_items}
              </div>
              <div className="text-xs text-neutral-500 font-light mt-1">
                active item{data.active_items === 1 ? "" : "s"}
              </div>
            </>
          )}
        </section>
      </div>

      <Tabs defaultValue="items">
        <TabsList className="bg-transparent border-b border-[var(--ee-border)] rounded-none w-full justify-start p-0 h-auto">
          {[
            ["items", "Items"],
            ["earnings", retailView ? "Sales" : "Earnings"],
            ["documents", "Documents"],
          ].map(([k, label]) => (
            <TabsTrigger
              key={k}
              value={k}
              data-testid={`tab-${k}`}
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-[var(--ee-magenta)] data-[state=active]:border-b-2 data-[state=active]:border-[var(--ee-magenta)] rounded-none px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em]"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="items" className="mt-4">
          <div className="bg-white border border-[var(--ee-border)] rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-[var(--ee-border)]">
                <tr>
                  {["Ref", "Description", "Category", "Listing price", "Date In", "Period End", "Status"].map((h) => (
                    <th key={h} className="ee-table-header text-left px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((i) => (
                  <tr key={i.item_id} className="border-b border-[var(--ee-border)] last:border-0 ee-row-alt">
                    <td className="px-4 py-3 font-semibold">{i.item_id}</td>
                    <td className="px-4 py-3">{i.description}</td>
                    <td className="px-4 py-3">{i.category}</td>
                    <td className="px-4 py-3">{fmtMoney(i.asking_price)}</td>
                    <td className="px-4 py-3 text-neutral-600">{fmtDate(i.date_in)}</td>
                    <td className="px-4 py-3 text-neutral-600">{fmtDate(i.period_end)}</td>
                    <td className="px-4 py-3"><StatusPill status={i.status} /></td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-sm text-neutral-400 py-8 font-light">No items yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="earnings" className="mt-4">
          <div className="bg-white border border-[var(--ee-border)] rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-[var(--ee-border)]">
                <tr>
                  {(retailView
                    ? ["Date", "Item", "Sale Price"]
                    : ["Date", "Item", "Sale Price", "Consignor Cut", "Status", "Payout Date"]
                  ).map((h) => (
                    <th key={h} className="ee-table-header text-left px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.sales.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--ee-border)] last:border-0 ee-row-alt">
                    <td className="px-4 py-3">{fmtDate(s.sale_date)}</td>
                    <td className="px-4 py-3 font-semibold">{s.item_id}</td>
                    <td className="px-4 py-3">{fmtMoney(s.sale_price)}</td>
                    {!retailView ? (
                      <>
                        <td className="px-4 py-3 text-[var(--ee-magenta)] font-semibold">
                          {fmtMoney(s.consignor_cut)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-0.5 rounded ${s.payout_status === "Paid" ? "ee-status-sold" : "ee-status-donated"}`}>
                            {s.payout_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-neutral-600">{fmtDate(s.payout_date)}</td>
                      </>
                    ) : null}
                  </tr>
                ))}
                {data.sales.length === 0 && (
                  <tr><td colSpan={retailView ? 3 : 6} className="text-center text-sm text-neutral-400 py-8 font-light">No sales yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {showFinance && data.payouts.length > 0 && (
            <div className="mt-6">
              <h3 className="ee-section-header text-sm mb-2">Payout History</h3>
              <div className="bg-white border border-[var(--ee-border)] rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-[var(--ee-border)]">
                    <tr>
                      {["Date", "Amount", "Method", "Processed By", "Notes"].map((h) => (
                        <th key={h} className="ee-table-header text-left px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.payouts.map((p) => (
                      <tr key={p.id} className="border-b border-[var(--ee-border)] last:border-0 ee-row-alt">
                        <td className="px-4 py-3">{fmtDate(p.date_paid)}</td>
                        <td className="px-4 py-3 font-semibold">{fmtMoney(p.amount)}</td>
                        <td className="px-4 py-3">{p.method}</td>
                        <td className="px-4 py-3 text-neutral-600">{p.processed_by}</td>
                        <td className="px-4 py-3 text-neutral-600">{p.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <div className="bg-white border border-[var(--ee-border)] rounded-md p-6">
            {data.agreement ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] tracking-[0.18em] uppercase text-[var(--ee-magenta)] font-semibold">
                      Consignment Agreement
                    </div>
                    <div className="text-sm font-semibold mt-1">
                      Signed by {data.agreement.signed_name}
                    </div>
                    <div className="text-xs text-neutral-500 font-light">
                      {fmtDate(data.agreement.signed_at)} ·
                      witnessed by {data.agreement.signed_by_staff}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      data-testid="download-agreement-pdf"
                      variant="outline"
                      className="ee-btn-label"
                      onClick={async () => {
                        try {
                          const res = await api.get(
                            `/consignors/${id}/agreement.pdf`,
                            { responseType: "blob" }
                          );
                          const url = window.URL.createObjectURL(res.data);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${id}-consignment-agreement.pdf`;
                          a.click();
                          window.URL.revokeObjectURL(url);
                          toast.success("Agreement downloaded");
                        } catch (e) {
                          toast.error(
                            formatApiError(e.response?.data?.detail) ||
                              e.message
                          );
                        }
                      }}
                    >
                      <Download size={14} className="md:mr-1" />
                      <span className="hidden md:inline">Download PDF</span>
                    </Button>
                    <div className="ee-status-sold inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-[0.12em]">
                      <FileText size={12} /> On file
                    </div>
                  </div>
                </div>
                <div className="border border-[var(--ee-border)] rounded p-3 bg-neutral-50 max-h-56 overflow-y-auto text-[11px] leading-relaxed text-neutral-700 whitespace-pre-wrap font-light">
                  {data.agreement.agreement_text}
                </div>
                <div>
                  <div className="text-[10px] tracking-[0.18em] uppercase text-neutral-500 font-semibold mb-1">
                    Signature
                  </div>
                  <img
                    src={data.agreement.signature_data_url}
                    alt="Signature"
                    data-testid="agreement-signature-img"
                    className="border border-[var(--ee-border)] rounded bg-white max-h-40"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-neutral-500 text-sm">
                <FileText size={16} />
                No signed agreement on file. Start a new intake from this profile
                to capture a signature.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <IntakeDialog
        open={intakeOpen}
        onClose={() => setIntakeOpen(false)}
        onDone={() => load()}
        presetConsignorId={id}
      />
      {canEdit ? (
        <EditConsignorDialog
          open={editOpen}
          consignor={data}
          onOpenChange={setEditOpen}
          onSaved={(nextId) => {
            if (nextId && nextId !== id) {
              nav(`/consignors/${nextId}`, { replace: true });
              return;
            }
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function draftFromConsignor(consignor) {
  return {
    consignor_id: consignor?.consignor_id || "",
    full_name: consignor?.full_name || "",
    phone: consignor?.phone || "",
    email: consignor?.email || "",
    address: consignor?.address || "",
    payout_method: consignor?.payout_method || "Cash",
    payout_details: consignor?.payout_details || "",
    expiry_action: consignor?.expiry_action || "",
    date_of_drop_off: consignor?.date_of_drop_off || "",
    notes: consignor?.notes || "",
  };
}

function EditConsignorDialog({ open, consignor, onOpenChange, onSaved }) {
  const [form, setForm] = useState(draftFromConsignor(consignor));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setForm(draftFromConsignor(consignor));
  }, [open, consignor]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    const full_name = form.full_name.trim();
    const consignor_id = form.consignor_id.trim();
    if (!/^\d{4}$/.test(consignor_id)) {
      toast.error("Consignor ID should be 4 digits, like 2047");
      return;
    }
    if (full_name.length < 2) {
      toast.error("Enter a full name");
      return;
    }
    const email = form.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email or leave it blank");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.patch(`/consignors/${consignor.consignor_id}`, {
        consignor_id,
        full_name,
        phone: form.phone.trim(),
        email,
        address: form.address.trim(),
        payout_method: form.payout_method,
        payout_details: form.payout_details.trim(),
        expiry_action: form.expiry_action.trim(),
        date_of_drop_off: form.date_of_drop_off.trim(),
        notes: form.notes.trim(),
      });
      toast.success("Consignor updated");
      onOpenChange(false);
      onSaved(data.consignor_id);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="edit-consignor-dialog" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit consignor</DialogTitle>
          <DialogDescription>
            Update their ID and profile. Items and balances stay with them.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
                Consignor ID
              </Label>
              <Input
                data-testid="edit-consignor-id"
                value={form.consignor_id}
                onChange={set("consignor_id")}
                inputMode="numeric"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
                Full name
              </Label>
              <Input
                data-testid="edit-consignor-name"
                value={form.full_name}
                onChange={set("full_name")}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
                Phone
              </Label>
              <Input
                data-testid="edit-consignor-phone"
                value={form.phone}
                onChange={set("phone")}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
                Email
              </Label>
              <Input
                data-testid="edit-consignor-email"
                type="email"
                value={form.email}
                onChange={set("email")}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
                Address
              </Label>
              <Input
                data-testid="edit-consignor-address"
                value={form.address}
                onChange={set("address")}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
                Payout method
              </Label>
              <Select
                value={form.payout_method}
                onValueChange={(v) => setForm((f) => ({ ...f, payout_method: v }))}
              >
                <SelectTrigger data-testid="edit-consignor-payout" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDIT_PAYOUT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
                Payout details
              </Label>
              <Input
                data-testid="edit-consignor-payout-details"
                value={form.payout_details}
                onChange={set("payout_details")}
                placeholder="Zelle or Venmo"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
                When items expire
              </Label>
              <Input
                data-testid="edit-consignor-expiry"
                value={form.expiry_action}
                onChange={set("expiry_action")}
                placeholder="Donate or pick up"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
                Drop-off date
              </Label>
              <Input
                data-testid="edit-consignor-dropoff"
                value={form.date_of_drop_off}
                onChange={set("date_of_drop_off")}
                placeholder="YYYY-MM-DD"
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
                Notes
              </Label>
              <Textarea
                data-testid="edit-consignor-notes"
                rows={2}
                value={form.notes}
                onChange={set("notes")}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="ee-btn-label text-neutral-600"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              data-testid="edit-consignor-save"
              disabled={busy}
              className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
