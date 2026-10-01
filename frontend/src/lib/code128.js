/** Code 128 for inventory item ids (the SKU), e.g. "2041-03".
 * frontend/public/code128.js is a copy of this file for the static Kenco preview.
 *
 * That string is the key inventory lookup already uses
 * (`inventory.item_id` / GET /inventory/{item_id}).
 * Quiet zone is 10 modules. Module width is capped at 10 mil and
 * shrinks so the symbol, quiet zone included, stays inside maxWidthIn.
 */

const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

const START_B = 104;
const START_C = 105;
const CODE_B = 100;
const CODE_C = 99;
const STOP = 106;
const QUIET_MODULES = 10;
const PREFERRED_MODULE_IN = 0.01;

function digitsAhead(text, index) {
  let n = 0;
  while (index + n < text.length && text[index + n] >= "0" && text[index + n] <= "9") n += 1;
  return n;
}

/** Symbol values including start, checksum, and stop. */
export function code128Symbols(text) {
  const raw = String(text);
  if (!raw || [...raw].some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) > 126)) {
    throw new Error("Code 128 payload must be printable ASCII");
  }

  const symbols = [];
  let mode = null;
  let i = 0;

  while (i < raw.length) {
    const ahead = digitsAhead(raw, i);
    const startInC = mode == null && ahead >= 2 && (ahead >= 4 || ahead % 2 === 0);
    const switchToC = mode === "B" && ahead >= 4;
    const stayInC = mode === "C" && ahead >= 2;

    if (startInC || switchToC || stayInC) {
      if (mode !== "C") {
        symbols.push(mode == null ? START_C : CODE_C);
        mode = "C";
      }
      const take = ahead % 2 === 0 ? ahead : ahead - 1;
      for (let k = 0; k < take; k += 2) {
        symbols.push(Number(raw.slice(i, i + 2)));
        i += 2;
      }
      continue;
    }

    if (mode !== "B") {
      symbols.push(mode == null ? START_B : CODE_B);
      mode = "B";
    }
    symbols.push(raw.charCodeAt(i) - 32);
    i += 1;
  }

  let sum = symbols[0];
  for (let p = 1; p < symbols.length; p += 1) sum += p * symbols[p];
  symbols.push(sum % 103);
  symbols.push(STOP);
  return symbols;
}

function symbolsToBits(symbols) {
  const bits = [];
  symbols.forEach((sym) => {
    let bar = true;
    for (const ch of PATTERNS[sym]) {
      const width = Number(ch);
      for (let n = 0; n < width; n += 1) bits.push(bar);
      bar = !bar;
    }
  });
  return bits;
}

/**
 * Bar geometry in module units. `rects` are merged black runs so adjacent
 * modules do not leave hairline gaps when the SVG is scaled.
 */
export function code128Layout(text, { maxWidthIn, barHeightIn }) {
  const symbols = code128Symbols(text);
  const bits = symbolsToBits(symbols);
  const modules = bits.length + QUIET_MODULES * 2;
  const moduleIn = Math.min(PREFERRED_MODULE_IN, maxWidthIn / modules);
  const heightUnits = Math.max(1, Math.round(barHeightIn / moduleIn));
  const rects = [];
  let i = 0;
  while (i < bits.length) {
    if (!bits[i]) {
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < bits.length && bits[j]) j += 1;
    rects.push({ x: QUIET_MODULES + i, w: j - i });
    i = j;
  }
  return {
    text: String(text),
    modules,
    moduleIn,
    widthIn: modules * moduleIn,
    heightUnits,
    heightIn: heightUnits * moduleIn,
    rects,
  };
}

export function code128Svg(text, options) {
  const layout = code128Layout(text, options);
  const label = String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
  const rects = layout.rects
    .map((bar) => `<rect x="${bar.x}" y="0" width="${bar.w}" height="${layout.heightUnits}" fill="#000"/>`)
    .join("");
  return `<svg class="barcode" xmlns="http://www.w3.org/2000/svg" width="${layout.widthIn}in" height="${layout.heightIn}in" viewBox="0 0 ${layout.modules} ${layout.heightUnits}" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" role="img" aria-label="Code 128 ${label}" data-barcode-value="${label}">${rects}</svg>`;
}
