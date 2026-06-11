import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fmtMoney, fmtDate, formatApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusPill from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Printer } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES } from "@/lib/brand";
import { toast } from "sonner";

const STATUS_FILTERS = ["All", "Active", "Expiring Soon", "Expired", "Sold", "Donated", "Returned"];
const FILTER_PILL_W = "w-[9.75rem]";
const FILTER_PILL_CLASS =
  "shrink-0 whitespace-nowrap text-[10px] uppercase tracking-[0.14em] font-semibold px-3 py-1.5 rounded border";

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [selected, setSelected] = useState(new Set());
  const nav = useNavigate();

  const load = () => api.get("/inventory").then((r) => setItems(r.data));
  useEffect(() => {
    load();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const sevenAhead = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return items.filter((i) => {
      if (term) {
        const hay = `${i.item_id} ${i.description} ${i.consignor_id} ${i.consignor_name}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (categoryFilter !== "All" && i.category !== categoryFilter) return false;
      if (statusFilter === "All") return true;
      if (statusFilter === "Expiring Soon") {
        return i.status === "Active" && i.period_end <= sevenAhead && i.period_end >= today;
      }
      return i.status === statusFilter;
    });
  }, [items, q, statusFilter, categoryFilter, today, sevenAhead]);

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

  return (
    <div className="px-6 md:px-10 py-8">
      <PageHeader
        title="Inventory"
        subtitle={`${items.length} item${items.length === 1 ? "" : "s"} tracked`}
        testid="inventory-title"
        actions={
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
                {["Status", "Item ID", "Consignor", "Description", "Category", "Size", "Price", "Date In", "Period End"].map((h) => (
                  <th key={h} className="ee-table-header text-left px-3 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody data-testid="inventory-tbody">
              {filtered.map((i) => (
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
                  <td className="px-3 py-2.5 text-neutral-600">{i.category}</td>
                  <td className="px-3 py-2.5 text-neutral-600">{i.size}</td>
                  <td className="px-3 py-2.5 font-semibold">{fmtMoney(i.asking_price)}</td>
                  <td className="px-3 py-2.5 text-neutral-600">{fmtDate(i.date_in)}</td>
                  <td className="px-3 py-2.5 text-neutral-600">{fmtDate(i.period_end)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="text-center text-sm text-neutral-400 py-12 font-light">No items match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
