// 상단 메뉴 + 푸터 공통 링크 일괄 적용기
//  - 상단 메뉴: "문의" 앞에 "회원가입" 항목을 넣는다
//  - 푸터: "회원가입 · 문의 · 운영자 로그인" 한 줄로 통일한다
// 사용: node tools/site-links.mjs   (몇 번을 돌려도 결과가 같다 — 멱등)
// 운영자 페이지(admin.html)는 자체 메뉴를 쓰므로 제외.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SKIP = new Set(["tools", "node_modules", ".git", ".vercel", "admin.html", "google87dc6a6e4f9e5530.html", "naverd37ebeac5bdca9dc6b5ae7e3c426fd29.html"]);
const FOOTER_OPEN = '<footer class="site-footer">';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith("_")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

// 푸터에 남아 있던 옛 링크 줄 + 이전 실행에서 넣은 표준 줄은 지우고 표준 줄 하나로 다시 넣는다
// (표준 줄에도 admin.html이 들어 있어 DROP에 걸리므로, 방침 줄도 함께 DROP에 넣어 멱등 유지)
const DROP = /admin\.html|privacy\.html|terms\.html|mailto:fktu-nodong|>홈으로<\/a>|게시판<\/a> · <a href="[^"]*contact\.html">문의/;

const files = walk(ROOT);
let navAdded = 0;
const footerChanged = [];

for (const file of files) {
  const up = dirname(file) === ROOT ? "" : "../";
  const html = readFileSync(file, "utf8");
  const at = html.indexOf(FOOTER_OPEN);
  const head = at === -1 ? html : html.slice(0, at);
  const tail = at === -1 ? "" : html.slice(at);

  const joinLink = `<a href="${up}join.html">회원가입</a>`;
  const contactNavRe = new RegExp(`<a href="${up}contact\\.html"[^>]*>문의</a>`);
  const nextHead = head.includes(`${up}join.html`)
    ? head
    : head.replace(contactNavRe, `${joinLink}\n        $&`);
  if (nextHead !== head) navAdded++;

  const footLine = `      <p>${joinLink} · <a href="${up}contact.html">문의</a> · <a href="${up}admin.html">운영자 로그인</a></p>\n      <p><a href="${up}privacy.html">개인정보처리방침</a> · <a href="${up}terms.html">이용약관</a></p>`;
  const nextTail = tail.replace(
    /(<div class="footer-inner">)([\s\S]*?)(<\/div>\s*<\/footer>)/,
    (m, open, inner, close) => {
      let kept = inner.split("\n").filter((l) => !DROP.test(l)).join("\n");
      if (!kept.includes(footLine.trim())) kept = `${kept.replace(/\s+$/, "")}\n${footLine}`;
      return `${open}${kept}\n    ${close}`;
    },
  );

  const next = nextHead + nextTail;
  if (next !== html) {
    writeFileSync(file, next);
    footerChanged.push(relative(ROOT, file).replace(/\\/g, "/"));
  }
}

const missing = files
  .map((f) => relative(ROOT, f).replace(/\\/g, "/"))
  .filter((rel) => !readFileSync(join(ROOT, rel), "utf8").includes(">운영자 로그인</a>"));

console.log(`HTML 파일 ${files.length}개 · 메뉴 추가 ${navAdded}개 · 푸터 정리 ${footerChanged.length}개`);
if (missing.length) {
  console.error(`공통 링크가 빠진 파일 ${missing.length}개:\n  ${missing.join("\n  ")}`);
  process.exit(1);
}
console.log("전 파일 메뉴·푸터 링크 확인 OK");
