"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  authApi,
  clearToken,
  extractApiError,
  getToken,
  setToken,
} from "./api-client";
import type { LoginPayload, RegisterPayload, User } from "@/types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const me = await authApi.me();
      setUser(me);
    } catch (err) {
      clearToken();
      setUser(null);
      setError(extractApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Bootstrap: load the current user on mount
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (payload: LoginPayload) => {
    setError(null);
    try {
      const { token, user } = await authApi.login(payload);
      setToken(token);
      setUser(user);
      router.push("/projects");
    } catch (err) {
      setError(extractApiError(err));
      throw err;
    }
  }, [router]);

  const register = useCallback(async (payload: RegisterPayload) => {
    setError(null);
    try {
      const { token, user } = await authApi.register(payload);
      setToken(token);
      setUser(user);
      router.push("/projects");
    } catch (err) {
      setError(extractApiError(err));
      throw err;
    }
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore server-side logout failures; local cleanup still happens
    } finally {
      clearToken();
      setUser(null);
      router.push("/");
    }
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      error,
      login,
      register,
      logout,
      refreshUser,
      isAuthenticated: !!user,
    }),
    [user, isLoading, error, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
