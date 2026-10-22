@echo off
chcp 65001 > nul
rem ────────────────────────────────────────────────────────────────
rem  한국노총 노동연대 — 일일 홍보 러너 (작업 스케줄러가 부르는 파일)
rem
rem  2026-09-19 변경 — 무인 브라우저 자동 게시를 전부 중단했다.
rem  사유: 매일 같은 시각에 같은 문장으로 자동 게시하는 패턴이 계정 정지
rem        (봇 탐지)의 가장 흔한 원인이다. 사람 로그인 세션을 자동 조작하면
rem        공식 API 경로보다 위험 요소가 훨씬 많다.
rem        promo-browser.mjs / promo-blog.mjs 는 사람이 직접 실행할 때만
rem        동작하도록 TTY 가드를 걸어 뒀다(무인 실행이면 exit 2).
rem
rem  이제 이 러너가 하는 일:
rem    1) X·스레드·인스타그램 초안만 만든다 (tools/social-outbox/)
rem       → 사람이 복사해서 직접 올린다. 이 러너는 브라우저를 열지 않는다.
rem    2) 공식 API 가 붙은 채널(텔레그램·디스코드·블루스카이·페이스북 페이지)
rem       에만 자동 게시한다. 이쪽은 플랫폼이 허용한 경로다.
rem
rem  초안 확인 : node tools\social-draft.mjs
rem  올린 뒤 기록: node tools\social-draft.mjs --mark <id> x threads instagram
rem  결과 로그 : tools\promo-log.txt   점검: node tools\promo-logs.mjs
rem ────────────────────────────────────────────────────────────────

cd /d "%~dp0.."
set LOG=tools\promo-log.txt

echo. >> "%LOG%"
echo ===== %DATE% %TIME% ===== >> "%LOG%"

rem 1) 초안만 만든다 — 브라우저를 열지 않는다
node tools\social-draft.mjs --max 1 >> "%LOG%" 2>&1

rem 2) 공식 API 채널만 자동 게시 (X 는 목록에서 제외돼 있음)
node tools\social-post.mjs --draft --post --max 1 >> "%LOG%" 2>&1

exit /b 0
