// logo.svg 에서 아이콘 PNG 를 다시 뜬다 — apple-touch-icon.png · icon-512.png · og.png
// 사용: node tools/brand-icons.mjs && node tools/make-ico.mjs
// ponytail: 크롬 헤드리스 스크린샷이면 끝난다. sharp/resvg 같은 이미지 라이브러리를 새로 깔 이유가 없다.
// 주의 1: 크롬은 상대 경로로 쓰기를 거부한다 → 출력은 절대 경로로.
// 주의 2: 뷰포트 최소 크기가 있어 180 창에 100vw 이미지를 넣으면 500px 짜리 로고가 잘려 찍힌다.
//         그래서 html 을 매번 만들어 픽셀 크기를 고정하고, --user-data-dir 도 매번 새로 준다.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = join(import.meta.dirname, "..");
const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find(existsSync);
if (!CHROME) throw new Error("chrome.exe 를 찾지 못했습니다");

const win = (p) => join(ROOT, p).replace(/\\/g, "/");
const LOGO = "file:///" + win("logo.svg");
const tmp = mkdtempSync(join(tmpdir(), "brand-"));

// 8비트 RGB(A) PNG 만 읽는다 — 크롬 스크린샷이 내는 형식
function decode(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("PNG 가 아닙니다: " + file);
  let w = 0, h = 0, ch = 0;
  const idat = [];
  for (let p = 8; p < buf.length;) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("latin1", p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      if (data[8] !== 8 || (data[9] !== 6 && data[9] !== 2)) throw new Error("8비트 RGB(A) 만 지원");
      ch = data[9] === 6 ? 4 : 3;
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const px = Buffer.alloc(h * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i];
      const a = i >= ch ? px[y * stride + i - ch] : 0;
      const b = y > 0 ? px[(y - 1) * stride + i] : 0;
      const c = i >= ch && y > 0 ? px[(y - 1) * stride + i - ch] : 0;
      px[y * stride + i] = (f === 0 ? x : f === 1 ? x + a : f === 2 ? x + b
        : f === 3 ? x + ((a + b) >> 1) : x + paeth(a, b, c)) & 0xff;
    }
  }
  return { w, h, ch, px, at: (x, y) => { const i = (y * w + x) * ch; return [px[i], px[i + 1], px[i + 2]]; } };
}

function shoot(html, out, w, h) {
  const page = join(tmp, "p.html");
  writeFileSync(page, html);
  execFileSync(CHROME, [
    "--headless=new", `--user-data-dir=${join(tmp, "prof").replace(/\\/g, "/")}`,
    `--screenshot=${out.replace(/\\/g, "/")}`, `--window-size=${w},${h}`,
    "--hide-scrollbars", "--force-device-scale-factor=1",
    "file:///" + page.replace(/\\/g, "/"),
  ], { stdio: ["ignore", "ignore", "pipe"] });
}

// 아이콘: 배지가 꽉 차고 가운데에 흰 불꽃이 있어야 한다
function icon(px, name) {
  const out = join(tmp, name);
  shoot(`<!DOCTYPE html><meta charset="utf-8">
<style>html,body{margin:0;overflow:hidden}img{display:block;width:${px}px;height:${px}px}</style>
<img src="${LOGO}" alt="">`, out, px, px);
  const img = decode(out);
  const [cr, cg, cb] = img.at(px >> 1, px >> 1);
  let white = 0;
  for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
    const [r, g, b] = img.at(x, y);
    if (r > 230 && g > 230 && b > 230) white++;
  }
  const ratio = white / (px * px);
  if (img.w !== px || img.h !== px) throw new Error(`${name} 크기 ${img.w}x${img.h} (기대 ${px}x${px})`);
  if (cr < 200) throw new Error(`${name} 가운데가 흰색이 아님 (${cr},${cg},${cb}) — 불꽃이 안 그려짐`);
  if (ratio < 0.05 || ratio > 0.4) throw new Error(`${name} 흰 영역 비중 ${(ratio * 100).toFixed(1)}% — 로고가 잘렸을 수 있음`);
  copyFileSync(out, join(ROOT, name));
  console.log(`${name} ${px}x${px} · 흰 영역 ${(ratio * 100).toFixed(1)}%`);
}

// 공유카드: 로고 + 제목이 들어간 별도 페이지(brand-card.html)를 그대로 쓴다
function card() {
  const out = join(tmp, "og.png");
  execFileSync(CHROME, [
    "--headless=new", `--user-data-dir=${join(tmp, "prof").replace(/\\/g, "/")}`,
    `--screenshot=${out.replace(/\\/g, "/")}`, "--window-size=1200,630",
    "--hide-scrollbars", "--force-device-scale-factor=1", "file:///" + win("tools/brand-card.html"),
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const img = decode(out);
  if (img.w !== 1200 || img.h !== 630) throw new Error(`og.png 크기 ${img.w}x${img.h}`);
  let red = 0;                                   // 좌측 로고 자리에 빨간 배지가 있어야 한다
  for (let y = 40; y < 600; y++) for (let x = 60; x < 320; x++) {
    const [r, g, b] = img.at(x, y);
    if (r > 130 && g < 90 && b < 90) red++;
  }
  if (red < 5000) throw new Error(`og.png 좌측에 로고가 없음 (빨간 픽셀 ${red}개)`);
  copyFileSync(out, join(ROOT, "og.png"));
  console.log(`og.png 1200x630 · ${(statSync(out).size / 1024).toFixed(0)}KB`);
}

icon(180, "apple-touch-icon.png");
icon(512, "icon-512.png");
card();
