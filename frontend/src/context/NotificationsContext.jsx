import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { notificationsApi } from '../services/api';
import { useAuth } from './AuthContext';

const NotificationsContext = createContext({ unread: 0, refresh: () => {} });

// Keeps the unread count fresh: on login, on every page change, and every minute.
export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    if (!user) return setUnread(0);
    notificationsApi.list({ limit: 1 }).then((res) => setUnread(res.data.unread)).catch(() => {});
  }, [user]);

  useEffect(refresh, [refresh, pathname]);
  useEffect(() => {
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, [refresh]);

  return <NotificationsContext.Provider value={{ unread, refresh }}>{children}</NotificationsContext.Provider>;
}

export const useNotifications = () => useContext(NotificationsContext);
