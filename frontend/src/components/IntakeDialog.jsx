import { useEffect, useMemo, useRef, useState } from "react";
import { api, formatApiError, fmtDate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveModal,
  ResponsiveModalContent,
} from "@/components/ResponsiveModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Printer, ChevronRight, ChevronLeft, Eraser, CheckCircle2 } from "lucide-react";
import { CATEGORIES, CONDITIONS, PAYOUT_METHODS, STORE } from "@/lib/brand";
import SignaturePad from "@/components/SignaturePad";
import { buildAgreementText } from "@/lib/agreement";

const blankItem = () => ({
  description: "",
  category: "Dresses",
  size: "",
  condition: "Excellent",
  asking_price: "",
});

const STEPS = [
  { key: "consignor", label: "Consignor Info" },
  { key: "items", label: "Items" },
  { key: "agreement", label: "Agreement & Signature" },
];

const INTAKE_SHELL_CLASS = "p-0 gap-0 overflow-hidden flex flex-col";

export default function IntakeDialog({ open, onClose, onDone, presetConsignorId, presetMode }) {
  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveModalContent
        className={`${INTAKE_SHELL_CLASS} max-w-xl lg:max-w-2xl`}
        data-testid="intake-dialog"
      >
        {open ? (
          <IntakeWizard
            onClose={onClose}
            onDone={onDone}
            presetConsignorId={presetConsignorId}
            presetMode={presetMode}
          />
        ) : null}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

function IntakeWizard({ onClose, onDone, presetConsignorId, presetMode }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [consignors, setConsignors] = useState([]);
  const [mode, setMode] = useState(presetMode || "existing"); // existing | new
  const [consignorId, setConsignorId] = useState(presetConsignorId || "");
  const [newConsignor, setNewConsignor] = useState({
    full_name: "",
    phone: "",
    email: "",
    address: "",
    payout_method: "Cash",
    payout_details: "",
    notes: "",
  });
  const [items, setItems] = useState([blankItem()]);
  const [signedName, setSignedName] = useState("");
  const [sigEmpty, setSigEmpty] = useState(true);
  const sigRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api.get("/consignors").then((r) => {
      if (!cancelled) setConsignors(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedConsignor = useMemo(() => {
    if (mode === "existing")
      return consignors.find((c) => c.consignor_id === consignorId);
    return null;
  }, [mode, consignors, consignorId]);

  const consignorDisplayName =
    mode === "existing" ? selectedConsignor?.full_name : newConsignor.full_name;
  const consignorDisplayId =
    mode === "existing" ? selectedConsignor?.consignor_id : "(new)";

  // Validation
  const canLeaveStep0 =
    mode === "existing"
      ? !!consignorId
      : newConsignor.full_name.trim().length > 1;
  const validItems = items.filter(
    (i) => i.description.trim() && Number(i.asking_price) > 0
  );
  const canLeaveStep1 = validItems.length > 0;
  const canSubmit = !sigEmpty && (signedName.trim().length > 1 || consignorDisplayName);

  const setItem = (idx, patch) => {
    const next = items.slice();
    next[idx] = { ...next[idx], ...patch };
    setItems(next);
  };

  const next = () => {
    if (step === 0 && !canLeaveStep0)
      return toast.error("Choose or create a consignor first");
    if (step === 1 && !canLeaveStep1)
      return toast.error("Add at least one item with description and price");
    if (step === 2) return submit();
    setStep(step + 1);
  };
  const back = () => setStep(Math.max(0, step - 1));

  const submit = async () => {
    if (sigRef.current?.isEmpty()) return toast.error("Please sign the agreement");
    setBusy(true);
    try {
      // 1) Create consignor if new
      let cid = consignorId;
      if (mode === "new") {
        const { data } = await api.post("/consignors", newConsignor);
        cid = data.consignor_id;
      }
      // 2) Save signed agreement
      const sigData = sigRef.current.toDataURL();
      const agreementText = buildAgreementText({
        consignorName: consignorDisplayName || newConsignor.full_name,
        consignorId: cid,
      });
      await api.post(`/consignors/${cid}/agreement`, {
        signature_data_url: sigData,
        agreement_text: agreementText,
        signed_name: signedName || consignorDisplayName || newConsignor.full_name,
      });
      // 3) Save items
      const { data: batch } = await api.post("/inventory/batch", {
        consignor_id: cid,
        items: validItems.map((i) => ({
          ...i,
          asking_price: Number(i.asking_price),
        })),
      });
      toast.success(`${batch.items.length} item${batch.items.length === 1 ? "" : "s"} added`);
      // 4) Open tag print
      const ids = batch.items.map((i) => i.item_id).join(",");
      window.open(`/print/tags?ids=${encodeURIComponent(ids)}`, "_blank", "noopener");
      onDone?.();
      onClose();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="shrink-0 px-4 pt-4 pb-3 sm:px-5 sm:pt-5 sm:pb-4">
        <h2 className="ee-section-header text-lg sm:text-xl pr-6 font-semibold tracking-tight">
          New Drop-Off
        </h2>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-5 sm:px-5 sm:pb-6">
        {/* Stepper */}
        <ol className="flex items-center gap-1 sm:gap-2 text-[10px] uppercase tracking-[0.14em] font-semibold border-b border-[var(--ee-border)] pb-3 mb-5 sm:mb-6 overflow-x-auto">
          {STEPS.map((s, i) => (
            <li
              key={s.key}
              className={`flex items-center gap-2 whitespace-nowrap ${
                i === step
                  ? "text-[var(--ee-magenta)]"
                  : i < step
                  ? "text-neutral-700"
                  : "text-neutral-400"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] ${
                  i === step
                    ? "bg-[var(--ee-magenta)] text-white"
                    : i < step
                    ? "bg-neutral-700 text-white"
                    : "bg-neutral-200 text-neutral-500"
                }`}
              >
                {i + 1}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
              {i < STEPS.length - 1 && (
                <ChevronRight size={12} className="text-neutral-300" />
              )}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <StepConsignor
            mode={mode}
            setMode={setMode}
            consignors={consignors}
            consignorId={consignorId}
            setConsignorId={setConsignorId}
            newConsignor={newConsignor}
            setNewConsignor={setNewConsignor}
          />
        )}
        {step === 1 && (
          <StepItems items={items} setItem={setItem} setItems={setItems} />
        )}
        {step === 2 && (
          <StepAgreement
            consignorName={consignorDisplayName || newConsignor.full_name}
            consignorId={consignorDisplayId}
            signedName={signedName}
            setSignedName={setSignedName}
            sigRef={sigRef}
            sigEmpty={sigEmpty}
            setSigEmpty={setSigEmpty}
            items={validItems}
          />
        )}
      </div>

      <div className="shrink-0 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 sm:px-5 sm:py-4 border-t border-[var(--ee-border)]">
        <Button
          variant="outline"
          onClick={step === 0 ? onClose : back}
          className="ee-btn-label w-full sm:w-auto"
          data-testid="intake-back"
        >
          <ChevronLeft size={14} className="mr-1" />
          {step === 0 ? "Cancel" : "Back"}
        </Button>
        <Button
          data-testid="intake-next"
          onClick={next}
          disabled={busy || (step === 2 && !canSubmit)}
          className="ee-btn-label w-full sm:w-auto bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
        >
          {step === 2 ? (
            <>
              <Printer size={14} className="mr-1" /> Sign & Save
            </>
          ) : (
            <>
              Next <ChevronRight size={14} className="ml-1" />
            </>
          )}
        </Button>
      </div>
    </>
  );
}

function StepConsignor({
  mode,
  setMode,
  consignors,
  consignorId,
  setConsignorId,
  newConsignor,
  setNewConsignor,
}) {
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex gap-2">
        <button
          data-testid="intake-mode-existing"
          onClick={() => setMode("existing")}
          className={`flex-1 min-w-0 text-[10px] sm:text-[11px] uppercase tracking-[0.1em] sm:tracking-[0.12em] font-semibold py-2 px-2 rounded border ${
            mode === "existing"
              ? "border-[var(--ee-magenta)] bg-[var(--ee-magenta-soft)] text-[var(--ee-magenta)]"
              : "border-[var(--ee-border)] text-neutral-600"
          }`}
        >
          <span className="sm:hidden">Existing</span>
          <span className="hidden sm:inline">Existing Consignor</span>
        </button>
        <button
          data-testid="intake-mode-new"
          onClick={() => setMode("new")}
          className={`flex-1 min-w-0 text-[10px] sm:text-[11px] uppercase tracking-[0.1em] sm:tracking-[0.12em] font-semibold py-2 px-2 rounded border ${
            mode === "new"
              ? "border-[var(--ee-magenta)] bg-[var(--ee-magenta-soft)] text-[var(--ee-magenta)]"
              : "border-[var(--ee-border)] text-neutral-600"
          }`}
        >
          <span className="sm:hidden">New</span>
          <span className="hidden sm:inline">New Consignor</span>
        </button>
      </div>

      {mode === "existing" ? (
        <div>
          <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
            Consignor
          </Label>
          <Select value={consignorId} onValueChange={setConsignorId}>
            <SelectTrigger data-testid="intake-consignor">
              <SelectValue placeholder="Select a consignor…" />
            </SelectTrigger>
            <SelectContent>
              {consignors.map((c) => (
                <SelectItem key={c.consignor_id} value={c.consignor_id}>
                  {c.consignor_id} · {c.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Full Name" testid="new-intake-name">
            <Input
              data-testid="new-intake-name"
              value={newConsignor.full_name}
              onChange={(e) =>
                setNewConsignor({ ...newConsignor, full_name: e.target.value })
              }
            />
          </Field>
          <Field label="Phone">
            <Input
              value={newConsignor.phone}
              onChange={(e) =>
                setNewConsignor({ ...newConsignor, phone: e.target.value })
              }
            />
          </Field>
          <Field label="Email">
            <Input
              value={newConsignor.email}
              onChange={(e) =>
                setNewConsignor({ ...newConsignor, email: e.target.value })
              }
            />
          </Field>
          <Field label="Address">
            <Input
              value={newConsignor.address}
              onChange={(e) =>
                setNewConsignor({ ...newConsignor, address: e.target.value })
              }
            />
          </Field>
          <Field label="Payout Method">
            <Select
              value={newConsignor.payout_method}
              onValueChange={(v) =>
                setNewConsignor({ ...newConsignor, payout_method: v })
              }
            >
              <SelectTrigger>
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
          </Field>
          <Field label="Payout Details">
            <Input
              value={newConsignor.payout_details}
              onChange={(e) =>
                setNewConsignor({
                  ...newConsignor,
                  payout_details: e.target.value,
                })
              }
              placeholder="Zelle # / Venmo handle / etc."
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <Textarea
                rows={2}
                value={newConsignor.notes}
                onChange={(e) =>
                  setNewConsignor({ ...newConsignor, notes: e.target.value })
                }
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

function StepItems({ items, setItem, setItems }) {
  return (
    <div>
      <div className="border border-[var(--ee-border)] rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="ee-table-header text-left px-3 py-2">#</th>
                <th className="ee-table-header text-left px-3 py-2">Description</th>
                <th className="ee-table-header text-left px-3 py-2">Category</th>
                <th className="ee-table-header text-left px-3 py-2">Size</th>
                <th className="ee-table-header text-left px-3 py-2">Condition</th>
                <th className="ee-table-header text-left px-3 py-2">Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} className="border-t border-[var(--ee-border)]">
                  <td className="px-3 py-2 text-neutral-500 font-semibold">
                    {idx + 1}
                  </td>
                  <td className="px-3 py-2 min-w-[180px]">
                    <Input
                      data-testid={`intake-desc-${idx}`}
                      value={it.description}
                      onChange={(e) =>
                        setItem(idx, { description: e.target.value })
                      }
                      placeholder="e.g. Silk wrap dress, blush"
                      className="text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={it.category}
                      onValueChange={(v) => setItem(idx, { category: v })}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="w-[70px] text-sm"
                      value={it.size}
                      onChange={(e) => setItem(idx, { size: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={it.condition}
                      onValueChange={(v) => setItem(idx, { condition: v })}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITIONS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      data-testid={`intake-price-${idx}`}
                      className="w-[80px] text-sm"
                      type="number"
                      value={it.asking_price}
                      onChange={(e) =>
                        setItem(idx, { asking_price: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    {items.length > 1 && (
                      <button
                        onClick={() =>
                          setItems(items.filter((_, i) => i !== idx))
                        }
                        className="text-neutral-400 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          data-testid="intake-add-item"
          onClick={() => setItems([...items, blankItem()])}
          className="ee-btn-label text-[var(--ee-magenta)] px-3 py-2 hover:bg-[var(--ee-magenta-soft)] w-full text-left border-t border-[var(--ee-border)]"
        >
          <Plus size={12} className="inline mr-1" /> Add another item
        </button>
      </div>
    </div>
  );
}

function StepAgreement({
  consignorName,
  consignorId,
  signedName,
  setSignedName,
  sigRef,
  sigEmpty,
  setSigEmpty,
  items,
}) {
  const agreementText = useMemo(
    () => buildAgreementText({ consignorName, consignorId }),
    [consignorName, consignorId]
  );
  const today = new Date();
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="bg-[var(--ee-magenta-soft)] border border-[var(--ee-border)] rounded-md p-2.5 sm:p-3 text-xs">
        <div className="text-[10px] tracking-[0.18em] uppercase text-neutral-600 font-semibold">
          Summary
        </div>
        <div className="mt-1 grid grid-cols-2 gap-y-1">
          <span className="text-neutral-600">Consignor</span>
          <span className="text-right font-semibold">{consignorName || "—"}</span>
          <span className="text-neutral-600">Items</span>
          <span className="text-right font-semibold">{items.length}</span>
          <span className="text-neutral-600">Period ends</span>
          <span className="text-right">
            {fmtDate(new Date(today.getTime() + 60 * 86400000).toISOString().slice(0, 10))}
          </span>
        </div>
      </div>

      <div>
        <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
          Consignment Agreement
        </Label>
        <div
          className="mt-1 border border-[var(--ee-border)] rounded-md bg-white p-2.5 sm:p-3 text-[11px] leading-relaxed text-neutral-700 max-h-28 sm:max-h-36 md:max-h-44 overflow-y-auto whitespace-pre-wrap font-light"
          data-testid="agreement-text"
        >
          {agreementText}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Printed Name">
          <Input
            data-testid="signed-name"
            value={signedName}
            onChange={(e) => setSignedName(e.target.value)}
            placeholder={consignorName || "Consignor's full name"}
          />
        </Field>
        <Field label="Date">
          <Input
            value={today.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            disabled
          />
        </Field>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
            Signature
          </Label>
          <button
            data-testid="sig-clear"
            type="button"
            onClick={() => sigRef.current?.clear()}
            className="ee-btn-label text-[10px] text-neutral-500 hover:text-[var(--ee-magenta)] inline-flex items-center gap-1"
          >
            <Eraser size={12} /> Clear
          </button>
        </div>
        <SignaturePad ref={sigRef} onChange={setSigEmpty} height={120} className="mt-1" />
        <div className="mt-2 flex items-center gap-1 text-[11px] text-neutral-500 font-light">
          {sigEmpty ? (
            "Awaiting signature…"
          ) : (
            <>
              <CheckCircle2 size={12} className="text-emerald-600" /> Signature captured
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
        {label}
      </Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
