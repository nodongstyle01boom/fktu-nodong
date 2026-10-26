// favicon.ico 생성기 — 브라우저·크롤러가 링크 태그와 무관하게 자동 요청하는 /favicon.ico 를 채운다.
// 사용: node tools/make-ico.mjs
// ponytail: ICO 안에 PNG 를 그대로 넣는 방식(Vista+)이라 인코더가 20줄이면 끝난다. 이미지 라이브러리를 끌어올 이유가 없다.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "apple-touch-icon.png");   // 180x180
const OUT = join(ROOT, "favicon.ico");

const png = readFileSync(SRC);
const w = png.readUInt32BE(16);
const h = png.readUInt32BE(20);
if (w > 256 || h > 256) throw new Error(`ICO 에 넣을 수 없는 크기: ${w}x${h}`);
if (png.readUInt32BE(0) !== 0x89504e47) throw new Error("PNG 가 아닙니다: " + SRC);

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);   // reserved
header.writeUInt16LE(1, 2);   // type = icon
header.writeUInt16LE(1, 4);   // 이미지 1장

const entry = Buffer.alloc(16);
entry.writeUInt8(w === 256 ? 0 : w, 0);
entry.writeUInt8(h === 256 ? 0 : h, 1);
entry.writeUInt8(0, 2);       // 팔레트 없음
entry.writeUInt8(0, 3);       // reserved
entry.writeUInt16LE(1, 4);    // color planes
entry.writeUInt16LE(32, 6);   // bpp
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(22, 12);  // 데이터 오프셋 (6 + 16)

writeFileSync(OUT, Buffer.concat([header, entry, png]));
const out = readFileSync(OUT);
console.log(`favicon.ico ${out.length} bytes · ${w}x${h} PNG 포함 (${(out.length - 22) === png.length ? "무결" : "불일치"})`);
