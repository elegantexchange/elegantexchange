import { fmtMoney } from "@/lib/api";
import { activeDiscountFor, discountedPrice, percentLabel } from "@/lib/discounts";

export function SalePrice({ item, discounts, detail = false, ink }) {
  const deal = activeDiscountFor(item, discounts);
  const asking = item?.asking_price;
  if (!deal) {
    return <span className="tabular-nums">{fmtMoney(asking)}</span>;
  }
  const sale = discountedPrice(asking, deal.percent_off);
  const mark = `${percentLabel(deal.percent_off)}% off`;
  if (detail) {
    return (
      <div className="text-right">
        <div
          className="text-xl sm:text-2xl font-bold tabular-nums"
          style={ink ? { color: ink } : undefined}
        >
          {fmtMoney(sale)}
        </div>
        <div className="text-[11px] font-semibold text-[var(--ee-magenta)] mt-0.5">
          {mark} {deal.category}
        </div>
        <div className="text-[11px] text-neutral-400 line-through tabular-nums font-normal">
          {fmtMoney(asking)}
        </div>
      </div>
    );
  }
  return (
    <span className="inline-flex flex-col items-end">
      <span className="tabular-nums">{fmtMoney(sale)}</span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--ee-magenta)] leading-tight">
        {mark}
      </span>
    </span>
  );
}
