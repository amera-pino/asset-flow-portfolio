import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

import { API_PATHS } from "../constants/APIPaths";
import { ApiResponseError, apiFetch } from "../lib/api";
import { clearSessionToken, setSessionToken, toAuthUser } from "../lib/authStorage";
import type { AuthUser, LoginResponseUser } from "../types/auth";

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (user: AuthUser, sessionToken?: string | null) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  isInitializing: true,
  login: () => undefined,
  logout: async () => undefined,
  refreshUser: async () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  async function refreshUser() {
    try {
      const currentUser = await apiFetch<LoginResponseUser>(API_PATHS.me);
      setUser(toAuthUser(currentUser));
    } catch (error) {
      if (error instanceof ApiResponseError && error.status === 401) {
        setUser(null);
        clearSessionToken();
        return;
      }

      throw error;
    }
  }

  useEffect(() => {
    async function initializeAuth() {
      try {
        await refreshUser();
      } finally {
        setIsInitializing(false);
      }
    }

    void initializeAuth();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isInitializing,
      login(nextUser, sessionToken) {
        setSessionToken(sessionToken);
        setUser(nextUser);
      },
      async logout() {
        try {
          await apiFetch(API_PATHS.logout, { method: "POST" });
        } finally {
          clearSessionToken();
          setUser(null);
        }
      },
      async refreshUser() {
        await refreshUser();
      },
    }),
    [isInitializing, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
