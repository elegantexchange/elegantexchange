import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  ROLE_LABELS,
  ROLE_PREVIEW_PERSONAS,
  roleOf,
} from "@/lib/auth";

const ADMIN_ONLY_PATHS = ["/payouts"];
const MANAGER_PATHS = ["/analytics"];

/**
 * Localhost-only: click the role label to preview Admin / Manager / Retail UI.
 */
export default function RolePreviewMenu({ className = "" }) {
  const {
    user,
    sessionUser,
    canRolePreview,
    rolePreview,
    setRolePreview,
    clearRolePreview,
  } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const nav = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!user?.role) return null;

  const label = ROLE_LABELS[roleOf(user)] || roleOf(user);
  const realName = sessionUser?.name || "Signed-in user";

  if (!canRolePreview) {
    return (
      <div
        className={`text-[10px] tracking-[0.14em] uppercase font-semibold text-neutral-400 mt-0.5 ${className}`}
      >
        {label}
      </div>
    );
  }

  const pick = (persona) => {
    setRolePreview(persona);
    setOpen(false);
    const nextRole = persona?.role || roleOf(sessionUser);
    const onAdminOnly = ADMIN_ONLY_PATHS.some((p) =>
      location.pathname.startsWith(p)
    );
    const onManagerPath = MANAGER_PATHS.some((p) =>
      location.pathname.startsWith(p)
    );
    if (
      (nextRole === "retail" && (onAdminOnly || onManagerPath)) ||
      (nextRole === "manager" && onAdminOnly)
    ) {
      nav("/", { replace: true });
    }
  };

  return (
    <div ref={wrapRef} className={`relative mt-0.5 ${className}`}>
      <button
        type="button"
        data-testid="role-preview-trigger"
        onClick={() => setOpen((o) => !o)}
        className="text-[10px] tracking-[0.14em] uppercase font-semibold text-neutral-400 hover:text-[var(--ee-magenta)] transition-colors"
        title="Preview roles (local only)"
      >
        {label}
        {rolePreview ? " · preview" : ""}
      </button>
      {open ? (
        <div
          data-testid="role-preview-menu"
          className="absolute left-0 bottom-full mb-1.5 z-40 min-w-[168px] rounded-[8px] border border-[var(--ee-sidebar-border)] bg-[var(--ee-panel)] py-1 shadow-sm"
        >
          <div className="px-2.5 py-1 text-[9px] tracking-[0.14em] uppercase font-semibold text-neutral-400">
            Preview as
          </div>
          {ROLE_PREVIEW_PERSONAS.map((p) => {
            const active = rolePreview?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                data-testid={`role-preview-${p.id}`}
                onClick={() => pick(p)}
                className={`w-full text-left px-2.5 py-1.5 text-[12px] transition-colors ${
                  active
                    ? "bg-[var(--ee-sidebar-active)] text-[var(--ee-ink)] font-medium"
                    : "text-neutral-600 hover:bg-[var(--ee-sidebar-hover)]"
                }`}
              >
                <span className="font-semibold">{p.name}</span>
                <span className="text-neutral-400 ml-1.5">
                  {ROLE_LABELS[p.role]}
                </span>
              </button>
            );
          })}
          <div className="my-1 border-t border-[var(--ee-sidebar-border)]" />
          <button
            type="button"
            data-testid="role-preview-clear"
            onClick={() => {
              clearRolePreview();
              setOpen(false);
            }}
            className="w-full text-left px-2.5 py-1.5 text-[12px] text-neutral-600 hover:bg-[var(--ee-sidebar-hover)]"
          >
            <span className="font-semibold">{realName}</span>
            <span className="text-neutral-400 ml-1.5">Real session</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
