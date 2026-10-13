import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, fmtMoney } from "@/lib/api";
import { code128Svg } from "@/lib/code128";
import { Printer } from "lucide-react";

/** Sample hangtags so founders can preview print without pulling live inventory. */
const DEMO_TAGS = [
  {
    item_id: "2041-03",
    consignor_id: "2041",
    description: "Silk wrap blouse",
    category: "Tops",
    size: "S",
    condition: "Like New",
    asking_price: 48,
    date_in: "2026-09-12",
  },
  {
    item_id: "2188-01",
    consignor_id: "2188",
    description: "Floral midi dress",
    category: "Dresses",
    size: "M",
    condition: "Excellent",
    asking_price: 69,
    date_in: "2026-09-18",
  },
  {
    item_id: "1992-07",
    consignor_id: "1992",
    description: "Vintage denim jacket",
    category: "Outerwear",
    size: "M",
    condition: "Very Good",
    asking_price: 85,
    date_in: "2026-09-20",
  },
];

export default function TagPrint() {
  const [params] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const ids = useMemo(
    () => (params.get("ids") || "").split(",").filter(Boolean),
    [params]
  );
  const demo = params.get("demo") === "1" || ids.length === 0;

  useEffect(() => {
    if (demo) {
      setItems(DEMO_TAGS);
      return;
    }
    setLoading(true);
    Promise.all(ids.map((id) => api.get(`/inventory/${id}`).then((r) => r.data)))
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [demo, ids]);

  return (
    <div className="min-h-screen bg-[var(--ee-bg)] py-8 print:bg-white print:py-0">
      <div className="max-w-[8.5in] mx-auto px-4 print:px-0">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 no-print">
          <div>
            <div className="text-[10px] tracking-[0.22em] uppercase text-[var(--ee-magenta)] font-semibold">
              Back labels · 2″ × 2″
            </div>
            <h1 className="ee-page-title text-2xl mt-1">
              {loading
                ? "Loading…"
                : `${items.length} label${items.length === 1 ? "" : "s"} ready`}
            </h1>
            <p className="text-sm text-neutral-600 font-light mt-1 max-w-xl">
              Each label prints at 2×2 inches. Stick it on the back of the hang tag.
              {demo ? " Showing sample pieces." : null}
            </p>
          </div>
          <button
            data-testid="print-now"
            type="button"
            onClick={async () => {
              if (!demo && ids.length) {
                try {
                  await api.post("/inventory/tags-printed", { item_ids: ids });
                } catch {
                  /* still print if the queue update fails */
                }
              }
              window.print();
            }}
            className="ee-btn-label bg-[var(--ee-magenta)] text-white px-4 py-2.5 rounded hover:bg-[#6f1655] inline-flex items-center justify-center gap-2 shrink-0"
          >
            <Printer size={14} /> Print labels
          </button>
        </div>

        <div id="print-area" className="ee-label-sheet">
          <div className="ee-label-grid">
            {items.map((it) => (
              <HangTag key={it.item_id} item={it} />
            ))}
          </div>
          {!loading && items.length === 0 && (
            <div className="text-center text-neutral-400 py-12 text-sm font-light">
              No items found.
            </div>
          )}
        </div>

        <p className="no-print mt-8 text-[12px] text-neutral-500 font-light leading-relaxed max-w-2xl">
          In the print dialog choose letter paper, 100% scale, and turn off
          headers and footers. Each label is exactly 2×2 inches.
        </p>
      </div>
    </div>
  );
}
function labelCopy(item) {
  const category = (item.category || "").trim();
  const size = (item.size || "").trim();
  return { product: category || "—", size: size || "—" };
}

/** Keep the product name on one line by stepping the type down until it fits. */
function FitLine({ children, className }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.fontSize = "";
    const max = parseFloat(getComputedStyle(el).fontSize);
    let size = max;
    while (el.scrollWidth > el.clientWidth + 0.5 && size > 8.5) {
      size -= 0.25;
      el.style.fontSize = `${size}px`;
    }
  }, [children]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

function barcodeMarkup(itemId) {
  try {
    return code128Svg(itemId, { maxWidthIn: 1.76, barHeightIn: 0.58 });
  } catch {
    return "";
  }
}

function HangTag({ item }) {
  const { product, size } = labelCopy(item);
  const bars = barcodeMarkup(item.item_id);

  return (
    <article className="ee-back-label" data-testid={`hangtag-${item.item_id}`}>
      <div className="ee-back-row">
        <div className="ee-back-kicker">Size</div>
        <div className="ee-back-value">{size}</div>
      </div>
      <div className="ee-back-rule" />
      <div className="ee-back-row">
        <div className="ee-back-kicker">Product</div>
        <FitLine className="ee-back-value ee-back-product">{product}</FitLine>
      </div>
      <div className="ee-back-rule" />
      <div className="ee-back-row">
        <div className="ee-back-kicker">Price</div>
        <div className="ee-back-value ee-back-price">{fmtMoney(item.asking_price)}</div>
      </div>
      <div className="ee-back-code">
        {bars ? (
          <div
            className="ee-back-barcode"
            aria-hidden
            dangerouslySetInnerHTML={{ __html: bars }}
          />
        ) : null}
        <div className="ee-back-id">{item.item_id}</div>
      </div>
    </article>
  );
}
