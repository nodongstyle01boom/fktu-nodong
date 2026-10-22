// 푸터에 광고 고지 + RSS + 광고 정책 링크를 모든 페이지에 넣는다(멱등).
// 사용: node tools/patch-footer.mjs
// 정책 고지·광고 설정·쿠키 설정 안내를 전 페이지에 노출해야 애드센스 심사가 통과한다.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SKIP_DIRS = new Set(["tools", "node_modules", ".git", ".vercel", ".netlify"]);

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(full);
    } else if (name.endsWith(".html")) {
      files.push(full);
    }
  }
};
walk(ROOT);

let patched = 0;
let skipped = 0;
for (const file of files) {
  let html = readFileSync(file, "utf8");
  if (html.includes("ad-notice")) {
    skipped++;
    continue;
  }
  const up = relative(ROOT, file).includes(sep) ? "../" : "";
  const old = `<p><a href="${up}privacy.html">개인정보처리방침</a> · <a href="${up}terms.html">이용약관</a></p>`;
  if (!html.includes(old)) {
    skipped++;
    continue;
  }
  const next =
    `<p class="ad-notice">본 사이트는 Google AdSense 광고를 게재합니다. 광고는 <strong>“광고”/“AD”</strong> 표기로 구분합니다. ` +
    `<a href="https://adssettings.google.com/" target="_blank" rel="noopener">광고 설정</a> · ` +
    `<a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener">쿠키 설정</a></p>\n      ` +
    `<p><a href="${up}feed.xml">RSS 구독</a> · <a href="${up}privacy.html">개인정보처리방침</a> · ` +
    `<a href="${up}terms.html">이용약관</a> · <a href="${up}adpolicy.html">광고 정책</a></p>`;
  html = html.replace(old, next);
  writeFileSync(file, html, "utf8");
  patched++;
}
console.log(`푸터 광고 고지 반영 — 적용 ${patched}건 · 건너뜀 ${skipped}건`);
