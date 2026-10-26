// 블루스카이 계정 생성 도구 — 무료 자동 게시 채널을 직접 만든다
//
// 블루스카이는 무료로 게시 API 를 쓸 수 있어서(X 와 달리) 홍보 자동화에 실제로 쓸 수 있는 채널이다.
// 이 스크립트가 하는 일:
//   1) 계정 생성 (이메일 인증 메일 발송)
//   2) 인증 코드 확인 (confirm)
//   3) 앱 비밀번호 발급 → tools/social.env 에 자동 기록
//   4) 실제 게시 1건으로 검증 (--test)
//
// 사용:
//   node tools/create-bluesky.mjs --create --email a@gmail.com --handle fktu-nodong.bsky.social
//   node tools/create-bluesky.mjs --confirm --email a@gmail.com --code 123456
//   node tools/create-bluesky.mjs --app-password
//   node tools/create-bluesky.mjs --test
//
// 생성한 비밀번호는 tools/bluesky-account.json 에 저장된다 (저장소에 안 올라감).
// 핸들은 이미 누가 쓰면 실패한다 → --handle 로 다른 이름을 주면 된다.

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ACC_FILE = join(ROOT, 'tools', 'bluesky-account.json');
const ENV_FILE = join(ROOT, 'tools', 'social.env');
const PDS = 'https://bsky.social';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const load = (f, d) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d);
const save = (f, o) => writeFileSync(f, JSON.stringify(o, null, 2));

async function xrpc(method, body, token) {
  const r = await fetch(`${PDS}/xrpc/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body || {}),
  });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  if (!r.ok) throw new Error(`${method} ${r.status} ${json.error || ''} ${json.message || json.raw || ''}`.trim());
  return json;
}

// 앱 비밀번호를 social.env 에 기록 (이미 있으면 갱신)
function writeEnv(handle, appPassword) {
  const pairs = { BSKY_HANDLE: handle, BSKY_APP_PASSWORD: appPassword };
  let lines = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8').split(/\r?\n/) : ['# 한국노총 노동연대 홍보 채널 토큰 (저장소에 올리지 말 것)'];
  for (const [k, v] of Object.entries(pairs)) {
    const i = lines.findIndex((l) => l.startsWith(`${k}=`));
    if (i >= 0) lines[i] = `${k}=${v}`;
    else lines.push(`${k}=${v}`);
  }
  writeFileSync(ENV_FILE, lines.join('\n').replace(/\n*$/, '\n'));
}

if (has('--create')) {
  const email = val('--email');
  const handle = val('--handle');
  const birthDate = val('--birthdate', '1980-01-01');
  if (!email || !handle) {
    console.log('--email 과 --handle 이 필요합니다.');
    process.exit(1);
  }
  const password = `Fktu-${randomBytes(6).toString('base64url')}!7`;
  try {
    const res = await xrpc('com.atproto.server.createAccount', { email, password, handle, birthDate });
    save(ACC_FILE, { email, handle: res.handle, did: res.did, password });
    console.log(`계정 생성됨: ${res.handle} (${res.did})`);
    console.log('인증 메일 발송됨 → Gmail 에서 6자리 코드를 찾아 --confirm 으로 넘겨주세요.');
  } catch (e) {
    console.log('생성 실패:', e.message);
    console.log('핸들이 이미 사용 중이면 --handle 다른이름.bsky.social 로 다시 실행하세요.');
    process.exit(1);
  }
} else if (has('--confirm')) {
  const acc = load(ACC_FILE, {});
  const email = val('--email', acc.email);
  const code = val('--code');
  if (!code) {
    console.log('--code 6자리가 필요합니다.');
    process.exit(1);
  }
  try {
    await xrpc('com.atproto.server.confirmEmail', { email, token: code });
    console.log('이메일 인증 완료');
  } catch (e) {
    console.log('인증 실패:', e.message);
    process.exit(1);
  }
} else if (has('--app-password')) {
  const acc = load(ACC_FILE, {});
  if (!acc.handle || !acc.password) {
    console.log('먼저 --create 를 실행하세요.');
    process.exit(1);
  }
  const ses = await xrpc('com.atproto.server.createSession', { identifier: acc.handle, password: acc.password });
  const app = await xrpc('com.atproto.server.createAppPassword', { name: 'auto-post' }, ses.accessJwt);
  acc.appPassword = app.password;
  acc.appPasswordName = app.name;
  save(ACC_FILE, acc);
  writeEnv(acc.handle, app.password);
  console.log(`앱 비밀번호 발급: ${app.password}`);
  console.log(`tools/social.env 에 BSKY_HANDLE / BSKY_APP_PASSWORD 기록 완료`);
} else if (has('--test')) {
  const acc = load(ACC_FILE, {});
  const envText = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '';
  const handle = acc.handle || (/BSKY_HANDLE=(.+)/.exec(envText) || [])[1];
  const appPw = acc.appPassword || (/BSKY_APP_PASSWORD=(.+)/.exec(envText) || [])[1];
  if (!handle || !appPw) {
    console.log('핸들/앱 비밀번호가 없습니다. --create → --app-password 를 먼저 실행하세요.');
    process.exit(1);
  }
  const ses = await xrpc('com.atproto.server.createSession', { identifier: handle, password: appPw });
  const text = `한국노총 노동연대 홍보 채널 개설\n현장 소식과 노동 기초 지식을 정리해 올립니다.\nhttps://nodong.seoulblue.com`;
  const started = new Date().toISOString();
  const res = await xrpc('com.atproto.repo.createRecord', {
    repo: ses.did,
    collection: 'app.bsky.feed.post',
    record: { $type: 'app.bsky.feed.post', text, facets: null, createdAt: started },
  }, ses.accessJwt);
  const uri = res.uri || '';
  const rkey = uri.split('/').pop();
  console.log(`게시 성공: ${uri}`);
  // 실제로 공개 조회가 되는지 확인
  const post = `https://bsky.app/profile/${ses.handle}/post/${rkey}`;
  const view = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}`).then((r) => r.json()).catch(() => null);
  console.log(`공개 조회: ${view && view.thread && view.thread.post ? '확인됨' : '확인 실패'}`);
  console.log(`주소: ${post}`);
  appendFileSync(join(ROOT, 'tools', 'bluesky-account.json'), '');
  save(ACC_FILE, { ...load(ACC_FILE, {}), testUri: uri, testAt: started, lastPostUrl: post });
} else {
  console.log('사용: --create | --confirm | --app-password | --test  (자세한 설명은 파일 머리말)');
}
