import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase";

const MAINTENANCE_LOG_COLLECTION = "maintenance_logs";

const safeTrim = (value) => String(value || "").trim();
const normalizeCount = (value) => Number(value || 0);

// -----------------------------------------------------------------------------
// IMS NOTE [AKTIF/CLEANUP CANDIDATE] — normalisasi array metadata audit.
// Fungsi blok: menjaga modules/affectedCollections selalu array string bersih.
// Alasan cleanup: menghapus filter duplikatif di create/update audit log tanpa
// mengubah schema maintenance_logs. Behavior-preserving cleanup.
// -----------------------------------------------------------------------------
const normalizeTextArray = (items = []) => (
  Array.isArray(items) ? items.map(safeTrim).filter(Boolean) : []
);

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
  planSummary = {},
  resultBuckets = {},
  affectedCollections = [],
  affectedCount = 0,
  dryRun = true,
  status = "success",
  note = "",
  executedBy = "client-ui",
} = {}) => {
  const logRef = doc(collection(db, MAINTENANCE_LOG_COLLECTION));
  const normalizedModules = normalizeTextArray(modules);
  const normalizedCollections = normalizeTextArray(affectedCollections);

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
    planSummary: planSummary || {},
    resultBuckets: resultBuckets || {},
    executedAt: serverTimestamp(),
    executedBy: safeTrim(executedBy) || "client-ui",
  });

  return logRef.id;
};

// -----------------------------------------------------------------------------
// ACTIVE / GUARDED: update status audit reset destructive.
// Dipakai agar reset membuat log "started" sebelum delete berjalan, lalu log yang
// sama diubah menjadi success/failed. Jika update akhir gagal, data reset tetap
// tidak diklaim gagal oleh UI karena error audit dipisah dari error reset.
// -----------------------------------------------------------------------------
export const updateMaintenanceLogStatus = async (logId, {
  status = "success",
  summary,
  planSummary,
  resultBuckets,
  affectedCollections,
  affectedCount,
  note,
  errorMessage,
} = {}) => {
  const safeLogId = safeTrim(logId);
  if (!safeLogId) {
    throw new Error("ID maintenance log tidak valid.");
  }

  const payload = {
    status: safeTrim(status) || "success",
    updatedAt: serverTimestamp(),
  };

  if (summary !== undefined) payload.summary = summary || {};
  if (planSummary !== undefined) payload.planSummary = planSummary || {};
  if (resultBuckets !== undefined) payload.resultBuckets = resultBuckets || {};
  if (affectedCollections !== undefined) {
    payload.affectedCollections = normalizeTextArray(affectedCollections);
  }
  if (affectedCount !== undefined) payload.affectedCount = normalizeCount(affectedCount);
  if (note !== undefined) payload.note = safeTrim(note);
  if (errorMessage !== undefined) payload.errorMessage = safeTrim(errorMessage);

  await updateDoc(doc(db, MAINTENANCE_LOG_COLLECTION, safeLogId), payload);
  return safeLogId;
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
