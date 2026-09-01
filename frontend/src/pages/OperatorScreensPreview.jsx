import { useState } from "react";
import OperatorRollCall from "@/components/OperatorRollCall";
import WelcomeSplash from "@/components/WelcomeSplash";

/**
 * Local responsive preview — glass picker + thank-you splash.
 */
export default function OperatorScreensPreview() {
  const [phase, setPhase] = useState("picker");
  const [name, setName] = useState("Youseline");

  return (
    <div className="min-h-screen bg-[var(--ee-bg)] text-[var(--ee-ink)] px-4 sm:px-8 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[var(--ee-magenta)]">
          Local preview
        </div>
        <h1 className="ee-page-title text-3xl mt-2">Presence across screens</h1>
        <p className="mt-2 text-[14px] text-neutral-500 font-light max-w-xl">
          Glass picker (sign-in only), then thank-you splash greets the selected
          name. Sign out to pick someone else — no Switch while logged in.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPhase("picker")}
            className={`px-3 py-2 rounded-[8px] text-[12px] font-semibold uppercase tracking-[0.06em] ${
              phase === "picker"
                ? "bg-[var(--ee-magenta)] text-white"
                : "bg-[var(--ee-panel)] border border-[var(--ee-sidebar-border)]"
            }`}
          >
            Picker
          </button>
          <button
            type="button"
            onClick={() => setPhase("splash")}
            className={`px-3 py-2 rounded-[8px] text-[12px] font-semibold uppercase tracking-[0.06em] ${
              phase === "splash"
                ? "bg-[var(--ee-magenta)] text-white"
                : "bg-[var(--ee-panel)] border border-[var(--ee-sidebar-border)]"
            }`}
          >
            Thank-you splash
          </button>
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start justify-items-center">
          <Frame label="Mobile · 390×844" width={390} height={700}>
            {phase === "picker" ? (
              <div className="relative h-full overflow-hidden">
                <OperatorRollCall
                  embedded
                  onSelect={(p) => {
                    setName(p.name);
                    setPhase("splash");
                  }}
                />
              </div>
            ) : (
              <WelcomeSplash
                user={{ name }}
                authLoading={false}
                onDone={() => setPhase("picker")}
              />
            )}
          </Frame>
          <Frame label="Desktop · 1280 panel" width={720} height={700} wide>
            {phase === "picker" ? (
              <div className="relative h-full overflow-hidden">
                <OperatorRollCall
                  embedded
                  onSelect={(p) => {
                    setName(p.name);
                    setPhase("splash");
                  }}
                />
              </div>
            ) : (
              <WelcomeSplash
                user={{ name }}
                authLoading={false}
                onDone={() => setPhase("picker")}
              />
            )}
          </Frame>
        </div>
      </div>
    </div>
  );
}

function Frame({ label, width, height, wide, children }) {
  return (
    <div className="w-full flex flex-col items-center">
      <div className="text-[10px] tracking-[0.14em] uppercase font-semibold text-neutral-400 mb-3">
        {label}
      </div>
      <div
        className={`relative overflow-hidden bg-neutral-900 shadow-[0_24px_60px_rgba(0,0,0,0.18)] ${
          wide ? "rounded-[16px] border-[8px] border-neutral-800 w-full max-w-[720px]" : "rounded-[28px] border-[10px] border-neutral-800"
        }`}
        style={{
          width: wide ? undefined : width,
          maxWidth: "100%",
          height,
        }}
      >
        <div className="absolute inset-0 bg-[var(--ee-bg)] overflow-hidden [&>*]:!absolute [&>*]:!inset-0">
          {children}
        </div>
      </div>
    </div>
  );
}
