import { getApiBaseUrl, getToken } from "./auth";

async function request(path: string, init: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const url = `${getApiBaseUrl()}${path}`;
  console.log(`[API] ${init.method || "GET"} ${url}`);

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch (networkErr) {
    // This is the "Failed to fetch" source — backend is unreachable
    console.error("[API] Network error:", networkErr);
    throw new Error("Backend is not running. Please start server.");
  }

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    // Response had no JSON body — still surface the status
    data = {};
  }

  if (!res.ok) {
    const message = data?.message || `Server error (${res.status})`;
    console.error(`[API] Error ${res.status}:`, message);
    throw new Error(message);
  }

  return data;
}

export const api = {
  get: (path: string) => request(path, { method: "GET" }),
  post: (path: string, body?: unknown) =>
    request(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: (path: string, body?: unknown) =>
    request(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: (path: string, body?: unknown) =>
    request(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string) => request(path, { method: "DELETE" }),
};

