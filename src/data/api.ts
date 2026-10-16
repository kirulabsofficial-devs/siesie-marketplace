import { LIVE_BACKEND, STATIC_PROTOTYPE } from "./runtime";
import { rpc } from "./supabaseStore";

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function api<T>(path: string, data?: unknown): Promise<T> {
  if (LIVE_BACKEND) {
    const url = new URL(path, window.location.origin);
    return rpc<T>("siesie_chat", { route: url.pathname, input: data ?? null, after_sequence: Number(url.searchParams.get("after") || 0), page_limit: Number(url.searchParams.get("limit") || 100) });
  }
  if (STATIC_PROTOTYPE) {
    const { prototypeApi } = await import("./prototypeApi");
    return prototypeApi<T>(path, data);
  }
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: data === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store",
      headers: data === undefined ? undefined : { "Content-Type": "application/json", "X-Siesie-Request": "1" },
      body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(12_000),
    });
  } catch { throw new ApiError("Cannot reach Siesie. Check your connection and try again.", 0); }
  const result = await response.json().catch(() => { throw new ApiError("Siesie is temporarily unavailable. Please try again shortly.", response.status); });
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/test/")) window.dispatchEvent(new Event("siesie:session-expired"));
    throw new ApiError(result.error || "That didn’t work. Please try again.", response.status);
  }
  return result as T;
}
