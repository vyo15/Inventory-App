import { createContext } from "react";
import { getSqliteRealtimeStatus } from "../services/System/sqliteRealtimeService";

const SqliteRealtimeContext = createContext({
  lastEvent: null,
  status: getSqliteRealtimeStatus(),
});

export default SqliteRealtimeContext;
