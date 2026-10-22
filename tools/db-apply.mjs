// Supabase 스키마 적용 + 관리자 계정 생성
// 사용: node tools/db-apply.mjs [schema 파일명]
//   예) node tools/db-apply.mjs schema-members.sql
// 자격증명: POSTGRES_URL 또는 POSTGRES_URL_NON_POOLING, NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY 환경변수를 사용하세요. 평문 자격증명 파일을 만들지 마세요.
// 관리자 계정까지 만들 때 ADMIN_EMAIL·ADMIN_PASSWORD를 추가로 넘깁니다.
// ponytail: DDL은 여기서 한 번만. 이후 스키마 변경은 Supabase 대시보드나 새 SQL 파일로.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const HERE = import.meta.dirname;
const PG_MODULE = join(HERE, "..", "..", ".supabase", "node_modules", "pg");

const DATABASE_URL = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const missing = [
  !DATABASE_URL && "POSTGRES_URL 또는 POSTGRES_URL_NON_POOLING",
  !SUPABASE_URL && "NEXT_PUBLIC_SUPABASE_URL",
  !SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
].filter(Boolean);
if (missing.length) {
  throw new Error(`필수 환경변수가 없습니다: ${missing.join(", ")}`);
}

const require = createRequire(import.meta.url);
const { Client } = require(PG_MODULE);

const url = new URL(DATABASE_URL);
const client = new Client({
  host: url.hostname,
  port: Number(url.port || 5432),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, "") || "postgres",
  ssl: { rejectUnauthorized: false },
});

const SCHEMA = join(HERE, process.argv[2] || "schema.sql");
const sql = readFileSync(SCHEMA, "utf8");
await client.connect();
await client.query(sql);
console.log(`스키마 적용 완료 — ${SCHEMA.split(/[\\/]/).pop()}`);

const tables = await client.query(
  "select tablename from pg_tables where schemaname='public' order by tablename",
);
console.log("public 테이블:", tables.rows.map((r) => r.tablename).join(", "));

const policies = await client.query(
  "select tablename, policyname from pg_policies where schemaname='public' order by tablename, policyname",
);
console.log("RLS 정책", policies.rowCount + "개");
await client.end();

// 관리자 계정 (Auth) — 리셋 가능하도록 upsert
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "fktu-nodong@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (ADMIN_PASSWORD) {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, email_confirm: true }),
  });
  const body = await res.json();
  console.log(res.ok
    ? `관리자 계정 생성: ${ADMIN_EMAIL}`
    : `관리자 계정 생성 실패(${res.status}): ${body.msg || body.message || JSON.stringify(body)}`);
} else {
  console.log("ADMIN_PASSWORD 미지정 — 관리자 계정 생성 생략");
}
