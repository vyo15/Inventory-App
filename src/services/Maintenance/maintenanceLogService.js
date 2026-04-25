import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../../firebase";

const MAINTENANCE_LOG_COLLECTION = "maintenance_logs";

const safeTrim = (value) => String(value || "").trim();

const normalizeCount = (value) => Number(value || 0);

// -----------------------------------------------------------------------------
// ACTIVE / FINAL: audit trail resmi untuk semua aksi Reset & Maintenance Data.
// Service ini dipisah dari service reset/repair agar flow operasional aktif tidak
// ikut terganggu. Log ini hanya mencatat metadata aksi, tidak mengubah stok/kas.
// -----------------------------------------------------------------------------
export const createMaintenanceLog = async ({
  actionType = "maintenance",
  mode = "dry_run",
  modules = [],
  summary = {},
  affectedCollections = [],
  affectedCount = 0,
  dryRun = true,
  status = "success",
  note = "",
} = {}) => {
  const logRef = doc(collection(db, MAINTENANCE_LOG_COLLECTION));
  const normalizedModules = Array.isArray(modules) ? modules.filter(Boolean) : [];
  const normalizedCollections = Array.isArray(affectedCollections)
    ? affectedCollections.filter(Boolean)
    : [];

  await setDoc(logRef, {
    actionType: safeTrim(actionType) || "maintenance",
    mode: safeTrim(mode) || "dry_run",
    modules: normalizedModules,
    summary: summary || {},
    affectedCollections: normalizedCollections,
    affectedCount: normalizeCount(affectedCount),
    dryRun: Boolean(dryRun),
    status: safeTrim(status) || "success",
    note: safeTrim(note),
    executedAt: serverTimestamp(),
    executedBy: "client-ui",
  });

  return logRef.id;
};

// -----------------------------------------------------------------------------
// ACTIVE / FINAL: riwayat aksi dipakai UI maintenance agar admin bisa melihat
// audit singkat setelah menjalankan dry run, repair aman, atau reset destructive.
// -----------------------------------------------------------------------------
export const getLatestMaintenanceLogs = async (maxItems = 20) => {
  const logsQuery = query(
    collection(db, MAINTENANCE_LOG_COLLECTION),
    orderBy("executedAt", "desc"),
    limit(maxItems),
  );
  const snapshot = await getDocs(logsQuery);

  return snapshot.docs.map((itemDoc) => ({
    id: itemDoc.id,
    ...itemDoc.data(),
  }));
};
