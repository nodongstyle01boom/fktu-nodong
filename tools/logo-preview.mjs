// 로고 모양 눈검사 — logo.svg 를 크롬 헤드리스로 뜬 뒤 텍스트로 찍는다.
// 사용: node tools/logo-preview.mjs [px]   (기본 64, 헤더 크기 28도 같이 찍는다)
// ponytail: 이미지 뷰어 없이 확인하려고 PNG(zlib)·헤드리스 크롬만 쓴다. 이미지 라이브러리 필요 없음.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = join(import.meta.dirname, "..");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const SVG = join(ROOT, "logo.svg").replace(/\\/g, "/");

// SVG 를 그 크기에 맞춰 꽉 채운 HTML 로 뜬다. SVG 를 직접 열면 자연 크기(64px)로 그려져 잘려 나온다.
function shot(px) {
  const dir = mkdtempSync(join(tmpdir(), "logo-"));
  const page = join(dir, "p.html");
  const out = join(dir, "s.png");
  writeFileSync(page, `<!DOCTYPE html><meta charset="utf-8">
<style>html,body{margin:0;overflow:hidden}img{display:block;width:${px}px;height:${px}px}</style>
<img src="file:///${SVG}" alt="">`);
  execFileSync(CHROME, [
    "--headless=new", `--screenshot=${out}`, `--window-size=${px},${px}`,
    "--hide-scrollbars", "--default-background-color=00000000", `file:///${page.replace(/\\/g, "/")}`,
  ], { stdio: "ignore" });
  return decode(readFileSync(out));
}

// 8비트 RGB/RGBA PNG 만 지원 (크롬 스크린샷 출력)
function decode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("PNG 아님");
  let w = 0, h = 0, ch = 0;
  const idat = [];
  for (let p = 8; p < buf.length;) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("latin1", p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      if (data[8] !== 8 || !(data[9] === 6 || data[9] === 2)) throw new Error("8비트 RGB(A) 만 지원");
      ch = data[9] === 6 ? 4 : 3;
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? px[y * stride + i - ch] : 0;        // 왼쪽
      const b = y > 0 ? px[(y - 1) * stride + i] : 0;          // 위
      const c = i >= ch && y > 0 ? px[(y - 1) * stride + i - ch] : 0;
      const x = line[i];
      px[y * stride + i] = (f === 0 ? x
        : f === 1 ? x + a
        : f === 2 ? x + b
        : f === 3 ? x + ((a + b) >> 1)
        : x + paeth(a, b, c)) & 0xff;
    }
  }
  return { w, h, ch, px };
}
const paeth = (a, b, c) => {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

const RAMP = " .:-=+*#%@";
function ascii({ w, h, ch, px }, cols) {
  const sc = Math.max(1, Math.round(w / cols));
  const lines = [];
  for (let y = 0; y < h; y += sc * 2) {              // 터미널 글자는 세로로 길어 절반만 쓴다
    let line = "";
    for (let x = 0; x < w; x += sc) {
      const i = (y * w + x) * ch;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const a = ch === 4 ? px[i + 3] / 255 : 1;
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) * a + 255 * (1 - a);
      line += RAMP[Math.min(9, Math.floor((255 - lum) / 25.6))];
    }
    lines.push(line);
  }
  return lines.join("\n");
}

// 헤더 마크가 28px 이다. 그 크기에서 흰 불꽃이 살아 있는지 줄 폭으로 잰다.
function runs({ w, h, ch, px }, px2) {
  const isW = (x, y) => {
    const i = (y * w + x) * ch;
    return px[i] > 230 && px[i + 1] > 230 && px[i + 2] > 230;
  };
  const rows = [];
  for (let y = (h >> 2); y < (h * 3 >> 2); y += Math.max(1, Math.round(h / 12))) {
    const segs = [];
    let run = 0;
    for (let x = 0; x < w; x++) {
      if (isW(x, y)) run++;
      else if (run) { segs.push(run); run = 0; }
    }
    if (run) segs.push(run);
    rows.push(segs.join("+") || "0");
  }
  console.log(`${px2}px 가로줄 흰 구간 폭(px): ${rows.join(" / ")}`);
}

for (const px of [64, 28]) {
  const img = shot(px);
  const cols = px === 64 ? 64 : 48;
  console.log(`\n=== ${px}x${px} ===`);
  console.log(ascii(img, cols));
  runs(img, px);
}
