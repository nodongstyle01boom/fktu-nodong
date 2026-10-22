# 무료 자동 홍보 설치 안내 (2026-09-17, 2026-09-19 개정)

유료 플랜 없이 채널에 자동으로 홍보 글을 올리는 방법. 도구는 `tools/social-post.mjs`.

> **2026-09-19 개정 — 무인 브라우저 자동 게시 중단**
> 인스타그램·스레드·X 계정이 봇으로 계정 정지된 것을 계기로, 사람이 로그인한
> 브라우저 화면을 자동 조작해 글을 올리는 방식을 전부 중단했다.
> 이제 원칙은 하나다: **공식 API 로만 자동, 나머지는 사람이 누른다.**
> 하루 1건을 같은 시각에 같은 문장으로 자동 게시하는 패턴이 계정 정지의
> 가장 흔한 원인이다. 사람 흉내를 낸 지연·마우스 흔들기 등은 오히려
> 탐지 신호를 늘린다(사람과 다른 타이밍 분포). 우회를 노린 게 아니라
> 아예 자동화를 빼는 쪽으로 정리했다.

| 채널 | 자동 게시 | 비용 | 준비 시간 |
|---|---|---|---|
| 텔레그램 (채널·그룹) | ✅ 공식 API | 무료 | 5분 |
| 디스코드 (서버) | ✅ 공식 API | 무료 | 3분 |
| 블루스카이 (Bluesky) | ✅ 공식 API | 무료 | 5분 |
| 페이스북 (페이지) | ✅ 공식 API | 무료 | 15분 |
| X (트위터) | ❌ 자동 대상 제외 | **유료** + 계정 정지 이력 | — |
| 스레드 (Threads) | ❌ 자동 금지 → 사람이 올림 | — | 복붙 2번 |
| 인스타그램 | ❌ 자동 금지 → 사람이 올림 | — | 복붙 + 이미지 1장 |
| 네이버 블로그·카페 | ❌ API 없음 → 수동 | — | 복붙 2번 |
| 카카오톡 채널 | ❌ 유료(알림톡·친구톡) | 유료 | — |
| 단체 문자 | ❌ 통신사 발송 | 유료 | — |

**결론: 자동화가 되는 곳은 공식 API 가 있는 `텔레그램 + 디스코드 + 블루스카이 + 페이스북 페이지` 뿐이다.**
스레드·인스타그램·X 는 `tools/social-draft.mjs` 가 채널 길이에 맞춰 준 초안을 뽑아 주고, **사람이 직접 올린다.**

X 는 2026-09 확인 결과 **무료 등급이 사라졌다** (아래 2장 참고). 계정 정지 이력도 있어
자동 연결 목록에서 완전히 뺐다 — 토큰을 채워도 예약 회차에서 자동으로 붙지 않는다.

---

## 1. 사이트 글에서 홍보글 자동 작성

```bash
cd "/e/AI 프로젝트 결과물/한국노총 노동연대 홈페이지/fktu-nodong"
node tools/social-post.mjs --draft     # 지식 30편 + 소식에서 홍보글 생성
node tools/social-post.mjs             # 미리보기 (아무 데도 안 올림)
```

결과: `tools/social-queue.json` — 항목마다 `short`(X·블루스카이용, 268자 이내)와 `long`(텔레그램·디스코드·페이스북용)이 들어 있음. 문구가 마음에 안 들면 `social-post.mjs`의 `draft()` 안 템플릿을 고치면 됨.

---

## 2. 토큰 넣기 — `tools/social.env` 만들기

```bash
cp tools/social.env.example tools/social.env     # 예시 파일을 복사
notepad tools/social.env                        # 값을 채우고 저장
```

`social.env` 안에 이렇게 생겼다. 빈 항목은 그대로 두면 된다.

```ini
# 텔레그램
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
# 디스코드 (서버 설정 → 연동 → 웹훅 → URL 복사)
DISCORD_WEBHOOK_URL=
# 블루스카이
BSKY_HANDLE=내핸들.bsky.social
BSKY_APP_PASSWORD=
# X (developer.x.com → 앱 → Keys and tokens)
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_SECRET=
# 페이스북 페이지
FB_PAGE_ID=
FB_PAGE_TOKEN=
```

비어 있는 채널은 자동으로 건너뛴다. 이 파일은 `.gitignore`에 추가해 두었으니 저장소에 안 올라간다.

### 채널별 발급 방법

**텔레그램 (5분, 가장 쉬움)**
1. 텔레그램에서 `@BotFather` 에게 `/newbot` → 이름 정하면 **봇 토큰** 발급 (`TELEGRAM_BOT_TOKEN`)
2. 홍보할 채널(또는 그룹)을 만들고, 봇을 **관리자로 추가**
3. 봇에게 `/start` 를 한 번 보낸 뒤, 그 메시지를 `@userinfobot` 에게 전달하면 숫자 ID가 나옴 → `TELEGRAM_CHAT_ID`
   (채널이면 `https://api.telegram.org/bot<토큰>/getUpdates` 주소를 열어 `"chat":{"id":-100...}` 값 확인)

**디스코드 (3분)**
1. 서버 설정 → 연동 → 웹훅 → 새 웹훅 → URL 복사 → `DISCORD_WEBHOOK_URL`

**블루스카이 (5분)**
1. bsky.app 가입 → 설정 → 앱 비밀번호 → 새로 만들기 → 값 복사 → `BSKY_APP_PASSWORD`
2. `BSKY_HANDLE` 은 `내이름.bsky.social` (설정 화면 핸들)

**X — 결제 없이는 자동 게시 불가 (2026-09-17 확인)**
공식 문서(docs.x.com/x-api/getting-started/about-x-api)의 요금 항목은 이렇게 바뀌었다:

> No subscriptions / Pay only for what you use / Credit-based — Purchase credits, deducted per request

즉 예전의 "Free 등급(월 500건 쓰기)" 이 더 이상 안내되지 않고 **크레딧 선구매 방식**만 있다. 그래서 이 저장소는 X 를 무료 자동화 대상에서 빼 두었다. (`social.env` 의 X 칸은 비워 두면 자동으로 건너뜀)

X 를 쓰기로 했다면: developer.x.com → 앱 생성 → Keys and tokens 에서 API Key/Secret, Access Token/Secret (**앱 권한을 Read and Write 로 먼저 바꿔야** Write 토큰이 나옴). 주소는 `api.twitter.com` 과 `api.x.com` 둘 다 살아 있는 것을 확인했다(인증 없이 호출 시 401).

무료로 X 에 올리는 현실적인 방법은 `--next` 로 문구를 꺼내 **직접 붙여넣기**이다.

**페이스북 페이지 (15분)**
1. developers.facebook.com → 앱 만들기 → 유형: 비즈니스
2. Graph API Explorer 에서 권한 `pages_manage_posts`, `pages_read_engagement` 체크 → **페이지 토큰** 생성 → `FB_PAGE_TOKEN`
3. 페이지 ID → `FB_PAGE_ID` (페이지 → 정보 → 페이지 ID)
4. 본인이 관리하는 페이지면 앱 검수(App Review) 없이 게시 가능. 토큰은 만료되므로 주기적으로 재발급.

---

## 3. 실제로 올리기

**먼저 토큰 없이 연습** — 실제로는 아무 데도 안 올리고 `tools/social-outbox/` 에 "보낼 내용"만 저장한다. 전체 과정이 도는지 확인하는 용도.

```bash
node tools/social-post.mjs --dry-run --post --max 2
dir tools\social-outbox        # 결과 텍스트 확인
```

연습이 통과하면 실제 게시:

```bash
node tools/social-post.mjs --post                # 연결된 채널에 1건 게시 (기본 1건)
node tools/social-post.mjs --post --max 3        # 이번 회차 3건
node tools/social-post.mjs --post --only telegram,x
```

더 쉽게 하려면 상위 폴더의 **`홍보실행.cmd` 를 더블클릭** — 새 글 확인 → 홍보글 생성 → 1건 게시를 한 번에 돌리고 결과를 보여준다.

- 한 번 올린 글은 `tools/social-state.json` 에 기록되어 **중복 게시 안 됨**.
- 기본값이 회차당 1건인 이유: 하루에 30편을 몰아 올리면 스팸으로 보임. 하루 1건 × 30일이 정상 속도.

### 수동 게시(네이버 카페·블로그·밴드)용 문구 꺼내기

```bash
node tools/social-post.mjs --next      # 아직 안 올린 다음 글 문구 → tools/next-post.txt
```
그 파일을 열어 복사 → 카페·블로그에 붙여넣기. 네이버 블로그·카페는 글쓰기 API가 없어서 자동화 불가.

---

## 4. 예약 게시 (원하는 날짜·시간에 자동)

`tools/social-queue.json` 의 각 항목에 시각을 넣으면 그때까지는 안 나간다:

```json
{ "id": "articles-wage-arrears", "at": "2026-09-20T09:00:00+09:00", "done": {} }
```

---

## 5. 정기 자동 실행 (Windows 작업 스케줄러, 무료)

매일 오전 9시에 "새 글 확인 → 대기열 갱신 → 1건 게시" 를 자동으로 돌린다. 폴더에서 한 줄이면 끝:

```powershell
cd "E:\AI 프로젝트 결과물\한국노총 노동연대 홈페이지\fktu-nodong"
powershell -ExecutionPolicy Bypass -File tools\install-task.ps1
# 시각 바꾸기: powershell -ExecutionPolicy Bypass -File tools\install-task.ps1 -Time 08:30 -Force
# 끄기:      powershell -ExecutionPolicy Bypass -File tools\install-task.ps1 -Remove
```

- 확인: `schtasks /query /tn nodong-promo`
- PC가 꺼져 있으면 그 회차는 건너뜀(무료 계획은 이게 한계).
- 노트북을 자주 덮는 편이면 `/st 09:00` 대신 켤 때 도는 방식이 낫다 → 작업 스케줄러 GUI에서 트리거 "시스템 시작 시" + "놓친 작업 즉시 실행" 체크.

---

## 6. RSS 피드 + 무료 브리지(코딩 없이 X·페이스북으로)

사이트에 **RSS 피드가 이미 있다** → `https://fktu-nodong.vercel.app/feed.xml` (지식 30편 + 소식 6건, 새 글 올리면 갱신).

**2026-09-17 배포·확인됨** — 200 응답, `application/xml`, 항목 36건, 45개 페이지 head 에 자동발견 링크 들어감.

```bash
node tools/gen-feed.mjs     # 글을 추가·수정한 뒤 실행하면 feed.xml 이 다시 만들어짐
```

이 주소를 아래 무료 한도 서비스에 넣으면 "사이트 글이 새로 올라갈 때마다 SNS로 자동 배포"가 된다. 코드는 안 짜도 됨:

| 서비스 | 무료 한도(2026 기준, 가입 화면에서 확인) | 용도 |
|---|---|---|
| Make (make.com) | 월 1,000회 실행 | RSS → 텔레그램·페이스북 페이지 |
| IFTTT | 무료 앱릿 2개 | RSS → 밴드·블로그 자동 게시 |
| Zapier | 무료 월 100회 | RSS → 페이스북 |
| dlvr.it | 무료 1피드·월 한도 있음 | RSS → 페이스북 |

⚠️ 브리지 서비스로 **X** 에 보내려면 그 서비스도 X API 접근을 따로 구매해야 한다 — 위의 "X 유료화" 와 같은 이유다. X 연결은 빼 두고 쓰는 편이 현실적이다.

설정 순서(Make 기준, 5분): ① 가입 → ② Create scenario → ③ RSS > Watch RSS feed items → URL 에 `feed.xml` 주소 → ④ X(Facebook) > Create a post → ⑤ 일정 Every 15 minutes → 켜기.

RSS 는 검색·애그리게이터(노동 뉴스 수집기, 카페 자동 글봇)도 그냥 가져가기 때문에 채널을 안 붙여도 퍼지는 통로가 된다.

---

## 7. 주의 (안 지키면 계정 정지)

### 2026-09-19 — 실제 계정 정지教训

인스타그램·스레드·X 에서 봇으로 계정 정지된 뒤 세운 규칙이다.

1. **사람 로그인 세션을 자동 조작하지 않는다.** `--rehearse`/`--post` 는 사람이
   터미널에 붙어 있을 때만 동작한다. 스케줄러로 돌아가는 회차는 `TTY 가드` 에 걸려
   `exit 2` 로 멈춘다(`promo-browser.mjs` · `promo-blog.mjs`).
2. **같은 시각·같은 문장으로 반복 게시하지 않는다.** 무인 반복이 탐지의 1순위 신호다.
3. **사람 흉내를 내지 않는다.** 랜덤 지연·마우스 흔들기·지문 위장은 탐지를 피하는 게
   아니라 탐지 규칙이 겨냥하는 바로 그 지표다. 안 하는 게 낫다.
4. **차단된 뒤 재가입하지 않는다.** 재등록 자체가 위반이 되어 정지가 영구화된다.
5. **채널을 공식 API 로 옮긴다.** 자동화가 꼭 필요하면 브라우저 조작이 아니라
   공식 API 여야 한다. (브라우저 자동화는 API 경로보다 위험 요소가 훨씬 많다)

### 그 밖의 주의

- 커뮤니티마다 자체 홍보 규정이 있음. 남의 게시판에 자동 도배하면 삭제·차단.
- 같은 문구 반복 게시는 스팸 필터에 걸림 → `short`/`long` 두 종류를 돌려 쓰고, 하루 1~2건만.
- 자동화 금지 조항이 있는 서비스(네이버 등)는 수동 게시 유지.
- X·페이스북 토큰은 만료됨. 실패 로그가 뜨면 재발급 후 `social.env` 갱신.

### 사람이 직접 올리는 흐름 (스레드·인스타그램·X)

```bash
node tools/social-draft.mjs                      # 다음 글 1건, 채널 3종 길이 맞춤 초안
node tools/social-draft.mjs --max 3 --platform x
node tools/social-draft.mjs --list               # 남은 글
#   → 화면에 찍힌 문자를 복사해 각 채널에 붙여넣고 직접 누른다
#   → 인스타그램은 이미지 1장이 먼저 필요하다 (og.png 또는 tools/brand-card.html)
node tools/social-draft.mjs --mark <id> x threads instagram   # 올렸다고 기록
```

`social-draft.mjs` 는 브라우저도 계정도 건드리지 않고 로컬 파일만 쓴다.

---

## 8. 점검

```bash
node tools/social-post.mjs --check      # 문구 길이·링크 계산·중복 검사 + 토큰 없이 게시 경로 연습 (네트워크 안 씀)
node tools/test-social-post.mjs         # 5채널이 실제로 보내는 요청 모양 검사 (모의서버, 네트워크 안 씀)
node tools/check-links.mjs              # 사이트 내부 링크 깨짐 검사
node tools/gen-feed.mjs                 # RSS 피드 갱신
```

`--check` 는 10개 항목을 검사한다. 마지막 두 항목은 "연습 저장 2건 생성"·"연습 파일에 제목·본문·링크 포함" — 토큰이 하나도 없어도 게시 경로 전체가 도는지 확인하는 부분이다.

`test-social-post.mjs` 는 **토큰 없이 24개 항목**을 검사한다. 로컬 모의서버를 띄우고 `fetch` 의 호스트만 바꿔치기해서, 각 채널로 나가는 요청의 **경로·헤더·본문 필드 이름**을 실제 코드로 확인한다 (예: 텔레그램 `/bot<토큰>/sendMessage` 의 `chat_id`, 블루스카이 링크 facet 의 바이트 위치, X 의 OAuth1 서명 헤더). 실제 계정 권한 문제는 이 검사로 알 수 없다 — 그건 토큰을 넣고 한 번 돌려야 확인된다.

---

## 파일 정리

| 파일 | 역할 | 저장소에 올라감? |
|---|---|---|
| `tools/social-post.mjs` | 게시기 (자동·연습·미리보기) | ✅ |
| `tools/test-social-post.mjs` | 5채널 요청 모양 자기 점검 (모의서버) | ✅ |
| `tools/gen-feed.mjs` | RSS 피드 생성 + head 링크 삽입 | ✅ |
| `tools/social-setup.md` | 이 문서 | ✅ |
| `tools/social.env.example` | 토큰 입력 예시 (복사해서 씀) | ✅ |
| `tools/social.env` | 실제 토큰 | ❌ (.gitignore) |
| `tools/social-queue.json` | 홍보글 36건 대기열 (자동 생성) | ❌ |
| `tools/social-state.json` | 이미 올린 글 기록 (중복 방지·자동 생성) | ❌ |
| `tools/social-outbox/` | 연습(`--dry-run`) 결과물 | ❌ |
| `홍보실행.cmd` (상위 폴더) | 더블클릭 실행 | ❌ (사이트 밖) |

---

## 다음에 이어서 할 때

1. `cp tools/social.env.example tools/social.env` → 텔레그램·디스코드 토큰부터 채우기 (5분)
2. `node tools/social-post.mjs --check` → "전부 통과" 확인
3. `node tools/social-post.mjs --post --only telegram` → 실제로 채널에 하나 올라가는지 눈으로 확인
4. 잘 되면 나머지 채널 추가 → `powershell -ExecutionPolicy Bypass -File tools\install-task.ps1` (매일 자동)
5. 검색·브리지 등록: `feed.xml` 을 Make/IFTTT 에 넣고, `sitemap.xml` 을 검색엔진에 제출

(2026-09-17 완료분: `feed.xml`·`sitemap.xml`·`robots.txt` 배포, 5채널 요청 검사 도구 작성 — 남은 건 토큰 발급과 검색엔진 소유권 확인뿐)
