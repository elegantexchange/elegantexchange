import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, fmtMoney } from "@/lib/api";
import { LOGO_URL } from "@/lib/brand";
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
    <div className="min-h-screen bg-[#f3eee6] py-8 print:bg-white print:py-0">
      <div className="max-w-[8.5in] mx-auto px-4 print:px-0">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 no-print">
          <div>
            <div className="text-[10px] tracking-[0.22em] uppercase text-[var(--ee-magenta)] font-semibold">
              Hangtag preview · Option A
            </div>
            <h1 className="ee-page-title text-2xl mt-1">
              {loading
                ? "Loading…"
                : `${items.length} tag${items.length === 1 ? "" : "s"} ready`}
            </h1>
            <p className="text-sm text-neutral-600 font-light mt-1 max-w-xl">
              Print on letter cardstock from the app, cut on the guides, punch the
              hole, add string. Same flow as Inventory → Print tags.
              {demo ? " Showing sample pieces." : null}
            </p>
          </div>
          <button
            data-testid="print-now"
            type="button"
            onClick={() => window.print()}
            className="ee-btn-label bg-[var(--ee-magenta)] text-white px-4 py-2.5 rounded hover:bg-[#6f1655] inline-flex items-center justify-center gap-2 shrink-0"
          >
            <Printer size={14} /> Print sheet
          </button>
        </div>

        <div id="print-area" className="ee-hangtag-sheet">
          <div className="grid grid-cols-3 gap-3 print:gap-2">
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
          Tip: in the print dialog choose letter paper, 100% scale, and turn off
          headers/footers. Heavier cream cardstock reads closest to boutique
          hangtags.
        </p>
      </div>
    </div>
  );
}

function HangTag({ item }) {
  const styleLabel =
    (item.description || "").trim() ||
    (item.category || "").trim() ||
    "—";

  return (
    <article className="ee-hangtag" data-testid={`hangtag-${item.item_id}`}>
      <div className="ee-hangtag-hole" aria-hidden />

      <header className="ee-hangtag-brand">
        <img
          src={LOGO_URL}
          alt="The Elegant Exchange"
          className="ee-hangtag-logo"
          style={{
            width: "13.5rem",
            maxWidth: "96%",
            height: "5.75rem",
            objectFit: "cover",
            objectPosition: "center",
            display: "block",
          }}
        />
      </header>

      <div className="ee-hangtag-divider" />

      <section className="ee-hangtag-field">
        <div className="ee-hangtag-label">Size</div>
        <div className="ee-hangtag-value ee-hangtag-size">{item.size || "—"}</div>
      </section>

      <div className="ee-hangtag-rule" />

      <section className="ee-hangtag-field">
        <div className="ee-hangtag-label">Style</div>
        <div className="ee-hangtag-value ee-hangtag-style">{styleLabel}</div>
      </section>

      <div className="ee-hangtag-rule" />

      <section className="ee-hangtag-field">
        <div className="ee-hangtag-label">Price</div>
        <div className="ee-hangtag-value ee-hangtag-price">
          {fmtMoney(item.asking_price)}
        </div>
      </section>

      <div className="ee-hangtag-dots" />

      <footer className="ee-hangtag-meta">
        <div className="ee-hangtag-id">{item.item_id}</div>
      </footer>
    </article>
  );
}
