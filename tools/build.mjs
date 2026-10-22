// 배포 전에 돌릴 것들을 한 번에 — 순서가 중요해서 묶어 둔다.
// 사용: node tools/build.mjs   (배포는 이어서 node tools/deploy.mjs)
//
// 1) seo-tags      : 모든 페이지의 canonical·OG 카드·설명을 맞춘다
// 2) prerender     : 게시판·오피니언 목록을 초기 HTML 에 넣는다 (자바스크립트 없이도 보이게)
// 3) gen-sitemap   : sitemap.xml 을 실제 파일 목록에서 다시 만든다
// 4) gen-feed      : feed.xml 과 각 페이지의 RSS 링크를 맞춘다
// 5) check-links   : 깨진 내부 링크·잘못 광고된 주소가 있으면 여기서 멈춘다
import { spawnSync } from "node:child_process";

const STEPS = ["seo-tags.mjs", "prerender-posts.mjs", "gen-sitemap.mjs", "gen-feed.mjs", "check-links.mjs"];

for (const step of STEPS) {
  const r = spawnSync(process.execPath, [`tools/${step}`], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`\n실패: ${step} — 배포하지 마세요.`);
    process.exit(r.status ?? 1);
  }
}
console.log("\n빌드 완료. 배포: node tools/deploy.mjs");
