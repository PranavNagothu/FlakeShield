const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Fetch from the control-plane API.
 * Returns { data, fromMock } — fromMock=true when the API is unreachable.
 */
export async function apiFetch<T>(
  path: string,
  fallback: T
): Promise<{ data: T; fromMock: boolean }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: 30 }, // revalidate every 30s in Next.js cache
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: T = await res.json();
    return { data, fromMock: false };
  } catch {
    return { data: fallback, fromMock: true };
  }
}
