"use client";
import { createContext, useCallback, useContext, useState } from "react";
import Icon from "./Icon";

const Ctx = createContext(() => {});

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const toast = useCallback((msg, icon = "check") => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l, { id, msg, icon }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 3000);
  }, []);
  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div className="toast" key={t.id}>
            <span className="ti"><Icon name={t.icon} /></span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
