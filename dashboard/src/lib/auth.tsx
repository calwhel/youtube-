import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, setUnauthorizedHandler, type SessionResponse } from "./api";

interface AuthContextValue {
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  channels: SessionResponse["channels"];
  login: (token: string) => Promise<SessionResponse>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [channels, setChannels] = useState<SessionResponse["channels"]>([]);

  const applySession = useCallback((session: SessionResponse) => {
    setChannels(session.channels);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Cookie may already be cleared — still sign out locally.
    }
    setChannels([]);
    setIsAuthenticated(false);
  }, []);

  const login = useCallback(
    async (token: string) => {
      const session = await api.login(token);
      applySession(session);
      return session;
    },
    [applySession],
  );

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setChannels([]);
      setIsAuthenticated(false);
    });
    return () => setUnauthorizedHandler(() => {});
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const session = await api.session();
        applySession(session);
      } catch {
        setIsAuthenticated(false);
      } finally {
        setIsBootstrapping(false);
      }
    })();
  }, [applySession]);

  const value = useMemo(
    () => ({
      isAuthenticated,
      isBootstrapping,
      channels,
      login,
      logout,
    }),
    [isAuthenticated, isBootstrapping, channels, login, logout],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
