import { useEffect, useState } from "react";
import { api, fmtDateTime, formatApiError, API_BASE } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ROLE_LABELS, roleOf, isAdmin } from "@/lib/auth";
import { SHARED_SHOP_EMAIL } from "@/lib/operator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ResponsiveModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Link as LinkIcon, RefreshCw } from "lucide-react";

export const SETTINGS_CHAPTERS = [
  { id: "account", label: "My Account", blurb: "Your profile and password" },
  { id: "shop", label: "Shop", blurb: "Square and commission split", adminOnly: true },
  { id: "team", label: "Team", blurb: "Invite and manage roles", adminOnly: true },
];

export function chaptersForUser(user) {
  return SETTINGS_CHAPTERS.filter((c) => !c.adminOnly || isAdmin(user));
}

export function MyAccountPanel({ compact = false }) {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(user?.name || "");
    setPhone(user?.phone || "");
  }, [user]);

  const save = async () => {
    if (!name.trim()) return toast.error("Name is required");
    setBusy(true);
    try {
      const body = { name: name.trim(), phone: phone.trim() };
      if (password) {
        if (password.length < 8) {
          toast.error("Password must be at least 8 characters");
          setBusy(false);
          return;
        }
        body.password = password;
      }
      await api.put("/auth/me", body);
      setPassword("");
      await refresh();
      toast.success("Account updated");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-4"} data-testid="settings-account">
      <div className="flex items-center gap-2">
        <span className="text-[10px] tracking-[0.18em] uppercase font-semibold text-[var(--ee-magenta)]">
          {ROLE_LABELS[roleOf(user)] || roleOf(user)}
        </span>
      </div>
      <div>
        <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">Email</Label>
        <Input value={user?.email || ""} disabled className="mt-1 bg-neutral-50" />
      </div>
      <div>
        <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">Name</Label>
        <Input
          data-testid="settings-account-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">Phone</Label>
        <Input
          data-testid="settings-account-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
          New password
        </Label>
        <Input
          data-testid="settings-account-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1"
          placeholder="Leave blank to keep current"
          autoComplete="new-password"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          data-testid="settings-account-save"
          disabled={busy}
          onClick={save}
          className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
        >
          Save account
        </Button>
      </div>
    </div>
  );
}

export function ShopPanel() {
  const [square, setSquare] = useState(null);
  const [consignorSplitPct, setConsignorSplitPct] = useState(50);
  const [splitDraft, setSplitDraft] = useState("50");
  const [splitBusy, setSplitBusy] = useState(false);

  useEffect(() => {
    api.get("/square/status").then((r) => setSquare(r.data)).catch(() => {});
    api.get("/settings").then((r) => {
      const pct = Number(r.data?.consignor_split_pct ?? 50);
      setConsignorSplitPct(pct);
      setSplitDraft(String(pct));
    }).catch(() => {});
  }, []);

  const saveSplit = async () => {
    const pct = Number(splitDraft);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      return toast.error("Consignor split must be between 0 and 100");
    }
    setSplitBusy(true);
    try {
      const { data } = await api.put("/settings/split", { consignor_split_pct: pct });
      const next = Number(data.consignor_split_pct);
      setConsignorSplitPct(next);
      setSplitDraft(String(next));
      toast.success(
        `Split updated — new intakes use ${data.store_split_pct}% store / ${next}% consignor`
      );
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setSplitBusy(false);
    }
  };

  const connectSquare = () => {
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

  const draftPct = Number(splitDraft);
  const consignorDraft = Number.isNaN(draftPct) ? 0 : Math.min(100, Math.max(0, draftPct));
  const storeDraft = Math.round((100 - consignorDraft) * 100) / 100;

  return (
    <div className="space-y-8" data-testid="settings-shop">
      <div>
        <h3 className="ee-section-header text-base mb-3">Square POS</h3>
        <p className="text-sm text-neutral-500 font-light mb-4">
          Connect your Square account here. Then charge from Sales on the floor iPad — payments
          stay tied to each piece and consignor.
        </p>
        {!square?.configured ? (
          <p className="text-sm text-amber-800/80">
            Square credentials aren’t configured on the server yet. Add{" "}
            <code className="text-xs">SQUARE_APPLICATION_ID</code>,{" "}
            <code className="text-xs">SQUARE_APPLICATION_SECRET</code>, and{" "}
            <code className="text-xs">SQUARE_REDIRECT_URI</code> to the backend{" "}
            <code className="text-xs">.env</code>, then restart.
          </p>
        ) : square?.connected ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[var(--ee-border)] pb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" aria-hidden />
                <span className="text-neutral-800">Connected</span>
                <span className="text-neutral-300">·</span>
                <span className="text-neutral-500 truncate">{square.merchant_id}</span>
                <span className="text-neutral-300">·</span>
                <span className="text-neutral-400 text-xs uppercase tracking-[0.12em]">
                  {square.environment}
                </span>
              </div>
              <div className="text-[12px] text-neutral-400 mt-1 pl-3.5">
                Last sync {fmtDateTime(square.last_sync_at)}
              </div>
            </div>
            <div className="flex items-center gap-3 pl-3.5 sm:pl-0">
              <button
                type="button"
                onClick={sync}
                data-testid="settings-sync-btn"
                className="inline-flex items-center gap-1 text-[11px] text-neutral-600 hover:text-[var(--ee-ink)]"
              >
                <RefreshCw size={12} /> Sync
              </button>
              <button
                type="button"
                onClick={disconnect}
                data-testid="settings-disconnect-btn"
                className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-800"
              >
                Disconnect
              </button>
            </div>
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
      </div>

      <div data-testid="settings-split-section">
        <h3 className="ee-section-header text-base mb-1">Commission Split</h3>
        <p className="text-sm text-neutral-500 font-light mb-5">
          Default for new intakes. Existing pieces keep their stamped rate.
        </p>

        <div className="grid grid-cols-2 gap-6 mb-4">
          <div>
            <div className="text-[10px] tracking-[0.18em] uppercase font-semibold text-neutral-400">
              Store
            </div>
            <div className="mt-1 text-4xl font-semibold tracking-tight tabular-nums text-[var(--ee-ink)]">
              {storeDraft}
              <span className="text-lg text-neutral-400 font-medium ml-0.5">%</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] tracking-[0.18em] uppercase font-semibold text-neutral-400">
              Consignor
            </div>
            <div className="mt-1 text-4xl font-semibold tracking-tight tabular-nums text-[var(--ee-magenta)]">
              {consignorDraft}
              <span className="text-lg text-neutral-400 font-medium ml-0.5">%</span>
            </div>
          </div>
        </div>

        <div className="h-1.5 w-full rounded-full overflow-hidden flex bg-neutral-100 mb-4">
          <div
            className="h-full bg-[var(--ee-ink)] transition-[width] duration-150"
            style={{ width: `${storeDraft}%` }}
          />
          <div
            className="h-full bg-[var(--ee-magenta)] transition-[width] duration-150"
            style={{ width: `${consignorDraft}%` }}
          />
        </div>

        <input
          data-testid="settings-split-input"
          type="range"
          min={0}
          max={100}
          step={1}
          value={consignorDraft}
          onChange={(e) => setSplitDraft(e.target.value)}
          className="w-full accent-[var(--ee-magenta)]"
          aria-label="Consignor split percent"
        />
        <div className="flex justify-between text-[11px] text-neutral-400 mt-1.5 mb-2">
          <span>More to store</span>
          <span>More to consignor</span>
        </div>
        {Number(consignorSplitPct) !== consignorDraft && (
          <p className="text-[12px] text-neutral-500 mb-4">
            Saved rate is {Math.round((100 - consignorSplitPct) * 100) / 100}% / {consignorSplitPct}%
            — save to apply for new intakes.
          </p>
        )}
        <Button
          data-testid="settings-split-save"
          disabled={splitBusy}
          onClick={saveSplit}
          className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white mt-2"
        >
          Save Split
        </Button>
      </div>
    </div>
  );
}

export function TeamPanel() {
  const [users, setUsers] = useState([]);
  const [openNewUser, setOpenNewUser] = useState(false);

  const load = async () => {
    try {
      const r = await api.get("/auth/users");
      setUsers(r.data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div data-testid="settings-team" className="space-y-3">
      <div className="flex justify-end">
        <Button
          data-testid="add-user-btn"
          onClick={() => setOpenNewUser(true)}
          className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
        >
          <Plus size={14} className="mr-1" /> Invite
        </Button>
      </div>

      <ul className="divide-y divide-[var(--ee-border)] border border-[var(--ee-border)] rounded-[8px] overflow-hidden">
        {users.map((u) => {
          const isShopOwner =
            (u.email || "").toLowerCase() === SHARED_SHOP_EMAIL;
          return (
          <li
            key={u.id}
            className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{u.name}</div>
              <div className="text-[12px] text-neutral-500 truncate">{u.email}</div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {isShopOwner ? (
                <span
                  className="text-[11px] font-semibold tracking-[0.06em] uppercase text-neutral-500 px-2 py-1"
                  data-testid={`team-role-${u.id}`}
                >
                  Owner
                </span>
              ) : (
              <Select
                value={roleOf(u)}
                onValueChange={async (role) => {
                  try {
                    await api.patch(`/auth/users/${u.id}`, { role });
                    toast.success("Role updated");
                    load();
                  } catch (e) {
                    toast.error(formatApiError(e.response?.data?.detail) || e.message);
                  }
                }}
              >
                <SelectTrigger className="h-8 w-[110px]" data-testid={`team-role-${u.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Owner</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                </SelectContent>
              </Select>
              )}
              {!isShopOwner && (
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm(`Remove ${u.email}?`)) return;
                  try {
                    await api.delete(`/auth/users/${u.id}`);
                    toast.success("Removed");
                    load();
                  } catch (e) {
                    toast.error(formatApiError(e.response?.data?.detail) || e.message);
                  }
                }}
                className="p-1.5 text-neutral-400 hover:text-red-600"
                aria-label={`Remove ${u.email}`}
              >
                <Trash2 size={14} />
              </button>
              )}
            </div>
          </li>
          );
        })}
        {users.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-neutral-400 font-light">
            No team members yet.
          </li>
        )}
      </ul>

      <InviteUserDialog
        open={openNewUser}
        onClose={() => setOpenNewUser(false)}
        onDone={load}
      />
    </div>
  );
}

function InviteUserDialog({ open, onClose, onDone }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "retail",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ name: "", email: "", password: "", role: "retail" });
    }
  }, [open]);

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      return toast.error("Name, email, and temp password are required");
    }
    setBusy(true);
    try {
      const { data } = await api.post("/auth/users", form);
      if (data.invite_email?.delivered) {
        toast.success(`Invite email sent to ${form.email}`);
      } else if (data.invite_email?.reason === "smtp_not_configured") {
        toast.message("Member created — SMTP not set, invite logged in backend console");
      } else if (data.invite_email && !data.invite_email.delivered) {
        toast.message(
          `Member created — email not sent (${data.invite_email.reason || "unknown"})`
        );
      } else {
        toast.success("Member invited");
      }
      if (data.domain_warning) toast.message(data.domain_warning);
      onDone();
      onClose();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveModalContent className="max-w-md" data-testid="new-user-dialog">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle className="ee-section-header text-xl">
            Invite team member
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">Name</Label>
            <Input
              data-testid="new-user-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
              Email
            </Label>
            <Input
              data-testid="new-user-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="name@elegantexchange.co"
            />
            <p className="text-xs text-neutral-500 mt-1">
              They’ll get a branded email with login details and how to use the app.
            </p>
          </div>
          <div>
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
              Temp password
            </Label>
            <Input
              data-testid="new-user-password"
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger data-testid="new-user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Owner</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="retail">Retail</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <ResponsiveModalFooter>
          <Button variant="outline" onClick={onClose} className="ee-btn-label">
            Cancel
          </Button>
          <Button
            data-testid="new-user-submit"
            disabled={busy}
            onClick={submit}
            className="ee-btn-label bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
          >
            Invite
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

export function ChapterBody({ chapterId }) {
  if (chapterId === "shop") return <ShopPanel />;
  if (chapterId === "team") return <TeamPanel />;
  return <MyAccountPanel />;
}
