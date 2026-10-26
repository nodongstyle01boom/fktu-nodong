// Netlify 정적 배포 — 백업용(라이브는 Cloudflare Pages).
// 사용: node tools/deploy-netlify.mjs
// 로그인: netlify login (브라우저 OAuth). 상태 확인: netlify status
// 프로젝트: fktu-nodong-backup → https://fktu-nodong-backup.netlify.app
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const ROOT = join(import.meta.dirname, "..");
const SITE = process.env.NETLIFY_SITE_ID || "6697e72b-ff7e-4f26-a03e-3e8940cced06";
const SKIP = new Set([".git", ".vercel", ".netlify", "node_modules", "tools", "README.md", ".vercelignore", ".gitignore"]);
const SKIP_EXT = /\.(docx|hwp|xlsx|xls|pem|key)$/i;

const stage = mkdtempSync(join(tmpdir(), "fktu-nodong-netlify-"));
try {
  cpSync(ROOT, stage, {
    recursive: true,
    filter: (src) => {
      const rel = src.slice(ROOT.length + 1).replace(/\\/g, "/");
      if (!rel) return true;
      const top = rel.split("/")[0];
      if (SKIP.has(top) || top.startsWith(".env")) return false;
      return !SKIP_EXT.test(rel);
    },
  });

  // 백업 미러는 색인되면 중복 콘텐츠가 되므로 noindex 로 막는다(라이브는 Pages 배포라 영향 없음).
  writeFileSync(
    join(stage, "netlify.toml"),
    [
      "[[headers]]",
      '  for = "/*"',
      "  [headers.values]",
      '    X-Robots-Tag = "noindex, nofollow"',
      "",
    ].join("\n"),
    "utf8",
  );

  execSync(`netlify deploy --dir="." --prod --site="${SITE}" --message="backup deploy"`, {
    stdio: "inherit",
    cwd: stage,
  });
} finally {
  // netlify CLI 가 잠시 잡고 있는 파일 때문에 지워지지 않을 수 있어 재시도한다.
  try {
    rmSync(stage, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  } catch {
    console.log(`스테이징 정리 실패(무시): ${stage}`);
  }
}
