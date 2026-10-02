import { getApiBaseUrl, getToken } from "./auth";

async function request(path: string, init: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const baseUrl = getApiBaseUrl();
  const url = baseUrl ? `${baseUrl}${path}` : path;
  
  console.log(`[API] ${init.method || "GET"} ${url}`);

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch (networkErr) {
    console.error("[API] Failed to connect to backend at:", url);
    console.error("[API] Make sure backend is running: cd backend && npm run dev");
    console.error("[API] Error:", networkErr);
    throw new Error("Cannot connect to backend. Please start the backend server.");
  }

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const message = data?.message || `Server error (${res.status})`;
    console.error(`[API] Error ${res.status}:`, message);
    throw Object.assign(new Error(message), { status: res.status });
  }

  return data;
}

/** Fetch a file (e.g. the Excel export) with auth and trigger a browser download. */
async function download(path: string, fallbackName: string) {
  const token = getToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const baseUrl = getApiBaseUrl();
  const res = await fetch(baseUrl ? `${baseUrl}${path}` : path, { headers, credentials: "include" });
  if (!res.ok) {
    let message = `Server error (${res.status})`;
    try {
      message = (await res.json())?.message || message;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }

  const disposition = res.headers.get("Content-Disposition") || "";
  const filename = /filename="?([^";]+)"?/i.exec(disposition)?.[1] || fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  download,
  get: (path: string) => request(path, { method: "GET" }),
  post: (path: string, body?: unknown) =>
    request(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: (path: string, body?: unknown) =>
    request(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: (path: string, body?: unknown) =>
    request(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string) => request(path, { method: "DELETE" }),
};
