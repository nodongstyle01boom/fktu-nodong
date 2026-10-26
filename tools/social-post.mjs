// 한국노총 노동연대 — 홍보 자동 게시 도구
//
// 결제 없이 쓸 수 있는 채널 위주로 붙는다.
//   telegram  봇 (Bot API, 무료)                 텔레그램 채널/그룹
//   discord   웹훅 (무료)
//   bluesky   앱 비밀번호 (AT Protocol, 무료)
//   facebook  페이지 액세스 토큰 (Graph API, 무료)
//   x         개발자 앱 OAuth1.0a — 2026-09 확인: X API 가 '사용량 과금(크레딧)' 으로 바뀜.
//             공식 문서(docs.x.com/x-api/getting-started/about-x-api)에 무료 등급이 없다.
//             코드는 살려 두었으나 무료 자동 게시 수단으로 기대하지 말 것 — 확인 후 쓰거나 --next 로 수동.
//   2026-09-19: 자동 연결 목록에서 제외. 계정 정지 이력이 있어 예약 게시 대상이 아니다.
//
//
// 사용:
//   node tools/social-post.mjs --draft          사이트 글에서 홍보글 자동 작성 → 대기열
//   node tools/social-post.mjs                  미리보기 (네트워크 안 씀)
//   node tools/social-post.mjs --post           실제 게시 (연결된 채널 전부, 기본 1건)
//   node tools/social-post.mjs --post --max 3   회차당 최대 3건
//   node tools/social-post.mjs --next           수동 게시용 텍스트 → tools/next-post.txt
//   node tools/social-post.mjs --dry-run --post  토큰 없이 전체 과정 연습 (파일로만 저장)
//   node tools/social-post.mjs --check          자기 점검 (네트워크 없음)
//   node tools/social-post.mjs --post --only telegram,x
//
// 준비: tools/social.env 에 토큰. 발급 절차는 tools/social-setup.md 참고.
// 자동 실행: Windows 작업 스케줄러 → node tools/social-post.mjs --draft --post (social-setup.md 6장)

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { createHmac, randomBytes } from 'node:crypto';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://nodong.seoulblue.com';
// SOCIAL_ENV 로 다른 파일을 가리킬 수 있다 (자기 점검용 모의 테스트가 사용)
const ENV_FILE = process.env.SOCIAL_ENV || join(ROOT, 'tools', 'social.env');
const QUEUE_FILE = join(ROOT, 'tools', 'social-queue.json');
const STATE_FILE = join(ROOT, 'tools', 'social-state.json');
const NEXT_FILE = join(ROOT, 'tools', 'next-post.txt');
const OUTBOX = join(ROOT, 'tools', 'social-outbox');

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

// ---------- env ----------
const loadEnv = (file) => {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
};
const env = loadEnv(ENV_FILE);

const CHANNELS = {
  telegram: { need: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'], body: 'long' },
  discord: { need: ['DISCORD_WEBHOOK_URL'], body: 'long' },
  bluesky: { need: ['BSKY_HANDLE', 'BSKY_APP_PASSWORD'], body: 'short' },
  x: { need: ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET'], body: 'short' },
  facebook: { need: ['FB_PAGE_ID', 'FB_PAGE_TOKEN'], body: 'long' },
  dry: { need: [], body: 'long' }, // --dry-run 전용. 토큰이 없어도 전체 과정을 연습한다.
};
// dry 는 연습용이라 자동 연결 목록에서는 뺀다 (--dry-run 을 줘야 붙는다)
// 2026-09-19: x 도 여기서 뺀다. X 는 계정 정지 이력이 있고 무료 공식 API 도 없다.
//   토큰이 채워져 있어도 예약 회차에서 자동으로 붙지 않는다.
//   정말 올려야 하면 사람이 --only x 를 명시할 때만 실행된다.
const AUTO_CHANNELS = Object.keys(CHANNELS).filter((c) => c !== 'dry' && c !== 'x');
const connected = (name) => CHANNELS[name].need.every((k) => env[k]);
const usable = (name) => (name === 'dry' ? has('--dry-run') : connected(name));

// ---------- text helpers ----------
const decode = (s) =>
  s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');

const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…');

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const pick = (html, re) => {
  const m = re.exec(html);
  return m ? decode(m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()) : '';
};

// 대기열 만들기 — articles/*.html, news/*.html 에서 제목·요약을 뽑아 홍보문 생성
function draft() {
  const out = [];
  const add = (dir, rel) => {
    const html = read(rel);
    const title = pick(html, /<h1>([\s\S]*?)<\/h1>/);
    if (!title) return;
    const desc = pick(html, /<meta name="description" content="([^"]*)"/);
    const url = `${SITE}/${rel}`;
    const short = clip(`${title}\n${desc}\n${url}`, 268);
    const long =
      `${title}\n\n${desc}\n\n` +
      `${dir === 'articles' ? '임금체불·산재·해고처럼 현장에서 자주 막히는 문제를 순서대로 정리했습니다.' : '현장 소식입니다.'}\n` +
      `전체 내용 → ${url}\n\n` +
      `현장에서 겪은 일, 연대 제안, 문의도 받습니다.\n한국노총 노동연대 ${SITE}`;
    out.push({ id: rel.replace(/\.html$/, '').replace(/\//g, '-'), url, title, desc, short, long, at: null, done: {} });
  };

  for (const f of readdirSync(join(ROOT, 'articles')).sort()) {
    if (f === 'index.html' || !f.endsWith('.html')) continue;
    add('articles', `articles/${f}`);
  }
  for (const f of readdirSync(join(ROOT, 'news')).sort()) {
    if (f === 'index.html' || !f.endsWith('.html')) continue;
    add('news', `news/${f}`);
  }
  return out;
}

// ---------- 채널별 발송 ----------
const sent = (extra = {}) => ({ ok: true, at: new Date().toISOString(), ...extra });

async function toTelegram(text) {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: false }),
  });
  if (!r.ok) throw new Error(`telegram ${r.status} ${await r.text()}`);
  return sent();
}

async function toDiscord(text) {
  const r = await fetch(env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: text }),
  });
  if (!r.ok) throw new Error(`discord ${r.status} ${await r.text()}`);
  return sent();
}

// Bluesky — 링크가 클릭되려면 facet(바이트 위치)이 필요하다
export function facetsFor(text) {
  const out = [];
  const bytes = (s) => Buffer.byteLength(s, 'utf8');
  for (const m of text.matchAll(/https?:\/\/[^\s)]+/g)) {
    const start = bytes(text.slice(0, m.index));
    out.push({
      index: { byteStart: start, byteEnd: start + bytes(m[0]) },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }],
    });
  }
  return out;
}

async function toBluesky(text) {
  const ses = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: env.BSKY_HANDLE, password: env.BSKY_APP_PASSWORD }),
  });
  if (!ses.ok) throw new Error(`bluesky 로그인 ${ses.status} ${await ses.text()}`);
  const { accessJwt, did } = await ses.json();
  const r = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessJwt}` },
    body: JSON.stringify({
      repo: did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text,
        facets: facetsFor(text),
        createdAt: new Date().toISOString(),
      },
    }),
  });
  if (!r.ok) throw new Error(`bluesky 게시 ${r.status} ${await r.text()}`);
  return sent();
}

const enc = encodeURIComponent;
function oauth1Header(method, url, extra = {}) {
  const oauth = {
    oauth_consumer_key: env.X_API_KEY,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: env.X_ACCESS_TOKEN,
    oauth_version: '1.0',
    ...extra,
  };
  const base = [
    method.toUpperCase(),
    enc(url),
    enc(Object.keys(oauth).sort().map((k) => `${enc(k)}=${enc(oauth[k])}`).join('&')),
  ].join('&');
  const key = `${enc(env.X_API_SECRET)}&${enc(env.X_ACCESS_SECRET)}`;
  oauth.oauth_signature = createHmac('sha1', key).update(base).digest('base64');
  return 'OAuth ' + Object.keys(oauth).sort().map((k) => `${enc(k)}="${enc(oauth[k])}"`).join(', ');
}

async function toX(text) {
  const url = 'https://api.twitter.com/2/tweets';
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: oauth1Header('POST', url) },
    body: JSON.stringify({ text }),
  });
  if (!r.ok) throw new Error(`x ${r.status} ${await r.text()}`);
  return sent();
}

async function toFacebook(text) {
  const url = `https://graph.facebook.com/v21.0/${env.FB_PAGE_ID}/feed`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text, access_token: env.FB_PAGE_TOKEN }),
  });
  if (!r.ok) throw new Error(`facebook ${r.status} ${await r.text()}`);
  return sent();
}

export const senders = { telegram: toTelegram, discord: toDiscord, bluesky: toBluesky, x: toX, facebook: toFacebook };

// 토큰 없이 전체 과정을 연습한다 — 실제로 보내지 않고 "보낼 내용"을 파일로 남긴다.
let drySeq = 0;
function toDryRun(text, item, ch) {
  mkdirSync(OUTBOX, { recursive: true });
  const name = `${String(++drySeq).padStart(2, '0')}-${ch}-${item.id}.txt`;
  writeFileSync(join(OUTBOX, name), `[${ch}] ${item.title}\n${'-'.repeat(40)}\n${text}\n`);
  return sent({ dry: name });
}


// ---------- 자기 점검 (--check) ----------
function check() {
  const fails = [];
  const ok = (name, cond) => (cond ? console.log(`  OK   ${name}`) : fails.push(name));

  const f = facetsFor('안녕 https://nodong.seoulblue.com/articles/wage-arrears.html 끝');
  ok('facet 링크 1개', f.length === 1);
  ok('facet 바이트 시작(한글 3바이트 기준)', f[0]?.index.byteStart === Buffer.byteLength('안녕 '));
  ok('facet 끝 = 시작 + URL 바이트', f[0] && f[0].index.byteEnd - f[0].index.byteStart === Buffer.byteLength('https://nodong.seoulblue.com/articles/wage-arrears.html'));

  const q = draft();
  ok('대기열 30건 이상', q.length >= 30);
  ok('모든 항목 short ≤ 268자', q.every((i) => i.short.length <= 268));
  ok('모든 항목 URL 포함', q.every((i) => i.short.includes(i.url) || i.url.length > 60));
  ok('id 중복 없음', new Set(q.map((i) => i.id)).size === q.length);
  ok('제목 비어있지 않음', q.every((i) => i.title.length > 2));

  // 토큰 없이도 게시 경로가 끝까지 도는지 실제로 돌려 본다 (파일로만 저장)
  // 채널 이름을 'check' 로 둔다 — 실제 --dry-run 결과물(01-dry-...)을 지우지 않도록
  const made = q.slice(0, 2).map((it) => toDryRun(it.long, it, 'check'));
  ok('연습 저장 2건 생성', made.length === 2 && made.every((r) => existsSync(join(OUTBOX, r.dry))));
  ok(
    '연습 파일에 제목·본문·링크 포함',
    made.every((r) => {
      const t = readFileSync(join(OUTBOX, r.dry), 'utf8');
      return t.includes(SITE) && t.length > 200;
    }),
  );
  for (const r of made) rmSync(join(OUTBOX, r.dry), { force: true });

  console.log(fails.length ? `\n실패 ${fails.length}건: ${fails.join(' / ')}` : '\n전부 통과');
  process.exit(fails.length ? 1 : 0);
}

// ---------- 실행 ----------
const load = (f, d) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d);
const dueNow = (item) => !item.at || new Date(item.at) <= new Date();

async function main() {
  if (has('--check')) return check();

  let queue = load(QUEUE_FILE, []);
  if (has('--draft')) {
    queue = draft();
    writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
    console.log(`대기열 작성: ${queue.length}건 → tools/social-queue.json`);
  }
  if (!queue.length) {
    console.log('대기열 비어 있음. 먼저 --draft 로 홍보글을 만들어 주세요.');
    return;
  }

  const list = [...AUTO_CHANNELS.filter(connected), ...(has('--dry-run') ? ['dry'] : [])];
  if (has('--next')) {
    const item = queue.find((i) => Object.keys(i.done).length === 0) || queue[0];
    writeFileSync(NEXT_FILE, `${item.long}\n\n--- 숏폼(X·블루스카이) ---\n${item.short}\n`);
    console.log(`수동 게시용 텍스트 저장: tools/next-post.txt (${item.title})`);
    return;
  }

  const state = load(STATE_FILE, {});
  const only = val('--only', '') ? val('--only').split(',').map((s) => s.trim()) : null;
  const targets = (only || list).filter((c) => CHANNELS[c] && usable(c));
  // 채널이 아직 안 붙었으면 “아무 데도 안 올라간 글”을 기준으로 보여준다 (미리보기용)
  const pending = queue.filter((i) =>
    dueNow(i) && (targets.length ? targets.some((c) => !(state[i.id] || {})[c]) : Object.keys(state[i.id] || {}).length === 0),
  );

  console.log(`연결된 채널: ${list.length ? list.join(', ') : '(없음 — tools/social-setup.md 참고)'}`);
  console.log(`게시 대기: ${pending.length}건 / 전체 ${queue.length}건${only ? ` (${targets.join(',')} 만)` : ''}\n`);

  if (!has('--post')) {
    for (const i of pending.slice(0, Number(val('--max', 1)))) {
      console.log(`■ ${i.title}\n${i.short}\n- long ${i.long.length}자 / short ${i.short.length}자\n`);
    }
    console.log('실제로 올리려면 --post 를 붙이세요. (미리보기만 했음)');
    return;
  }
  if (!targets.length) {
    console.log('연결된 채널이 없습니다. tools/social.env 를 만들고 토큰을 넣어 주세요.');
    return;
  }

  const max = Number(val('--max', 1));
  const dryRun = has('--dry-run');
  let count = 0;
  for (const item of pending) {
    if (count >= max) break;
    let postedAny = false;
    for (const ch of targets) {
      if ((state[item.id] || {})[ch]) continue;
      try {
        const text = ch === 'dry' || CHANNELS[ch].body === 'short' ? item.short : item.long;
        const res = ch === 'dry' ? toDryRun(text, item, ch) : await senders[ch](text);
        if (!dryRun) state[item.id] = { ...(state[item.id] || {}), [ch]: res.at };
        postedAny = true;
        console.log(`  올림 ${ch} — ${item.title}`);
      } catch (e) {
        console.log(`  실패 ${ch} — ${item.title}\n        ${String(e.message).slice(0, 200)}`);
      }
    }
    if (postedAny) count++;
  }
  if (dryRun) {
    console.log(`\n연습 ${count}건 → tools/social-outbox/ (실제 게시 아님 · 중복 기록 안 남김)`);
  } else {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log(`\n이번 회차 게시 ${count}건 → tools/social-state.json (중복 방지 기록)`);
  }
}

if (process.argv[1] && basename(process.argv[1]) === 'social-post.mjs') await main();
