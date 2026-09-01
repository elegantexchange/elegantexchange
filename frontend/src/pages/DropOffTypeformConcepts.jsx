import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Eraser } from "lucide-react";
import { LOGO_URL, STORE } from "@/lib/brand";

const ease = [0.22, 1, 0.36, 1];

const VARIATIONS = [
  {
    id: "ink",
    name: "Ink line",
    blurb:
      "Welcome-splash DNA — logo, magenta ink draw, underline fields. Soft canvas, one quiet composition.",
  },
  {
    id: "ruled",
    name: "Ruled floor",
    blurb:
      "Sidebar ledger language — hairline rules, step index, left-aligned questions. Boutique ops precision.",
  },
  {
    id: "atelier",
    name: "Atelier panel",
    blurb:
      "Floating salon panel on soft field — brand lockup, generous type, signature nested under agreement.",
  },
];

const PREVIEW_STEPS = ["welcome", "name", "agreement"];

const DEMO = {
  name: "Maya Chen",
  agreement:
    "CONSIGNMENT AGREEMENT\n\nBetween The Elegant Exchange and Maya Chen.\n\n1. CONSIGNMENT PERIOD. Items remain for sale for sixty (60) days…\n\n2. COMMISSION SPLIT. Consignor receives 50% of the sale price.\n\n3. PRICING. Final pricing is agreed at intake.",
};

export default function DropOffTypeformConcepts() {
  const [active, setActive] = useState("ink");
  const [step, setStep] = useState("welcome");
  const variation = VARIATIONS.find((v) => v.id === active) || VARIATIONS[0];

  return (
    <div className="min-h-screen bg-[var(--ee-bg)] text-[var(--ee-ink)]">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
        <div className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[var(--ee-magenta)]">
          Concepts · client drop-off
        </div>
        <h1 className="ee-page-title text-3xl sm:text-4xl mt-2">
          Typeform variations
        </h1>
        <p className="mt-3 text-[15px] text-neutral-500 font-light max-w-xl leading-relaxed">
          Three systems in the Elegant Exchange register — magenta, ruled
          craft, ink line, soft panels. Pick one to carry into{" "}
          <code className="text-[13px] text-neutral-600">/drop-off</code>.
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          {VARIATIONS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setActive(v.id);
                setStep("welcome");
              }}
              className={`px-4 py-2.5 rounded-[8px] text-[12px] font-semibold tracking-[0.06em] uppercase transition-colors ${
                active === v.id
                  ? "bg-[var(--ee-magenta)] text-white"
                  : "bg-[var(--ee-panel)] border border-[var(--ee-sidebar-border)] text-neutral-600 hover:border-neutral-300"
              }`}
            >
              {v.name}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[14px] text-neutral-500 font-light max-w-lg">
          {variation.blurb}
        </p>

        <div className="mt-6 flex flex-wrap gap-2 items-center">
          <span className="text-[10px] tracking-[0.16em] uppercase font-semibold text-neutral-400">
            Preview step
          </span>
          {PREVIEW_STEPS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(s)}
              className={`px-3 py-1.5 rounded-md text-[12px] capitalize ${
                step === s
                  ? "bg-[var(--ee-sidebar-active)] font-medium"
                  : "text-neutral-500 hover:bg-black/[0.03]"
              }`}
            >
              {s === "agreement" ? "Agreement + sign" : s}
            </button>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <IpadFrame>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${active}-${step}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease }}
                className="h-full"
              >
                {active === "ink" && <InkLinePreview step={step} />}
                {active === "ruled" && <RuledFloorPreview step={step} />}
                {active === "atelier" && <AtelierPanelPreview step={step} />}
              </motion.div>
            </AnimatePresence>
          </IpadFrame>
        </div>

        <p className="mt-8 text-center text-[13px] text-neutral-400 font-light">
          Tell me which one (Ink / Ruled / Atelier) and I’ll apply it to the live
          flow.
        </p>
      </div>
    </div>
  );
}

function IpadFrame({ children }) {
  return (
    <div className="w-full max-w-[420px] aspect-[3/4] rounded-[28px] border-[10px] border-neutral-800 bg-neutral-800 shadow-[0_24px_60px_rgba(0,0,0,0.18)] overflow-hidden">
      <div className="h-full rounded-[18px] overflow-hidden bg-[var(--ee-bg)]">
        {children}
      </div>
    </div>
  );
}

function ProgressBar({ value }) {
  return (
    <div className="h-1 bg-neutral-200/80">
      <motion.div
        className="h-full bg-[var(--ee-magenta)]"
        initial={false}
        animate={{ width: `${value * 100}%` }}
        transition={{ duration: 0.35, ease }}
      />
    </div>
  );
}

/** A — Ink line: splash + underline Typeform */
function InkLinePreview({ step }) {
  const progress = step === "welcome" ? 0.2 : step === "name" ? 0.45 : 0.85;
  return (
    <div className="h-full flex flex-col bg-[var(--ee-panel)]">
      <ProgressBar value={progress} />
      <div className="flex-1 min-h-0 flex flex-col px-7 py-8">
        {step !== "welcome" && (
          <div className="text-[12px] text-neutral-400 inline-flex items-center gap-0.5 mb-5 -ml-1">
            <ChevronLeft size={14} /> Back
          </div>
        )}
        {step === "welcome" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <img
              src={LOGO_URL}
              alt=""
              className="w-40 h-[56px] object-cover object-center mb-5"
            />
            <div className="w-36 h-px bg-neutral-200 relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-full bg-[var(--ee-magenta)]" />
            </div>
            <h2 className="ee-page-title text-[1.75rem] mt-8 leading-tight">
              Thank you for being here
            </h2>
            <p className="mt-3 text-[14px] text-neutral-500 font-light max-w-[16rem]">
              Just a few details, then your agreement
            </p>
          </div>
        )}
        {step === "name" && (
          <div className="flex-1 flex flex-col justify-center">
            <h2 className="ee-page-title text-[1.6rem] leading-snug">
              What&apos;s your name?
            </h2>
            <p className="mt-2 text-[13px] text-neutral-500 font-light">
              As you&apos;d like it on the agreement
            </p>
            <div className="mt-8 border-b-2 border-[var(--ee-magenta)] pb-3 text-[1.65rem] text-[var(--ee-ink)]">
              {DEMO.name}
            </div>
          </div>
        )}
        {step === "agreement" && (
          <InkAgreement />
        )}
        <div className="pt-5 shrink-0">
          <div className="w-full py-3.5 rounded-[10px] bg-[var(--ee-magenta)] text-white text-center text-[14px] font-medium">
            {step === "welcome"
              ? "Get started"
              : step === "agreement"
                ? "Sign & finish"
                : "Continue"}
          </div>
        </div>
      </div>
    </div>
  );
}

function InkAgreement() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <h2 className="ee-page-title text-[1.5rem]">Agreement</h2>
      <p className="mt-1.5 text-[13px] text-neutral-500 font-light">
        Please read, then sign below
      </p>
      <div className="mt-3 flex-1 min-h-0 overflow-hidden rounded-[10px] border border-[var(--ee-sidebar-border)] bg-white p-3 text-[11px] leading-relaxed text-neutral-600 whitespace-pre-wrap font-light">
        {DEMO.agreement}
      </div>
      <div className="mt-3 shrink-0">
        <div className="text-[9px] tracking-[0.18em] uppercase font-semibold text-neutral-500 mb-1.5">
          Signature
        </div>
        <div className="h-[72px] rounded-[8px] border border-dashed border-neutral-300 bg-white flex items-end px-3 pb-2">
          <span
            className="text-[22px] text-[var(--ee-magenta)]/80 leading-none"
            style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}
          >
            Maya Chen
          </span>
        </div>
      </div>
    </div>
  );
}

/** B — Ruled floor: ledger / sidebar craft */
function RuledFloorPreview({ step }) {
  const idx = step === "welcome" ? 1 : step === "name" ? 2 : 4;
  const total = 4;
  return (
    <div className="h-full flex flex-col bg-[var(--ee-panel)]">
      <div className="px-6 pt-5 pb-3 border-b border-[var(--ee-sidebar-border)]">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-[var(--ee-sidebar-border)]" />
          <div className="text-[9px] tracking-[0.18em] uppercase font-semibold text-neutral-400">
            Drop off
          </div>
          <div className="h-px flex-1 bg-[var(--ee-sidebar-border)]" />
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <div className="text-[10px] tracking-[0.16em] uppercase font-semibold text-[var(--ee-magenta)]">
            Step {String(idx).padStart(2, "0")}
          </div>
          <div className="text-[11px] text-neutral-400 tabular-nums">
            {idx} / {total}
          </div>
        </div>
        <div className="mt-2 h-px bg-neutral-200 relative">
          <div
            className="absolute inset-y-0 left-0 bg-[var(--ee-magenta)]"
            style={{ width: `${(idx / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col px-6 py-6">
        {step !== "welcome" && (
          <div className="text-[12px] text-neutral-400 inline-flex items-center gap-0.5 mb-4 -ml-1">
            <ChevronLeft size={14} /> Back
          </div>
        )}
        {step === "welcome" && (
          <div className="flex-1 flex flex-col justify-center">
            <div className="text-[10px] tracking-[0.2em] uppercase font-semibold text-neutral-400">
              {STORE.name}
            </div>
            <h2
              className="mt-3 text-[1.85rem] leading-[1.15] font-semibold tracking-[-0.02em]"
              style={{ fontFamily: "Montserrat, system-ui, sans-serif" }}
            >
              Thank you for being here
            </h2>
            <div className="mt-5 flex items-center gap-3">
              <div className="h-px w-10 bg-[var(--ee-magenta)]" />
              <p className="text-[13px] text-neutral-500 font-light">
                Just a few details, then your agreement
              </p>
            </div>
          </div>
        )}
        {step === "name" && (
          <div className="flex-1 flex flex-col justify-center">
            <h2
              className="text-[1.55rem] leading-snug font-semibold tracking-[-0.02em]"
              style={{ fontFamily: "Montserrat, system-ui, sans-serif" }}
            >
              What&apos;s your name?
            </h2>
            <p className="mt-2 text-[12px] text-neutral-500 font-light">
              As you&apos;d like it on the agreement
            </p>
            <div className="mt-6 border border-[var(--ee-sidebar-border)] rounded-[8px] pl-3 border-l-[3px] border-l-[var(--ee-magenta)] bg-white">
              <input
                readOnly
                value={DEMO.name}
                className="w-full py-3.5 pr-3 text-[1.25rem] bg-transparent outline-none"
              />
            </div>
          </div>
        )}
        {step === "agreement" && (
          <div className="flex-1 min-h-0 flex flex-col">
            <h2
              className="text-[1.4rem] font-semibold tracking-[-0.02em]"
              style={{ fontFamily: "Montserrat, system-ui, sans-serif" }}
            >
              Agreement
            </h2>
            <p className="mt-1 text-[12px] text-neutral-500 font-light">
              Please read, then sign below
            </p>
            <div className="mt-3 flex-1 min-h-0 overflow-hidden border border-[var(--ee-sidebar-border)] bg-white">
              <div className="px-3 py-2 border-b border-[var(--ee-sidebar-border)] flex items-center gap-2">
                <div className="h-px flex-1 bg-[var(--ee-sidebar-border)]" />
                <span className="text-[8px] tracking-[0.16em] uppercase font-semibold text-neutral-400">
                  Terms
                </span>
                <div className="h-px flex-1 bg-[var(--ee-sidebar-border)]" />
              </div>
              <div className="p-3 text-[11px] leading-relaxed text-neutral-600 whitespace-pre-wrap font-light max-h-[120px] overflow-hidden">
                {DEMO.agreement}
              </div>
            </div>
            <div className="mt-3 border border-[var(--ee-sidebar-border)] bg-white p-2.5">
              <div className="text-[8px] tracking-[0.16em] uppercase font-semibold text-neutral-400 mb-2">
                Signature
              </div>
              <div className="h-[56px] border border-dashed border-neutral-300 flex items-end px-2 pb-1.5">
                <span
                  className="text-[20px] text-[var(--ee-ink)] leading-none"
                  style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}
                >
                  Maya Chen
                </span>
              </div>
              <div className="mt-1.5 text-[10px] text-neutral-400 inline-flex items-center gap-1">
                <Eraser size={11} /> Clear
              </div>
            </div>
          </div>
        )}
        <div className="pt-5 shrink-0">
          <div className="w-full py-3 rounded-[8px] bg-[var(--ee-magenta)] text-white text-center text-[11px] font-semibold tracking-[0.1em] uppercase">
            {step === "welcome"
              ? "Get started"
              : step === "agreement"
                ? "Sign & finish"
                : "Continue"}
          </div>
        </div>
      </div>
    </div>
  );
}

/** C — Atelier panel: floating salon card */
function AtelierPanelPreview({ step }) {
  const progress = step === "welcome" ? 0.2 : step === "name" ? 0.45 : 0.9;
  return (
    <div
      className="h-full flex flex-col relative"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 0%, #f5e8f2 0%, #f0f0f0 45%, #ebebeb 100%)",
      }}
    >
      <div className="absolute top-0 inset-x-0">
        <ProgressBar value={progress} />
      </div>
      <div className="flex-1 min-h-0 flex flex-col p-4 pt-5">
        <div className="flex-1 min-h-0 flex flex-col rounded-[16px] bg-[var(--ee-panel)] border border-[var(--ee-sidebar-border)] shadow-[0_8px_30px_rgba(139,31,107,0.06)] overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-[var(--ee-sidebar-border)]/80">
            <div className="text-[9px] tracking-[0.22em] uppercase font-semibold text-[var(--ee-magenta)]">
              {STORE.name}
            </div>
          </div>
          <div className="flex-1 min-h-0 flex flex-col px-5 py-5">
            {step !== "welcome" && (
              <div className="text-[12px] text-neutral-400 inline-flex items-center gap-0.5 mb-3 -ml-1">
                <ChevronLeft size={14} /> Back
              </div>
            )}
            {step === "welcome" && (
              <div className="flex-1 flex flex-col justify-center">
                <h2
                  className="text-[1.7rem] leading-[1.15] font-semibold tracking-[-0.025em]"
                  style={{ fontFamily: "Montserrat, system-ui, sans-serif" }}
                >
                  Thank you for being here
                </h2>
                <p className="mt-3 text-[14px] text-neutral-500 font-light leading-relaxed">
                  Just a few details, then your agreement
                </p>
              </div>
            )}
            {step === "name" && (
              <div className="flex-1 flex flex-col justify-center">
                <h2
                  className="text-[1.45rem] leading-snug font-semibold tracking-[-0.02em]"
                  style={{ fontFamily: "Montserrat, system-ui, sans-serif" }}
                >
                  What&apos;s your name?
                </h2>
                <p className="mt-2 text-[12px] text-neutral-500 font-light">
                  As you&apos;d like it on the agreement
                </p>
                <div className="mt-6 rounded-[12px] bg-[var(--ee-magenta-soft)]/50 border border-[var(--ee-magenta)]/15 px-4 py-3.5 text-[1.35rem]">
                  {DEMO.name}
                </div>
              </div>
            )}
            {step === "agreement" && (
              <div className="flex-1 min-h-0 flex flex-col">
                <h2
                  className="text-[1.35rem] font-semibold tracking-[-0.02em]"
                  style={{ fontFamily: "Montserrat, system-ui, sans-serif" }}
                >
                  Agreement
                </h2>
                <p className="mt-1 text-[12px] text-neutral-500 font-light">
                  Please read, then sign below
                </p>
                <div className="mt-3 flex-1 min-h-0 overflow-hidden rounded-[12px] bg-white/80 border border-[var(--ee-sidebar-border)] p-3 text-[11px] leading-relaxed text-neutral-600 whitespace-pre-wrap font-light">
                  {DEMO.agreement}
                </div>
                <div className="mt-3 rounded-[12px] bg-[var(--ee-magenta-soft)]/40 border border-[var(--ee-magenta)]/10 p-2.5">
                  <div className="text-[8px] tracking-[0.16em] uppercase font-semibold text-[var(--ee-magenta)] mb-1.5">
                    Signature
                  </div>
                  <div className="h-[56px] rounded-[8px] bg-white/90 border border-white flex items-end px-2.5 pb-1.5">
                    <span
                      className="text-[20px] text-[var(--ee-magenta)] leading-none"
                      style={{
                        fontFamily: "Georgia, serif",
                        fontStyle: "italic",
                      }}
                    >
                      Maya Chen
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div className="pt-4 shrink-0">
              <div className="w-full py-3.5 rounded-[10px] bg-[var(--ee-magenta)] text-white text-center text-[14px] font-medium shadow-[0_6px_16px_rgba(139,31,107,0.25)]">
                {step === "welcome"
                  ? "Get started"
                  : step === "agreement"
                    ? "Sign & finish"
                    : "Continue"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
