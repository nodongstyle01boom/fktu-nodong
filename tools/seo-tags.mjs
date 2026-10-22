// SEO 태그 일괄 정리 — canonical + OG/Twitter 카드 + description 보강.
// 사용: node tools/seo-tags.mjs
// 왜 필요한가: 지식 글 64편에 og:url·canonical 이 없어서, SNS 미리보기가 비고
// 검색엔진이 어느 주소를 대표로 볼지 알 수 없었다. 일부 글은 og:url 이 확장자 없는
// 주소(/articles/what-is-union)를 광고했는데 그 주소는 이 호스팅에서 404 다.
//
// ponytail: 빌드 단계가 없는 정적 사이트라 파일을 직접 고쳐 넣는다. 여러 번 돌려도 같은 결과.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const BASE = "https://nodong.seoulblue.com";
const SITE = "한국노총 노동연대";
const OG_ALT = "한국노총 노동연대 로고와 소개 문구";
const SITE_DESC = "한국노총 노동연대 — 연대, 산업안전, 비정규직, 지역조직 연결을 위한 안내와 소식";

const SKIP_DIRS = new Set(["tools", "js", "img", "social-outbox", ".git", ".vercel", "node_modules"]);
const SKIP_FILES = new Set(["admin.html", "post.html"]); // 운영자 전용·동적 페이지
const VERIFY_FILE = /^(google|naver)[0-9a-f]+\.html$/i; // 소유 확인 파일

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(p, out);
    } else if (name.endsWith(".html")) {
      out.push(p);
    }
  }
  return out;
}

const attr = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const text = (s) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

// 메타 설명용으로 자른다. 단어 중간에서 끊기면 마지막 단어를 버린다.
const clip = (s, n = 155) => {
  const t = text(s);
  return t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, "") + "…";
};

// 본문 문단에서 설명을 만들 때는 첫 문장을 살린다. 155자에서 자르면 "헌법이 보장하는…" 처럼
// 문장이 토막 나서 검색 결과 미리보기가 어색해진다.
const summarize = (s, n = 155) => {
  const t = text(s);
  if (t.length <= n) return t;
  const m = t.match(/^(.{40,}?[.!?])\s/);
  return m ? m[1] : clip(t, n);
};

// 본문 첫 문단 — 기존 description 이 없는 글의 설명을 만든다.
function firstParagraph(html) {
  const body = html.split('<div class="article-body">')[1] || html.split("<main>")[1] || "";
  const m = body.match(/<p>([\s\S]*?)<\/p>/);
  return m ? text(m[1]) : "";
}

// og/twitter/description/canonical 은 우리가 전부 다시 쓴다 → 몇 번을 돌려도 결과가 같다.
// article:published_time 도 같이 지운다. 안 지우면 돌릴 때마다 한 줄씩 늘어난다.
const META_RE = /^[ \t]*<meta[ \t]+(?:property="(?:og|article):[^"]*"|name="twitter:[^"]*")[^>]*>[ \t]*\r?\n/gm;
const DESC_RE = /^[ \t]*<meta[ \t]+name="description"[^>]*>[ \t]*\r?\n/gm;
const CANON_RE = /^[ \t]*<link[ \t]+rel="canonical"[^>]*>[ \t]*\r?\n/gm;

const files = walk(ROOT)
  .map((p) => relative(ROOT, p).split(sep).join("/"))
  .filter((rel) => !SKIP_FILES.has(rel) && !VERIFY_FILE.test(rel.split("/").pop()))
  .sort();

let changed = 0;

for (const rel of files) {
  const file = join(ROOT, rel);
  const html = readFileSync(file, "utf8");

  const isIndex = /(^|\/)index\.html$/.test(rel);
  const isPost = /^(articles|news)\/[^/]+\.html$/.test(rel) && !isIndex;
  const noindex = /name="robots"[^>]*noindex/i.test(html);

  // 인덱스는 디렉터리 주소가 아니라 index.html 자체를 대표 주소로 삼는다.
  // 이 사이트는 cleanUrls 를 쓰지 않아서 확장자를 떼면 404 다(내부 링크·사이트맵도 .html 을 쓴다).
  const canonical = rel === "index.html"
  ? `${BASE}/`
  : rel.endsWith("/index.html")
    ? `${BASE}/${rel.slice(0, -"index.html".length)}`
    : `${BASE}/${rel.replace(/\.html$/, "")}`;

  const title = text((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
  const h1 = text((html.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1]);
  const ogTitle = isPost && h1 ? h1 : title;

  const existing = clip((html.match(/<meta[ \t]+name="description"[ \t]+content="([^"]*)"/) || [])[1], 160);
  const lead = summarize(firstParagraph(html));
  // 본문 문단에서 만들어 넣은 설명은 다시 만들 수 있다(앞부분이 그 문단과 같다).
  // 손으로 쓴 설명은 그대로 둔다 — 그게 더 짧고 정확하다.
  const derived = Boolean(lead) && Boolean(existing) && lead.slice(0, 40) === existing.slice(0, 40);
  const desc =
    (derived ? lead : existing) ||
    lead ||
    clip((html.match(/<meta[ \t]+property="og:description"[ \t]+content="([^"]*)"/) || [])[1], 160) ||
    SITE_DESC;

  const published = (html.match(/작성\s+(\d{4}-\d{2}-\d{2})/) || [])[1];

  const lines = [
    `  <meta name="description" content="${attr(desc)}">`,
    ...(noindex ? [] : [`  <link rel="canonical" href="${canonical}">`]),
    `  <meta property="og:type" content="${isPost ? "article" : "website"}">`,
    `  <meta property="og:site_name" content="${SITE}">`,
    `  <meta property="og:locale" content="ko_KR">`,
    `  <meta property="og:title" content="${attr(ogTitle)}">`,
    `  <meta property="og:description" content="${attr(desc)}">`,
    `  <meta property="og:url" content="${canonical}">`,
    `  <meta property="og:image" content="${BASE}/og.png">`,
    `  <meta property="og:image:width" content="1200">`,
    `  <meta property="og:image:height" content="630">`,
    `  <meta property="og:image:alt" content="${OG_ALT}">`,
    ...(isPost && published ? [`  <meta property="article:published_time" content="${published}">`] : []),
    `  <meta name="twitter:card" content="summary_large_image">`,
  ];

  let out = html
    .replace(META_RE, "")
    .replace(DESC_RE, "")
    .replace(CANON_RE, "")
    .replace(/<\/head>/, `${lines.join("\n")}\n</head>`);

  // 지식 글 제목의 "— 지식" 꼬리는 검색 결과에서 의미가 없다. 브랜드를 붙인다.
  if (isPost && /^articles\//.test(rel) && title.endsWith(" — 지식")) {
    const next = `${title.slice(0, -" — 지식".length)} | ${SITE}`;
    out = out.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${next}</title>`);
    out = out.replace(
      /<meta property="og:title" content="[^"]*">/,
      () => `<meta property="og:title" content="${attr(ogTitle)}">`,
    );
  }

  if (out !== html) {
    writeFileSync(file, out);
    changed++;
  }
}

console.log(`SEO 태그 정리 — ${files.length}개 중 ${changed}개 갱신`);
