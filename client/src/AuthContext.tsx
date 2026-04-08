import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@dad-golf/shared";
import { api } from "./api.js";
import { getAuthToken, setAuthToken } from "./authStore.js";

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (payload: {
    username: string;
    password: string;
    displayName: string;
    handicap: number;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (displayName: string, handicap: number) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => {
        setAuthToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function signIn(username: string, password: string) {
    const res = await api.login(username, password);
    setAuthToken(res.token);
    setUser(res.user);
  }

  async function signUp(payload: {
    username: string;
    password: string;
    displayName: string;
    handicap: number;
  }) {
    const res = await api.register(payload);
    setAuthToken(res.token);
    setUser(res.user);
  }

  async function signOut() {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    setAuthToken(null);
    setUser(null);
  }

  async function refreshProfile() {
    try {
      const res = await api.me();
      setUser(res.user);
    } catch {
      setAuthToken(null);
      setUser(null);
    }
  }

  async function updateProfile(displayName: string, handicap: number) {
    const res = await api.updateProfile(displayName, handicap);
    setUser(res.user);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
