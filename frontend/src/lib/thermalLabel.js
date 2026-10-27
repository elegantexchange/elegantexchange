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

const PAD = 22; // ~0.11in safe margin
const FONT = '"Montserrat", "Helvetica Neue", Arial, sans-serif';

/** Make sure Montserrat is ready before drawing so the canvas doesn't fall back mid-batch. */
export async function ensureLabelFonts() {
  if (!document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load(`700 34px ${FONT}`),
      document.fonts.load(`600 15px ${FONT}`),
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

function row(ctx, kicker, value, centerY, valuePx) {
  ctx.textBaseline = "middle";
  ctx.font = `600 15px ${FONT}`;
  const kw = spacedText(ctx, kicker.toUpperCase(), PAD, centerY, 2.5);
  const maxW = LABEL_PX - PAD * 2 - kw - 14;
  const shown = fitFont(ctx, value, 700, valuePx, 18, maxW);
  ctx.textAlign = "right";
  ctx.fillText(shown, LABEL_PX - PAD, centerY + 1);
  ctx.textAlign = "left";
}

function rule(ctx, y) {
  ctx.fillRect(PAD, y, LABEL_PX - PAD * 2, 2);
}

/** Bars at a whole number of printer dots per module so every bar is crisp. */
function drawBarcode(ctx, text, top, height) {
  let layout;
  try {
    layout = code128Layout(text, { maxWidthIn: 10, barHeightIn: 0.5 });
  } catch {
    return;
  }
  // `modules` already includes the 10-module quiet zone on each side, which is
  // blank, so it may run into the margin.
  const avail = LABEL_PX - 16;
  const dot = Math.max(1, Math.min(3, Math.floor(avail / layout.modules)));
  const width = layout.modules * dot;
  const left = Math.round((LABEL_PX - width) / 2);
  layout.rects.forEach((bar) => {
    ctx.fillRect(left + bar.x * dot, top, bar.w * dot, height);
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

export function drawBackLabel(canvas, { size, product, price, itemId }) {
  canvas.width = LABEL_PX;
  canvas.height = LABEL_PX;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, LABEL_PX, LABEL_PX);
  ctx.fillStyle = "#000";

  row(ctx, "Size", size, PAD + 24, 34);
  rule(ctx, PAD + 50);
  row(ctx, "Product", product, PAD + 78, 28);
  rule(ctx, PAD + 104);
  row(ctx, "Price", price, PAD + 134, 40);

  const barTop = PAD + 170;
  const barHeight = 140;
  drawBarcode(ctx, itemId, barTop, barHeight);

  ctx.textBaseline = "top";
  ctx.font = `700 20px ${FONT}`;
  spacedText(ctx, String(itemId), LABEL_PX / 2, barTop + barHeight + 10, 3, "center");

  threshold(ctx);
  return canvas;
}

export function backLabelBlob(fields) {
  const canvas = drawBackLabel(document.createElement("canvas"), fields);
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
