import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { SessionUser, clearSession, getSessionUser, getToken, setSessionUser as saveSessionUser } from "../lib/auth";
import { api } from "../lib/api";

interface UserContextType {
  user: SessionUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  /** Call after login (user) or logout (null) so route guards see the change immediately. */
  setCurrentUser: (user: SessionUser | null) => void;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  refreshUser: async () => {},
  setCurrentUser: () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    try {
      const data = await api.get("/api/user/profile");
      if (data.user) {
        const sessionUser: SessionUser = {
          id: data.user._id || data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          phoneNumber: data.user.phoneNumber,
          primaryAddress: data.user.primaryAddress,
        };
        setUser(sessionUser);
        saveSessionUser(sessionUser);
      }
    } catch (err: any) {
      setUser(null);
      // Expired/invalid token: drop it, otherwise /login would bounce a stale
      // admin token back to /admin/* forever.
      if (err?.status === 401) clearSession();
    }
  }

  function setCurrentUser(next: SessionUser | null) {
    if (next) saveSessionUser(next);
    else clearSession();
    setUser(next);
    setLoading(false);
  }

  useEffect(() => {
    const storedUser = getSessionUser();
    if (storedUser) {
      setUser(storedUser);
    }
    // No token → anonymous visitor; skip the profile call (it would only 401).
    if (!getToken()) {
      setLoading(false);
      return;
    }
    refreshUser().finally(() => setLoading(false));
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, refreshUser, setCurrentUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
