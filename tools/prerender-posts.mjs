// 게시판·오피니언 목록을 초기 HTML 에 미리 넣는다.
// 사용: node tools/prerender-posts.mjs
//
// 왜 필요한가: 이 두 페이지는 초기 HTML 이 "불러오는 중…" 뿐이고 목록은 브라우저가
// Supabase 에서 받아 채웠다. 검색엔진은 자바스크립트 실행을 미루거나 건너뛰기 때문에
// 내용 없는 페이지로 보일 수 있다. 크롤러가 보는 것과 사람이 보는 것을 같게 맞춘다.
//
// 페이지의 JS 는 그대로 둔다 — 글을 새로 올리면 새로고침만으로 반영되고,
// 이 스크립트를 다시 돌리면 초기 HTML 도 최신이 된다.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// js/site.js 는 브라우저용 ES 모듈이라 여기서 바로 import 할 수 없다(루트에 package.json 이 없다).
// 화면에 나오는 형식을 맞춰야 하므로 두 함수만 그대로 옮겨 온다. site.js 와 같이 고칠 것.
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const fmtDate = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
};

const ROOT = join(import.meta.dirname, "..");
const siteJs = readFileSync(join(ROOT, "js", "site.js"), "utf8");
const SB_URL = siteJs.match(/SB_URL = "([^"]+)"/)[1];
const SB_KEY = siteJs.match(/SB_KEY = "([^"]+)"/)[1];

const TARGETS = [
  { file: "board.html", listId: "list", statusId: "status", link: "post.html", empty: "아직 등록된 글이 없습니다." },
  { file: "opinion/index.html", listId: "list", statusId: "status", link: "../post.html", category: "오피니언", empty: "아직 등록된 오피니언이 없습니다." },
  { file: "index.html", listId: "board-list", statusId: "board-note", link: "post.html", limit: 3, empty: "아직 등록된 글이 없습니다." },
];

async function posts({ category = null, limit = 50 } = {}) {
  const q = [
    "?select=id,category,title,created_at",
    category ? `&category=eq.${encodeURIComponent(category)}` : "",
    "&order=created_at.desc",
    `&limit=${limit}`,
  ].join("");
  const res = await fetch(`${SB_URL}/rest/v1/posts${q}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!res.ok) throw new Error(`posts 조회 실패 (${res.status})`);
  return res.json();
}

const listHtml = (rows, link) =>
  rows
    .map(
      (p) => `        <li>
          <span class="date">${fmtDate(p.created_at)} · ${esc(p.category)}</span>
          <h3 style="margin:0.25rem 0"><a href="${link}?id=${p.id}">${esc(p.title)}</a></h3>
        </li>`,
    )
    .join("\n");

let changed = 0;

for (const t of TARGETS) {
  const file = join(ROOT, t.file);
  const html = readFileSync(file, "utf8");
  const rows = await posts({ category: t.category, limit: t.limit });

  const listRe = new RegExp(`(<ul class="list-plain" id="${t.listId}">)[\\s\\S]*?(</ul>)`);
  const statusRe = new RegExp(`(<div id="${t.statusId}" class="note")[^>]*>[\\s\\S]*?(</div>)`);

  if (!listRe.test(html) || !statusRe.test(html)) {
    throw new Error(`${t.file}: #${t.listId} / #${t.statusId} 를 찾지 못했습니다`);
  }

  const next = html
    .replace(listRe, (_, open, close) => (rows.length ? `${open}\n${listHtml(rows, t.link)}\n      ${close}` : `${open}${close}`))
    .replace(statusRe, () => (rows.length ? `<div id="${t.statusId}" class="note" hidden></div>` : `<div id="${t.statusId}" class="note">${t.empty}</div>`));

  if (next !== html) {
    writeFileSync(file, next);
    changed++;
  }
  console.log(`${t.file} — ${rows.length}건`);
}

console.log(`게시판 초기 HTML — ${TARGETS.length}개 중 ${changed}개 갱신`);
