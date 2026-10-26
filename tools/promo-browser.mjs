// 한국노총 노동연대 — 브라우저 자동 게시 (Aside repl 경유)
//
// 왜 필요한가: X·네이버 카페·페이스북은 무료 자동 게시 API 가 없다.
// 그런데 사용자가 이미 브라우저에 로그인해 있으면, Aside 로 그 화면을 그대로 눌러 올릴 수 있다.
// 크레딧 0 (aside repl 경로), 토큰 발급도 필요 없다.
//
// 두 가지 게시 대상:
//   --target page    (기본) 한국노총 노동연대 **페이지** 이름으로 게시 — 공개범위 전체 공개 고정
//   --target profile 개인 프로필 타임라인에 게시 — 공개범위 선택 필요(public/friends/onlyme)
//
// 사용:
//   node tools/promo-browser.mjs --check                      자기 점검 (CLI·대기열·브라우저)
//   node tools/promo-browser.mjs --next                       다음에 올라갈 글 보기 (브라우저 안 씀)
//   node tools/promo-browser.mjs --rehearse                   연습 — 게시 버튼 확인까지만, 제출 안 함
//   node tools/promo-browser.mjs --post                       실제 게시 (1건)
//   node tools/promo-browser.mjs --post --target profile      개인 프로필에 게시
//   node tools/promo-browser.mjs --post --text short          짧은 문구로 올리기
//
// ── 계정 정지 방지 원칙 (2026-09-19) ──────────────────────────────
// 브라우저를 실제로 여는 모드(--rehearse / --post)는 **사람이 붙어 있는 터미널에서만** 동작한다.
// 작업 스케줄러처럼 stdin 이 TTY 가 아닌 회차는 코드에서 거부한다(exit 2).
//   - 무인 연속 게시(매일 같은 시각·같은 문장)는 플랫폼 봇 탐지의 1순위 신호다.
//   - 예약 자동화 대신 `node tools/social-draft.mjs` 로 초안만 뽑고 사람이 직접 올린다.
//   - 공식 API 가 있는 채널(페이스북 페이지)은 social-post.mjs Graph API 경로를 쓴다.
// 규칙을 바꾸려면 이 파일과 tools/social-draft.mjs 를 같이 고칠 것.
//
// 기록: tools/social-state.json 에 채널 'fbpage'(페이지) / 'fb'(개인) 로 남긴다.
//
// ── 실측으로 확인한 것 ──────────────────────────────────────────────
// [2026-09-18, 페이스북 한국어 UI]
//   - 페이지 생성: facebook.com/pages/creation/ — 이름 + 카테고리('노동 조합') + 소개
//   - 생성된 페이지: id 61594440182410 (한국노총 노동연대 · 노동 조합)
//   - 관리자 개인 프로필로 보면 '지금 전환' 버튼 → 누르면 페이지 모드로 바뀌고
//     '새로운 페이지에 오신 것을 환영합니다!' 대화상자가 뜬다 → '페이지 사용' 으로 닫는다.
//   - 페이지 모드 작성 버튼: 화면 폭이 있는 '무슨 생각을 하고 계신가요?' (role=button)
//     주의: 같은 글자를 가진 폭 0짜리 요소가 먼저 잡히면 '새 메모' 창이 열린다 → ref 로 집을 것.
//   - 페이지 작성창은 공개범위가 이미 '전체 공개' 라서 라디오를 건드릴 필요가 없다.
//     (개인 프로필은 '나만 보기'가 기본이고 JS 클릭이 안 먹어서 실제 마우스 클릭이 필요했다.)
//   - 페이지 흐름: 본문 → [다음] → '게시물 설정'(공개 대상 전체 공개 · 지금 게시) → [게시]
//   - 게시 확인: 페이지 프로필에 '공유 대상: 전체 공개' 로 표시됨

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QUEUE_FILE = join(ROOT, 'tools', 'social-queue.json');
const STATE_FILE = join(ROOT, 'tools', 'social-state.json');
const CLI = process.env.ASIDE_CLI || join(process.env.LOCALAPPDATA || '', 'Aside', 'CLI', 'current', 'aside.exe');

const PAGE_URL = 'https://www.facebook.com/profile.php?id=61594440182410';
const TARGETS = { page: 'fbpage', profile: 'fb' };

// 개인 프로필 공개범위 → 페이스북 라디오 name (실측)
const AUDIENCE_KEYS = { public: '-0', friends: '-1', onlyme: '-5' };
const AUDIENCE_LABEL = { '-0': '전체 공개', '-1': '친구', '-5': '나만 보기' };

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const load = (f, d) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d);

function repl(code) {
  const r = spawnSync(CLI, ['repl', code], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000 });
  if (r.error) throw new Error(`aside repl 실행 실패: ${r.error.message}`);
  return `${r.stdout || ''}${r.stderr || ''}`;
}

function parseResult(out) {
  const line = out.split(/\r?\n/).reverse().find((l) => l.startsWith('RESULT '));
  if (!line) {
    const errs = out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^Error|^\s+at |SyntaxError|is not defined|Cannot read/.test(l));
    return { ok: false, step: 'repl', msg: errs.slice(0, 2).join(' / ').slice(0, 300) || '결과 줄을 찾지 못함' };
  }
  try {
    return JSON.parse(line.slice('RESULT '.length));
  } catch {
    return { ok: false, step: 'parse', msg: line.slice(0, 300) };
  }
}

// ---------- 브라우저에서 돌릴 프로그램 (공통 앞부분) ----------
const PRELUDE = `
const P = async (fn, n = 25, ms = 800) => { for (let i = 0; i < n; i++) { try { if (await fn()) return true; } catch (e) {} await sleep(ms); } return false; };
const RES = (o) => console.log('RESULT ' + JSON.stringify(o));
const TREE = async () => (await snapshot(pg, { interactive: true })).tree;
const refOf = (tree, re) => { const l = tree.split('\\n').find((x) => re.test(x)); const m = l && /\\[ref=(e\\d+)\\]/.exec(l); return m ? m[1] : null; };
const waitRef = async (re, n = 20) => { for (let i = 0; i < n; i++) { const r = refOf(await TREE(), re); if (r) return r; await sleep(800); } return null; };
const clickRef = async (re, n = 20) => { const r = await waitRef(re, n); if (!r) return false; try { await pg.locator(r).click(); } catch (e) { try { await pg.mouse.click(r); } catch (e2) { return false; } } return true; };
// 이미 열린 페이스북 탭을 재사용한다 (매 실행마다 탭이 쌓이는 것을 막음)
const tabs = await listBrowserTabs();
const existing = tabs.find((t) => /facebook\\.com/.test(t.url || ''));
const pg = existing ? await attachBrowserTab(existing.targetId) : await openTab('https://www.facebook.com/');
`.trim();

// ---------- 페이지(한국노총 노동연대 명의) 게시 ----------
function buildPageJs({ text, submit }) {
  return `
${PRELUDE}
const TEXT = ${JSON.stringify(text)};
const PAGE_URL = ${JSON.stringify(PAGE_URL)};
await pg.goto(PAGE_URL);
await sleep(6500);

// 페이지 관리자 모드인지 확인 — 아니면 '지금 전환' 으로 바꾼다
let tree = await TREE();
const NEED = /무슨 생각을 하고 계신가요|button "생각을 올려보세요/;
if (!NEED.test(tree)) {
  if (await clickRef(/button "지금 전환"/, 8)) { await sleep(6000); }
  if (await clickRef(/button "페이지 사용"/, 8)) { await sleep(5000); }
  else { await clickRef(/button "닫기"/, 4); await sleep(1200); }
  await pg.goto(PAGE_URL);
  await sleep(6500);
  tree = await TREE();
}

// 이전 실행이 남긴 작성창이 떠 있으면 닫는다
if (/게시물 만들기/.test(tree)) {
  await clickRef(/button "작성 도구 대화 상자 닫기"/, 3);
  await sleep(1500);
  tree = await TREE();
}

// 작성 버튼 — 폭이 있는 쪽만 (폭 0짜리 '생각을 올려보세요'는 '새 메모'를 연다)
const cLine = tree.split('\\n').find((x) => /button "무슨 생각을 하고 계신가요\\?"/.test(x))
  || tree.split('\\n').find((x) => /button "생각을 올려보세요/.test(x));
const cRef = cLine && /\\[ref=(e\\d+)\\]/.exec(cLine)[1];
if (!cRef) { RES({ ok: false, step: 'composer-button', msg: '페이지 작성 버튼을 찾지 못함 — 페이지 모드 전환 실패 또는 화면 구조 변경' }); }
else {
  await pg.locator(cRef).click();
  const opened = await P(() => pg.evaluate(() => !!document.querySelector('[role="dialog"] [contenteditable="true"]')));
  if (!opened) { RES({ ok: false, step: 'dialog', msg: '작성창이 열리지 않음' }); }
  else {
    const box = pg.locator('[role="dialog"] [contenteditable="true"]');
    await box.click();
    await box.fill(TEXT);
    await sleep(2000);
    // 주의: [role=dialog] 안에는 댓글 입력창(contenteditable + aria-label)도 같이 잡힌다.
    // 게시물 본문은 aria-label 이 없는 쪽이므로 그것으로 확인한다.
    const typed = await pg.evaluate(() => { const c = [...document.querySelectorAll('[contenteditable="true"]')].find((x) => !x.getAttribute('aria-label')); return c ? (c.textContent || '').length : 0; });
    if (typed < 10) { RES({ ok: false, step: 'type', msg: '본문 입력이 비었음' }); }
    else {
      // 페이지 작성창 공개범위는 이미 '전체 공개' — 라디오를 건드리지 않는다
      if (!(await clickRef(/button "다음"/, 15))) { RES({ ok: false, step: 'next', msg: '다음 버튼을 찾지 못함' }); }
      else {
        await sleep(4000);
        tree = await TREE();
        const audLine = tree.split('\\n').find((x) => /게시물 공개 대상/.test(x));
        const audience = audLine ? (audLine.match(/게시물 공개 대상\\s*([^"\\[]+)/) || [])[1] : null;
        const postLine = tree.split('\\n').find((x) => /- button "게시" \\[ref=/.test(x));
        if (!postLine) { RES({ ok: false, step: 'post-button', msg: '게시 버튼을 찾지 못함', audience }); }
        else if (!${submit}) { RES({ ok: true, step: 'rehearsed', audience, chars: TEXT.length }); }
        else {
          await pg.locator(/\\[ref=(e\\d+)\\]/.exec(postLine)[1]).click();
          await sleep(11000);
          let onPage = null; let shareLabel = null; let stillOpen = null;
          try {
            stillOpen = await pg.evaluate(() => /게시물 설정/.test(document.body.innerText));
            await pg.goto(PAGE_URL);
            await sleep(8000);
            // 주의: 페이지의 '공유 대상: 전체 공개' 는 img 의 alt 라서 innerText 에는 안 나온다.
            //      화면 구조(snapshot)로 확인해야 한다.
            const t6 = await TREE();
            onPage = t6.includes(TEXT.slice(0, 15));
            shareLabel = (t6.match(/공유 대상: ?[^"]{0,20}/) || [])[0] || '';
          } catch (e) { onPage = 'check-failed'; }
          RES({ ok: true, step: 'posted', audience, onPage, shareLabel, dialogStillOpen: stillOpen });
        }
      }
    }
  }
}
`.trim();
}

// ---------- 개인 프로필 게시 ----------
function buildProfileJs({ text, audience, submit }) {
  const key = JSON.stringify(AUDIENCE_KEYS[audience] || AUDIENCE_KEYS.public);
  return `
${PRELUDE}
const TEXT = ${JSON.stringify(text)};
const WANT = ${key};
const MIND = /무슨 생각|What.s on your mind/i;
await pg.goto('https://www.facebook.com/');
await sleep(6000);

const seeComposer = () => pg.evaluate((re) => !![...document.querySelectorAll('*')].find(e => e.children.length === 0 && new RegExp(re).test(e.textContent || '')), MIND.source);
if (!(await P(seeComposer))) { RES({ ok: false, step: 'composer', msg: '작성창을 찾지 못함 — 로그인이 풀렸거나 화면 구조가 바뀜' }); }
else {
  await pg.evaluate((re) => { const r = new RegExp(re); const l = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && r.test(e.textContent || '')); const b = l && l.closest('[role="button"]'); if (b) b.click(); }, MIND.source);
  const dlgOk = await P(() => pg.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return !!(d && d.querySelector('[contenteditable="true"]')); }));
  if (!dlgOk) { RES({ ok: false, step: 'dialog', msg: '작성창이 열리지 않음' }); }
  else {
    const box = pg.locator('[role="dialog"] [contenteditable="true"]');
    await box.click();
    await box.fill(TEXT);
    const inBox = await pg.evaluate(() => { const d = document.querySelector('[role="dialog"]'); const c = d && d.querySelector('[contenteditable="true"]'); return c ? (c.innerText || c.textContent || '') : ''; });
    if (!inBox || !inBox.includes(TEXT.slice(0, 12))) { RES({ ok: false, step: 'type', msg: '본문 입력이 비었음' }); }
    else {
      if (!(await clickRef(/button "다음"/, 15))) { RES({ ok: false, step: 'next', msg: '다음 버튼을 찾지 못함' }); }
      else {
        await sleep(3500);
        // 공개범위 — 옵션 줄을 실제 마우스로 누른다 (JS click 은 반영되지 않았다)
        let audResult = 'panel-not-found';
        const refAud = await waitRef(/게시물 공개 대상/);
        if (refAud) {
          await pg.locator(refAud).click();
          let hit = false;
          for (let i = 0; i < 20 && !hit; i++) {
            const b = await pg.evaluate((k) => {
              const el = document.querySelector('input[type="radio"][name="' + k + '"]');
              if (!el) return null;
              const row = el.closest('label') || el.parentElement || el;
              const r = row.getBoundingClientRect();
              if (!r.width) return null;
              return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
            }, WANT);
            if (b) { await pg.mouse.click(b.x, b.y); await sleep(600); hit = true; }
            else await sleep(800);
          }
          const checked = await pg.evaluate((k) => { const el = document.querySelector('input[type="radio"][name="' + k + '"]'); return el ? el.checked : null; }, WANT);
          audResult = checked === true ? 'set' : 'not-applied(' + checked + ')';
          const refDone = await waitRef(/공개 대상 선택 완료/);
          if (refDone) { await pg.locator(refDone).click(); await sleep(1200); }
        }
        const postLine = (await TREE()).split('\\n').find((x) => /- button "(게시|Post)" \\[ref=/.test(x));
        if (!postLine) { RES({ ok: false, step: 'post-button', msg: '게시 버튼을 찾지 못함', audience: audResult }); }
        else if (!${submit}) { RES({ ok: true, step: 'rehearsed', audience: audResult, chars: TEXT.length }); }
        else {
          await pg.locator(/\\[ref=(e\\d+)\\]/.exec(postLine)[1]).click();
          await sleep(9000);
          let onProfile = null; let shareLabel = null; let stillOpen = null;
          try {
            stillOpen = await pg.evaluate(() => !!document.querySelector('[role="dialog"] [contenteditable="true"]'));
            await pg.goto('https://www.facebook.com/me');
            await sleep(7000);
            const r6 = await pg.evaluate((t) => {
              const b = document.body.innerText;
              const at = b.indexOf('공유 대상:');
              return { has: b.includes(t), share: at >= 0 ? b.slice(at, at + 24).split('\\n')[0] : '' };
            }, TEXT.slice(0, 18));
            onProfile = r6.has; shareLabel = r6.share;
          } catch (e) { onProfile = 'check-failed'; }
          RES({ ok: true, step: 'posted', audience: audResult, onProfile, shareLabel, dialogStillOpen: stillOpen });
        }
      }
    }
  }
}
`.trim();
}

// ---------- 자기 점검 ----------
function check() {
  const fails = [];
  const ok = (name, cond, extra = '') => {
    if (cond) console.log(`  OK   ${name}${extra ? ' — ' + extra : ''}`);
    else {
      console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`);
      fails.push(name);
    }
  };

  ok('Aside CLI 존재', existsSync(CLI), CLI);
  const queue = load(QUEUE_FILE, []);
  ok('대기열 있음', queue.length > 0, `${queue.length}건`);
  const state = load(STATE_FILE, {});
  const pagePending = queue.filter((i) => !(state[i.id] || {})[TARGETS.page]);
  ok('페이지에 올릴 글 있음', pagePending.length > 0, `${pagePending.length}건 남음`);
  const item = pagePending[0] || queue[0];
  ok('본문 길이 2200자 이하', item ? item.long.length <= 2200 : false, item ? `${item.long.length}자` : '');
  ok('페이지 id 지정됨', /profile\.php\?id=\d+/.test(PAGE_URL), PAGE_URL);
  ok('공개범위 키 매핑(프로필 모드)', AUDIENCE_KEYS.public === '-0' && AUDIENCE_LABEL['-0'] === '전체 공개', 'public=-0');

  const pageJs = buildPageJs({ text: 'test', submit: false });
  ok('페이지 코드 — 리허설 표시', pageJs.includes('rehearsed'));
  ok('페이지 코드 — 전환 경로 포함', pageJs.includes('지금 전환') && pageJs.includes('페이지 사용'));
  ok('페이지 코드 — 공개범위 라디오 안 건드림', !pageJs.includes('radio"][name='));
  ok('페이지 코드 — 기존 탭 재사용', pageJs.includes('attachBrowserTab'));
  const profJs = buildProfileJs({ text: 'test', audience: 'public', submit: false });
  ok('프로필 코드 — 마우스 클릭 경로', profJs.includes('mouse.click') && profJs.includes('waitRef'));

  if (existsSync(CLI)) {
    const r = parseResult(repl("const t = await listBrowserTabs(); console.log('RESULT ' + JSON.stringify({ ok: true, tabs: t.length }));"));
    ok('브라우저 응답', r.ok === true, r.ok ? `탭 ${r.tabs}개` : r.msg || '응답 없음');
  }
  console.log(fails.length ? `\n실패 ${fails.length}건: ${fails.join(' / ')}` : '\n전부 통과');
  process.exit(fails.length ? 1 : 0);
}

// ---------- 실행 ----------
const target = val('--target', 'page');
if (!TARGETS[target]) {
  console.log(`--target 은 ${Object.keys(TARGETS).join(' / ')} 중 하나여야 합니다.`);
  process.exit(1);
}
const CHANNEL = TARGETS[target];

const state = load(STATE_FILE, {});
const queue = load(QUEUE_FILE, []);

if (has('--check')) check();
else if (!queue.length) console.log('대기열이 비었습니다. 먼저 node tools/social-post.mjs --draft 를 돌리세요.');
else {
  const done = (i) => (state[i.id] || {})[CHANNEL];
  const pending = queue.filter((i) => !done(i));
  if (!pending.length) {
    console.log(`대기열 ${queue.length}건 모두 ${target} 채널에 이미 올렸습니다 (기록: tools/social-state.json).`);
    process.exit(0);
  }
  const max = Number(val('--max', 1));
  const audience = val('--audience', 'public');
  const which = val('--text', 'long');
  const only = val('--only', '');
  if (!AUDIENCE_KEYS[audience]) {
    console.log(`--audience 는 ${Object.keys(AUDIENCE_KEYS).join(' / ')} 중 하나여야 합니다.`);
    process.exit(1);
  }
  const pool = only ? pending.filter((i) => i.id === only) : pending;
  const target_items = pool.slice(0, max);
  if (!target_items.length) {
    console.log(`해당하는 글이 없습니다: ${only}`);
    process.exit(1);
  }
  if (has('--next')) {
    for (const i of target_items) console.log(`■ ${i.title}\n\n${i[which]}\n\n${'-'.repeat(50)}`);
    console.log(`남은 ${pending.length}건 / 전체 ${queue.length}건 (${target} 채널 기준)`);
    process.exit(0);
  }
  // ── 무인 실행 차단 ────────────────────────────────────────────
  // 브라우저를 여는 모드는 사람이 직접 확인하고 실행할 때만 허용한다.
  // 스케줄러로 돌아가는 회차는 stdin 이 TTY 가 아니므로 여기서 멈춘다.
  if (!process.stdin.isTTY) {
    console.log(
      `\n[차단] 무인 실행에서는 브라우저를 열 수 없습니다.\n` +
        `  사유: --rehearse / --post 는 사람이 터미널에서 확인하고 실행하는 모드이며,\n` +
        `        예약 자동 게시(무인 반복)는 계정 정지 위험을 키운다.\n` +
        `  대신:  node tools/social-draft.mjs        초안만 뽑아 사람이 직접 올린다.\n` +
        `  직접:  node tools/promo-browser.mjs --post --max 1   (이 창에서 직접 실행할 때만)\n`,
    );
    process.exit(2);
  }
  if (!existsSync(CLI)) {
    console.log(`Aside CLI 를 찾지 못했습니다: ${CLI}\nASIDE_CLI 환경변수로 경로를 지정할 수 있습니다.`);
    process.exit(1);
  }

  const submit = has('--post');
  console.log(
    `${submit ? '실제 게시' : '연습 (게시 안 함)'} · 대상 ${target === 'page' ? '한국노총 노동연대 페이지' : '개인 프로필(' + audience + ')'} · ${which} 문구 · ${target_items.length}건\n`,
  );
  let posted = 0;
  for (const item of target_items) {
    const text = item[which];
    console.log(`■ ${item.title} (${text.length}자)`);
    let res;
    try {
      res = parseResult(repl(target === 'page' ? buildPageJs({ text, submit }) : buildProfileJs({ text, audience, submit })));
    } catch (e) {
      res = { ok: false, step: 'run', msg: String(e.message).slice(0, 300) };
    }
    if (!res.ok) {
      console.log(`  실패 [${res.step}] ${res.msg || ''}`);
      continue;
    }
    if (res.step === 'rehearsed') {
      const a = target === 'page' ? res.audience : AUDIENCE_LABEL[AUDIENCE_KEYS[audience]];
      console.log(`  연습 통과 — 설정된 공개범위: ${res.audience === 'set' ? '반영됨' : a || '확인 못함'} · 게시 버튼 확인됨`);
    } else {
      const where = res.shareLabel ? `${target === 'page' ? '페이지' : '프로필'} 표시: ${res.shareLabel}` : '게시물 표시 확인 실패';
      console.log(`  게시함 — 공개범위 ${res.audience === 'set' ? '반영됨' : res.audience || ''}`);
      console.log(`  ${res[target === 'page' ? 'onPage' : 'onProfile'] === true ? '게시물 확인됨' : res[target === 'page' ? 'onPage' : 'onProfile'] === false ? '게시물 못 찾음(반영 지연 가능)' : res[target === 'page' ? 'onPage' : 'onProfile']} · ${where}`);
      if (res.shareLabel && !/전체 공개/.test(res.shareLabel)) console.log('  ⚠ 전체 공개가 아닙니다 — 확인 필요');
      state[item.id] = { ...(state[item.id] || {}), [CHANNEL]: new Date().toISOString() };
      writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
      posted++;
    }
  }
  console.log(
    submit
      ? `\n게시 ${posted}건 → tools/social-state.json (중복 방지 기록)`
      : '\n연습만 했습니다. 실제로 올리려면 --post 를 붙이세요.',
  );
}
