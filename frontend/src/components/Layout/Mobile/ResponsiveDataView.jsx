import DataTableView from "../Table/DataTableView";

// =====================================================
// SECTION: ResponsiveDataView — AKTIF / UI-ONLY
// Fungsi:
// - alias standar IMS Mobile v1: desktop table, mobile card/list lewat mobileCardConfig.
// - sengaja mengarah ke DataTableView existing agar tidak ada dua implementasi table berbeda.
// Guardrail:
// - jangan menambah business logic di sini; komponen ini hanya naming standar untuk page baru.
// =====================================================
export default DataTableView;
