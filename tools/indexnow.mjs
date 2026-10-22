// IndexNow — 변경된 URL 을 검색엔진에 즉시 알려 색인을 앞당긴다(네이버·빙·야네덥 지원).
// 사용: node tools/indexnow.mjs
// 키 파일은 사이트 루트에 있어야 한다(예: <key>.txt 에 키 문자열).
// ponytail: 서명 없이 키 파일 조회만 확인하는 아주 단순한 방식. 손님이 많으면 서명 방식(키+HMAC)으로 바꾸면 된다.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const HOST = process.env.INDEXNOW_HOST || "https://nodong.seoulblue.com";
const ENDPOINT = process.env.INDEXNOW_ENDPOINT || "https://api.indexnow.org/indexnow";

// 키 파일 찾기: 루트의 32자리 hex .txt
const keyFile = readdirSync(ROOT).find((f) => /^[a-f0-9]{32}\.txt$/i.test(f));
if (!keyFile) throw new Error("IndexNow 키 파일(32자리 hex .txt)이 없습니다.");
const key = readFileSync(join(ROOT, keyFile), "utf8").trim();

const xml = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urls.length) throw new Error("sitemap.xml 에 URL 이 없습니다.");

const res = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: HOST.replace(/^https?:\/\//, ""),
    key,
    keyLocation: `${HOST}/${keyFile}`,
    urlList: urls,
  }),
});
const body = await res.text();
console.log(`IndexNow 전송 — ${urls.length}개 URL · HTTP ${res.status} · ${body.slice(0, 200)}`);
