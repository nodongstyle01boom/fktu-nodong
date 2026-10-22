// linkify 자체 점검 — 사용: node tools/test-linkify.mjs
// ponytail: 프레임워크 없이 assert 만. 게시판 본문 링크 규칙이 늘어나면 여기에 케이스를 더할 것.
import assert from "node:assert/strict";
import { linkify, esc } from "../js/site.js";

const L = (s) => linkify(esc(s));

// 1) 주소가 없으면 그대로
assert.equal(L("주소 없음"), "주소 없음");

// 2) 본문 속 주소 → 링크
assert.equal(
  L("주소: https://nodong.seoulblue.com"),
  '주소: <a href="https://nodong.seoulblue.com" target="_blank" rel="noopener noreferrer">https://nodong.seoulblue.com</a>'
);

// 3) 마침표·괄호는 링크 밖으로
assert.equal(L("https://a.com."), '<a href="https://a.com" target="_blank" rel="noopener noreferrer">https://a.com</a>.');
assert.equal(L("(https://a.com)"), '(<a href="https://a.com" target="_blank" rel="noopener noreferrer">https://a.com</a>)');

// 4) http/https 만 — 다른 스킴은 링크로 만들지 않는다
assert.equal(L("javascript:alert(1)"), "javascript:alert(1)");
assert.equal(L("mailto:fktu-nodong@gmail.com"), "mailto:fktu-nodong@gmail.com");

// 5) http:// 단독은 링크 아님
assert.equal(L("http://"), "http://");

// 6) esc 를 먼저 하므로 태그가 되살아나지 않는다 (XSS 방지)
const xss = L('<img src=x onerror="alert(1)"> https://a.com');
assert.ok(!xss.includes("<img"), "esc 결과가 태그로 살아나면 안 됨");
assert.ok(xss.includes("&lt;img"), "태그는 이스케이프된 채 남아야 함");
assert.ok(xss.includes('href="https://a.com"'), "주소는 링크가 되어야 함");

// 7) 쿼리스트링의 & 는 esc 후 &amp; 로 남고, 앵커 안에서는 정상 복원된다
const q = L("https://a.com/x?a=1&b=2");
assert.ok(q.includes('href="https://a.com/x?a=1&amp;b=2"'), q);

// 8) 여러 개도 각각 처리
assert.equal((L("a https://a.com b http://b.com").match(/<a /g) || []).length, 2);

console.log("linkify 자체 점검 8종 통과");
