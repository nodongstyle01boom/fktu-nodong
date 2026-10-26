// Vercel 정적 배포(백업) — 프로젝트 fktu-nodong-v2 (도메인 fktu-nodong.vercel.app)
// 라이브 배포는 tools/deploy-pages.mjs 를 쓴다.
// 사용: VERCEL_TOKEN=... node tools/deploy.mjs
// 팀 스코프 토큰이면 그대로. 계정(Full Account) 스코프 토큰이면 VERCEL_TEAM=team_... 도 같이 넘긴다.
// 프로젝트 이름은 VERCEL_PROJECT 로 바꿀 수 있다(기본 fktu-nodong-v2).
// 2026-10-02: 구 프로젝트 prj_P4tHJiJGn8AFlgW9tdhimQlxUqY0 는 비공개 레거시 설정이 고착되어
// 빌드 컨테이너가 시작되지 않음(Resource provisioning failed). 신규 프로젝트로 이전함.
// ponytail: 빌드 없음. 파일을 그대로 올린다. Next.js 등으로 바뀌면 이 스크립트를 버리고 CLI를 쓸 것.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const TOKEN = process.env.VERCEL_TOKEN;
if (!TOKEN) throw new Error("VERCEL_TOKEN 환경변수가 필요합니다");

const PROJECT = process.env.VERCEL_PROJECT || "fktu-nodong-v2";
const ROOT = join(import.meta.dirname, "..");
const SKIP = new Set([".git", ".vercel", "node_modules", "tools", ".env.local", "README.md"]);
const API = "https://api.vercel.com";
const TEAM = process.env.VERCEL_TEAM;
const teamQS = TEAM ? `&teamId=${TEAM}` : "";
const statusQS = TEAM ? `?teamId=${TEAM}` : "";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// 이미지·폰트는 바이트 그대로 올려야 한다. utf8 로 읽으면 PNG 가 깨진다.
const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|pdf)$/i;
const files = walk(ROOT).map((p) => {
  const file = relative(ROOT, p).replace(/\\/g, "/");
  return BINARY.test(file)
    ? { file, data: readFileSync(p).toString("base64"), encoding: "base64" }
    : { file, data: readFileSync(p, "utf8") };
});
const binCount = files.filter((f) => f.encoding).length;
console.log(`업로드 파일 ${files.length}개 (바이너리 ${binCount}개)`);

const res = await fetch(`${API}/v13/deployments?forceNew=1${teamQS}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ name: PROJECT, target: "production", files }),
});
const dep = await res.json();
if (!res.ok) throw new Error(`배포 생성 실패: ${JSON.stringify(dep)}`);
console.log(`생성됨 ${dep.id} → https://${dep.url}`);

let state = dep.readyState;
for (let i = 0; i < 60 && state !== "READY" && state !== "ERROR"; i++) {
  await new Promise((r) => setTimeout(r, 3000));
  const r = await fetch(`${API}/v13/deployments/${dep.id}${statusQS}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  state = (await r.json()).readyState;
}
console.log(`상태: ${state}`);
if (state !== "READY") process.exit(1);
