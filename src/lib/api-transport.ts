export class FirnApiError extends Error {
  status: number;
  detail: unknown;
  constructor(message: string, status: number, detail: unknown = null) {
    super(message);
    this.name = "FirnApiError";
    this.status = status;
    this.detail = detail;
  }
}

export async function requestApi<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 15000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    const payload = (await response.json().catch((reason) => {
      if (controller.signal.aborted) throw reason;
      return null;
    })) as { detail?: unknown } | null;
    if (!response.ok) {
      const detail = payload?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail
                .map(
                  (item) => `${item.loc?.join(" → ") ?? "Input"}: ${item.msg ?? "Invalid value"}`,
                )
                .join("; ")
            : detail && typeof detail === "object" && "message" in detail
              ? String(detail.message)
              : `Request failed (${response.status})`;
      throw new FirnApiError(message, response.status, detail);
    }
    if (payload === null)
      throw new FirnApiError(
        "The API returned an unreadable response. Retry loading.",
        response.status,
      );
    return payload as T;
  } catch (reason) {
    if (reason instanceof FirnApiError) throw reason;
    if (controller.signal.aborted)
      throw new FirnApiError(
        "The request is taking longer than expected. It may still finish on the server. Reload saved proposals or retry the same request; do not create a new one yet.",
        408,
      );
    throw new FirnApiError(
      "FIRN API is unreachable. Start the local FastAPI service and retry.",
      0,
    );
  } finally {
    clearTimeout(timer);
  }
}
