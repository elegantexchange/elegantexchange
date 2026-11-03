/** 2″ × 2″ back label rendered as an exact-size image for the Munbyn RW403B.
 *
 * Why an image: printing the web page from Safari sends a full page, which the
 * Munbyn app shrinks onto the label (tiny, blurry, rotated, spread over several
 * labels). A 406×406 PNG is the label at the printer's own 203 dpi, so the app
 * prints it 1:1 — one image, one label.
 *
 * Thermal heads only print solid black dots, so text is bold sans-serif and the
 * finished image is snapped to pure black/white. Barcode bars are whole dots wide.
 */
import { code128Layout } from "@/lib/code128";

export const LABEL_DPI = 203;
export const LABEL_IN = 2;
export const LABEL_PX = Math.round(LABEL_DPI * LABEL_IN); // 406

const PAD = 26; // ~0.13in safe margin on every side
const FONT = '"Montserrat", "Helvetica Neue", Arial, sans-serif';

/** Default printer alignment. The RW403B lands the image slightly left of the
 * label; 24 dots over-corrected (printed right), 0 printed left, so the default
 * sits between. Staff can fine-tune per device on the tag page (saved locally).
 * 203 dots = 1 inch. Positive = move right / down. */
export const NUDGE_X = 12;
export const NUDGE_Y = 0;

/** Type sizes in printer dots (203 per inch). */
const KICKER_PX = 13;
const SIZE_PX = 28;
const PRODUCT_PX = 24;
const PRICE_PX = 34;
const ID_PX = 17;
const BAR_HEIGHT = 128;
/** Weight for the size, product and price values (Montserrat 600 = SemiBold). */
const VALUE_WEIGHT = 600;
/** Weight for the small SIZE / PRODUCT / PRICE labels. */
const KICKER_WEIGHT = 700;
/** Divider thickness in printer dots (3 ≈ 0.015″) — 2 printed faint. */
const RULE_PX = 3;

/** Make sure Montserrat is ready before drawing so the canvas doesn't fall back mid-batch. */
export async function ensureLabelFonts() {
  if (!document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load(`700 34px ${FONT}`),
      document.fonts.load(`${VALUE_WEIGHT} 34px ${FONT}`),
      document.fonts.load(`600 15px ${FONT}`),
      document.fonts.load(`${KICKER_WEIGHT} 13px ${FONT}`),
    ]);
  } catch {
    /* fall back to system sans */
  }
}

function spacedText(ctx, text, x, y, spacing, align = "left") {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + spacing;
  });
  ctx.textAlign = prev;
  return total;
}

function fitFont(ctx, text, weight, maxPx, minPx, maxWidth) {
  let px = maxPx;
  ctx.font = `${weight} ${px}px ${FONT}`;
  while (px > minPx && ctx.measureText(text).width > maxWidth) {
    px -= 1;
    ctx.font = `${weight} ${px}px ${FONT}`;
  }
  if (ctx.measureText(text).width > maxWidth) {
    let t = text;
    while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
    return `${t}…`;
  }
  return text;
}

/** Kicker on the left edge, value right-aligned to the right edge. */
function row(ctx, kicker, value, centerY, valuePx, left, right) {
  ctx.textBaseline = "middle";
  ctx.font = `${KICKER_WEIGHT} ${KICKER_PX}px ${FONT}`;
  const kw = spacedText(ctx, kicker.toUpperCase(), left, centerY, 2);
  const maxW = right - left - kw - 12;
  const shown = fitFont(ctx, value, VALUE_WEIGHT, valuePx, 16, maxW);
  ctx.textAlign = "right";
  ctx.fillText(shown, right, centerY + 1);
  ctx.textAlign = "left";
}

function rule(ctx, y, left, right) {
  ctx.fillRect(left, Math.round(y - RULE_PX / 2), right - left, RULE_PX);
}

/** Where the barcode sits: bars at a whole number of printer dots per module
 * so every bar is crisp, centred on the label. `barLeft`/`barRight` are the
 * outer edges of the printed bars (quiet zones excluded) — the rows above use
 * the same edges so the whole block lines up. */
function barcodeGeometry(text) {
  let layout;
  try {
    layout = code128Layout(text, { maxWidthIn: 10, barHeightIn: 0.5 });
  } catch {
    return null;
  }
  // `modules` already includes the 10-module quiet zone on each side, which is
  // blank, so it may run into the margin.
  const avail = LABEL_PX - 16;
  const dot = Math.max(1, Math.min(3, Math.floor(avail / layout.modules)));
  const left = Math.round((LABEL_PX - layout.modules * dot) / 2);
  const xs = layout.rects.map((b) => b.x);
  const ends = layout.rects.map((b) => b.x + b.w);
  return {
    layout,
    dot,
    left,
    barLeft: left + Math.min(...xs) * dot,
    barRight: left + Math.max(...ends) * dot,
  };
}

function drawBarcode(ctx, geo, top, height) {
  if (!geo) return;
  geo.layout.rects.forEach((bar) => {
    ctx.fillRect(geo.left + bar.x * geo.dot, top, bar.w * geo.dot, height);
  });
}

/** Snap anti-aliased greys to pure black/white — thermal prints dots, not greys. */
function threshold(ctx) {
  const img = ctx.getImageData(0, 0, LABEL_PX, LABEL_PX);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114 < 150 ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/** `nudge: false` draws the label perfectly centred (for on-screen preview and
 * letter sheets); the Munbyn images are shifted by `nudgeX` to offset the printer. */
export function drawBackLabel(
  canvas,
  { size, product, price, itemId },
  { nudge = true, nudgeX = NUDGE_X, nudgeY = NUDGE_Y } = {}
) {
  canvas.width = LABEL_PX;
  canvas.height = LABEL_PX;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, LABEL_PX, LABEL_PX);
  ctx.fillStyle = "#000";
  ctx.save();
  if (nudge) ctx.translate(nudgeX, nudgeY);

  // Stack, top to bottom (offsets from the first row's centre line):
  // three rows 50 dots apart with a rule between each, then the barcode and SKU.
  const ROW_GAP = 50;
  const barGap = 30; // price row centre → top of bars
  const idGap = 10; // bottom of bars → SKU
  const top = -SIZE_PX / 2; // first row's text starts half a line above its centre
  const bottom = ROW_GAP * 2 + barGap + BAR_HEIGHT + idGap + ID_PX;
  // Centre the whole stack vertically on the label.
  const y0 = Math.round((LABEL_PX - (bottom - top)) / 2 - top);

  // Rows span exactly the width of the barcode bars.
  const geo = barcodeGeometry(itemId);
  const L = geo ? geo.barLeft : PAD;
  const R = geo ? geo.barRight : LABEL_PX - PAD;

  row(ctx, "Size", size, y0, SIZE_PX, L, R);
  rule(ctx, y0 + ROW_GAP / 2, L, R);
  row(ctx, "Product", product, y0 + ROW_GAP, PRODUCT_PX, L, R);
  rule(ctx, y0 + ROW_GAP * 1.5, L, R);
  row(ctx, "Price", price, y0 + ROW_GAP * 2, PRICE_PX, L, R);

  const barTop = y0 + ROW_GAP * 2 + barGap;
  drawBarcode(ctx, geo, barTop, BAR_HEIGHT);

  ctx.textBaseline = "top";
  ctx.font = `700 ${ID_PX}px ${FONT}`;
  spacedText(ctx, String(itemId), LABEL_PX / 2, barTop + BAR_HEIGHT + idGap, 2.5, "center");
  ctx.restore();

  threshold(ctx);
  return canvas;
}

export function backLabelBlob(fields, options) {
  const canvas = drawBackLabel(document.createElement("canvas"), fields, options);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png")
  );
}

/** Hand the label images to the iPad share sheet (pick the Munbyn app). Falls back to downloads. */
export async function shareLabelFiles(files) {
  if (navigator.canShare && navigator.canShare({ files })) {
    await navigator.share({ files });
    return "shared";
  }
  files.forEach((f) => {
    const url = URL.createObjectURL(f);
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });
  return "downloaded";
}
