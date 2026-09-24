import { createContext, useContext, useEffect, useState } from 'react';

const CartContext = createContext(null);
const KEY = 'marketlink_cart';

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
};

// Cart lines: { product: {_id, name, price, unit, image, farmerId, stallName, max}, quantity }
export function CartProvider({ children }) {
  const [items, setItems] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable */
    }
  }, [items]);

  const addItem = (product, quantity = 1) =>
    setItems((cur) => {
      const found = cur.find((i) => i.product._id === product._id);
      if (!found) return [...cur, { product, quantity: Math.min(quantity, product.max) }];
      return cur.map((i) =>
        i.product._id === product._id ? { ...i, product, quantity: Math.min(i.quantity + quantity, product.max) } : i
      );
    });

  const setQuantity = (id, quantity) =>
    setItems((cur) => cur.map((i) => (i.product._id === id ? { ...i, quantity: Math.max(1, Math.min(quantity, i.product.max)) } : i)));

  // Refresh price/stock from live data ({ [productId]: product }); clamps quantities to stock.
  const sync = (live) =>
    setItems((cur) =>
      cur.map((i) => {
        const l = live[i.product._id];
        if (!l) return i;
        return { product: { ...i.product, price: l.price, max: l.quantityAvailable }, quantity: Math.min(i.quantity, l.quantityAvailable) };
      })
    );

  const removeItem = (id) => setItems((cur) => cur.filter((i) => i.product._id !== id));
  const clear = () => setItems([]);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const total = items.reduce((s, i) => s + i.quantity * i.product.price, 0);

  return <CartContext.Provider value={{ items, addItem, setQuantity, removeItem, sync, clear, count, total }}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
