// 한국노총 노동연대 — 블로거(Google Blogger) 자동 발행 (Aside repl 경유)
//
// 왜 브라우저인가: Blogger 는 글 발행 API(v3)가 있지만 OAuth 클라이언트를 따로 만들어야 한다.
// 이미 로그인된 브라우저 화면을 그대로 누르면 토큰 없이도 발행된다. 크레딧 0 (aside repl 경로).
//
// 블로그: 한국노총 노동연대 · https://fktu-nodong.blogspot.com (Blogger id 3322947475780930115)
// 계정:   nodongstyle01@gmail.com
//
// 사용:
//   node tools/promo-blog.mjs --check          자기 점검
//   node tools/promo-blog.mjs --next           다음에 올라갈 글 보기 (브라우저 안 씀)
//   node tools/promo-blog.mjs --rehearse       연습 — 제목·본문까지 채우고 게시 안 함
//   node tools/promo-blog.mjs --post           실제 발행 (1건)
//
// ── 계정 정지 방지 원칙 (2026-09-19) ──────────────────────────────
// --rehearse / --post 는 사람이 붙어 있는 터미널에서만 동작한다.
// 스케줄러로 돌아가는 회차는 코드에서 거부한다(exit 2).
// 무인 반복 발행은 Google 계정과 블로그 모두에 위험 요소다.
// 무인 발행이 꼭 필요하면 공식 Blogger API(v3, OAuth)로 옮길 것 — social-setup.md 참고.
//
// 기록: tools/social-state.json 에 채널 'blog' 로 남긴다.
//
// ── 실측으로 확인한 것 (2026-09-18, Blogger 한국어 UI) ────────────────
//   - 새 블로그 만들기: 대시보드의 'Blog Selection' 목록상자 → '새 블로그...' → 제목 → 주소.
//     주의: '새 블로그...' 항목은 화면 밖(y=-99809)에 있다가 목록을 열면 살아난다 → 목록을 먼저 클릭할 것.
//   - 글 편집기 주소: /blog/post/edit/<blogId>/<postId>. 새 글은 대시보드의 '새 글 작성' 버튼으로 연다.
//     (/blog/post/edit/<blogId>/new 는 글로 리다이렉트되므로 쓰지 않는다.)
//   - 본문은 **iframe 안 contenteditable** 이다. 바깥 문서에는 contenteditable 이 없다.
//     다만 snapshot 은 iframe 안을 f2e1 같은 ref 로 내려주므로 읽기 확인에는 쓸 수 있다.
//     입력은 좌표 클릭 + keyboard.insertText 로 했다 (iframe 안이라 locator.fill 이 안 먹는다).
//   - 제목: input[aria-label="제목"] — 클릭 후 keyboard.insertText.
//   - 발행: 툴바 '게시' → alertdialog "글을 게시하시겠습니까?" → '확인'.
//   - 발행 후 확인: https://fktu-nodong.blogspot.com 본문에 제목·본문이 나온다.
//   - 지우기: 글 목록에서 그 줄에 마우스를 올려야 '휴지통으로 이동' 버튼이 나온다.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QUEUE_FILE = join(ROOT, 'tools', 'social-queue.json');
const STATE_FILE = join(ROOT, 'tools', 'social-state.json');
const CLI = process.env.ASIDE_CLI || join(process.env.LOCALAPPDATA || '', 'Aside', 'CLI', 'current', 'aside.exe');

const BLOG_ID = '3322947475780930115';
const BLOG_URL = 'https://fktu-nodong.blogspot.com/';
const CHANNEL = 'blog';

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

// ---------- 브라우저에서 돌릴 프로그램 ----------
function buildJs({ title, body, tags, publish }) {
  return `
const RES = (o) => console.log('RESULT ' + JSON.stringify(o));
const TREE = async () => (await snapshot(pg, { interactive: true })).tree;
const refOf = (tree, re) => { const l = tree.split('\\n').find((x) => re.test(x)); const m = l && /\\[ref=(f?\\w+)\\]/.exec(l); return m ? m[1] : null; };
const waitRef = async (re, n = 25) => { for (let i = 0; i < n; i++) { const r = refOf(await TREE(), re); if (r) return r; await sleep(800); } return null; };

const TITLE = ${JSON.stringify(title)};
const LINES = ${JSON.stringify(body.split('\n').filter((l) => l.trim() !== ''))};
const TAGS = ${JSON.stringify(tags || '')};

// 이미 열린 Blogger 탭을 재사용한다 (탭이 쌓이지 않게)
const tabs = await listBrowserTabs();
const found = tabs.find((t) => /blogger\\.com|blogspot\\.com/.test(t.url || ''));
const pg = found ? await attachBrowserTab(found.targetId) : await openTab('https://www.blogger.com/');

await pg.goto('https://www.blogger.com/blog/posts/${BLOG_ID}');
await sleep(8000);

const newRef = await waitRef(/button "새 글 작성"/);
if (!newRef) { RES({ ok: false, step: 'dashboard', msg: '대시보드에서 새 글 버튼을 찾지 못함 — 로그인 풀림 가능' }); }
else {
  await pg.locator(newRef).click();
  await sleep(11000);
  const hasTitle = await pg.evaluate(() => !![...document.querySelectorAll('input')].find((x) => (x.getAttribute('aria-label') || '') === '제목'));
  if (!hasTitle) { RES({ ok: false, step: 'editor', msg: '편집기가 열리지 않음' }); }
  else {
    // 1) 제목
    const tRef = await waitRef(/textbox "제목"/);
    await pg.locator(tRef).click();
    await sleep(400);
    await pg.keyboard.insertText(TITLE);
    await sleep(1200);

    // 2) 본문 — iframe 안 contenteditable 이라 좌표 클릭 + 키 입력으로 넣는다
    const rect = await pg.evaluate(() => {
      const f = [...document.querySelectorAll('iframe')].find((x) => !x.getAttribute('src'));
      if (!f) return null;
      const r = f.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    });
    if (!rect || rect.w < 200) { RES({ ok: false, step: 'body-frame', msg: '본문 입력 영역(iframe)을 찾지 못함' }); }
    else {
      await pg.mouse.click(rect.x + 60, rect.y + 40);
      await sleep(900);
      for (let i = 0; i < LINES.length; i++) {
        if (i) { await pg.keyboard.press('Enter'); await sleep(150); }
        await pg.keyboard.insertText(LINES[i]);
        await sleep(120);
      }
      await sleep(1500);

      // 3) 검증 — snapshot 이 iframe 안을 f2e1 ref 로 내려준다
      const bodySeen = await pg.evaluate(() => {
        const f = [...document.querySelectorAll('iframe')].find((x) => !x.getAttribute('src'));
        try { return (f.contentDocument.body.innerText || ''); } catch (e) { return 'ERR'; }
      });
      const inTitle = await pg.evaluate(() => { const i = [...document.querySelectorAll('input')].find((x) => (x.getAttribute('aria-label') || '') === '제목'); return i ? i.value : ''; });
      if (inTitle !== TITLE) { RES({ ok: false, step: 'title', msg: '제목이 입력되지 않음', got: inTitle.slice(0, 40) }); }
      else if (!bodySeen || !bodySeen.includes(LINES[0].slice(0, 10))) { RES({ ok: false, step: 'body', msg: '본문이 입력되지 않음', got: String(bodySeen).slice(0, 60) }); }
      else {
        // 4) 라벨(태그) — 입력칸이 보일 때만
        if (TAGS) {
          const tagBox = refOf(await TREE(), /textbox "쉼표로 라벨을 구분하세요/);
          if (tagBox) { try { await pg.locator(tagBox).click(); await pg.keyboard.insertText(TAGS); await sleep(800); } catch (e) {} }
        }
        // 5) 발행
        const pubRef = await waitRef(/- button "게시" \\[ref=/);
        if (!pubRef) { RES({ ok: false, step: 'publish-button', msg: '게시 버튼을 찾지 못함' }); }
        else if (!${publish}) { RES({ ok: true, step: 'rehearsed', titleChars: TITLE.length, bodyChars: bodySeen.length }); }
        else {
          await pg.locator(pubRef).click();
          await sleep(5000);
          const okRef = await waitRef(/- button "확인"/, 12);
          if (!okRef) { RES({ ok: false, step: 'confirm', msg: '게시 확인 대화상자가 뜨지 않음' }); }
          else {
            await pg.locator(okRef).click();
            await sleep(9000);
            let onBlog = null; let postUrl = null;
            try {
              const cur = await pg.url();
              const m = /\\/blog\\/post\\/edit\\/\\d+\\/(\\d+)/.exec(cur);
              postUrl = m ? 'https://fktu-nodong.blogspot.com/' + new Date().getFullYear() + '/' + String(new Date().getMonth() + 1).padStart(2, '0') + '/' + ('post-' + m[1]) + '.html' : null;
              await pg.goto('${BLOG_URL}');
              await sleep(7000);
              const b = await pg.evaluate(() => document.body.innerText);
              onBlog = b.includes(TITLE.slice(0, 12));
            } catch (e) { onBlog = 'check-failed'; }
            RES({ ok: true, step: 'published', onBlog, postUrl });
          }
        }
      }
    }
  }
}
`.trim();
}

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
  const state = load(STATE_FILE, {});
  ok('대기열 있음', queue.length > 0, `${queue.length}건`);
  const pending = queue.filter((i) => !(state[i.id] || {})[CHANNEL]);
  ok('블로그에 올릴 글 있음', pending.length > 0, `${pending.length}건 남음`);
  const item = pending[0] || queue[0];
  ok('제목 있음', !!(item && item.title), item ? item.title : '');
  ok('본문 있음', !!(item && item.long), item ? `${item.long.length}자` : '');
  ok('블로그 id 지정됨', /^\d+$/.test(BLOG_ID), BLOG_ID);
  const js = buildJs({ title: 't', body: 'a\nb', tags: '', publish: false });
  ok('코드 — iframe 입력 경로', js.includes('contentDocument') && js.includes('insertText'));
  ok('코드 — 발행 확인 경로', js.includes('button "확인"') && js.includes('게시'));
  ok('코드 — 리허설 표시', js.includes('rehearsed'));
  ok('코드 — 기존 탭 재사용', js.includes('attachBrowserTab'));
  ok('제목·본문 줄바꿈 처리', buildJs({ title: 't', body: 'x\ny\n\nz', tags: '', publish: false }).includes('["x","y","z"]'));
  if (existsSync(CLI)) {
    const r = parseResult(repl("const t = await listBrowserTabs(); console.log('RESULT ' + JSON.stringify({ ok: true, tabs: t.length }));"));
    ok('브라우저 응답', r.ok === true, r.ok ? `탭 ${r.tabs}개` : r.msg || '응답 없음');
  }
  console.log(fails.length ? `\n실패 ${fails.length}건: ${fails.join(' / ')}` : '\n전부 통과');
  process.exit(fails.length ? 1 : 0);
}

const state = load(STATE_FILE, {});
const queue = load(QUEUE_FILE, []);

if (has('--check')) check();
else if (!queue.length) console.log('대기열이 비었습니다. 먼저 node tools/social-post.mjs --draft 를 돌리세요.');
else {
  const pending = queue.filter((i) => !(state[i.id] || {})[CHANNEL]);
  if (!pending.length) {
    console.log(`대기열 ${queue.length}건 모두 블로그에 이미 올렸습니다 (기록: tools/social-state.json).`);
    process.exit(0);
  }
  const max = Number(val('--max', 1));
  const only = val('--only', '');
  const pool = only ? pending.filter((i) => i.id === only) : pending;
  const targets = pool.slice(0, max);
  if (!targets.length) {
    console.log(`해당하는 글이 없습니다: ${only}`);
    process.exit(1);
  }
  if (has('--next')) {
    for (const i of targets) console.log(`■ ${i.title}\n\n${i.long}\n\n${'-'.repeat(50)}`);
    console.log(`남은 ${pending.length}건 / 전체 ${queue.length}건 (블로그 기준)`);
    process.exit(0);
  }
  // ── 무인 실행 차단 (2026-09-19) ─────────────────────────────────
  if (!process.stdin.isTTY) {
    console.log(
      `\n[차단] 무인 실행에서는 브라우저를 열 수 없습니다.\n` +
        `  사유: --rehearse / --post 는 사람이 확인하고 실행하는 모드이며,\n` +
        `        예약 자동 발행은 계정 정지 위험을 키운다.\n` +
        `  대신:  node tools/social-draft.mjs        초안만 뽑아 사람이 직접 올린다.\n` +
        `  직접:  node tools/promo-blog.mjs --post --max 1   (이 창에서 직접 실행할 때만)\n`,
    );
    process.exit(2);
  }
  if (!existsSync(CLI)) {
    console.log(`Aside CLI 를 찾지 못했습니다: ${CLI}\nASIDE_CLI 환경변수로 경로를 지정할 수 있습니다.`);
    process.exit(1);
  }

  const publish = has('--post');
  console.log(`${publish ? '실제 발행' : '연습 (발행 안 함)'} · 대상 블로그 fktu-nodong.blogspot.com · ${targets.length}건\n`);
  let done = 0;
  for (const item of targets) {
    // 본문: 요약 설명 + 전체 안내 + 출처 링크. 블로그는 길이 제한이 없어 문구를 그대로 쓴다.
    const body = `${item.desc || ''}\n\n${item.long}`.trim();
    console.log(`■ ${item.title} (본문 ${body.length}자)`);
    let res;
    try {
      res = parseResult(repl(buildJs({ title: item.title, body, tags: '노동 지식,한국노총 노동연대', publish })));
    } catch (e) {
      res = { ok: false, step: 'run', msg: String(e.message).slice(0, 300) };
    }
    if (!res.ok) {
      console.log(`  실패 [${res.step}] ${res.msg || ''}${res.got ? ' / 입력된 값: ' + res.got : ''}`);
      continue;
    }
    if (res.step === 'rehearsed') {
      console.log(`  연습 통과 — 제목 ${res.titleChars}자 · 본문 ${res.bodyChars}자 입력 확인 (발행 안 함)`);
    } else {
      console.log(`  발행함 — ${res.onBlog === true ? '블로그에서 제목 확인됨' : res.onBlog === false ? '블로그에서 제목 못 찾음(반영 지연 가능)' : res.onBlog}`);
      if (res.postUrl) console.log(`  주소: ${res.postUrl}`);
      state[item.id] = { ...(state[item.id] || {}), [CHANNEL]: new Date().toISOString() };
      writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
      done++;
    }
  }
  console.log(publish ? `\n발행 ${done}건 → tools/social-state.json (중복 방지 기록)` : '\n연습만 했습니다. 실제로 올리려면 --post 를 붙이세요.');
}
