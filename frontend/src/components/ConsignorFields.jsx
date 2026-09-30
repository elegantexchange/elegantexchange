import AddressField from "@/components/AddressField";
import DateField from "@/components/DateField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X } from "lucide-react";
import {
  EXPIRY_OPTIONS,
  PHONE_TYPES,
  formatPhoneInput,
} from "@/lib/consignorForm";

const fieldLabel =
  "text-[10px] tracking-[0.18em] uppercase font-semibold";

export default function ConsignorFields({
  form,
  setForm,
  payoutMethods,
  idHint,
  autoFocusId = false,
  idPrefix = "consignor",
}) {
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const phones = form.phones?.length ? form.phones : [{ type: "mobile", number: "" }];

  const setPhone = (index, patch) => {
    setForm((f) => {
      const next = (f.phones?.length ? f.phones : [{ type: "mobile", number: "" }]).map(
        (row, i) => (i === index ? { ...row, ...patch } : row)
      );
      return { ...f, phones: next };
    });
  };

  const expiryOptions = [...EXPIRY_OPTIONS];
  if (form.expiry_action && !expiryOptions.some((o) => o.value === form.expiry_action)) {
    expiryOptions.push({ value: form.expiry_action, label: form.expiry_action });
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <Label className={fieldLabel}>Consignor ID</Label>
        <Input
          data-testid={`${idPrefix}-id`}
          value={form.consignor_id}
          onChange={set("consignor_id")}
          inputMode="numeric"
          autoFocus={autoFocusId}
          placeholder="2047"
          className="mt-1"
        />
        {idHint ? (
          <p className="mt-1 text-[11px] text-neutral-500 leading-snug">{idHint}</p>
        ) : null}
      </div>
      <div>
        <Label className={fieldLabel}>Full name</Label>
        <Input
          data-testid={`${idPrefix}-name`}
          value={form.full_name}
          onChange={set("full_name")}
          className="mt-1"
        />
      </div>

      <div className="sm:col-span-2">
        <Label className={fieldLabel}>Phone</Label>
        <div className="mt-1 space-y-2">
          {phones.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <Select
                value={row.type || "mobile"}
                onValueChange={(v) => setPhone(index, { type: v })}
              >
                <SelectTrigger
                  data-testid={`${idPrefix}-phone-type-${index}`}
                  className="w-[7.25rem] shrink-0"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHONE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                data-testid={
                  index === 0 ? `${idPrefix}-phone` : `${idPrefix}-phone-${index}`
                }
                value={row.number}
                inputMode="tel"
                placeholder="(508) 555-0142"
                onChange={(e) =>
                  setPhone(index, { number: formatPhoneInput(e.target.value) })
                }
              />
              {phones.length > 1 ? (
                <button
                  type="button"
                  aria-label="Remove phone"
                  data-testid={`${idPrefix}-phone-remove-${index}`}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      phones: f.phones.filter((_, i) => i !== index),
                    }))
                  }
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-neutral-400 hover:bg-black/[0.04] hover:text-neutral-700"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            data-testid={`${idPrefix}-add-phone`}
            onClick={() =>
              setForm((f) => ({
                ...f,
                phones: [...(f.phones || []), { type: "mobile", number: "" }],
              }))
            }
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--ee-magenta)] hover:underline"
          >
            <Plus size={13} />
            Add phone
          </button>
        </div>
      </div>

      <div className="sm:col-span-2">
        <Label className={fieldLabel}>Email</Label>
        <Input
          data-testid={`${idPrefix}-email`}
          type="email"
          value={form.email}
          onChange={set("email")}
          className="mt-1"
        />
      </div>

      <div className="sm:col-span-2 relative z-20">
        <Label className={fieldLabel}>Address</Label>
        <div className="mt-1">
        <AddressField
          testId={`${idPrefix}-address`}
          value={form.address}
          onChange={(address) => setForm((f) => ({ ...f, address }))}
        />
        </div>
      </div>

      <div>
        <Label className={fieldLabel}>Payout method</Label>
        <Select
          value={form.payout_method}
          onValueChange={(v) => setForm((f) => ({ ...f, payout_method: v }))}
        >
          <SelectTrigger data-testid={`${idPrefix}-payout`} className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {payoutMethods.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className={fieldLabel}>Payout details</Label>
        <Input
          data-testid={`${idPrefix}-payout-details`}
          value={form.payout_details}
          onChange={set("payout_details")}
          placeholder="Zelle or Venmo"
          className="mt-1"
        />
      </div>

      <div>
        <Label className={fieldLabel}>When items expire</Label>
        <Select
          value={form.expiry_action || "__none__"}
          onValueChange={(v) =>
            setForm((f) => ({ ...f, expiry_action: v === "__none__" ? "" : v }))
          }
        >
          <SelectTrigger data-testid={`${idPrefix}-expiry`} className="mt-1">
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Not set</SelectItem>
            {expiryOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="relative z-30">
        <Label className={fieldLabel}>Drop-off date</Label>
        <DateField
          testId={`${idPrefix}-dropoff`}
          value={form.date_of_drop_off}
          onChange={(date_of_drop_off) => setForm((f) => ({ ...f, date_of_drop_off }))}
        />
      </div>

      <div className="sm:col-span-2">
        <Label className={fieldLabel}>Notes</Label>
        <Textarea
          data-testid={`${idPrefix}-notes`}
          rows={2}
          value={form.notes}
          onChange={set("notes")}
          className="mt-1"
        />
      </div>
    </div>
  );
}
