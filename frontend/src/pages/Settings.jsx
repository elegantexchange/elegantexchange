import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, fmtDateTime, formatApiError, API_BASE } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
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
import { Plus, Trash2, Link as LinkIcon, RefreshCw } from "lucide-react";

export default function Settings() {
  const [square, setSquare] = useState(null);
  const [users, setUsers] = useState([]);
  const [openNewUser, setOpenNewUser] = useState(false);
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    api.get("/square/status").then((r) => setSquare(r.data)).catch(() => {});
    api.get("/auth/users").then((r) => setUsers(r.data)).catch(() => {});
    const flag = params.get("square");
    if (flag === "connected") toast.success("Square connected");
    else if (flag === "error") toast.error("Square OAuth failed");
    else if (flag === "invalid_state") toast.error("Square OAuth state mismatch");
    else if (flag === "token_error") toast.error("Square token exchange failed");
    if (flag) {
      params.delete("square");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectSquare = () => {
    // Cookie is httpOnly so backend can authenticate the redirect
    const token = localStorage.getItem("ee_token");
    window.location.href = `${API_BASE}/square/connect?token=${encodeURIComponent(token || "")}`;
  };
  const disconnect = async () => {
    try {
      await api.post("/square/disconnect");
      toast.success("Disconnected from Square");
      const r = await api.get("/square/status");
      setSquare(r.data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };
  const sync = async () => {
    try {
      const { data } = await api.post("/square/sync");
      toast.success(`Matched ${data.matched}, ${data.unmatched} for review`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl">
      <PageHeader
        title="Settings"
        subtitle="Owner-only configuration."
        testid="settings-title"
      />

      <section className="bg-white border border-[var(--ee-border)] rounded-md p-6 mb-6">
        <h2 className="ee-section-header text-base mb-1">Square POS Integration</h2>
        <p className="text-sm text-neutral-500 font-light mb-4">
          Connect your Square account to auto-sync transactions. Items match by
          Item ID (e.g. EE-001-01) when included in the Square sale note.
        </p>
        {!square?.configured ? (
          <div
            className="rounded-md p-4 text-sm"
            style={{ background: "var(--ee-warning-bg)", color: "#7a5e00" }}
          >
            Square credentials are not configured on the server yet. Add{" "}
            <code>SQUARE_APPLICATION_ID</code>, <code>SQUARE_APPLICATION_SECRET</code>,{" "}
            and <code>SQUARE_REDIRECT_URI</code> to the backend <code>.env</code>,
            then restart the backend.
          </div>
        ) : square?.connected ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-[var(--ee-magenta-soft)] rounded-md px-3 py-2 text-sm">
              <span className="font-semibold">Connected</span> · Merchant {square.merchant_id} ·{" "}
              {square.environment}
              <div className="text-xs text-neutral-500 mt-0.5">
                Last sync: {fmtDateTime(square.last_sync_at)}
              </div>
            </div>
            <Button onClick={sync} variant="outline" className="ee-btn-label" data-testid="settings-sync-btn">
              <RefreshCw size={14} className="mr-1" /> Sync Now
            </Button>
            <Button onClick={disconnect} variant="outline" className="ee-btn-label" data-testid="settings-disconnect-btn">
              Disconnect
            </Button>
          </div>
        ) : (
          <Button
            data-testid="settings-connect-square"
            onClick={connectSquare}
            className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
          >
            <LinkIcon size={14} className="mr-1" /> Connect Square
          </Button>
        )}
      </section>

      <section className="bg-white border border-[var(--ee-border)] rounded-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="ee-section-header text-base">Staff Accounts</h2>
            <p className="text-sm text-neutral-500 font-light">
              Owners can add or remove staff logins.
            </p>
          </div>
          <Button
            data-testid="add-user-btn"
            onClick={() => setOpenNewUser(true)}
            className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
          >
            <Plus size={14} className="mr-1" /> Add User
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b border-[var(--ee-border)]">
            <tr>
              {["Name", "Email", "Role", ""].map((h) => (
                <th key={h} className="ee-table-header text-left px-3 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-0 border-[var(--ee-border)]">
                <td className="px-3 py-2.5">{u.name}</td>
                <td className="px-3 py-2.5 text-neutral-700">{u.email}</td>
                <td className="px-3 py-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ee-magenta)]">
                    {u.role}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Remove ${u.email}?`)) return;
                      try {
                        await api.delete(`/auth/users/${u.id}`);
                        toast.success("Removed");
                        const r = await api.get("/auth/users");
                        setUsers(r.data);
                      } catch (e) {
                        toast.error(formatApiError(e.response?.data?.detail) || e.message);
                      }
                    }}
                    className="text-neutral-400 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <NewUserDialog
        open={openNewUser}
        onClose={() => setOpenNewUser(false)}
        onDone={async () => {
          const r = await api.get("/auth/users");
          setUsers(r.data);
        }}
      />
    </div>
  );
}

function NewUserDialog({ open, onClose, onDone }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "staff" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setForm({ name: "", email: "", password: "", role: "staff" });
  }, [open]);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post("/auth/users", form);
      toast.success("User created");
      onDone();
      onClose();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="new-user-dialog">
        <DialogHeader>
          <DialogTitle className="ee-section-header text-xl">New User</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">Name</Label>
            <Input data-testid="new-user-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">Email</Label>
            <Input data-testid="new-user-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">Temp Password</Label>
            <Input data-testid="new-user-password" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="ee-btn-label">Cancel</Button>
          <Button data-testid="new-user-submit" disabled={busy} onClick={submit} className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white">Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
