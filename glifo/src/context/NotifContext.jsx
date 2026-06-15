import { createContext, useContext, useState, useCallback } from 'react';

const NotifContext = createContext(null);

let _id = 1;

export function NotifProvider({ children }) {
  const [notifs, setNotifs] = useState([]);

  const push = useCallback((msg, type = 'info', duration = 4000) => {
    const id = _id++;
    setNotifs(prev => [{ id, msg, type, ts: Date.now() }, ...prev].slice(0, 20));
    if (duration > 0) setTimeout(() => dismiss(id), duration);
  }, []);

  const dismiss = useCallback((id) => {
    setNotifs(prev => prev.filter(n => n.id !== id));
  }, []);

  const clear = useCallback(() => setNotifs([]), []);

  return (
    <NotifContext.Provider value={{ notifs, push, dismiss, clear }}>
      {children}
    </NotifContext.Provider>
  );
}

export const useNotif = () => useContext(NotifContext);
