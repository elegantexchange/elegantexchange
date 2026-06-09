import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, fmtMoney, fmtDate, formatApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import StatusPill from "@/components/StatusPill";
import IntakeDialog from "@/components/IntakeDialog";
import { ArrowLeft, Plus, FileText, Mail, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";

export default function ConsignorDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [intakeOpen, setIntakeOpen] = useState(false);

  const load = () => api.get(`/consignors/${id}`).then((r) => setData(r.data));
  useEffect(() => {
    load().catch((e) => {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    });
  }, [id]);

  if (!data) {
    return <div className="px-10 py-8 text-sm text-neutral-500">Loading…</div>;
  }

  return (
    <div className="px-6 md:px-10 py-8">
      <button
        onClick={() => nav("/consignors")}
        className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 hover:text-[var(--ee-magenta)] inline-flex items-center gap-1 mb-3"
      >
        <ArrowLeft size={12} /> All consignors
      </button>
      <PageHeader
        title={data.full_name}
        subtitle={`Consignor ${data.consignor_id}`}
        testid="consignor-detail-title"
        actions={
          <Button
            data-testid="consignor-detail-intake"
            className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
            onClick={() => setIntakeOpen(true)}
          >
            <Plus size={14} className="mr-1" /> New Intake
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <section className="bg-white border border-[var(--ee-border)] rounded-md p-5 lg:col-span-2">
          <h2 className="ee-section-header text-base mb-3">Contact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 text-sm">
            <div className="flex items-center gap-2 text-neutral-700">
              <Phone size={13} className="text-neutral-400" />
              {data.phone || "—"}
            </div>
            <div className="flex items-center gap-2 text-neutral-700">
              <Mail size={13} className="text-neutral-400" />
              {data.email || "—"}
            </div>
            <div className="flex items-center gap-2 text-neutral-700 sm:col-span-2">
              <MapPin size={13} className="text-neutral-400" />
              {data.address || "—"}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-y-2 text-sm border-t border-[var(--ee-border)] pt-4">
            <div>
              <div className="text-[10px] tracking-[0.18em] uppercase text-neutral-500 font-semibold">
                Payout Method
              </div>
              <div>{data.payout_method}</div>
            </div>
            <div>
              <div className="text-[10px] tracking-[0.18em] uppercase text-neutral-500 font-semibold">
                Payout Details
              </div>
              <div>{data.payout_details || "—"}</div>
            </div>
          </div>
        </section>
        <section className="bg-white border border-[var(--ee-magenta)] rounded-md p-5" style={{ borderWidth: 1.5 }}>
          <div className="text-[10px] tracking-[0.18em] uppercase text-[var(--ee-magenta)] font-semibold">
            Balance Owed
          </div>
          <div data-testid="consignor-balance" className="text-4xl font-bold text-[var(--ee-magenta)] mt-1">
            {fmtMoney(data.total_owed)}
          </div>
          <div className="text-xs text-neutral-500 font-light mt-1">
            {data.active_items} active item{data.active_items === 1 ? "" : "s"} on the floor
          </div>
        </section>
      </div>

      <Tabs defaultValue="items">
        <TabsList className="bg-transparent border-b border-[var(--ee-border)] rounded-none w-full justify-start p-0 h-auto">
          {[
            ["items", "Items"],
            ["earnings", "Earnings"],
            ["documents", "Documents"],
          ].map(([k, label]) => (
            <TabsTrigger
              key={k}
              value={k}
              data-testid={`tab-${k}`}
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-[var(--ee-magenta)] data-[state=active]:border-b-2 data-[state=active]:border-[var(--ee-magenta)] rounded-none px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em]"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="items" className="mt-4">
          <div className="bg-white border border-[var(--ee-border)] rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-[var(--ee-border)]">
                <tr>
                  {["Item ID", "Description", "Category", "Price", "Date In", "Period End", "Status"].map((h) => (
                    <th key={h} className="ee-table-header text-left px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((i) => (
                  <tr key={i.item_id} className="border-b border-[var(--ee-border)] last:border-0 ee-row-alt">
                    <td className="px-4 py-3 font-semibold">{i.item_id}</td>
                    <td className="px-4 py-3">{i.description}</td>
                    <td className="px-4 py-3">{i.category}</td>
                    <td className="px-4 py-3">{fmtMoney(i.asking_price)}</td>
                    <td className="px-4 py-3 text-neutral-600">{fmtDate(i.date_in)}</td>
                    <td className="px-4 py-3 text-neutral-600">{fmtDate(i.period_end)}</td>
                    <td className="px-4 py-3"><StatusPill status={i.status} /></td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-sm text-neutral-400 py-8 font-light">No items yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="earnings" className="mt-4">
          <div className="bg-white border border-[var(--ee-border)] rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-[var(--ee-border)]">
                <tr>
                  {["Date", "Item", "Sale Price", "Consignor Cut", "Status", "Payout Date"].map((h) => (
                    <th key={h} className="ee-table-header text-left px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.sales.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--ee-border)] last:border-0 ee-row-alt">
                    <td className="px-4 py-3">{fmtDate(s.sale_date)}</td>
                    <td className="px-4 py-3 font-semibold">{s.item_id}</td>
                    <td className="px-4 py-3">{fmtMoney(s.sale_price)}</td>
                    <td className="px-4 py-3 text-[var(--ee-magenta)] font-semibold">
                      {fmtMoney(s.consignor_cut)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-0.5 rounded ${s.payout_status === "Paid" ? "ee-status-sold" : "ee-status-donated"}`}>
                        {s.payout_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{fmtDate(s.payout_date)}</td>
                  </tr>
                ))}
                {data.sales.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-sm text-neutral-400 py-8 font-light">No sales yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {data.payouts.length > 0 && (
            <div className="mt-6">
              <h3 className="ee-section-header text-sm mb-2">Payout History</h3>
              <div className="bg-white border border-[var(--ee-border)] rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-[var(--ee-border)]">
                    <tr>
                      {["Date", "Amount", "Method", "Processed By", "Notes"].map((h) => (
                        <th key={h} className="ee-table-header text-left px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.payouts.map((p) => (
                      <tr key={p.id} className="border-b border-[var(--ee-border)] last:border-0 ee-row-alt">
                        <td className="px-4 py-3">{fmtDate(p.date_paid)}</td>
                        <td className="px-4 py-3 font-semibold">{fmtMoney(p.amount)}</td>
                        <td className="px-4 py-3">{p.method}</td>
                        <td className="px-4 py-3 text-neutral-600">{p.processed_by}</td>
                        <td className="px-4 py-3 text-neutral-600">{p.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <div className="bg-white border border-[var(--ee-border)] rounded-md p-6 text-sm">
            <div className="flex items-center gap-2 text-neutral-500">
              <FileText size={16} />
              Signed agreement and intake records will appear here once the seller
              uploads them in V2. For now, intake records are linked to each
              item ID above.
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <IntakeDialog
        open={intakeOpen}
        onClose={() => setIntakeOpen(false)}
        onDone={() => load()}
        presetConsignorId={id}
      />
    </div>
  );
}
