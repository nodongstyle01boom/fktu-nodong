# Vercel 지원 티켓 초안 (2026-10-02)

접수처: https://vercel.com/help → Contact Support (또는 대시보드 우측 Help → Support)
구분: Build / Deploy 문제
아래 [제목]과 [본문]을 그대로 붙여넣으세요. 답변은 계정 이메일(worldculture0825@gmail.com)로 옵니다.

---

## [제목]

Stuck legacy backend settings on prj_P4tHJiJGn8AFlgW9tdhimQlxUqY0 — all builds fail with "Resource provisioning failed"

## [본문]

Hello Vercel Support,

All deployments for one of my projects started failing with "Resource provisioning failed" (BUILD_FAILED) before the build container ever starts. The project has since been deleted, so I am not asking for a restore — I would like to know the root cause so I can prevent it from happening to my other projects.

**Account / project**
- Team: worldculture0825-2848 (team_3HoUweM4zrGrTm1lCaxrYjpI) — Hobby plan
- Project: fktu-nodong (prj_P4tHJiJGn8AFlgW9tdhimQlxUqY0)
- Account email: worldculture0825@gmail.com
- First failure: 2026-10-02 05:51 UTC
- Last successful deployment: 2026-09-24 (READY)

**Symptom**
Every deployment fails identically: errorCode `BUILD_FAILED`, errorMessage `Resource provisioning failed`, ~0 ms build duration, and no build logs at all (the build container never starts). Failed deployment IDs:

- dpl_2tV1SsGVBPQGiBxqUuvefKSftmsL
- dpl_6zz2qGoXgBzxm5CwQVFnLwAFXBXj
- dpl_J9SCZvRKaZ6JxeumMyYuRXJnHkVx
- dpl_7SnaUfYjxXc8eCjffMhFS4V1twer (preview target)

**What I already tried (behavior unchanged)**
1. Deployed via the Vercel CLI, via the Deployments REST API (static files), and via the GitHub integration — identical failure in all three paths.
2. Cleared the plan-incompatible resource settings through the public project PATCH API:
   - `resourceConfig.fluid`: true → false
   - `functionDefaultTimeout`: 300 → 10
   - `ssoProtection`: disabled
   Current `resourceConfig` is now `{ "fluid": false, "functionDefaultRegions": ["iad1"], "buildMachineType": "basic", "buildMachineSelection": "fixed" }`.
3. Created a brand-new project on the same account with the same default resource settings and deployed a static site to it — it went READY immediately. So the account, token and files are fine; only this project is affected.

This matches the "stuck legacy backend settings" case described here (settings like `isUsingActiveCPU` / `SKIP_NAMESPACE_QUEUE` that are not exposed in the public API):
https://community.vercel.com/t/hobby-project-stuck-on-resource-provisioning-failed-legacy-backend-settings/42915

**Request**
Could you please check the build/provisioning logs of the failed deployments above and tell me which stuck backend setting caused this (e.g. the `isUsingActiveCPU` / `SKIP_NAMESPACE_QUEUE` case above), and what I should avoid configuring so it does not recur on my remaining projects?

Note: there was no user-facing outage — the production domain was moved to a new project (fktu-nodong-v2) before I deleted the broken one. This is not urgent; the goal is purely to understand the root cause and prevent a recurrence.

Thank you,
Site admin — worldculture0825-2848

---

## 메모

- 2026-10-02: 구 프로젝트는 폐기 완료(prj_WUsBK4YXEtyS8tyjYnlBkI3lwfGE 로 이전 후 삭제). 따라서 이 티켓은 **복구 요청이 아닌 원인 확인·재발 방지**용.

## 붙여넣기 전 체크

- [ ] 티켓에 토큰·비밀번호는 절대 넣지 않기 (위 초안에도 없음 — 그대로 붙여넣어도 안전)
- [ ] 첨부가 요구되면: 실패 화면 스크린샷(대시보드 Deployments 목록) — 빌드 로그는 어차피 비어 있음
