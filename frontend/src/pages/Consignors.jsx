import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, fmtMoney } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import IntakeDialog from "@/components/IntakeDialog";

export default function Consignors() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [params, setParams] = useSearchParams();
  const [openIntake, setOpenIntake] = useState(
    params.get("intake") === "1" || params.get("new") === "1"
  );
  const intakePresetMode = params.get("new") === "1" ? "new" : "existing";
  const nav = useNavigate();

  const load = () => api.get("/consignors").then((r) => setList(r.data));
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    if (!term) return list;
    return list.filter(
      (c) =>
        c.full_name.toLowerCase().includes(term) ||
        c.consignor_id.toLowerCase().includes(term) ||
        (c.phone || "").toLowerCase().includes(term) ||
        (c.email || "").toLowerCase().includes(term)
    );
  }, [list, q]);

  return (
    <div className="px-6 md:px-10 py-8">
      <PageHeader
        title="Consignors"
        subtitle={`${list.length} consignor${list.length === 1 ? "" : "s"} on file`}
        testid="consignors-title"
        actions={
          <Button
            data-testid="open-intake-btn"
            className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
            onClick={() => setOpenIntake(true)}
          >
            <Plus size={14} className="md:mr-1" />
            <span className="hidden md:inline">New Drop-Off</span>
          </Button>
        }
      />

      <div className="relative w-full mb-4">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <Input
          data-testid="consignors-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, ID, phone, email…"
          className="w-full pl-9"
        />
      </div>

      <div className="bg-white border border-[var(--ee-border)] rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-neutral-50 border-b border-[var(--ee-border)]">
              <tr>
                {["ID", "Name", "Phone", "Email", "Active Items", "Total Owed", "Payout"].map((h) => (
                  <th key={h} className="ee-table-header text-left px-3 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody data-testid="consignors-tbody">
              {filtered.map((c) => (
                <tr
                  key={c.consignor_id}
                  data-testid={`consignor-row-${c.consignor_id}`}
                  className="border-b border-[var(--ee-border)] last:border-0 ee-row-alt hover:bg-[var(--ee-magenta-soft)]/40 cursor-pointer"
                  onClick={() => nav(`/consignors/${c.consignor_id}`)}
                >
                  <td className="px-3 py-2.5 font-semibold">{c.consignor_id}</td>
                  <td className="px-3 py-2.5">{c.full_name}</td>
                  <td className="px-3 py-2.5 text-neutral-600">{c.phone || "—"}</td>
                  <td className="px-3 py-2.5 text-neutral-600 max-w-[200px] truncate" title={c.email || undefined}>{c.email || "—"}</td>
                  <td className="px-3 py-2.5">{c.active_items}</td>
                  <td className="px-3 py-2.5 font-semibold text-[var(--ee-magenta)]">
                    {fmtMoney(c.total_owed)}
                  </td>
                  <td className="px-3 py-2.5 text-neutral-600">{c.payout_method}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-neutral-400 py-10 text-sm font-light">
                    No consignors match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <IntakeDialog
        open={openIntake}
        presetMode={intakePresetMode}
        onClose={() => {
          setOpenIntake(false);
          params.delete("intake");
          params.delete("new");
          setParams(params);
        }}
        onDone={() => load()}
      />
    </div>
  );
}
