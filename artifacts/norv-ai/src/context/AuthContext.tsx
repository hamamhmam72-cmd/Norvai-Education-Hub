import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, getMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("norv_token"));
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    async function restoreSession() {
      if (token) {
        try {
          const fetchedUser = await getMe();
          setUser(fetchedUser);
        } catch (error) {
          console.error("Failed to restore session", error);
          localStorage.removeItem("norv_token");
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    }
    restoreSession();
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("norv_token", newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem("norv_token");
    setToken(null);
    setUser(null);
    setLocation("/login");
  };

  const updateUser = (newUser: User) => {
    setUser(newUser);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
