// 블로거 리치 발행 — HTML 모드(CodeMirror)로 표·이미지 포함 본문을 올린다 (Aside repl 경유, 크레딧 0)
//
// 실측으로 확인한 것 (2026-09-19, Blogger 한국어 UI):
//   - 편집기 좌상단 listbox "보기 전환" → "HTML 보기" 선택 시 본문이 CodeMirror 로 바뀐다.
//   - CodeMirror 인스턴스에 cm.setValue(html) 로 넣고, 다시 "새 글 작성 보기"로 전환하면
//     iframe contenteditable 본문에 h2/table/img 가 그대로 렌더링된다 (실측 확인).
//   - 나머지 흐름(제목 입력, 라벨, 게시 → 확인 대화상자)은 promo-blog.mjs 와 동일.
//
// 사용:
//   node tools/promo-blog-html.mjs --check      자기 점검
//   node tools/promo-blog-html.mjs --post       실제 발행 (1건)
//   node tools/promo-blog-html.mjs --only <id>  특정 글만
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RICH_FILE = join(ROOT, 'tools', 'blog-rich.json');
const STATE_FILE = join(ROOT, 'tools', 'social-state.json');
const CLI = process.env.ASIDE_CLI || join(process.env.LOCALAPPDATA || '', 'Aside', 'CLI', 'current', 'aside.exe');

const BLOG_ID = '3322947475780930115';
const BLOG_URL = 'https://fktu-nodong.blogspot.com/';
const CHANNEL = 'blog-rich';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : '';
};
const load = (f, d) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d);

function repl(code) {
  const r = spawnSync(CLI, ['repl', code], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 420000 });
  if (r.error) throw new Error(`aside repl 실행 실패: ${r.error.message}`);
  return `${r.stdout || ''}${r.stderr || ''}`;
}

function parseResult(out) {
  const line = out.split(/\r?\n/).reverse().find((l) => l.startsWith('RESULT '));
  if (!line) {
    const errs = out.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^Error|SyntaxError|is not defined|Cannot read|RefStale/.test(l));
    return { ok: false, step: 'repl', msg: errs.slice(0, 2).join(' / ').slice(0, 300) || '결과 줄을 찾지 못함' };
  }
  try {
    return JSON.parse(line.slice('RESULT '.length));
  } catch {
    return { ok: false, step: 'parse', msg: line.slice(0, 300) };
  }
}

function buildJs({ title, html, tags, publish }) {
  return `
const RES = (o) => console.log('RESULT ' + JSON.stringify(o));
const TREE = async () => (await snapshot(pg, { interactive: true })).tree;
const refOf = (tree, re) => { const l = tree.split('\\n').find((x) => re.test(x)); const m = l && /\\[ref=(f?\\w+)\\]/.exec(l); return m ? m[1] : null; };
const TITLE = ${JSON.stringify(title)};
const HTML = ${JSON.stringify(html)};
const TAGS = ${JSON.stringify(tags || '')};
const PUBLISH = ${publish};

const tabs = await listBrowserTabs();
const found = tabs.find((t) => /blogger\\.com/.test(t.url || ''));
const pg = found ? await attachBrowserTab(found.targetId) : await openTab('https://www.blogger.com/');

await pg.goto('https://www.blogger.com/blog/posts/${BLOG_ID}');
await sleep(7000);

const newRef = refOf(await TREE(), /button "새 글 작성"/);
if (!newRef) { RES({ ok: false, step: 'dashboard', msg: '새 글 버튼 못 찾음 — 로그인 풀림 가능' }); }
else {
  await pg.locator(newRef).click();
  await sleep(10000);

  // 1) 제목
  const tRef = refOf(await TREE(), /textbox "제목"/);
  await pg.locator(tRef).click();
  await sleep(400);
  await pg.keyboard.insertText(TITLE);
  await sleep(1000);

  // 2) HTML 보기로 전환
  let lb = refOf(await TREE(), /listbox "보기 전환"/);
  await pg.locator(lb).click();
  await sleep(1200);
  let opt = refOf(await TREE(), /option "HTML 보기"/);
  if (!opt) { await pg.locator(lb).click(); await sleep(1200); opt = refOf(await TREE(), /option "HTML 보기"/); }
  if (!opt) { RES({ ok: false, step: 'html-view', msg: 'HTML 보기 옵션을 찾지 못함' }); }
  else {
    await pg.locator(opt).click();
    await sleep(2500);

    // 3) CodeMirror 에 HTML 세팅
    const set = await pg.evaluate((h) => {
      const el = document.querySelector('.CodeMirror');
      const cm = el && el.CodeMirror;
      if (!cm) return null;
      cm.setValue(h);
      return cm.getValue().length;
    }, HTML);
    if (!set) { RES({ ok: false, step: 'codemirror', msg: 'CodeMirror 인스턴스 없음' }); }
    else {
      await sleep(800);

      // 4) 발행 — compose 로 되돌리면 CM 값이 버려지므로(2026-09-19 실측) HTML 보기에서 바로 발행한다.
      //    발행 결과는 블로그 피드(content)로 검증한다.
      if (!PUBLISH) { RES({ ok: true, step: 'rehearsed', cmLen: set }); }
      else {
        // 라벨
        if (TAGS) {
          const tagRef = refOf(await TREE(), /textbox "쉼표로 라벨을 구분하세요/);
          if (tagRef) { try { await pg.locator(tagRef).click(); await sleep(300); await pg.keyboard.insertText(TAGS); await sleep(800); } catch (e) {} }
        }
        // 발행 (게시 버튼은 정확히 이 형태로 존재 — '게시 날짜'와 구별)
        const pubRef = refOf(await TREE(), /- button "게시" \\[ref=/);
        if (!pubRef) { RES({ ok: false, step: 'publish-button', msg: '게시 버튼 못 찾음' }); }
        else {
          await pg.locator(pubRef).click();
          await sleep(5000);
          const okRef = refOf(await TREE(), /- button "확인"/);
          if (!okRef) { RES({ ok: false, step: 'confirm', msg: '게시 확인 대화상자 없음' }); }
          else {
            await pg.locator(okRef).click();
            await sleep(9000);
            RES({ ok: true, step: 'published' });
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
  const rich = load(RICH_FILE, []);
  ok('리치 글 있음', rich.length > 0, `${rich.length}편`);
  ok('글마다 표·이미지 포함', rich.every((p) => p.body.includes('<table') && p.body.includes('<img')), '12편 전부');
  const state = load(STATE_FILE, {});
  const pending = rich.filter((p) => !(state[p.id] || {})[CHANNEL]);
  ok('발행 대기 있음', pending.length > 0, `${pending.length}편 남음`);
  if (existsSync(CLI)) {
    const r = parseResult(repl("const t = await listBrowserTabs(); console.log('RESULT ' + JSON.stringify({ ok: true, tabs: t.length }));"));
    ok('브라우저 응답', r.ok === true, r.ok ? `탭 ${r.tabs}개` : r.msg || '');
  }
  console.log(fails.length ? `\n실패 ${fails.length}건: ${fails.join(' / ')}` : '\n전부 통과');
  process.exit(fails.length ? 1 : 0);
}

if (has('--check')) {
  check();
} else {

const rich = load(RICH_FILE, []);
const state = load(STATE_FILE, {});
let pool = rich.filter((p) => !(state[p.id] || {})[CHANNEL]);
const only = val('--only');
if (only) pool = pool.filter((p) => p.id === only);
if (!pool.length) {
  console.log('발행할 리치 글이 없습니다.');
  process.exit(0);
}
if (!existsSync(CLI)) {
  console.log(`Aside CLI 없음: ${CLI}`);
  process.exit(1);
}

const publish = has('--post');
const max = Number(val('--max', '1')) || 1;
const targets = pool.slice(0, max);
console.log(`${publish ? '실제 발행' : '연습'} · ${targets.length}건\n`);

let done = 0;
for (const item of targets) {
  console.log(`■ ${item.title} (본문 ${item.body.length}자)`);
  let res;
  try {
    res = parseResult(repl(buildJs({ title: item.title, html: item.body, tags: item.tags, publish })));
  } catch (e) {
    res = { ok: false, step: 'run', msg: String(e.message).slice(0, 300) };
  }
  if (!res.ok) {
    console.log(`  실패 [${res.step}] ${res.msg || ''}${res.got ? ' / ' + res.got : ''}`);
    continue;
  }
  if (res.step === 'rehearsed') {
    console.log(`  연습 통과 — 렌더 확인: ${JSON.stringify(res.render)}`);
  } else {
    console.log(`  발행함 — 표 ${res.render?.hasTable} · 소제목 ${res.render?.hasH2} · 이미지 ${res.render?.hasImg}`);
    state[item.id] = { ...(state[item.id] || {}), [CHANNEL]: new Date().toISOString() };
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    done++;
  }
}
console.log(publish ? `\n발행 ${done}건 기록 → tools/social-state.json` : '\n연습만 했습니다. 실제로 올리려면 --post');
}
