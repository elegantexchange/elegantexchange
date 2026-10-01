/**
 * QR Code of an item SKU (byte mode, ECC Q).
 * The payload is the SKU characters exactly — no prefix.
 * Version 1 of a code like "2041-03" is 21×21 modules; with a 4-module
 * quiet zone that square fits a 1.1875in tag at a scannable module width.
 *
 * frontend/public/sku-qr.js is a copy of this file for the static Kenco preview.
 */

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGenerator(nsym) {
  let gen = [1];
  for (let i = 0; i < nsym; i++) {
    const next = new Array(gen.length + 1).fill(0);
    const a = GF_EXP[i];
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j];
      next[j + 1] ^= gfMul(gen[j], a);
    }
    gen = next;
  }
  return gen;
}

function rsRemainder(data, nsym) {
  const gen = rsGenerator(nsym);
  const msg = data.concat(new Array(nsym).fill(0));
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (!coef) continue;
    for (let j = 0; j < gen.length; j++) {
      msg[i + j] ^= gfMul(gen[j], coef);
    }
  }
  return msg.slice(data.length);
}

// ECC Q only. blocks: groups of { n, data, ecc }.
const VERSIONS = {
  1: { align: [], remainder: 0, blocks: [{ n: 1, data: 13, ecc: 13 }] },
  2: { align: [6, 18], remainder: 7, blocks: [{ n: 1, data: 22, ecc: 22 }] },
  3: { align: [6, 22], remainder: 7, blocks: [{ n: 2, data: 17, ecc: 18 }] },
  4: { align: [6, 26], remainder: 7, blocks: [{ n: 2, data: 24, ecc: 26 }] },
};

const FORMAT_Q = [
  "011010101011111",
  "011000001101000",
  "011111100110001",
  "011101000000110",
  "010010010110100",
  "010000110000011",
  "010111011011010",
  "010101111101101",
].map((s) => parseInt(s, 2));

function dataCapacity(version) {
  return VERSIONS[version].blocks.reduce((sum, g) => sum + g.n * g.data, 0);
}

function chooseVersion(byteLength) {
  for (let version = 1; version <= 4; version++) {
    const bits = 4 + 8 + byteLength * 8;
    if (bits <= dataCapacity(version) * 8) return version;
  }
  throw new Error("SKU is too long for a hangtag QR code");
}

function pushBits(bits, value, len) {
  for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
}

function dataCodewords(bytes, capacity) {
  const bits = [];
  pushBits(bits, 0b0100, 4);
  pushBits(bits, bytes.length, 8);
  bytes.forEach((b) => pushBits(bits, b, 8));
  const maxBits = capacity * 8;
  const term = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < term; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const out = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    out.push(v);
  }
  let pad = 0xec;
  while (out.length < capacity) {
    out.push(pad);
    pad ^= 0xec ^ 0x11;
  }
  return out;
}

function splitBlocks(codewords, version) {
  const groups = VERSIONS[version].blocks;
  const dataBlocks = [];
  const eccBlocks = [];
  let offset = 0;
  groups.forEach((group) => {
    for (let i = 0; i < group.n; i++) {
      const block = codewords.slice(offset, offset + group.data);
      offset += group.data;
      dataBlocks.push(block);
      eccBlocks.push(rsRemainder(block, group.ecc));
    }
  });
  const out = [];
  const maxData = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) {
    dataBlocks.forEach((b) => {
      if (i < b.length) out.push(b[i]);
    });
  }
  const eccLen = eccBlocks[0].length;
  for (let i = 0; i < eccLen; i++) {
    eccBlocks.forEach((b) => out.push(b[i]));
  }
  return out;
}

function skuBytes(text) {
  const bytes = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c > 0x7f) {
      throw new Error("Hangtag SKU must be ASCII");
    }
    bytes.push(c);
  }
  return bytes;
}

function emptyMatrix(size) {
  return Array.from({ length: size }, () => Array(size).fill(false));
}

function drawFinder(matrix, func, x0, y0) {
  const size = matrix.length;
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const x = x0 + dx;
      const y = y0 + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const inFinder = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const edge = dx === 0 || dx === 6 || dy === 0 || dy === 6;
      const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
      matrix[y][x] = inFinder && (edge || core);
      func[y][x] = true;
    }
  }
}

function drawAlignment(matrix, func, cx, cy) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const on = Math.max(Math.abs(dx), Math.abs(dy)) !== 1;
      matrix[cy + dy][cx + dx] = on;
      func[cy + dy][cx + dx] = true;
    }
  }
}

function reserveFormat(func, size) {
  for (let i = 0; i < 9; i++) {
    if (i === 6) continue;
    func[i][8] = true;
    func[8][i] = true;
  }
  for (let i = 0; i < 8; i++) {
    func[8][size - 1 - i] = true;
    func[size - 1 - i][8] = true;
  }
}

function placeData(matrix, func, codewords, remainder) {
  const size = matrix.length;
  const bits = [];
  codewords.forEach((cw) => {
    for (let i = 7; i >= 0; i--) bits.push(((cw >>> i) & 1) === 1);
  });
  for (let i = 0; i < remainder; i++) bits.push(false);
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let vert = 0; vert < size; vert++) {
      const y = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        if (func[y][x]) continue;
        matrix[y][x] = i < bits.length ? bits[i] : false;
        i += 1;
      }
    }
  }
}

function maskFlips(mask, row, col) {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return (row * col) % 2 + (row * col) % 3 === 0;
    case 6:
      return ((row * col) % 2 + (row * col) % 3) % 2 === 0;
    default:
      return ((row + col) % 2 + (row * col) % 3) % 2 === 0;
  }
}

function applyMask(matrix, func, mask) {
  const size = matrix.length;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!func[y][x] && maskFlips(mask, y, x)) matrix[y][x] = !matrix[y][x];
    }
  }
}

function drawFormat(matrix, mask) {
  const data = FORMAT_Q[mask];
  const size = matrix.length;
  const bit = (i) => ((data >>> i) & 1) === 1;
  const set = (x, y, on) => {
    matrix[y][x] = on;
  };
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6));
  set(8, 8, bit(7));
  set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
  set(8, size - 8, true);
}

function penalty(matrix) {
  const n = matrix.length;
  let score = 0;
  const runs = (line) => {
    let s = 0;
    let run = 1;
    for (let i = 1; i < line.length; i++) {
      if (line[i] === line[i - 1]) {
        run += 1;
        if (run === 5) s += 3;
        else if (run > 5) s += 1;
      } else {
        run = 1;
      }
    }
    return s;
  };
  for (let y = 0; y < n; y++) score += runs(matrix[y]);
  for (let x = 0; x < n; x++) {
    const col = [];
    for (let y = 0; y < n; y++) col.push(matrix[y][x]);
    score += runs(col);
  }
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const v = matrix[y][x];
      if (
        v === matrix[y][x + 1] &&
        v === matrix[y + 1][x] &&
        v === matrix[y + 1][x + 1]
      ) {
        score += 3;
      }
    }
  }
  const finderLike = (line) => {
    let s = 0;
    for (let i = 0; i + 6 < line.length; i++) {
      if (
        line[i] &&
        !line[i + 1] &&
        line[i + 2] &&
        line[i + 3] &&
        line[i + 4] &&
        !line[i + 5] &&
        line[i + 6]
      ) {
        const left =
          i >= 4 &&
          !line[i - 1] &&
          !line[i - 2] &&
          !line[i - 3] &&
          !line[i - 4];
        const right =
          i + 10 < line.length &&
          !line[i + 7] &&
          !line[i + 8] &&
          !line[i + 9] &&
          !line[i + 10];
        if (left || right) s += 40;
      }
    }
    return s;
  };
  for (let y = 0; y < n; y++) score += finderLike(matrix[y]);
  for (let x = 0; x < n; x++) {
    const col = [];
    for (let y = 0; y < n; y++) col.push(matrix[y][x]);
    score += finderLike(col);
  }
  let dark = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) if (matrix[y][x]) dark += 1;
  }
  const pct = (dark * 100) / (n * n);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

function formatBitsComputed(mask) {
  const data = (0b11 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) {
    rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  }
  return (((data << 10) | (rem & 0x3ff)) ^ 0x5412) & 0x7fff;
}

export function buildSkuQr(text) {
  const bytes = skuBytes(String(text));
  const version = chooseVersion(bytes.length);
  const spec = VERSIONS[version];
  const size = 17 + 4 * version;
  const capacity = dataCapacity(version);
  const packed = dataCodewords(bytes, capacity);
  const codewords = splitBlocks(packed, version);
  const matrix = emptyMatrix(size);
  const func = emptyMatrix(size);
  drawFinder(matrix, func, 0, 0);
  drawFinder(matrix, func, size - 7, 0);
  drawFinder(matrix, func, 0, size - 7);
  for (let i = 8; i < size - 8; i++) {
    const on = i % 2 === 0;
    matrix[6][i] = on;
    func[6][i] = true;
    matrix[i][6] = on;
    func[i][6] = true;
  }
  spec.align.forEach((cy) => {
    spec.align.forEach((cx) => {
      const corner =
        (cx < 9 && cy < 9) ||
        (cx > size - 10 && cy < 9) ||
        (cx < 9 && cy > size - 10);
      if (!corner) drawAlignment(matrix, func, cx, cy);
    });
  });
  reserveFormat(func, size);
  matrix[size - 8][8] = true;
  placeData(matrix, func, codewords, spec.remainder);

  let bestMask = 0;
  let bestScore = Infinity;
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const trial = matrix.map((row) => row.slice());
    applyMask(trial, func, mask);
    drawFormat(trial, mask);
    const score = penalty(trial);
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
      best = trial;
    }
  }
  return {
    text: String(text),
    version,
    size,
    mask: bestMask,
    modules: best,
    func,
    quiet: 4,
  };
}

function xmlEscape(value) {
  return String(value).replace(/[&<>"]/g, (ch) => {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    return "&quot;";
  });
}

export function skuQrSvg(text) {
  const qr = buildSkuQr(text);
  const quiet = qr.quiet;
  const total = qr.size + quiet * 2;
  let rects = "";
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.modules[y][x]) {
        rects += `<rect x="${x + quiet}" y="${y + quiet}" width="1" height="1"/>`;
      }
    }
  }
  const label = xmlEscape(text);
  return `<svg class="sku-qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" aria-label="QR code ${label}" data-sku="${label}" data-symbology="QR"><g fill="#000000">${rects}</g></svg>`;
}

export function qrSelfTest() {
  const errors = [];
  for (let mask = 0; mask < 8; mask++) {
    if (formatBitsComputed(mask) !== FORMAT_Q[mask]) {
      errors.push(`format mask ${mask} ${formatBitsComputed(mask)} != ${FORMAT_Q[mask]}`);
    }
  }
  ["2041-03", "2047-05", "2188-01", "1992-07", "HOUSE-01", "2041-100"].forEach((sku) => {
    const qr = buildSkuQr(sku);
    const bits = [];
    const size = qr.size;
    for (let right = size - 1; right >= 1; right -= 2) {
      let col = right;
      if (col === 6) col = 5;
      const upward = ((col + 1) & 2) === 0;
      for (let vert = 0; vert < size; vert++) {
        const y = upward ? size - 1 - vert : vert;
        for (let j = 0; j < 2; j++) {
          const x = col - j;
          if (qr.func[y][x]) continue;
          let on = qr.modules[y][x];
          if (maskFlips(qr.mask, y, x)) on = !on;
          bits.push(on ? 1 : 0);
        }
      }
    }
    const take = (n) => {
      let v = 0;
      for (let i = 0; i < n; i++) v = (v << 1) | bits.shift();
      return v;
    };
    const mode = take(4);
    const len = take(8);
    let got = "";
    for (let i = 0; i < len; i++) got += String.fromCharCode(take(8));
    if (mode !== 0b0100) errors.push(`${sku} mode ${mode}`);
    if (got !== sku) errors.push(`${sku} decoded ${got}`);
    if (sku === "2041-03" && qr.version !== 1) errors.push(`version ${qr.version}`);
    if (!qr.modules[0][0] || !qr.modules[size - 1][0] || !qr.modules[0][size - 1]) {
      errors.push(`${sku} finder`);
    }
    const svg = skuQrSvg(sku);
    if (!svg.includes(`data-sku="${sku}"`)) errors.push(`${sku} svg`);
    if (sku === "2041-03" && !svg.includes('viewBox="0 0 29 29"')) {
      errors.push(`viewBox ${svg.slice(0, 180)}`);
    }
    const group = VERSIONS[qr.version].blocks[0];
    const packed = dataCodewords(skuBytes(sku), dataCapacity(qr.version));
    const ecc = rsRemainder(packed.slice(0, group.data), group.ecc);
    const word = packed.slice(0, group.data).concat(ecc);
    for (let i = 0; i < group.ecc; i++) {
      let s = 0;
      for (let j = 0; j < word.length; j++) s = gfMul(s, GF_EXP[i]) ^ word[j];
      if (s !== 0) errors.push(`${sku} syndrome ${i}=${s}`);
    }
  });
  return errors;
}
