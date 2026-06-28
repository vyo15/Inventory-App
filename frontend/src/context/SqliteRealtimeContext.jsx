import { useEffect, useMemo, useState } from "react";
import {
  getSqliteRealtimeStatus,
  subscribeSqliteRealtime,
  subscribeSqliteRealtimeStatus,
} from "../services/System/sqliteRealtimeService";
import SqliteRealtimeContext from "./sqliteRealtimeContext.js";

export const SqliteRealtimeProvider = ({ children }) => {
  const [lastEvent, setLastEvent] = useState(null);
  const [status, setStatus] = useState(() => getSqliteRealtimeStatus());

  useEffect(() => {
    const unsubscribeEvents = subscribeSqliteRealtime(setLastEvent);
    const unsubscribeStatus = subscribeSqliteRealtimeStatus(setStatus);
    return () => {
      unsubscribeEvents();
      unsubscribeStatus();
    };
  }, []);

  const value = useMemo(() => ({ lastEvent, status }), [lastEvent, status]);
  return (
    <SqliteRealtimeContext.Provider value={value}>
      {children}
    </SqliteRealtimeContext.Provider>
  );
};
