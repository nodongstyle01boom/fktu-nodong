// 한국노총 노동연대 — 소셜 초안 생성기 (게시하지 않는다)
//
// 왜 필요한가:
//   2026-09-19 무인 브라우저 자동 게시를 중단했다. 매일 같은 시각에 같은 문장으로
//   자동 게시하는 패턴이 계정 정지(봇 탐지)의 가장 흔한 원인이라,
//   이제는 "글은 여기서 만들고, 누르는 건 사람이 한다"로 통일한다.
//
// 이 스크립트가 하는 일 (전부 로컬 파일):
//   1. 대기열에서 아직 올리지 않은 글을 고른다
//   2. 채널별 글자 수 제한에 맞춰 본문을 자른다
//   3. tools/social-outbox/ 에 붙여넣기용 텍스트로 저장한다
//   4. 화면에 복사해서 쓸 수 있게 찍는다
//
// 이 스크립트가 하지 않는 일:
//   브라우저 실행 없음 · 계정 로그인 없음 · API 호출 없음 · 게시 없음
//
// 사용:
//   node tools/social-draft.mjs                        다음 글 1건, 채널 3종 초안
//   node tools/social-draft.mjs --max 3               다음 글 3건
//   node tools/social-draft.mjs --platform x           X 만
//   node tools/social-draft.mjs --only <id>           특정 글만
//   node tools/social-draft.mjs --list                남은 글 목록만
//   node tools/social-draft.mjs --mark <id> x threads  사람이 올렸다고 기록
//
// 글자 수 제한 (2026-09-19 기준):
//   X         280 가중치. 한글은 가중치 2라 140자 안쪽을 안전선으로 쓴다
//   스레드     500자
//   인스타그램  캡션 2,200자 (단, 미디어(사진·영상) 없이는 게시 불가)
//
// 기록 형식은 social-state.json 의 기존 규칙을 그대로 쓴다:
//   { "글-id": { "fbpage": "…", "x": "사람이 직접 올림", "instagram": "…" } }

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QUEUE_FILE = join(ROOT, 'tools', 'social-queue.json');
const STATE_FILE = join(ROOT, 'tools', 'social-state.json');
const OUTBOX = join(ROOT, 'tools', 'social-outbox');

const PLATFORMS = {
  x: { label: 'X', limit: 140, field: 'short', media: null },
  threads: { label: '스레드', limit: 500, field: 'long', media: null },
  instagram: { label: '인스타그램', limit: 2200, field: 'long', media: '필수 — 사진·영상 1장 (예: og.png, 또는 tools/brand-card.html 로 만든 카드)' },
};

const MANUAL = '사람이 직접 올림';
const KEYS = Object.keys(PLATFORMS);

const args = process.argv.slice(2);
const val = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const load = (f, d) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d);
const save = (f, v) => writeFileSync(f, JSON.stringify(v, null, 2));
const posted = (item, key) => (state[item.id] || {})[key] === MANUAL;

const queue = load(QUEUE_FILE, []);
const state = load(STATE_FILE, {});

if (!queue.length) {
  console.log('대기열이 비었습니다. 먼저 node tools/social-post.mjs --draft 를 돌리세요.');
  process.exit(0);
}

// ── 사람이 올렸다고 표시 ──────────────────────────────────────────
const mark = val('--mark', '');
if (mark) {
  const keys = KEYS.filter((k) => args.includes(k));
  if (!keys.length) {
    console.log(`--mark 뒤에 채널 이름을 적으세요. 예: --mark ${queue[0].id} x threads`);
    process.exit(1);
  }
  const item = queue.find((i) => i.id === mark);
  if (!item) {
    console.log(`대기열에 없는 id 입니다: ${mark}`);
    process.exit(1);
  }
  for (const k of keys) state[item.id] = { ...(state[item.id] || {}), [k]: MANUAL };
  save(STATE_FILE, state);
  console.log(`기록했습니다: ${item.title} → ${keys.map((k) => PLATFORMS[k].label).join(', ')}`);
  process.exit(0);
}

// ── 본문 자르기 ───────────────────────────────────────────────────
function fit(item, key) {
  const cfg = PLATFORMS[key];
  const url = item.url || '';
  const raw = item[cfg.field] || item.short || item.title || '';
  if ([...raw].length <= cfg.limit) return { text: raw, cut: false };

  // 넘치면 본문만 자른다 — 링크는 항상 마지막에 남긴다
  const body = url && raw.endsWith(url) ? raw.slice(0, raw.length - url.length) : raw;
  const room = cfg.limit - (url ? url.length + 1 : 0);
  if (room < 40) return { text: [...raw].slice(0, cfg.limit).join(''), cut: true };
  let trimmed = [...body].slice(0, room).join('');
  const nl = trimmed.lastIndexOf('\n');
  if (nl > 40) trimmed = trimmed.slice(0, nl); // 줄바꿈에서 자른다
  return { text: trimmed.replace(/\s+$/, '') + (url ? '\n' + url : ''), cut: true };
}

const pending = queue.filter((i) => !KEYS.every((k) => posted(i, k)));
const wanted = KEYS.filter((k) => (args.includes('--platform') ? args.includes(k) : true));
const only = val('--only', '');
const pool = only ? pending.filter((i) => i.id === only) : pending;

if (args.includes('--list')) {
  console.log(`대기열 ${queue.length}건 / 남은 ${pending.length}건\n`);
  for (const i of pending) {
    const done = KEYS.filter((k) => posted(i, k)).map((k) => PLATFORMS[k].label);
    console.log(`  ${i.id}\n    ${i.title}\n    올림: ${done.length ? done.join(', ') : '—'}`);
  }
  process.exit(0);
}

if (!wanted.length) {
  console.log(`--platform 은 ${KEYS.join(' / ')} 중 하나여야 합니다.`);
  process.exit(1);
}
if (!pool.length) {
  console.log(only ? `대기열에 없는 id 입니다: ${only}` : '남은 글이 없습니다.');
  process.exit(0);
}

if (!existsSync(OUTBOX)) mkdirSync(OUTBOX, { recursive: true });

const max = Number(val('--max', 1));
const items = pool.slice(0, max);
const day = new Date().toISOString().slice(0, 10);

console.log('='.repeat(64));
console.log('초안만 만듭니다. 브라우저도 계정도 건드리지 않았습니다.');
console.log('복사해 각 채널에 붙여넣은 뒤, 직접 누르세요.');
console.log('='.repeat(64));

for (const item of items) {
  console.log(`\n■ ${item.title}\n`);
  for (const key of wanted) {
    const cfg = PLATFORMS[key];
    const { text, cut } = fit(item, key);
    const name = `${day}-${key}-${item.id}.txt`;
    writeFileSync(join(OUTBOX, name), text);
    const n = [...text].length;
    console.log(`  ── ${cfg.label} ── ${n}/${cfg.limit}자${cut ? ' (초과분 잘림)' : ''}`);
    console.log(text.split('\n').map((l) => `  │ ${l}`).join('\n'));
    if (cfg.media) console.log(`  ※ 미디어: ${cfg.media}`);
    console.log(`  저장: tools/social-outbox/${name}`);
    console.log(`  올린 뒤 기록: node tools/social-draft.mjs --mark ${item.id} ${key}\n`);
  }
}

console.log('-'.repeat(64));
console.log(`처리 ${items.length}건 · 채널 ${wanted.map((k) => PLATFORMS[k].label).join(', ')}`);
console.log('남은 글: node tools/social-draft.mjs --list');
