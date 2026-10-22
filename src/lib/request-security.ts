export function requestHasAllowedOrigin(request: Request): boolean {
  const value = request.headers.get("origin");
  if (value === null) return true;
  try {
    const origin = new URL(value);
    const target = new URL(request.url);
    target.host = request.headers.get("host") || target.host;
    return (
      value === origin.origin &&
      ["http:", "https:"].includes(origin.protocol) &&
      origin.origin === target.origin
    );
  } catch {
    return false;
  }
}

export function safeReturnPath(value: string | null): string {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020\u007f]/.test(value)
  )
    return "/";
  const base = "https://return.invalid";
  try {
    const url = new URL(value, base);
    return url.origin === base ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}
