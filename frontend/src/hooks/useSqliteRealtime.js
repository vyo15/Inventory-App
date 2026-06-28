import { useContext } from "react";
import SqliteRealtimeContext from "../context/sqliteRealtimeContext.js";

const useSqliteRealtime = () => useContext(SqliteRealtimeContext);

export default useSqliteRealtime;
