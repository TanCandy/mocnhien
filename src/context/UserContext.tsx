import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { SessionUser, getSessionUser, setSessionUser as saveSessionUser } from "../lib/auth";
import { api } from "../lib/api";

interface UserContextType {
  user: SessionUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  refreshUser: async () => {},
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
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    const storedUser = getSessionUser();
    if (storedUser) {
      setUser(storedUser);
    }
    refreshUser().finally(() => setLoading(false));
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
