import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { favoritesApi } from '../services/api';
import { useAuth } from './AuthContext';

const FavoritesContext = createContext(null);
const EMPTY = { farmers: new Set(), products: new Set(), markets: new Set() };

const toSets = (f) => ({
  farmers: new Set(f.farmers.map((farmer) => farmer._id)),
  products: new Set(f.products.map((product) => product._id)),
  markets: new Set(f.markets.map((market) => market._id)),
});

// Customers' saved farmers / products / markets, shared across pages.
export function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const [favs, setFavs] = useState(EMPTY);
  const isCustomer = user?.role === 'customer';

  useEffect(() => {
    if (!isCustomer) return setFavs(EMPTY);
    favoritesApi.list().then((res) => setFavs(toSets(res.data.favorites))).catch(() => {});
  }, [isCustomer, user?._id]);

  const has = (type, id) => favs[type].has(id);

  const toggle = useCallback(
    async (type, id) => {
      const on = favs[type].has(id);
      // Optimistic update, rolled back on failure.
      const next = new Set(favs[type]);
      on ? next.delete(id) : next.add(id);
      setFavs((previousFavs) => ({ ...previousFavs, [type]: next }));
      try {
        await (on ? favoritesApi.remove(type, id) : favoritesApi.add(type, id));
      } catch {
        setFavs((previousFavs) => ({ ...previousFavs, [type]: favs[type] }));
      }
    },
    [favs]
  );

  return <FavoritesContext.Provider value={{ has, toggle, enabled: isCustomer }}>{children}</FavoritesContext.Provider>;
}

export const useFavorites = () => useContext(FavoritesContext);
