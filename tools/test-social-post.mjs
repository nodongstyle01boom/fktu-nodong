// 게시 경로 자기 점검 — 토큰 없이, 네트워크 없이 실제 요청 모양을 확인한다.
//   node tools/test-social-post.mjs
//
// 진짜 서버 대신 로컬 모의서버를 띄우고 fetch 의 호스트만 갈아끼운다.
// 그래서 "텔레그램에 보낸 첨부/필드 이름이 맞나", "X 서명 헤더가 붙나",
// "블루스카이 facet 바이트 위치가 맞나" 같은 것을 실제 코드로 확인할 수 있다.
// 실제 게시 여부(계정 권한)는 이 파일로 알 수 없다 — 토큰을 넣고 한 번 돌려야 확인된다.

import { createServer } from 'node:http';
import { writeFileSync, rmSync, existsSync, readFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOLS = fileURLToPath(new URL('.', import.meta.url));
const ENV_FILE = join(TOOLS, 'social.env');
const TMP_ENV = join(TOOLS, '_test-social.env');

const LINK = 'https://nodong.seoulblue.com/articles/wage-arrears.html';
const TEXT = `임금체불 — 대응 순서와 신고 절차\n\n현장 소식입니다.\n${LINK}`;

const calls = [];
const server = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    calls.push({ method: req.method, url: req.url, auth: req.headers.authorization || '', body });
    const p = req.url;
    if (p.includes('createSession')) return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ accessJwt: 'JWT123', did: 'did:plc:test' }));
    if (p.startsWith('/bot')) return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true }));
    if (p.includes('/2/tweets')) return res.writeHead(201, { 'Content-Type': 'application/json' }).end(JSON.stringify({ data: { id: '1' } }));
    if (p.includes('/feed')) return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ id: '1_1' }));
    res.writeHead(204).end();
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

// 실제 fetch 를 감싸서 호스트만 모의서버로 바꾼다. 경로·헤더·본문은 그대로 흐른다.
const realFetch = globalThis.fetch;
const HOSTS = /^https:\/\/(api\.telegram\.org|discord\.com|bsky\.social|api\.twitter\.com|graph\.facebook\.com)/;
globalThis.fetch = (u, i) => realFetch(String(u).replace(HOSTS, `http://127.0.0.1:${port}`), i);

const hadEnv = existsSync(ENV_FILE);
if (hadEnv) copyFileSync(ENV_FILE, TMP_ENV + '.bak');
writeFileSync(
  TMP_ENV,
  [
    'TELEGRAM_BOT_TOKEN=TESTBOT',
    'TELEGRAM_CHAT_ID=-1001234',
    'DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/999/SECRET',
    'BSKY_HANDLE=test.bsky.social',
    'BSKY_APP_PASSWORD=app-pass',
    'X_API_KEY=ck',
    'X_API_SECRET=cs',
    'X_ACCESS_TOKEN=at',
    'X_ACCESS_SECRET=as',
    'FB_PAGE_ID=PAGE7',
    'FB_PAGE_TOKEN=fb-token',
    '',
  ].join('\n'),
);
process.env.SOCIAL_ENV = TMP_ENV;

const fails = [];
const ok = (name, cond) => {
  if (cond) console.log(`  OK   ${name}`);
  else {
    fails.push(name);
    console.log(`  FAIL ${name}`);
  }
};

try {
  const { senders } = await import('./social-post.mjs');
  const withFetch = async (name) => {
    const before = calls.length;
    const r = await senders[name](TEXT);
    const c = calls.slice(before);
    ok(`${name} 성공 반환`, r?.ok === true);
    return c;
  };

  const tg = await withFetch('telegram');
  ok('telegram 경로에 봇 토큰', tg[0]?.url === '/botTESTBOT/sendMessage');
  ok('telegram chat_id·text 전달', JSON.parse(tg[0].body).chat_id === '-1001234' && JSON.parse(tg[0].body).text === TEXT);

  const dc = await withFetch('discord');
  ok('discord 웹훅 경로 유지', dc[0]?.url === '/api/webhooks/999/SECRET');
  ok('discord content 전달', JSON.parse(dc[0].body).content === TEXT);

  const bs = await withFetch('bluesky');
  ok('bluesky 로그인 → 게시 2회 호출', bs.length === 2 && bs[0].url.includes('createSession') && bs[1].url.includes('createRecord'));
  ok('bluesky 로그인 비밀번호는 앱 비밀번호', JSON.parse(bs[0].body).password === 'app-pass');
  ok('블루스카이 게시는 Bearer 인증', bs[1].auth === 'Bearer JWT123');
  const rec = JSON.parse(bs[1].body);
  ok('블루스카이 repo=did, text 원문 그대로', rec.repo === 'did:plc:test' && rec.record.text === TEXT);
  const facet = rec.record.facets?.[0];
  ok('블루스카이 링크 facet 1개', rec.record.facets?.length === 1);
  ok('블루스카이 facet 시작 = 링크 앞 한글 바이트', facet?.index.byteStart === Buffer.byteLength(TEXT.slice(0, TEXT.indexOf(LINK))));
  ok('블루스카이 facet 끝 = 시작 + URL 바이트', facet?.index.byteEnd - facet?.index.byteStart === Buffer.byteLength(LINK));
  ok('블루스카이 facet 링크 종류', facet?.features?.[0]?.$type === 'app.bsky.richtext.facet#link');

  const x = await withFetch('x');
  ok('x 게시 엔드포인트', x[0]?.url === '/2/tweets' && x[0].method === 'POST');
  ok('x OAuth1 헤더 5개 키', ['oauth_consumer_key', 'oauth_nonce', 'oauth_signature', 'oauth_timestamp', 'oauth_token'].every((k) => x[0].auth.includes(k)));
  ok('x signature_method HMAC-SHA1', x[0].auth.includes('HMAC-SHA1'));
  ok('x 본문 text', JSON.parse(x[0].body).text === TEXT);

  const fb = await withFetch('facebook');
  ok('facebook 페이지 피드 경로', fb[0]?.url === '/v21.0/PAGE7/feed');
  ok('facebook message·access_token', JSON.parse(fb[0].body).message === TEXT && JSON.parse(fb[0].body).access_token === 'fb-token');

  console.log(fails.length ? `\n실패 ${fails.length}건: ${fails.join(' / ')}` : '\n전부 통과 (5채널 요청 모양 확인 · 실제 게시는 아님)');
} catch (e) {
  console.log(`\n오류: ${e.message}`);
  fails.push('실행 오류');
} finally {
  globalThis.fetch = realFetch;
  await new Promise((r) => server.close(r)); // process.exit 로 끊으면 윈도에서 libuv 오류가 난다
  rmSync(TMP_ENV, { force: true });
  if (hadEnv) {
    copyFileSync(TMP_ENV + '.bak', ENV_FILE);
    rmSync(TMP_ENV + '.bak', { force: true });
    console.log(`(기존 tools/social.env 는 그대로 둠 — ${readFileSync(ENV_FILE, 'utf8').split('\n').filter(Boolean).length}줄)`);
  }
  process.exitCode = fails.length ? 1 : 0;
}
