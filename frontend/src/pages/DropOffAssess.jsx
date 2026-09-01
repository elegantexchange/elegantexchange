import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Camera, Plus, Trash2, Printer, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, CONDITIONS } from "@/lib/brand";
import ItemScanDialog from "@/components/ItemScanDialog";

const blankItem = () => ({
  description: "",
  category: "Dresses",
  size: "",
  condition: "Excellent",
  asking_price: "",
  color: "",
  rack: "",
  text_id: "",
  date_in: "",
});

export default function DropOffAssess() {
  const { id } = useParams();
  const nav = useNavigate();
  const [session, setSession] = useState(null);
  const [items, setItems] = useState([blankItem()]);
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/drop-offs/${id}`);
        if (cancelled) return;
        if (data.status === "completed") {
          toast.message("Already assessed");
          nav("/", { replace: true });
          return;
        }
        setSession(data);
      } catch (e) {
        toast.error(formatApiError(e, "Drop-off not found"));
        nav("/", { replace: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, nav]);

  const validItems = items.filter(
    (i) => i.description.trim().length > 1 && Number(i.asking_price) > 0
  );

  const updateItem = (idx, patch) => {
    setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const submit = async () => {
    if (!validItems.length) {
      toast.error("Add at least one item with description and price");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post(`/drop-offs/${id}/assess`, {
        items: validItems.map((i) => ({
          ...i,
          asking_price: Number(i.asking_price),
        })),
      });
      toast.success(`${data.created} item${data.created === 1 ? "" : "s"} added`);
      const ids = (data.item_ids || []).join(",");
      if (ids) {
        window.open(`/print/tags?ids=${encodeURIComponent(ids)}`, "_blank", "noopener");
      }
      nav(`/consignors/${data.consignor_id}`, { replace: true });
    } catch (e) {
      toast.error(formatApiError(e, "Could not save items"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-sm text-neutral-500" data-testid="drop-off-assess">
        Loading…
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-3xl mx-auto" data-testid="drop-off-assess">
      <button
        type="button"
        onClick={() => nav("/")}
        className="inline-flex items-center gap-1.5 text-[13px] text-neutral-500 mb-4"
      >
        <ArrowLeft size={14} /> Dashboard
      </button>

      <div className="text-[10px] tracking-[0.18em] uppercase font-semibold text-[var(--ee-magenta)]">
        Assess drop-off
      </div>
      <h1 className="ee-page-title text-2xl mt-1">
        {session?.consignor_name || "Consignor"}
      </h1>
      <p className="text-sm text-neutral-500 mt-1">
        {session?.consignor_id}
        {session?.consignor_phone ? ` · ${session.consignor_phone}` : ""}
      </p>

      <div className="mt-6 space-y-3">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="rounded-[11px] border border-[var(--ee-sidebar-border)] bg-[var(--ee-panel)] p-3 space-y-2"
          >
            <div className="flex items-start gap-2">
              <Input
                value={item.description}
                onChange={(e) => updateItem(idx, { description: e.target.value })}
                placeholder="Description"
                className="flex-1 rounded-[8px]"
              />
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                  className="p-2 text-neutral-400 hover:text-neutral-700"
                  aria-label="Remove item"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Select
                value={item.category}
                onValueChange={(v) => updateItem(idx, { category: v })}
              >
                <SelectTrigger className="rounded-[8px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={item.size}
                onChange={(e) => updateItem(idx, { size: e.target.value })}
                placeholder="Size"
                className="rounded-[8px]"
              />
              <Select
                value={item.condition}
                onValueChange={(v) => updateItem(idx, { condition: v })}
              >
                <SelectTrigger className="rounded-[8px]">
                  <SelectValue placeholder="Condition" />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={item.asking_price}
                onChange={(e) => updateItem(idx, { asking_price: e.target.value })}
                placeholder="Price"
                inputMode="decimal"
                className="rounded-[8px]"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="ee-btn-label rounded-[8px]"
          onClick={() => setItems((prev) => [...prev, blankItem()])}
        >
          <Plus size={14} className="mr-1" /> Add item
        </Button>
        <Button
          type="button"
          variant="outline"
          className="ee-btn-label rounded-[8px]"
          onClick={() => setScanOpen(true)}
        >
          <Camera size={14} className="mr-1" /> Scan
        </Button>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Button
          type="button"
          data-testid="dropoff-assess-save"
          disabled={busy || !validItems.length}
          className="ee-btn-label rounded-[8px] bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
          onClick={submit}
        >
          <Printer size={14} className="mr-1" />
          {busy ? "Saving…" : `Save ${validItems.length || ""} item${validItems.length === 1 ? "" : "s"} & print tags`}
        </Button>
      </div>

      <ItemScanDialog
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        confirmLabel="Add to drop-off"
        onConfirm={(draft) => {
          setScanOpen(false);
          setItems((prev) => [
            ...prev,
            {
              ...blankItem(),
              description: draft.description || "",
              category: draft.category || "Other",
              size: draft.size || "",
              condition: draft.condition || "Excellent",
              asking_price: draft.asking_price ?? "",
              color: draft.color || "",
              rack: draft.rack || "",
              text_id: draft.text_id || "",
              date_in: draft.date_in || "",
            },
          ]);
        }}
      />
    </div>
  );
}
