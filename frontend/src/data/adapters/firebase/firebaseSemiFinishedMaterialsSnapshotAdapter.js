import { getAllSemiFinishedMaterials } from "../../../services/Produksi/semiFinishedMaterialsService";

const compareByName = (first = {}, second = {}) =>
  String(first.name || first.itemCode || first.code || first.id || "").localeCompare(
    String(second.name || second.itemCode || second.code || second.id || ""),
    "id-ID",
  );

export const listSemiFinishedMaterialSnapshots = async () => {
  const rows = await getAllSemiFinishedMaterials();
  return rows.sort(compareByName);
};

export const getSemiFinishedMaterialSnapshotById = async (semiFinishedMaterialId) => {
  if (!semiFinishedMaterialId) return null;
  const rows = await listSemiFinishedMaterialSnapshots();
  return rows.find((row) => String(row.id) === String(semiFinishedMaterialId)) || null;
};
