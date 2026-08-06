import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useShell } from "@/context/ShellContext";
import { useTour } from "@/context/TourContext";
import { api } from "@/lib/api";
import { needsOnboarding, needsProductTour, roleOf } from "@/lib/auth";

const TIP_W = 300;
const TIP_GAP = 12;
const ARROW = 10; // half of rotated square caret

function stepsForRole(role) {
  const base = [
    {
      id: "home",
      path: "/",
      target: '[data-testid="nav-home"]',
      title: "Home",
      body: "Your daily snapshot — sales pulse, what’s active, and what needs attention.",
      pointer: "left",
    },
    {
      id: "new-drop-off",
      path: "/",
      target: '[data-testid="quick-new-intake"]',
      title: "New Drop Off",
      body: "Start a drop-off here — choose an existing consignor or create one, then add pieces.",
      pointer: "top",
    },
    {
      id: "add-consignor",
      path: "/",
      target: '[data-testid="quick-add-consignor"]',
      title: "Add Consignor",
      body: "Use this when someone is new to the boutique — it opens drop-off with a fresh consignor profile.",
      pointer: "top",
    },
    {
      id: "consignors",
      path: "/consignors",
      target: '[data-testid="nav-consignors"]',
      title: "Consignors",
      body: "Your consignor list lives here. Open anyone for balances, contact, and past drop-offs.",
      pointer: "left",
    },
    {
      id: "inventory",
      path: "/inventory",
      target: '[data-testid="nav-inventory"]',
      title: "Inventory",
      body: "Everything on the floor — status, racks, and what’s ready to sell.",
      pointer: "left",
    },
    {
      id: "scan-item",
      path: "/inventory",
      target: '[data-testid="inventory-scan-item-btn"]',
      title: "Scan item",
      body: "Photograph a piece and tag to draft inventory quickly — review, then save.",
      pointer: "top",
    },
    {
      id: "import-csv",
      path: "/inventory",
      target: '[data-testid="import-inventory-btn"]',
      title: "Import CSV",
      body: "Bulk-add pieces from a spreadsheet when you’re bringing in a larger batch.",
      pointer: "top",
    },
    {
      id: "sales",
      path: "/sales",
      target: '[data-testid="nav-sales"]',
      title: "Sales",
      body: "Log sales (or sync Square). Store and consignor cuts follow each item’s split.",
      pointer: "left",
    },
  ];

  if (role === "manager" || role === "admin") {
    base.push(
      {
        id: "payouts",
        path: "/payouts",
        target: '[data-testid="nav-payouts"]',
        title: "Payouts",
        body: "See what’s owed and record when a consignor is paid.",
        pointer: "left",
      },
      {
        id: "analytics",
        path: "/analytics",
        target: '[data-testid="nav-analytics"]',
        title: "Analytics",
        body: "Performance for the shop — revenue, sell-through, and trends.",
        pointer: "left",
      }
    );
  }

  return base;
}

function measure(selector) {
  const nodes = Array.from(document.querySelectorAll(selector));
  const el =
    nodes.find((n) => {
      const r = n.getBoundingClientRect();
      return r.width > 2 && r.height > 2 && r.top >= 0;
    }) || nodes[0];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 && r.height < 2) return null;
  return {
    top: r.top,
    left: r.left,
    width: r.width,
    height: r.height,
    right: r.right,
    bottom: r.bottom,
    cx: r.left + r.width / 2,
    cy: r.top + r.height / 2,
  };
}

function placeTip(rect, preferred, vw, vh) {
  const tipW = Math.min(TIP_W, vw - 40);
  const tipH = 150;

  if (!rect) {
    return {
      top: Math.max(80, vh * 0.28),
      left: Math.max(16, (vw - tipW) / 2),
      side: preferred,
      arrow: tipW / 2,
    };
  }

  if (preferred === "top") {
    let left = rect.cx - tipW / 2;
    left = Math.max(16, Math.min(left, vw - tipW - 16));
    let top = rect.bottom + TIP_GAP;
    let side = "top";
    if (top + tipH > vh - 16 && rect.top > tipH + TIP_GAP + 16) {
      top = rect.top - tipH - TIP_GAP;
      side = "bottom";
    }
    const arrow = Math.max(ARROW + 8, Math.min(rect.cx - left, tipW - ARROW - 8));
    return { top, left, side, arrow };
  }

  // Preferred: tip to the right of target, caret on left edge at target center
  let left = rect.right + TIP_GAP;
  let side = "left";
  if (left + tipW > vw - 16) {
    left = Math.max(16, Math.min(rect.cx - tipW / 2, vw - tipW - 16));
    const top = rect.bottom + TIP_GAP;
    const arrow = Math.max(ARROW + 8, Math.min(rect.cx - left, tipW - ARROW - 8));
    return { top, left, side: "top", arrow };
  }

  // Prefer caret ~22px into the tip; clamp tip, then re-aim caret at cy
  const preferArrow = 22;
  let top = rect.cy - preferArrow;
  top = Math.max(16, Math.min(top, vh - tipH - 16));
  const arrow = Math.max(ARROW + 8, Math.min(rect.cy - top, tipH - ARROW - 8));
  return { top, left, side, arrow };
}

function Pointer({ side, offset }) {
  const common =
    "absolute w-2.5 h-2.5 bg-[var(--ee-panel)] rotate-45 shadow-[0_0_0_1px_rgba(0,0,0,0.04)]";
  if (side === "left") {
    return (
      <span
        className={`${common} -left-[5px]`}
        style={{ top: offset - ARROW / 2 }}
        aria-hidden
      />
    );
  }
  if (side === "top") {
    return (
      <span
        className={`${common} -top-[5px]`}
        style={{ left: offset - ARROW / 2 }}
        aria-hidden
      />
    );
  }
  if (side === "bottom") {
    return (
      <span
        className={`${common} -bottom-[5px]`}
        style={{ left: offset - ARROW / 2 }}
        aria-hidden
      />
    );
  }
  return null;
}

export default function ProductTour() {
  const { user, refresh } = useAuth();
  const { setSidebarOpen } = useShell();
  const { tourOpen, tourRole, startTour, stopTour } = useTour();
  const nav = useNavigate();
  const location = useLocation();

  const role = tourRole || roleOf(user);
  const steps = useMemo(() => stepsForRole(role), [role]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [vw, setVw] = useState(() => window.innerWidth);
  const [vh, setVh] = useState(() => window.innerHeight);

  useEffect(() => {
    if (
      user &&
      !needsOnboarding(user) &&
      needsProductTour(user) &&
      !location.pathname.startsWith("/onboarding") &&
      !tourOpen
    ) {
      startTour(roleOf(user));
    }
  }, [user, location.pathname, tourOpen, startTour]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("guide") === "1" && user && !needsOnboarding(user)) {
      startTour(roleOf(user));
      params.delete("guide");
      const next = params.toString();
      nav(`${location.pathname}${next ? `?${next}` : ""}`, { replace: true });
    }
  }, [location.search, location.pathname, user, startTour, nav]);

  useEffect(() => {
    if (tourOpen) {
      setSidebarOpen?.(true);
      setIndex(0);
    }
  }, [tourOpen, setSidebarOpen]);

  const step = steps[index];
  const active = tourOpen && !!step;

  useEffect(() => {
    if (!active || !step) return;
    if (location.pathname !== step.path) {
      nav(step.path);
    }
  }, [active, step, location.pathname, nav]);

  useLayoutEffect(() => {
    if (!active || !step) return;
    let tries = 0;
    let raf = 0;
    const tick = () => {
      const next = measure(step.target);
      if (next) {
        setRect(next);
        return;
      }
      tries += 1;
      if (tries < 48) raf = requestAnimationFrame(tick);
      else setRect(null);
    };
    tick();
    const t = setTimeout(tick, 80);
    const onResize = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
      setRect(measure(step.target));
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [active, step, location.pathname, location.key]);

  const finish = async (markComplete) => {
    stopTour();
    if (markComplete && user && needsProductTour(user)) {
      try {
        await api.post("/auth/tour/complete");
        await refresh();
      } catch {
        /* ignore */
      }
    }
  };

  const next = () => {
    if (index >= steps.length - 1) finish(true);
    else setIndex((i) => i + 1);
  };

  const back = () => setIndex((i) => Math.max(0, i - 1));

  if (!active) return null;

  const tip = placeTip(rect, step.pointer || "left", vw, vh);

  return createPortal(
    <div className="fixed inset-0 z-[80]" data-testid="product-tour">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-[0.5px]"
        onClick={() => finish(true)}
        aria-hidden
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          className="absolute w-[min(300px,calc(100vw-40px))] pointer-events-auto"
          style={{ top: tip.top, left: tip.left }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          <div className="relative bg-[var(--ee-panel)] px-4 py-3.5 rounded-[8px] shadow-sm">
            <Pointer side={tip.side} offset={tip.arrow} />
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-[15px] font-medium text-[var(--ee-ink)]">
                {step.title}
              </div>
              <div className="text-[11px] tabular-nums text-neutral-400 shrink-0">
                {index + 1} / {steps.length}
              </div>
            </div>
            <p className="text-[13px] text-neutral-500 font-light mt-1.5 leading-snug">
              {step.body}
            </p>
            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                onClick={() => finish(true)}
                className="text-[12px] text-neutral-400 hover:text-neutral-600"
              >
                Skip
              </button>
              <div className="flex-1" />
              {index > 0 && (
                <button
                  type="button"
                  onClick={back}
                  className="text-[12px] text-neutral-500 hover:text-neutral-800"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                data-testid="tour-next"
                onClick={next}
                className="text-[12px] font-medium text-[var(--ee-magenta)] hover:text-[#6f1655]"
              >
                {index >= steps.length - 1 ? "Done" : "Next"}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body
  );
}
