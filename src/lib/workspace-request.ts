export async function workspaceRequest<T>(
  path: string,
  options: RequestInit = {},
  timeout = 20000,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, timeout);
  try {
    const response = await fetch(path, {
      ...options,
      cache: "no-store",
      signal: controller.signal,
    });
    const value: unknown = await response.json();
    if (!response.ok) {
      const message =
        value &&
        typeof value === "object" &&
        "error" in value &&
        typeof value.error === "string"
          ? value.error
          : "The service is temporarily unavailable. Please try again.";
      throw Error(message);
    }
    return value as T;
  } catch (error) {
    if (controller.signal.aborted && !options.signal?.aborted)
      throw Error(
        "This request is taking longer than expected. Check your connection and try again.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
