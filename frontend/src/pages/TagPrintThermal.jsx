import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { fmtMoney } from "@/lib/api";
import { Printer } from "lucide-react";

/** Brother QL–style hangtag size (~2.4" × 3.9") — black-only thermal. */
const DEMO_TAGS = [
  {
    item_id: "2041-03",
    consignor_id: "2041",
    description: "Silk wrap blouse",
    size: "S",
    asking_price: 48,
  },
  {
    item_id: "2188-01",
    consignor_id: "2188",
    description: "Floral midi dress",
    size: "M",
    asking_price: 69,
  },
  {
    item_id: "1992-07",
    consignor_id: "1992",
    description: "Vintage denim jacket",
    size: "M",
    asking_price: 85,
  },
];

export default function TagPrintThermal() {
  const [params] = useSearchParams();
  const focus = params.get("focus");
  const tags = useMemo(() => {
    if (!focus) return DEMO_TAGS;
    const one = DEMO_TAGS.find((t) => t.item_id === focus);
    return one ? [one] : DEMO_TAGS;
  }, [focus]);

  return (
    <div className="min-h-screen bg-neutral-100 py-8 print:bg-white print:py-0">
      <div className="max-w-3xl mx-auto px-4 print:max-w-none print:px-0">
        <div className="no-print mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="text-[10px] tracking-[0.22em] uppercase text-[var(--ee-magenta)] font-semibold">
                Thermal tag preview
              </div>
              <h1 className="ee-page-title text-2xl mt-1">
                Black-only hangtags · one at a time
              </h1>
              <p className="text-sm text-neutral-600 font-light mt-1 max-w-xl">
                Sized for a Brother QL–class hangtag (~2.4″ × 3.9″). No cream stock,
                no trimmer — printer cuts/feeds the roll.
              </p>
            </div>
            <button
              type="button"
              data-testid="thermal-print-now"
              onClick={() => window.print()}
              className="ee-btn-label bg-[var(--ee-magenta)] text-white px-4 py-2.5 rounded hover:bg-[#6f1655] inline-flex items-center justify-center gap-2 shrink-0"
            >
              <Printer size={14} /> Print sample
            </button>
          </div>

          <ol className="text-sm text-neutral-700 space-y-2 bg-white border border-neutral-200 rounded-lg p-4 font-light leading-relaxed">
            <li>
              <span className="font-semibold text-neutral-900">1. Hardware</span> —
              Brother QL (or similar) + hangtag / die-cut label roll with a hole.
            </li>
            <li>
              <span className="font-semibold text-neutral-900">2. In the app</span> —
              After intake or from Inventory → Print tags (thermal layout). One piece
              = one label.
            </li>
            <li>
              <span className="font-semibold text-neutral-900">3. Print dialog</span> —
              Choose the thermal printer, label size matching the roll, 100% scale,
              no margins.
            </li>
            <li>
              <span className="font-semibold text-neutral-900">4. Attach</span> —
              Snap the string through the hole (or peel if adhesive) and hang on the
              garment. Done.
            </li>
          </ol>
        </div>

        <div id="print-area" className="flex flex-wrap gap-6 justify-center print:block print:gap-0">
          {tags.map((it) => (
            <ThermalHangTag key={it.item_id} item={it} />
          ))}
        </div>

        <p className="no-print mt-8 text-[12px] text-neutral-500 font-light leading-relaxed max-w-2xl mx-auto text-center">
          This is a layout preview. Full Brother SDK wiring can come later; today you
          can still print this page to a QL if the OS paper size matches the roll.
        </p>
      </div>
    </div>
  );
}

function ThermalHangTag({ item }) {
  const styleLabel = (item.description || "").trim() || "—";

  return (
    <article
      className="ee-thermal-tag"
      data-testid={`thermal-tag-${item.item_id}`}
    >
      <div className="ee-thermal-hole" aria-hidden />

      <div className="ee-thermal-brand">THE ELEGANT EXCHANGE</div>

      <div className="ee-thermal-rule" />

      <div className="ee-thermal-field">
        <div className="ee-thermal-label">SIZE</div>
        <div className="ee-thermal-size">{item.size || "—"}</div>
      </div>

      <div className="ee-thermal-rule thin" />

      <div className="ee-thermal-field">
        <div className="ee-thermal-label">STYLE</div>
        <div className="ee-thermal-style">{styleLabel}</div>
      </div>

      <div className="ee-thermal-rule thin" />

      <div className="ee-thermal-field">
        <div className="ee-thermal-label">PRICE</div>
        <div className="ee-thermal-price">{fmtMoney(item.asking_price)}</div>
      </div>

      <div className="ee-thermal-barcode" aria-hidden>
        <span className="ee-thermal-bars" />
      </div>
      <div className="ee-thermal-id">{item.item_id}</div>
    </article>
  );
}
