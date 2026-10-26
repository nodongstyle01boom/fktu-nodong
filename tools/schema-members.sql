-- 회원가입 명단 (2026-09-17 추가)
-- 적용: node tools/db-apply.mjs schema-members.sql
-- 계정(Auth)이 아니라 명단이다. 개인정보를 최소로 받고, 조회는 운영자만.

create table if not exists public.members (
  id          bigint generated always as identity primary key,
  name        text not null,
  email       text not null,
  phone       text,
  org         text,
  region      text,
  interest    text,
  agreed      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists members_created_at_idx on public.members (created_at desc);

alter table public.members enable row level security;

-- 가입: 누구나 등록 (운영자 계정도 authenticated 이므로 함께 허용)
drop policy if exists members_anon_insert on public.members;
create policy members_anon_insert on public.members
  for insert to anon, authenticated with check (true);

-- 조회·수정·삭제: 로그인한 운영자만
drop policy if exists members_admin_read on public.members;
create policy members_admin_read on public.members
  for select to authenticated using (true);

drop policy if exists members_admin_update on public.members;
create policy members_admin_update on public.members
  for update to authenticated using (true) with check (true);

drop policy if exists members_admin_delete on public.members;
create policy members_admin_delete on public.members
  for delete to authenticated using (true);
