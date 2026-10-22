import { spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
const cli =
  process.env.VERCEL_CLI_PATH ||
  "C:/nvm4w/nodejs/node_modules/vercel/dist/index.js";
const project = JSON.parse(await readFile(".vercel/project.json", "utf8"));
if (process.env.SUPABASE_SECRET_KEY?.startsWith("sb_publishable_"))
  throw Error(
    "SUPABASE_SECRET_KEY contains a publishable key. Replace it with the server Secret key before syncing Vercel settings.",
  );
const names = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "SUPABASE_SECRET_KEY",
  "OPENAI_API_KEY",
  "OPENAI_IMAGE_MODEL",
  "AI_PREVIEW_PROVIDER",
  "DASHSCOPE_API_KEY",
  "DASHSCOPE_REGION",
  "DASHSCOPE_API_HOST",
  "QWEN_IMAGE_MODEL",
  "AI_PREVIEW_DAILY_LIMIT",
  "AI_PREVIEW_SITE_DAILY_LIMIT",
];
const variables = names
  .filter((n) => process.env[n])
  .map((key) => ({
    key,
    value: process.env[key],
    target: ["preview", "production"],
    type: key.startsWith("NEXT_PUBLIC") ? "plain" : "sensitive",
  }));
await mkdir(".cache", { recursive: true });
const inputPath = ".cache/vercel-private-env.json";
for (const variable of variables) {
  await writeFile(inputPath, JSON.stringify(variable), { mode: 0o600 });
  let result;
  try {
    result = spawnSync(
      process.execPath,
      [
        cli,
        "api",
        `/v10/projects/${project.projectId}/env?upsert=true&teamId=${project.orgId}`,
        "--method",
        "POST",
        "--header",
        "Content-Type:application/json",
        "--input",
        inputPath,
        "--silent",
      ],
      { encoding: "utf8" },
    );
  } finally {
    await unlink(inputPath);
  }
  if (result.status !== 0) {
    let message = String(result.stderr || "Environment sync failed.");
    for (const v of variables)
      message = message.replaceAll(v.value, "[redacted]");
    throw Error(message);
  }
}
console.log(
  "Vercel preview and production configured: " +
    variables.map((v) => v.key).join(", "),
);
