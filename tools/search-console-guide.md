# Google Search Console 운영 안내

사이트: https://fktu-nodong.vercel.app/

## 현재 준비된 파일

- Google 사이트 확인 파일: `/google87dc6a6e4f9e5530.html`
- Naver 사이트 확인 파일: `/naverd37ebeac5bdca9dc6b5ae7e3c426fd29.html`
- 사이트맵: `/sitemap.xml` — 2026-09-19 기준 74개 URL
- RSS: `/feed.xml` — 2026-09-19 기준 60개 항목
- robots.txt에 사이트맵 주소가 등록되어 있음

## Search Console 등록 순서

1. Google Search Console에서 **속성 추가**를 선택합니다.
2. URL 접두어 속성으로 다음 주소를 입력합니다.

   ```text
   https://fktu-nodong.vercel.app/
   ```

3. HTML 파일 확인 방법을 선택하고, Google이 제시한 파일명과 현재 배포 파일이 일치하는지 확인합니다.
4. 소유권 확인 후 **색인 생성 → 사이트맵**에서 다음 값을 제출합니다.

   ```text
   sitemap.xml
   ```

5. URL 검사에서 홈페이지와 최근 수정된 주요 문서의 색인 생성을 요청합니다.

## 주요 확인 URL

```text
https://fktu-nodong.vercel.app/
https://fktu-nodong.vercel.app/articles/index.html
https://fktu-nodong.vercel.app/articles/union-setup.html
https://fktu-nodong.vercel.app/articles/collective-bargaining.html
https://fktu-nodong.vercel.app/articles/strike-legal-basics.html
https://fktu-nodong.vercel.app/articles/unfair-labor-practice.html
https://fktu-nodong.vercel.app/articles/bargaining-unit-singleization.html
```

## 운영 원칙

- Google·Naver·Discord 비밀번호, 웹훅 URL, API 토큰은 저장소에 기록하지 않습니다.
- 계정 권한과 Search Console 사용자 관리는 해당 서비스 화면에서 직접 처리합니다.
- 글을 추가하거나 수정한 뒤 다음 명령을 실행합니다.

  ```powershell
  node tools/gen-sitemap.mjs
  node tools/gen-feed.mjs
  ```

- 배포 후 `sitemap.xml`, `feed.xml`, 확인 파일이 HTTP 200으로 응답하는지 확인합니다.