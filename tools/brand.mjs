// 로고·파비콘·공유카드 일괄 적용기 — 모든 HTML 의 <head> 와 헤더 brand 앵커를 갱신한다.
// 사용: node tools/brand.mjs
// 몇 번을 돌려도 결과가 같다(멱등). 하나라도 빠진 파일이 있으면 오류로 멈춘다.
// ponytail: 헤더·head 가 44개 파일에 복붙된 정적 사이트라 스크립트 한 개로 도는 게 상한. 템플릿 엔진은 과하다.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SITE = "https://nodong.seoulblue.com";
const SITE_NAME = "한국노총 노동연대";
const SITE_DESC = "한국노총 노동연대 — 연대, 산업안전, 비정규직, 지역조직 연결을 위한 안내와 소식";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith("_") || name === "tools" || name === "node_modules") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

const files = walk(ROOT);
const changed = [];

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const depth = rel.split("/").length - 1;            // 0 = 루트, 1 = articles/ · news/
  const up = depth === 0 ? "" : "../";
  const html = readFileSync(file, "utf8");
  let next = html;

  // 1) 헤더 brand 앵커에 마크 삽입
  if (!next.includes("brand-mark")) {
    next = next.replace(
      /<a class="brand" href="([^"]*)">([^<]*)<span>([^<]*)<\/span><\/a>/,
      `<a class="brand" href="$1"><img class="brand-mark" src="${up}logo.svg" alt="" width="28" height="28">$2<span>$3</span></a>`
    );
  }

  // 2) 파비콘 — styles.css 링크 바로 뒤. 두 링크는 따로 검사한다(하나가 있어도 나머지는 들어가야 함)
  if (!next.includes('rel="icon"')) {
    next = next.replace(
      new RegExp(`(<link rel="stylesheet" href="${up}styles\\.css">)`),
      `$1\n  <link rel="icon" href="${up}logo.svg" type="image/svg+xml">`
    );
  }
  if (!next.includes("apple-touch-icon")) {
    next = next.replace(
      /(<link rel="icon"[^>]*>)/,
      `$1\n  <link rel="apple-touch-icon" href="${up}apple-touch-icon.png">`
    );
  }

  // 3) 공유 카드(og) — </head> 앞. 제목·설명은 각 페이지 것을 그대로 쓴다
  if (!next.includes("og:image")) {
    const title = (next.match(/<title>([^<]*)<\/title>/) || [, SITE_NAME])[1];
    const desc = (next.match(/<meta name="description" content="([^"]*)"/) || [, SITE_DESC])[1];
    const path = rel.replace(/index\.html$/, "").replace(/\.html$/, "");
    const url = `${SITE}/${path}`;
    const meta = `  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${SITE}/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${SITE_NAME} 로고와 소개 문구">
  <meta name="twitter:card" content="summary_large_image">
</head>`;
    next = next.replace(/<\/head>/, meta);
  }

  if (next !== html) {
    writeFileSync(file, next);
    changed.push(rel);
  }
}

// 점검 — 빠진 파일이 남으면 조용히 넘어가지 않고 실패시킨다
const need = ["brand-mark", 'rel="icon"', "og:image", "apple-touch-icon"];
const missing = files
  .map((f) => relative(ROOT, f).replace(/\\/g, "/"))
  .filter((rel) => {
    const h = readFileSync(join(ROOT, rel), "utf8");
    return need.some((n) => !h.includes(n));
  });

console.log(`HTML 파일 ${files.length}개 · 수정 ${changed.length}개`);
if (missing.length) {
  console.error(`로고·메타가 빠진 파일 ${missing.length}개:\n  ${missing.join("\n  ")}`);
  process.exit(1);
}
console.log("전 파일 로고·파비콘·공유카드 확인 OK");
