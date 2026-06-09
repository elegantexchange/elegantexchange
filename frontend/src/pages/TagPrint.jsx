import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, fmtDate, fmtMoney } from "@/lib/api";
import { STORE } from "@/lib/brand";
import { Printer } from "lucide-react";

export default function TagPrint() {
  const [params] = useSearchParams();
  const [items, setItems] = useState([]);

  useEffect(() => {
    const ids = (params.get("ids") || "").split(",").filter(Boolean);
    Promise.all(ids.map((id) => api.get(`/inventory/${id}`).then((r) => r.data))).then(
      setItems
    );
  }, [params]);

  return (
    <div className="min-h-screen bg-[var(--ee-bg)] py-8">
      <div className="max-w-[8.5in] mx-auto px-4">
        <div className="flex items-center justify-between mb-4 no-print">
          <div>
            <div className="text-[10px] tracking-[0.22em] uppercase text-[var(--ee-magenta)] font-semibold">
              Item Tags
            </div>
            <h1 className="ee-page-title text-2xl">
              {items.length} tag{items.length === 1 ? "" : "s"} ready
            </h1>
          </div>
          <button
            data-testid="print-now"
            onClick={() => window.print()}
            className="ee-btn-label bg-[var(--ee-magenta)] text-white px-4 py-2 rounded hover:bg-[#6f1655] inline-flex items-center gap-2"
          >
            <Printer size={14} /> Print
          </button>
        </div>

        <div id="print-area">
          <div className="grid grid-cols-3 gap-3">
            {items.map((it) => (
              <div key={it.item_id} className="ee-tag">
                <div className="ee-tag-hole" />
                <div className="text-center pt-5">
                  <div className="text-[8px] tracking-[0.22em] uppercase text-[var(--ee-magenta)] font-bold">
                    {STORE.name.toUpperCase()}
                  </div>
                  <div className="font-bold text-lg mt-2 tracking-tight">
                    {it.item_id}
                  </div>
                </div>
                <div className="text-xs text-center mt-1 space-y-0.5">
                  <div className="font-semibold leading-tight px-1 line-clamp-2">
                    {it.description}
                  </div>
                  <div className="text-neutral-600 text-[10px] uppercase tracking-wider">
                    {it.category} · {it.size || "—"}
                  </div>
                  <div className="text-neutral-600 text-[10px] uppercase tracking-wider">
                    {it.condition}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-[var(--ee-ink)]">
                    {fmtMoney(it.asking_price)}
                  </div>
                </div>
                <div className="text-center text-[9px] text-neutral-500 tracking-wider">
                  IN · {fmtDate(it.date_in)}
                </div>
              </div>
            ))}
          </div>
          {items.length === 0 && (
            <div className="text-center text-neutral-400 py-12 text-sm font-light">
              No items found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
