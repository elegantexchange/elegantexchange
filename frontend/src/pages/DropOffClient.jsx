import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Eraser } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { STORE } from "@/lib/brand";
import { buildAgreementText } from "@/lib/agreement";
import SignaturePad from "@/components/SignaturePad";
import { Toaster } from "@/components/ui/sonner";

const ease = [0.22, 1, 0.36, 1];

const STEPS = [
  "welcome",
  "name",
  "phone",
  "email",
  "agreement",
  "thanks",
  "handoff",
];

/** Boutique social voice — warm, short, elevated */
const COPY = {
  welcomeTitle: "So glad you're here",
  welcomeHint: "A few quick details — then you're officially in with us",
  welcomeCta: "Let's begin",
  nameLabel: "What should we call you?",
  nameHint: "Exactly as you'd like it on your agreement",
  namePlaceholder: "Your full name",
  phoneLabel: "Best number for you?",
  phoneHint: "So we can reach you when your pieces find a home",
  phonePlaceholder: "(555) 555-0100",
  emailLabel: "Where should updates go?",
  emailHint: "Sale notes and boutique news land here",
  emailPlaceholder: "you@email.com",
  agreementTitle: "Make it official",
  agreementHint: "A quick read, then your signature seals it",
  agreementCta: "Sign & join us",
  thanksTitle: "You're in",
  thanksHint: (first) =>
    `We've got you from here${first ? `, ${first}` : ""}.`,
  nextCta: "Next",
};

export default function DropOffClient() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [splitPct, setSplitPct] = useState(50);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [signedName, setSignedName] = useState("");
  const [sigEmpty, setSigEmpty] = useState(true);
  const [result, setResult] = useState(null);
  const sigRef = useRef(null);
  const holdRef = useRef(null);
  const [holdProgress, setHoldProgress] = useState(0);

  useEffect(() => {
    api
      .get("/settings")
      .then((r) => {
        const pct = Number(r.data?.consignor_split_pct);
        if (!Number.isNaN(pct)) setSplitPct(pct);
      })
      .catch(() => {});
  }, []);

  const key = STEPS[step];
  const clientSteps = STEPS.slice(0, 5);
  const progress =
    key === "handoff" || key === "thanks"
      ? 1
      : Math.min(1, (step + 1) / clientSteps.length);

  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const canContinue = () => {
    if (key === "name") return fullName.trim().length > 1;
    if (key === "phone") return phone.replace(/\D/g, "").length >= 7;
    if (key === "email") {
      const e = email.trim();
      return e.includes("@") && e.includes(".") && e.length > 5;
    }
    if (key === "agreement") {
      return !sigEmpty && (signedName.trim() || fullName.trim());
    }
    return true;
  };

  const submitSign = async () => {
    if (sigRef.current?.isEmpty()) {
      toast.error("Add your signature to continue");
      return;
    }
    setBusy(true);
    try {
      const name = fullName.trim();
      const { data: consignor } = await api.post("/consignors", {
        full_name: name,
        phone: phone.trim(),
        email: email.trim(),
        date_of_drop_off: new Date().toISOString().slice(0, 10),
        notes: "Signed via iPad drop-off",
      });
      const cid = consignor.consignor_id;
      const agreementText = buildAgreementText({
        consignorName: name,
        consignorId: cid,
        consignorSplitPct: splitPct,
      });
      const sigData = sigRef.current.toDataURL();
      await api.post(`/consignors/${cid}/agreement`, {
        signature_data_url: sigData,
        agreement_text: agreementText,
        signed_name: (signedName || name).trim(),
      });
      const { data: drop } = await api.post("/drop-offs", {
        consignor_id: cid,
      });
      setResult({
        consignor_id: cid,
        drop_off_id: drop.id,
        full_name: name,
      });
      setStep(STEPS.indexOf("thanks"));
      setTimeout(() => setStep(STEPS.indexOf("handoff")), 1600);
    } catch (e) {
      toast.error(formatApiError(e, "Could not complete drop-off"));
    } finally {
      setBusy(false);
    }
  };

  const startHoldExit = () => {
    const started = Date.now();
    holdRef.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - started) / 1200);
      setHoldProgress(p);
      if (p >= 1) {
        clearInterval(holdRef.current);
        holdRef.current = null;
        setHoldProgress(0);
        nav("/");
      }
    }, 40);
  };
  const endHoldExit = () => {
    if (holdRef.current) clearInterval(holdRef.current);
    holdRef.current = null;
    setHoldProgress(0);
  };

  const firstName = fullName.trim().split(/\s+/)[0] || "";

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col"
      data-testid="drop-off-client"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 0%, #f5e8f2 0%, #f0f0f0 45%, #ebebeb 100%)",
      }}
    >
      <Toaster position="top-right" />
      {key !== "handoff" && (
        <div className="h-1 bg-neutral-200/70 shrink-0">
          <motion.div
            className="h-full bg-[var(--ee-magenta)]"
            initial={false}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.35, ease }}
          />
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col p-3 sm:p-5 md:p-6">
        <div className="flex-1 min-h-0 flex flex-col max-w-2xl mx-auto w-full rounded-[16px] bg-[var(--ee-panel)] border border-[var(--ee-sidebar-border)] shadow-[0_8px_30px_rgba(139,31,107,0.06)] overflow-hidden">
          {key !== "handoff" && (
            <div className="px-5 sm:px-7 pt-5 pb-3 border-b border-[var(--ee-sidebar-border)]/80 shrink-0">
              <div className="text-[10px] tracking-[0.22em] uppercase font-semibold text-[var(--ee-magenta)]">
                {STORE.name}
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 flex flex-col px-5 sm:px-7 py-5 sm:py-6">
            {key !== "welcome" && key !== "thanks" && key !== "handoff" && (
              <button
                type="button"
                onClick={goBack}
                className="self-start inline-flex items-center gap-1 text-[13px] text-neutral-500 mb-3 -ml-1"
              >
                <ChevronLeft size={16} /> Back
              </button>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease }}
                className="flex-1 min-h-0 flex flex-col"
              >
                {key === "welcome" && (
                  <div className="flex-1 flex flex-col justify-center">
                    <h1
                      className="text-3xl sm:text-4xl leading-[1.12] font-semibold tracking-[-0.025em] text-[var(--ee-ink)]"
                      style={{
                        fontFamily: "Montserrat, system-ui, sans-serif",
                      }}
                    >
                      {COPY.welcomeTitle}
                    </h1>
                    <p className="mt-4 text-[16px] text-neutral-500 font-light leading-relaxed max-w-md">
                      {COPY.welcomeHint}
                    </p>
                  </div>
                )}
                {key === "name" && (
                  <FieldStep
                    label={COPY.nameLabel}
                    hint={COPY.nameHint}
                    value={fullName}
                    onChange={setFullName}
                    placeholder={COPY.namePlaceholder}
                    autoFocus
                    testId="dropoff-name"
                  />
                )}
                {key === "phone" && (
                  <FieldStep
                    label={COPY.phoneLabel}
                    hint={COPY.phoneHint}
                    value={phone}
                    onChange={setPhone}
                    placeholder={COPY.phonePlaceholder}
                    inputMode="tel"
                    autoFocus
                    testId="dropoff-phone"
                  />
                )}
                {key === "email" && (
                  <FieldStep
                    label={COPY.emailLabel}
                    hint={COPY.emailHint}
                    value={email}
                    onChange={setEmail}
                    placeholder={COPY.emailPlaceholder}
                    inputMode="email"
                    autoFocus
                    testId="dropoff-email"
                  />
                )}
                {key === "agreement" && (
                  <AgreementSignStep
                    name={fullName}
                    splitPct={splitPct}
                    signedName={signedName}
                    setSignedName={setSignedName}
                    sigRef={sigRef}
                    onSigChange={setSigEmpty}
                  />
                )}
                {key === "thanks" && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <h1
                      className="text-3xl sm:text-4xl font-semibold tracking-[-0.025em]"
                      style={{
                        fontFamily: "Montserrat, system-ui, sans-serif",
                      }}
                    >
                      {COPY.thanksTitle}
                    </h1>
                    <p className="text-neutral-500 mt-3 text-[15px] font-light max-w-sm">
                      {COPY.thanksHint(firstName)}
                    </p>
                  </div>
                )}
                {key === "handoff" && (
                  <HandoffStep
                    result={result}
                    onAssess={() =>
                      nav(`/drop-off/${result.drop_off_id}/assess`, {
                        replace: true,
                      })
                    }
                    onLater={() => nav("/", { replace: true })}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {key !== "thanks" && key !== "handoff" && (
              <div className="pt-5 shrink-0">
                {key === "welcome" ? (
                  <button
                    type="button"
                    data-testid="dropoff-start"
                    onClick={goNext}
                    className="w-full py-3.5 rounded-[10px] bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white text-[15px] font-medium shadow-[0_6px_16px_rgba(139,31,107,0.22)]"
                  >
                    {COPY.welcomeCta}
                  </button>
                ) : key === "agreement" ? (
                  <button
                    type="button"
                    data-testid="dropoff-submit"
                    disabled={!canContinue() || busy}
                    onClick={submitSign}
                    className="w-full py-3.5 rounded-[10px] bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white text-[15px] font-medium disabled:opacity-40 shadow-[0_6px_16px_rgba(139,31,107,0.22)]"
                  >
                    {busy ? "Saving…" : COPY.agreementCta}
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="dropoff-next"
                    disabled={!canContinue()}
                    onClick={goNext}
                    className="w-full py-3.5 rounded-[10px] bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white text-[15px] font-medium disabled:opacity-40 shadow-[0_6px_16px_rgba(139,31,107,0.22)]"
                  >
                    {COPY.nextCta}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {key !== "handoff" && key !== "thanks" && (
          <button
            type="button"
            onMouseDown={startHoldExit}
            onMouseUp={endHoldExit}
            onMouseLeave={endHoldExit}
            onTouchStart={startHoldExit}
            onTouchEnd={endHoldExit}
            className="mt-3 self-center text-[11px] text-neutral-400 tracking-wide relative px-3 py-2"
            aria-label="Hold to exit to staff view"
          >
            Hold for staff exit
            {holdProgress > 0 && (
              <span
                className="absolute left-0 bottom-0 h-0.5 bg-[var(--ee-magenta)] transition-none"
                style={{ width: `${holdProgress * 100}%` }}
              />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function FieldStep({
  label,
  hint,
  value,
  onChange,
  placeholder,
  inputMode,
  autoFocus,
  testId,
}) {
  return (
    <div className="flex-1 flex flex-col justify-center">
      <h1
        className="text-2xl sm:text-3xl leading-snug font-semibold tracking-[-0.02em] text-[var(--ee-ink)]"
        style={{ fontFamily: "Montserrat, system-ui, sans-serif" }}
      >
        {label}
      </h1>
      {hint ? (
        <p className="mt-2 text-[14px] text-neutral-500 font-light">{hint}</p>
      ) : null}
      <input
        data-testid={testId}
        autoFocus={autoFocus}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-7 w-full rounded-[12px] bg-[var(--ee-magenta-soft)]/50 border border-[var(--ee-magenta)]/15 focus:border-[var(--ee-magenta)]/40 outline-none text-xl sm:text-2xl px-4 py-3.5 text-[var(--ee-ink)] placeholder:text-neutral-400"
      />
    </div>
  );
}

function AgreementSignStep({
  name,
  splitPct,
  signedName,
  setSignedName,
  sigRef,
  onSigChange,
}) {
  const text = buildAgreementText({
    consignorName: name,
    consignorSplitPct: splitPct,
  });
  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1">
      <h1
        className="text-2xl sm:text-3xl font-semibold tracking-[-0.02em]"
        style={{ fontFamily: "Montserrat, system-ui, sans-serif" }}
      >
        {COPY.agreementTitle}
      </h1>
      <p className="mt-2 text-[14px] text-neutral-500 font-light">
        {COPY.agreementHint}
      </p>

      <div className="mt-5 rounded-[12px] border border-[var(--ee-sidebar-border)] bg-white p-5 sm:p-6 text-[14px] sm:text-[15px] leading-[1.65] text-neutral-700 whitespace-pre-wrap font-light">
        {text}
      </div>

      <div className="mt-5 mb-1 rounded-[12px] bg-[var(--ee-magenta-soft)]/40 border border-[var(--ee-magenta)]/10 p-3 sm:p-4">
        <div className="text-[10px] tracking-[0.18em] uppercase font-semibold text-[var(--ee-magenta)] mb-2">
          Your signature
        </div>
        <input
          data-testid="dropoff-signed-name"
          value={signedName}
          onChange={(e) => setSignedName(e.target.value)}
          placeholder={name || "Printed name"}
          className="w-full rounded-[8px] border border-white/80 px-3 py-2.5 text-[15px] bg-white/90"
        />
        <div className="mt-2 h-[110px] sm:h-[120px] rounded-[8px] overflow-hidden bg-white/90">
          <SignaturePad
            ref={sigRef}
            height={120}
            onChange={(empty) => onSigChange(empty)}
            className="h-full"
          />
        </div>
        <button
          type="button"
          onClick={() => sigRef.current?.clear()}
          className="mt-2 self-start inline-flex items-center gap-1.5 text-[12px] text-neutral-500"
        >
          <Eraser size={13} /> Clear
        </button>
      </div>
    </div>
  );
}

function HandoffStep({ result, onAssess, onLater }) {
  return (
    <div className="flex-1 flex flex-col justify-center px-1">
      <div className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[var(--ee-magenta)]">
        Staff · rotate iPad back
      </div>
      <h1
        className="text-3xl mt-2 font-semibold tracking-[-0.02em]"
        style={{ fontFamily: "Montserrat, system-ui, sans-serif" }}
      >
        Signed
      </h1>
      <p className="mt-3 text-[15px] text-neutral-500 font-light leading-relaxed">
        <span className="text-[var(--ee-ink)] font-medium">
          {result?.full_name}
        </span>{" "}
        ({result?.consignor_id}) is ready. Assess pieces now, or leave them in
        Needs attention for later.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          data-testid="dropoff-assess-now"
          onClick={onAssess}
          className="flex-1 py-3.5 rounded-[10px] bg-[var(--ee-magenta)] hover:bg-[#6f1655] text-white text-[15px] font-medium shadow-[0_6px_16px_rgba(139,31,107,0.22)]"
        >
          Assess now
        </button>
        <button
          type="button"
          data-testid="dropoff-assess-later"
          onClick={onLater}
          className="flex-1 py-3.5 rounded-[10px] border border-[var(--ee-sidebar-border)] text-[15px] text-neutral-700 bg-white/60"
        >
          Assess later
        </button>
      </div>
    </div>
  );
}
