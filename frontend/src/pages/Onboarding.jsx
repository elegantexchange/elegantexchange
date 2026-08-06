import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiError } from "@/lib/api";
import { ROLE_LABELS, roleOf } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOGO_URL, STORE } from "@/lib/brand";
import { toast } from "sonner";

const ease = [0.22, 1, 0.36, 1];

/** First-login essentials only — platform tour runs in-app after this. */
export default function Onboarding({ preview = false }) {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState(preview ? "preview-pass" : "");
  const [password2, setPassword2] = useState(preview ? "preview-pass" : "");
  const [name, setName] = useState(user?.name || (preview ? "Jordan Lee" : ""));
  const [phone, setPhone] = useState(user?.phone || "");
  const [previewRole, setPreviewRole] = useState(roleOf(user) || "retail");

  const role = preview ? previewRole : roleOf(user);
  const canPassword = password.length >= 8 && password === password2;
  const canProfile = name.trim().length > 0;
  const steps = useMemo(() => ["Password", "Profile"], []);

  const finish = async () => {
    if (!canPassword) return toast.error("Password must be at least 8 characters and match");
    if (!canProfile) return toast.error("Name is required");

    if (preview) {
      toast.message("Preview only — next you’d get the in-app guide on Home");
      nav("/tour-preview", { replace: true });
      return;
    }

    setBusy(true);
    try {
      await api.post("/auth/onboarding", {
        password,
        name: name.trim(),
        phone: phone.trim(),
      });
      await refresh();
      toast.success("You’re in — here’s a quick walkthrough");
      nav("/", { replace: true });
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (step === 0 && !canPassword) {
      return toast.error("Password must be at least 8 characters and match");
    }
    if (step === 1) return finish();
    setStep((s) => s + 1);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-[var(--ee-panel)]">
      <div className="w-full max-w-md" data-testid="onboarding-wizard">
        {preview && (
          <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[10px] tracking-[0.18em] uppercase font-semibold text-neutral-500">
              Preview as
            </span>
            {["admin", "manager", "retail"].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setPreviewRole(r)}
                className={`px-2.5 py-1 rounded-[8px] text-[11px] uppercase tracking-[0.12em] font-semibold border ${
                  previewRole === r
                    ? "bg-[var(--ee-ink)] text-white border-[var(--ee-ink)]"
                    : "border-[var(--ee-sidebar-border)] text-neutral-600"
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        )}

        <img
          src={LOGO_URL}
          alt={STORE.name}
          className="w-48 h-16 mx-auto object-cover object-center mb-6"
        />
        <div className="text-center mb-6">
          <p className="text-[10px] tracking-[0.2em] uppercase font-semibold text-neutral-500">
            {preview ? "Preview · " : "First-time setup · "}
            {ROLE_LABELS[role] || role}
          </p>
          <h1 className="ee-section-header text-2xl mt-1">Welcome</h1>
          <p className="text-sm text-neutral-500 font-light mt-2">
            Set your password, then we’ll guide you through the workspace on the page.
          </p>
        </div>

        <div className="flex gap-2 mb-6">
          {steps.map((label, i) => (
            <div key={label} className="flex-1">
              <div
                className={`h-1 rounded-full transition-colors ${
                  i <= step ? "bg-[var(--ee-magenta)]" : "bg-neutral-200"
                }`}
              />
              <div className="mt-1.5 text-[10px] tracking-[0.14em] uppercase text-neutral-500">
                {label}
              </div>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease }}
            className="space-y-4"
          >
            {step === 0 && (
              <>
                <p className="text-sm text-neutral-600 font-light">
                  Choose a password you’ll use for this account.
                </p>
                <div>
                  <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
                    New password
                  </Label>
                  <Input
                    data-testid="onboarding-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
                    Confirm password
                  </Label>
                  <Input
                    data-testid="onboarding-password2"
                    type="password"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    className="mt-1"
                    autoComplete="new-password"
                  />
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <p className="text-sm text-neutral-600 font-light">
                  Confirm how you appear on the floor.
                </p>
                <div>
                  <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
                    Name
                  </Label>
                  <Input
                    data-testid="onboarding-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[10px] tracking-[0.18em] uppercase font-semibold">
                    Phone{" "}
                    <span className="normal-case tracking-normal font-light">(optional)</span>
                  </Label>
                  <Input
                    data-testid="onboarding-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="text-sm text-neutral-500">
                  Signed in as{" "}
                  <span className="font-medium text-neutral-800">
                    {user?.email || "preview@elegantexchange.co"}
                  </span>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex gap-2 mt-8">
          {step > 0 && (
            <Button
              variant="outline"
              className="ee-btn-label"
              onClick={() => setStep((s) => s - 1)}
              disabled={busy}
            >
              Back
            </Button>
          )}
          <Button
            data-testid="onboarding-next"
            disabled={busy}
            onClick={next}
            className="ee-btn-label flex-1 bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white"
          >
            {step === 1 ? "Continue to guide" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
