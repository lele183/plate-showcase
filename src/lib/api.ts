import "server-only";
import { serverSupabase } from "./supabase/server";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function requireUser() {
  const client = await serverSupabase();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    throw new ApiError("Sign in to use uploads and saved projects.", 401);
  return { client, user };
}
export function apiError(error: unknown) {
  if (error instanceof ApiError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error(
    "Website request failed:",
    error instanceof Error ? error.message : "Unknown error",
  );
  return Response.json(
    { error: "This service is temporarily unavailable. Please try again." },
    { status: 503 },
  );
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") || new URL(request.url).host;
  if (origin && new URL(origin).host !== host)
    throw new ApiError("Request origin is not allowed.", 403);
}
