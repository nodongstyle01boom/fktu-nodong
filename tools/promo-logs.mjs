// 홍보 자동화 로그 점검 (한국노총 노동연대)
//
// 왜 필요한가: 페이지·블로거·토큰 채널이 각각 로그를 남기는데, 어디가 언제 실패했는지
// 한 번에 보이지 않았다. 이 도구가 promo-log.txt + social-state.json 을 합쳐 한 장으로 보여준다.
//
// 사용:
//   node tools/promo-logs.mjs                 요약 (기본)
//   node tools/promo-logs.mjs --summary       위와 같음
//   node tools/promo-logs.mjs --tail 40       로그 마지막 40줄
//   node tools/promo-logs.mjs --problems      실패한 회차만
//   node tools/promo-logs.mjs --self-test     파싱 규칙 자체 점검 (로그 파일 없이 돌아감)
//
// 파일: tools/promo-log.txt (promo-daily.cmd 가 append) · tools/social-state.json (채널별 발행 기록)

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOG_FILE = join(ROOT, 'tools', 'promo-log.txt');
const STATE_FILE = join(ROOT, 'tools', 'social-state.json');
const QUEUE_FILE = join(ROOT, 'tools', 'social-queue.json');

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const CHANNEL_LABEL = { fbpage: '페이스북 페이지', fb: '페이스북 개인', blog: '블로그', telegram: '텔레그램', discord: '디스코드', bluesky: '블루스카이', x: 'X(트위터)', facebook: '페이스북(토큰)' };

// 회차 블록의 성패 판정 — 각 도구가 남기는 문구를 기준으로 한다.
const OK_PATTERNS = [/게시 \d+건/, /발행 \d+건/, /게시함 —/, /발행함 —/, /연습 통과/];
const FAIL_PATTERNS = [/실패 \[/, /\[오류\]/, /^Error:/m, /aside repl 실행 실패/, /찾지 못함/];

function classify(text) {
  const fails = FAIL_PATTERNS.filter((re) => re.test(text)).length;
  const oks = OK_PATTERNS.filter((re) => re.test(text)).length;
  if (fails) return { status: '실패', fails, oks };
  if (oks) return { status: '성공', fails, oks };
  return { status: '기록없음', fails, oks };
}

// "===== 2026-09-18 오전 9:00:05 =====" 로 시작하는 회차 단위로 자른다
function splitRuns(text) {
  const lines = text.split(/\r?\n/);
  const runs = [];
  let cur = null;
  for (const line of lines) {
    if (/^=+\s*\S/.test(line) && /=====/.test(line)) {
      cur = { header: line.replace(/=/g, '').trim(), lines: [] };
      runs.push(cur);
    } else if (cur) cur.lines.push(line);
  }
  return runs.map((r) => ({ header: r.header, body: r.lines.join('\n') }));
}

function failLines(body) {
  return body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => FAIL_PATTERNS.some((re) => re.test(l)))
    .slice(0, 4);
}

function summary() {
  const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};
  const queue = existsSync(QUEUE_FILE) ? JSON.parse(readFileSync(QUEUE_FILE, 'utf8')) : [];

  console.log('■ 채널별 발행 기록 (tools/social-state.json)');
  const byChannel = {};
  for (const [id, chans] of Object.entries(state)) {
    for (const [ch, at] of Object.entries(chans || {})) {
      (byChannel[ch] ||= []).push({ id, at });
    }
  }
  if (!Object.keys(byChannel).length) console.log('  아직 기록이 없습니다.');
  for (const [ch, list] of Object.entries(byChannel)) {
    const sorted = list.slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
    console.log(`  ${(CHANNEL_LABEL[ch] || ch).padEnd(14)} ${String(list.length).padStart(3)}건 · 최근 ${String(sorted.at(-1).at).slice(0, 19).replace('T', ' ')}`);
  }

  console.log('\n■ 남은 대기열');
  for (const [ch, label] of [['fbpage', '페이스북 페이지'], ['blog', '블로그'], ['fb', '페이스북 개인']]) {
    const left = queue.filter((i) => !(state[i.id] || {})[ch]).length;
    console.log(`  ${label.padEnd(14)} ${left}건 남음 / 전체 ${queue.length}건`);
  }

  console.log('\n■ 최근 실행 회차 (tools/promo-log.txt)');
  if (!existsSync(LOG_FILE)) {
    console.log('  로그 파일이 없습니다 — 아직 자동 실행이 없었습니다.');
    console.log('  지금 한 번 돌려보기: powershell -Command "Start-ScheduledTask -TaskName nodong-promo"');
    return;
  }
  const runs = splitRuns(readFileSync(LOG_FILE, 'utf8')).filter((r) => r.body.trim());
  if (!runs.length) {
    console.log('  회차 기록이 없습니다.');
    return;
  }
  const recent = runs.slice(-7).reverse();
  let okCount = 0;
  let failCount = 0;
  for (const r of runs) (classify(r.body).status === '실패' ? failCount++ : okCount++);

  for (const r of recent) {
    const c = classify(r.body);
    const mark = c.status === '성공' ? 'OK  ' : c.status === '실패' ? 'FAIL' : '—   ';
    console.log(`  [${mark}] ${r.header}`);
    if (c.status === '실패') for (const l of failLines(r.body)) console.log(`          ${l.slice(0, 110)}`);
    if (c.status === '성공') {
      const posted = r.body.match(/(게시|발행) (\d+)건/g);
      if (posted) console.log(`          ${posted.join(' · ')}`);
    }
  }
  console.log(`\n  전체 ${runs.length}회차 · 성공 ${okCount} · 실패 ${failCount}`);
  if (failCount) console.log('  실패 회차 자세히: node tools/promo-logs.mjs --problems');
}

function selfTest() {
  const fails = [];
  const ok = (name, cond) => {
    console.log(`  ${cond ? 'OK  ' : 'FAIL'} ${name}`);
    if (!cond) fails.push(name);
  };
  ok('성공 회차 판정', classify('게시 1건 → tools/social-state.json').status === '성공');
  ok('실패 회차 판정', classify('실패 [composer-button] 페이지 작성 버튼을 찾지 못함').status === '실패');
  ok('기록 없는 회차 판정', classify('연습만 했습니다.').status === '기록없음');
  ok('성공+실패 혼재는 실패로', classify('게시 1건\n실패 [next]').status === '실패');
  const runs = splitRuns('===== 2026-09-18 오전 9:00 =====\n게시 1건\n===== 2026-09-19 오전 9:00 =====\n실패 [x] y');
  ok('회차 분리', runs.length === 2 && runs[1].body.includes('실패'));
  ok('실패 줄 추출', failLines('a\n실패 [next] 다음 버튼을 찾지 못함\nb').length === 1);
  ok('채널 이름표 누락 없음', ['fbpage', 'blog', 'fb', 'telegram', 'discord', 'bluesky'].every((c) => CHANNEL_LABEL[c]));
  console.log(fails.length ? `\n실패 ${fails.length}건` : '\n전부 통과');
  process.exit(fails.length ? 1 : 0);
}

if (has('--self-test')) selfTest();
else if (has('--tail')) {
  if (!existsSync(LOG_FILE)) {
    console.log('로그 파일이 없습니다: tools/promo-log.txt');
    process.exit(0);
  }
  const lines = readFileSync(LOG_FILE, 'utf8').split(/\r?\n/);
  console.log(lines.slice(-Number(val('--tail', 40))).join('\n'));
} else if (has('--problems')) {
  const runs = existsSync(LOG_FILE) ? splitRuns(readFileSync(LOG_FILE, 'utf8')) : [];
  const bad = runs.filter((r) => classify(r.body).status === '실패');
  if (!bad.length) console.log('실패한 회차가 없습니다.');
  for (const r of bad) {
    console.log(`\n=== ${r.header} ===`);
    for (const l of failLines(r.body)) console.log(`  ${l}`);
  }
} else summary();
