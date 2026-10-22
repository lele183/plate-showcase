import "server-only";
import { serverSupabase } from "./supabase/server";
import { requestHasAllowedOrigin } from "./request-security";
import { supabaseConfigured } from "./supabase/config";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function requireUser() {
  if (!supabaseConfigured())
    throw new ApiError(
      "Account services are temporarily unavailable. You can still browse and use the on-device workspace.",
      503,
    );
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
  if (!requestHasAllowedOrigin(request))
    throw new ApiError("Request origin is not allowed.", 403);
}
export async function readJson(request: Request) {
  try {
    const body = await request.json();
    if (body === null || typeof body !== "object" || Array.isArray(body))
      throw new ApiError("Send a JSON object with the request details.");
    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("The request contains invalid JSON.");
  }
}
