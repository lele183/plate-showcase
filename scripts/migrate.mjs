import postgres from "postgres";
import { readFile, readdir } from "node:fs/promises";
if (
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL.includes("[YOUR-PASSWORD]")
)
  throw Error(
    "Set a real DATABASE_URL in .env.local before applying migrations.",
  );
const connection = new URL(process.env.DATABASE_URL);
if (
  !["postgres:", "postgresql:"].includes(connection.protocol) ||
  !connection.password
)
  throw Error(
    "DATABASE_URL must be the PostgreSQL connection URI from Supabase Connect, including the database password. The https project API URL belongs in NEXT_PUBLIC_SUPABASE_URL.",
  );
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
try {
  await sql`create table if not exists public.yanco_schema_migrations(version text primary key, applied_at timestamptz default now())`;
  await sql`alter table public.yanco_schema_migrations enable row level security`;
  await sql`revoke all on public.yanco_schema_migrations from anon,authenticated`;
  for (const file of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if (
      (
        await sql`select version from public.yanco_schema_migrations where version=${file}`
      ).length
    )
      continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(await readFile(`supabase/migrations/${file}`, "utf8"));
      await tx`insert into public.yanco_schema_migrations(version) values(${file})`;
    });
    console.log("Applied", file);
  }
} finally {
  await sql.end();
}
