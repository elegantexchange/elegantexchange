import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
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
import { toast } from "sonner";
import { Plus, Trash2, Printer } from "lucide-react";
import { CATEGORIES, CONDITIONS } from "@/lib/brand";
import { useNavigate } from "react-router-dom";

const blankItem = () => ({
  description: "",
  category: "Dresses",
  size: "",
  condition: "Excellent",
  asking_price: "",
});

export default function IntakeDialog({ open, onClose, onDone, presetConsignorId }) {
  const [consignors, setConsignors] = useState([]);
  const [consignorId, setConsignorId] = useState(presetConsignorId || "");
  const [items, setItems] = useState([blankItem()]);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    if (open) {
      api.get("/consignors").then((r) => setConsignors(r.data));
      setConsignorId(presetConsignorId || "");
      setItems([blankItem()]);
    }
  }, [open, presetConsignorId]);

  const setItem = (idx, patch) => {
    const next = items.slice();
    next[idx] = { ...next[idx], ...patch };
    setItems(next);
  };

  const submit = async () => {
    if (!consignorId) {
      toast.error("Choose a consignor");
      return;
    }
    const valid = items.filter(
      (i) => i.description.trim() && Number(i.asking_price) > 0
    );
    if (valid.length === 0) {
      toast.error("Add at least one item with description and price");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/inventory/batch", {
        consignor_id: consignorId,
        items: valid.map((i) => ({
          ...i,
          asking_price: Number(i.asking_price),
        })),
      });
      toast.success(`${data.items.length} item${data.items.length === 1 ? "" : "s"} added`);
      // Open tag printer in new tab
      const ids = data.items.map((i) => i.item_id).join(",");
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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl" data-testid="intake-dialog">
        <DialogHeader>
          <DialogTitle className="ee-section-header text-xl">
            New Drop-Off
          </DialogTitle>
        </DialogHeader>

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

        <div className="border border-[var(--ee-border)] rounded-md mt-4 overflow-hidden">
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
                    <td className="px-3 py-2">
                      <Input
                        data-testid={`intake-desc-${idx}`}
                        value={it.description}
                        onChange={(e) => setItem(idx, { description: e.target.value })}
                        placeholder="e.g. Silk wrap dress, blush"
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
                        className="w-[70px]"
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
                        className="w-[80px]"
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

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose} className="ee-btn-label">
            Cancel
          </Button>
          <Button
            data-testid="intake-submit"
            onClick={submit}
            disabled={busy}
            className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
          >
            <Printer size={14} className="mr-1" /> Save & Print Tags
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
