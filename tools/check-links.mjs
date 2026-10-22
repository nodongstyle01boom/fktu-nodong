// 내부 링크 검사 — 외부(http/mailto) 제외, 상대경로만 실제 파일 존재 확인
// 사용: node tools/check-links.mjs
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SKIP = new Set([".git", ".vercel", "node_modules", "tools"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

const files = walk(ROOT);
const missing = [];
let checked = 0;

for (const file of files) {
  const html = readFileSync(file, "utf8");
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const raw = m[1];
    if (/^(https?:|mailto:|tel:|data:|#)/.test(raw)) continue;
    const target = raw.split("#")[0].split("?")[0];
    if (!target) continue;
    checked++;
    const abs = target.startsWith("/") ? join(ROOT, target) : resolve(dirname(file), target);
    if (!existsSync(abs)) {
      missing.push(`${relative(ROOT, file).replace(/\\/g, "/")} -> ${raw}`);
    }
  }

  // 메타데이터가 광고하는 절대 URL(og:url 등)도 "그대로 열리는" 주소여야 한다.
  // 이 호스팅은 cleanUrls 를 쓰지 않으므로 확장자를 뺀 주소(/about)는 404 다.
  // 파일이 있다는 이유로(.html 을 붙이면 있다) 통과시키면 "사이트가 알린 주소가 404"를 못 잡는다.
  const advertised = [
    ...html.matchAll(/content="https:\/\/fktu-nodong\.vercel\.app([^"]*)"/g),
    ...html.matchAll(/"url":"https:\/\/fktu-nodong\.vercel\.app([^"]*)"/g), // 구조화 데이터(ld+json)
  ];
  for (const m of advertised) {
    const raw = m[1] || "/";
    const rel = raw.split("#")[0].split("?")[0].replace(/^\//, "");
    checked++;
    const candidates = rel === "" ? ["index.html"] : rel.endsWith("/") ? [`${rel}index.html`] : [rel];
    if (!candidates.some((c) => existsSync(join(ROOT, c)))) {
      missing.push(`${relative(ROOT, file).replace(/\\/g, "/")} -> ${raw} (메타데이터 URL)`);
    }
  }
}

console.log(`HTML 파일 ${files.length}개 · 내부 링크 ${checked}개 검사`);
if (missing.length) {
  console.log(`\n깨진 링크 ${missing.length}개:`);
  for (const m of missing) console.log("  " + m);
  process.exit(1);
}
console.log("깨진 링크 0");
