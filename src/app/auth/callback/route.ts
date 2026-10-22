import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/request-security";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeReturnPath(url.searchParams.get("next"));
  if (code) {
    const client = await serverSupabase();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(
    new URL("/?authError=Please+request+a+new+sign-in+link", url.origin),
  );
}
