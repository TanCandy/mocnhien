export type UserRole = "user" | "admin";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phoneNumber?: string;
  primaryAddress?: string;
}

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

// Empty string = use relative URL, Vite proxy handles routing
export function getApiBaseUrl() {
  return "";
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function setSessionUser(user: SessionUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getSessionUser(): SessionUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function clearSessionUser() {
  localStorage.removeItem(USER_KEY);
}

export function clearSession() {
  clearToken();
  clearSessionUser();
}

function parseJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const decoded = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function getRoleFromToken(token: string | null): UserRole | null {
  if (!token) return null;
  const payload = parseJwtPayload(token);
  return payload?.role === "admin" ? "admin" : payload?.role === "user" ? "user" : null;
}
