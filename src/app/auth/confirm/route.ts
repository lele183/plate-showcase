import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType;
  if (
    token_hash &&
    ["signup", "recovery", "email", "email_change", "invite"].includes(type)
  ) {
    const client = await serverSupabase();
    const { error } = await client.auth.verifyOtp({ token_hash, type });
    if (!error)
      return NextResponse.redirect(
        new URL(type === "recovery" ? "/?recovery=1" : "/", url.origin),
      );
  }
  return NextResponse.redirect(
    new URL("/?authError=This+link+has+expired", url.origin),
  );
}
