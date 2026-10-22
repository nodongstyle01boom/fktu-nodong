// Cloudflare Pages 정적 배포 — 프로젝트 fktu-nodong (도메인 nodong.seoulblue.com)
// 사용: node tools/deploy-pages.mjs
// 인증: `npx wrangler login` 으로 OAuth 로그인해 두면 토큰 없이도 배포된다(자동 갱신).
//      CI 등에서는 CLOUDFLARE_API_TOKEN=<토큰> 을 넘긴다(Cloudflare My Profile → API Tokens →
//      Account → Cloudflare Pages → Edit 로 발급).
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "1deac365f150448ef143a47a4a2b3db8";
const PROJECT = process.env.CF_PAGES_PROJECT || "fktu-nodong";
const ROOT = join(import.meta.dirname, "..");
const SKIP = new Set([".git", ".vercel", ".netlify", "node_modules", "tools", "README.md", ".vercelignore", ".gitignore"]);
const SKIP_EXT = /\.(docx|hwp|xlsx|xls|pem|key)$/i;

const stage = mkdtempSync(join(tmpdir(), "fktu-nodong-pages-"));
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

  execSync(
    `npx --yes wrangler pages deploy "${stage}" --project-name "${PROJECT}" --branch main --commit-dirty=true`,
    {
      stdio: "inherit",
      env: {
        ...process.env,
        CLOUDFLARE_ACCOUNT_ID: ACCOUNT,
        ...(TOKEN ? { CLOUDFLARE_API_TOKEN: TOKEN } : {}),
      },
    },
  );
} finally {
  rmSync(stage, { recursive: true, force: true });
}
