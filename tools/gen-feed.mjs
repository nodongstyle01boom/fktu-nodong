// RSS 피드(feed.xml) 생성 — 무료 배포 통로.
// 카페·블로그·텔레그램 봇·Make/IFTTT/Zapier 무료 한도가 이 파일을 읽어가서 자동으로 퍼뜨린다.
// 사용: node tools/gen-feed.mjs
//   · feed.xml 새로 씀 (지식 글 + 소식, 최신순)
//   · 모든 페이지 head 에 <link rel="alternate" type="application/rss+xml"> 한 줄 넣음 (멱등)
// ponytail: pubDate 는 파일 수정시각을 쓴다. 글 본문에 날짜가 없어서 정확한 발행일을 얻을 데가 없다.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const BASE = 'https://nodong.seoulblue.com';
const FEED_REL = 'feed.xml';
const SKIP_DIRS = new Set(['tools', 'node_modules', '.git', '.vercel']);
const SKIP_FILES = new Set(['admin.html', 'post.html']);

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
const xmlEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pick = (html, re) => {
  const m = re.exec(html);
  return m ? decode(m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()) : '';
};

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name) && !name.startsWith('_')) walk(full, out);
    } else if (name.endsWith('.html') && !SKIP_FILES.has(name)) {
      out.push(full);
    }
  }
  return out;
};

// ---------- 1. 피드 만들기 ----------
const items = [];
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).split('\\').join('/');
  const section = rel.startsWith('articles/') ? '지식' : rel.startsWith('news/') ? '소식' : null;
  if (!section || rel.endsWith('/index.html')) continue;

  const html = readFileSync(file, 'utf8');
  const title = pick(html, /<h1>([\s\S]*?)<\/h1>/);
  if (!title) continue;
  const desc = pick(html, /<meta name="description" content="([^"]*)"/);
  const main = (/<main[^>]*>([\s\S]*?)<\/main>/i.exec(html) || [, ''])[1];
  const body = decode(main
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
  items.push({ title, desc, body: body || desc, url: `${BASE}/${rel.replace(/\.html$/, '')}`, at: statSync(file).mtime, category: section });
}
items.sort((a, b) => b.at - a.at);

const rfc822 = (d) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const kst = new Date(d.getTime() + 9 * 3600 * 1000); // +09:00 로 표시
  const p = (n) => String(n).padStart(2, '0');
  return `${days[kst.getUTCDay()]}, ${p(kst.getUTCDate())} ${mon[kst.getUTCMonth()]} ${kst.getUTCFullYear()} `
    + `${p(kst.getUTCHours())}:${p(kst.getUTCMinutes())}:${p(kst.getUTCSeconds())} +0900`;
};

const body = items.map((i) => `    <item>
      <title>${xmlEsc(i.title)}</title>
      <link>${i.url}</link>
      <guid isPermaLink="true">${i.url}</guid>
      <category>${i.category}</category>
      <description>${xmlEsc(i.body)}</description>
      <pubDate>${rfc822(i.at)}</pubDate>
    </item>`).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>한국노총 노동연대</title>
    <link>${BASE}/</link>
    <description>노동 소식, 노동 기초 지식, 성명과 오피니언을 모아 올립니다.</description>
    <language>ko</language>
    <lastBuildDate>${rfc822(items[0]?.at ?? new Date())}</lastBuildDate>
    <atom:link href="${BASE}/${FEED_REL}" rel="self" type="application/rss+xml"/>
${body}
  </channel>
</rss>
`;

// 방어: 글이 통째로 비면 잘못 만든 것 — 덮어쓰지 않고 멈춘다
if (items.length < 30) throw new Error(`피드 항목이 너무 적음: ${items.length} (30 이상이어야 정상)`);

writeFileSync(join(ROOT, FEED_REL), xml, 'utf8');
console.log(`feed.xml — 항목 ${items.length}건 (지식 ${items.filter((i) => i.category === '지식').length} · 소식 ${items.filter((i) => i.category === '소식').length})`);

// ---------- 2. head 에 RSS 자동발견 링크 ----------
// 여러 번 돌려도 줄이 늘어나지 않는다: 중복 줄은 지우고 한 줄만 남긴다.
const HEAD_ANCHOR = /(<link rel="apple-touch-icon" href="[^"]*">)/;
const RSS_LINE = /^[ \t]*<link rel="alternate" type="application\/rss\+xml"[^>]*>\r?\n?/gm;
let headAdded = 0;
let headDeduped = 0;
for (const file of walk(ROOT)) {
  const up = dirname(file) === ROOT ? '' : '../';
  const html = readFileSync(file, 'utf8');

  // 1) 기존 줄 중 첫 번째만 남기고 나머지는 제거
  let next = html;
  let seen = false;
  next = next.replace(RSS_LINE, (line) => {
    if (!seen) {
      seen = true;
      return line;
    }
    headDeduped++;
    return '';
  });

  // 2) 아예 없으면 head 에 넣는다
  if (!seen) {
    const tag = `  <link rel="alternate" type="application/rss+xml" title="한국노총 노동연대 — 새 글" href="${up}${FEED_REL}">`;
    next = HEAD_ANCHOR.test(next)
      ? next.replace(HEAD_ANCHOR, `$1\n${tag}`)
      : next.replace('</head>', `${tag}\n</head>`);
  }

  if (next !== html) {
    writeFileSync(file, next);
    headAdded++;
  }
}
console.log(`RSS 자동발견 링크 — 새로 넣음 ${headAdded}개 · 중복 제거 ${headDeduped}줄`);
