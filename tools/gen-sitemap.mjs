// sitemap.xml 생성 — 검색엔진에 페이지를 알리기 위한 파일.
// 사용: node tools/gen-sitemap.mjs
// 공개 페이지만 넣는다: admin.html(운영자), post.html(동적), welcome.html(noindex 시안),
// 소유 확인 파일, tools/ 제외.

import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, posix, sep } from 'node:path';

const BASE = 'https://nodong.seoulblue.com';
const SKIP_DIRS = new Set(['tools', '.vercel', 'node_modules', '.git', 'js']);
const SKIP_FILES = new Set(['admin.html', 'post.html', 'welcome.html']);
// 구글·네이버 소유 확인 파일은 색인이 아니라 확인용이다.
const SKIP_VERIFY = /^(google|naver)[0-9a-f]+\.html$/i;

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(full, out);
    } else if (name.endsWith('.html') && !SKIP_FILES.has(name) && !SKIP_VERIFY.test(name)) {
      out.push({ rel: full.split(sep).join('/').replace(/^\.\//, ''), mtime: st.mtime });
    }
  }
  return out;
};

const priorityOf = (rel) => {
  if (rel === 'index.html') return '1.0';
  if (/^(about|direction|news\/index|articles\/index|opinion\/index|board|contact|join)\.html$/.test(rel)) return '0.8';
  if (/^(news|articles)\//.test(rel)) return '0.6';
  return '0.5';
};

const files = walk('.');
const urls = files
  .map(({ rel, mtime }) => {
    const loc = rel === 'index.html'
      ? `${BASE}/`
      : rel.endsWith('/index.html')
        ? `${BASE}/${rel.slice(0, -'index.html'.length)}`
        : `${BASE}/${rel.replace(/\.html$/, '')}`;
    const lastmod = mtime.toISOString().slice(0, 10);
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <priority>${priorityOf(rel)}</priority>\n  </url>`;
  })
  .sort((a, b) => (a.includes(`<loc>${BASE}/<`) ? -1 : b.includes(`<loc>${BASE}/<`) ? 1 : a.localeCompare(b)));

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;

// 방어: 공개 페이지만, 개수 이상하면 실패로 멈춘다
if (files.length < 30) throw new Error(`공개 페이지가 너무 적음: ${files.length}`);
if (xml.includes('admin.html') || xml.includes('post.html')) throw new Error('비공개 페이지가 섞임');

writeFileSync('sitemap.xml', xml);
console.log(`sitemap.xml — ${files.length}개 URL (경로: ${posix.join('.', 'sitemap.xml')})`);
