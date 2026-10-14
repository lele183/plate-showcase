import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);
const email = `yanco-redirect-${randomUUID()}@example.invalid`;
const { data, error } = await client.auth.admin.createUser({
  email,
  password: randomUUID() + "!Aa",
  email_confirm: true,
});
if (error) throw Error(error.message);
try {
  for (const requested of [
    "https://plate-showcase.vercel.app/auth/callback",
    "https://plate-showcase.vercel.app/auth/callback?next=/?recovery=1",
    "http://127.0.0.1:4173/auth/callback",
  ]) {
    // Generates a test link without sending email. Tokens are never logged.
    const result = await client.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: requested },
    });
    if (result.error) throw Error(result.error.message);
    const actual =
      result.data.properties.redirect_to ||
      new URL(result.data.properties.action_link).searchParams.get(
        "redirect_to",
      );
    console.log(
      JSON.stringify({
        requested,
        accepted: actual === requested,
        configuredOrigin: actual ? new URL(actual).origin : null,
      }),
    );
  }
} finally {
  const removed = await client.auth.admin.deleteUser(data.user.id);
  if (removed.error)
    throw Error("Unable to clean up the temporary redirect test account.");
}
