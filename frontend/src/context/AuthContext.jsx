import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, tokenStore } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  // Restore the session from a saved token.
  useEffect(() => {
    if (!tokenStore.get()) return;
    authApi
      .me()
      .then((res) => setUser(res.data.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const startSession = useCallback((data) => {
    tokenStore.set(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const login = async (credentials) => startSession((await authApi.login(credentials)).data);
  const registerCustomer = async (form) => startSession((await authApi.registerCustomer(form)).data);
  const registerFarmer = async (form) => startSession((await authApi.registerFarmer(form)).data);

  const logout = () => {
    tokenStore.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, registerCustomer, registerFarmer, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// Where each role lands after login.
export const homeFor = (user) =>
  user?.role === 'admin' ? '/admin' : user?.role === 'farmer' ? '/farmer' : '/markets';
