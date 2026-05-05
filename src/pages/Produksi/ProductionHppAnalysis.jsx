// =====================================================
// Page: Analisis HPP Produksi
// Tahap 1: membaca work log completed dan payroll produksi
// untuk analisa biaya realisasi per output
// =====================================================

import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Col, Empty, Input, Select, Space, Table, Typography, message, Tag } from "antd";
import { FileExcelOutlined } from "@ant-design/icons";
import { getCompletedProductionWorkLogs } from "../../services/Produksi/productionWorkLogsService";
import { getAllProductionPayrolls } from "../../services/Produksi/productionPayrollsService";
import ProductionSummaryCards from "../../components/Produksi/shared/ProductionSummaryCards";
import ProductionFilterCard from "../../components/Produksi/shared/ProductionFilterCard";
import ProductionPageHeader from "../../components/Produksi/shared/ProductionPageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import { exportJsonToExcel } from "../../utils/export/exportExcel";
import { formatDateId } from "../../utils/formatters/dateId";
import formatNumber from "../../utils/formatters/numberId";
import formatCurrency from "../../utils/formatters/currencyId";

// =====================================================
// Formatter final lintas aplikasi
// ACTIVE / FINAL: HPP produksi hanya memakai helper shared untuk display.
// =====================================================

// =====================================================
// ACTIVE / FINAL - label target type untuk tampilan dan export HPP.
// Fungsi blok:
// - mengubah kode target type menjadi label yang mudah dibaca user;
// - tidak mengubah source data Work Log atau rumus HPP.
// Hubungan dengan flow laporan/export: dipakai agar XLSX HPP bukan data mentah teknis.
// Status: aktif dipakai; bukan legacy dan bukan kandidat cleanup.
// =====================================================
const TARGET_TYPE_LABEL_MAP = {
  product: "Produk Jadi",
  semi_finished_material: "Semi Finished",
};

const resolveTargetTypeLabel = (targetType) =>
  TARGET_TYPE_LABEL_MAP[targetType] || targetType || "-";

// =====================================================
// ACTIVE / GUARDED - helper warning cost 0 HPP.
// Fungsi blok:
// - membaca angka cost hasil flow HPP aktif tanpa mengubah rumus;
// - memberi penjelasan saat cost 0 agar user tidak mengira HPP sudah valid.
// Hubungan dengan flow HPP/Work Log:
// - HPP tetap bersumber dari Work Log completed dan payroll confirmed/paid;
// - helper ini hanya visibility UI, bukan backfill dan bukan kalkulasi baru.
// Status:
// - aktif dipakai; bukan legacy dan bukan kandidat cleanup.
// =====================================================
const buildHppCostWarnings = ({
  materialCost,
  directLaborCost,
  totalCost,
  hppPerUnit,
  goodQty,
}) => {
  const warnings = [];

  if (Number(materialCost || 0) === 0) {
    warnings.push("Biaya material 0. Cek cost bahan atau snapshot material.");
  }

  if (Number(directLaborCost || 0) === 0) {
    warnings.push("Biaya tenaga kerja 0. Cek payroll Work Log.");
  }

  if (Number(totalCost || 0) === 0) {
    warnings.push("Total biaya 0. HPP belum valid untuk analisis.");
  }

  if (Number(hppPerUnit || 0) === 0 && Number(goodQty || 0) > 0) {
    warnings.push("HPP per good unit 0 walaupun good qty ada. Cek sumber biaya Work Log.");
  }

  return warnings;
};

const isPayrollEligibleForHpp = (payroll, workLogId) =>
  payroll.workLogId === workLogId &&
  ["confirmed", "paid"].includes(payroll.status) &&
  payroll.status !== "cancelled" &&
  payroll.includePayrollInHpp !== false;

const calculateDirectLaborCost = ({ workLog, payrolls }) => {
  const payrollTotal = payrolls
    .filter((payroll) => isPayrollEligibleForHpp(payroll, workLog.id))
    .reduce((sum, payroll) => sum + Number(payroll.finalAmount || 0), 0);

  return payrollTotal > 0 ? payrollTotal : Number(workLog.laborCostActual || 0);
};

// IMS NOTE [AKTIF/GUARDED] - Row kalkulasi HPP tetap lokal di halaman.
// Fungsi blok: menyatukan rumus material + labor + overhead -> total -> HPP/unit
// agar table, summary, dan export membaca angka yang sama tanpa memindahkan rule ke abstraction jauh.
// Behavior: tidak mengubah source completed Work Log, payroll final, warning cost 0, atau schema.
const buildHppAnalysisRow = ({ workLog, payrolls }) => {
  const materialCost = Number(workLog.materialCostActual || 0);
  const directLaborCost = calculateDirectLaborCost({ workLog, payrolls });
  const overheadCost = Number(workLog.overheadCostActual || 0);
  const totalCost = materialCost + directLaborCost + overheadCost;
  const goodQty = Number(workLog.goodQty || 0);
  const hppPerUnit = goodQty > 0 ? totalCost / goodQty : 0;
  const costWarnings = buildHppCostWarnings({
    materialCost,
    directLaborCost,
    totalCost,
    hppPerUnit,
    goodQty,
  });

  return {
    id: workLog.id,
    workNumber: workLog.workNumber || "-",
    targetType: workLog.targetType || "-",
    targetName: workLog.targetName || "-",
    stepName: workLog.stepName || "-",
    workDate: workLog.workDate || null,
    completedAt: workLog.completedAt || null,
    goodQty,
    materialCost,
    directLaborCost,
    overheadCost,
    totalCost,
    hppPerUnit,
    costWarnings,
  };
};

const matchesHppAnalysisFilters = ({ row, search, targetTypeFilter }) => {
  const searchText = search.trim().toLowerCase();
  const searchableText = [row.workNumber, row.targetName, row.stepName]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  const matchSearch = !searchText || searchableText.includes(searchText);
  const matchTargetType = targetTypeFilter === "all" || row.targetType === targetTypeFilter;

  return matchSearch && matchTargetType;
};

const buildHppAnalysisSummary = (rows) => {
  const totalLogs = rows.length;
  const totalProductionCost = rows.reduce((sum, row) => sum + Number(row.totalCost || 0), 0);
  const totalGoodQty = rows.reduce((sum, row) => sum + Number(row.goodQty || 0), 0);
  const averageHpp = totalGoodQty > 0 ? totalProductionCost / totalGoodQty : 0;
  const warningRows = rows.filter(
    (row) => Array.isArray(row.costWarnings) && row.costWarnings.length > 0,
  ).length;

  return {
    totalLogs,
    totalProductionCost,
    totalGoodQty,
    averageHpp,
    warningRows,
  };
};

const resolveCostValidationText = (costWarnings = []) =>
  Array.isArray(costWarnings) && costWarnings.length > 0
    ? costWarnings.join("; ")
    : "Cost valid";

const buildHppExportRows = (rows) =>
  rows.map((row) => ({
    workNumber: row.workNumber || "-",
    workDateDisplay: formatDateId(row.workDate, true),
    completedAtDisplay: formatDateId(row.completedAt, true),
    targetTypeLabel: resolveTargetTypeLabel(row.targetType),
    targetName: row.targetName || "-",
    stepName: row.stepName || "-",
    goodQtyDisplay: formatNumber(row.goodQty),
    materialCostDisplay: formatCurrency(row.materialCost),
    directLaborCostDisplay: formatCurrency(row.directLaborCost),
    overheadCostDisplay: formatCurrency(row.overheadCost),
    totalCostDisplay: formatCurrency(row.totalCost),
    hppPerUnitDisplay: formatCurrency(row.hppPerUnit),
    costValidation: resolveCostValidationText(row.costWarnings),
  }));

const ProductionHppAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [workLogs, setWorkLogs] = useState([]);
  const [payrolls, setPayrolls] = useState([]);

  const [search, setSearch] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("all");

  const loadData = async () => {
    try {
      setLoading(true);
      const [workLogResult, payrollResult] = await Promise.all([
        getCompletedProductionWorkLogs(),
        getAllProductionPayrolls(),
      ]);

      setWorkLogs(workLogResult);
      setPayrolls(payrollResult);
    } catch (error) {
      console.error(error);
      message.error("Gagal memuat analisis HPP produksi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const rows = useMemo(
    () => workLogs.map((workLog) => buildHppAnalysisRow({ workLog, payrolls })),
    [workLogs, payrolls],
  );

  const filteredRows = useMemo(
    () => rows.filter((row) => matchesHppAnalysisFilters({ row, search, targetTypeFilter })),
    [rows, search, targetTypeFilter],
  );

  const summary = useMemo(
    () => buildHppAnalysisSummary(filteredRows),
    [filteredRows],
  );

  const summaryItems = useMemo(
    () => [
      { key: "total-logs", title: "Total Work Log", value: formatNumber(summary.totalLogs) },
      {
        key: "total-cost",
        title: "Total Biaya Produksi",
        value: formatCurrency(summary.totalProductionCost),
      },
      { key: "good-qty", title: "Total Good Qty", value: formatNumber(summary.totalGoodQty) },
      { key: "avg-hpp", title: "Rata-rata HPP / Unit", value: formatCurrency(summary.averageHpp) },
      { key: "warning-rows", title: "Perlu Cek Cost", value: formatNumber(summary.warningRows) },
    ],
    [summary],
  );

  // =====================================================
  // ACTIVE / FINAL - export HPP Analysis ke XLSX.
  // Fungsi blok:
  // - menyiapkan file Excel yang rapi dari rows HPP yang sedang tampil;
  // - menampilkan header manusiawi, Rupiah, tanggal, dan catatan validasi cost.
  // Hubungan dengan flow HPP/laporan:
  // - hanya membaca hasil analisis Work Log completed + payroll final;
  // - tidak mengubah rumus HPP, payroll, Work Log, atau source data bisnis.
  // Status: aktif dipakai; bukan legacy dan bukan kandidat cleanup.
  // =====================================================
  const exportHppToExcel = async () => {
    if (filteredRows.length === 0) {
      message.warning("Tidak ada data HPP untuk diekspor.");
      return;
    }

    await exportJsonToExcel({
      title: "Laporan Analisis HPP Produksi IMS Bunga Flanel",
      subtitle: "Export HPP membaca Work Log completed dan payroll final sesuai filter aktif, tanpa mengubah rumus biaya.",
      fileName: "laporan-hpp-produksi",
      sheetName: "HPP Analysis",
      filters: [
        `Target Type: ${targetTypeFilter === "all" ? "Semua" : resolveTargetTypeLabel(targetTypeFilter)}`,
        `Pencarian: ${search || "-"}`,
        "Catatan: row dengan cost 0 perlu dicek sebelum dipakai sebagai analisis final.",
      ],
      columns: [
        { key: "workNumber", label: "No. Work Log" },
        { key: "workDateDisplay", label: "Tanggal Work Log" },
        { key: "completedAtDisplay", label: "Tanggal Selesai" },
        { key: "targetTypeLabel", label: "Target Type" },
        { key: "targetName", label: "Target" },
        { key: "stepName", label: "Step" },
        { key: "goodQtyDisplay", label: "Good Qty" },
        { key: "materialCostDisplay", label: "Biaya Material" },
        { key: "directLaborCostDisplay", label: "Biaya Tenaga Kerja" },
        { key: "overheadCostDisplay", label: "Overhead" },
        { key: "totalCostDisplay", label: "Total Biaya" },
        { key: "hppPerUnitDisplay", label: "HPP / Unit" },
        { key: "costValidation", label: "Validasi Cost" },
      ],
      data: buildHppExportRows(filteredRows),
    });

    message.success("Laporan HPP berhasil diekspor ke Excel.");
  };

  const columns = [
    {
      title: "No. Work Log",
      dataIndex: "workNumber",
      key: "workNumber",
      width: 160,
      render: (value) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: "Target / Step",
      key: "targetStep",
      width: 260,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.targetName}</div>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>
            {record.stepName}
          </div>
        </div>
      ),
    },
    {
      title: "Good Qty",
      dataIndex: "goodQty",
      key: "goodQty",
      width: 110,
      render: (value) => formatNumber(value),
    },
    {
      title: "Material Cost",
      dataIndex: "materialCost",
      key: "materialCost",
      width: 150,
      render: (value) => formatCurrency(value),
    },
    {
      title: "Direct Labor",
      dataIndex: "directLaborCost",
      key: "directLaborCost",
      width: 150,
      render: (value) => formatCurrency(value),
    },
    {
      title: "Overhead",
      dataIndex: "overheadCost",
      key: "overheadCost",
      width: 140,
      render: (value) => formatCurrency(value),
    },
    {
      title: "Total Cost",
      dataIndex: "totalCost",
      key: "totalCost",
      width: 150,
      render: (value) => formatCurrency(value),
    },
    {
      title: "HPP / Unit",
      dataIndex: "hppPerUnit",
      key: "hppPerUnit",
      width: 150,
      render: (value) => formatCurrency(value),
    },
    {
      title: "Validasi Cost",
      dataIndex: "costWarnings",
      key: "costWarnings",
      width: 280,
      render: (warnings) => {
        if (!Array.isArray(warnings) || warnings.length === 0) {
          return <Tag color="green">Cost valid</Tag>;
        }

        return (
          <Space direction="vertical" size={4}>
            {warnings.map((warning) => (
              <Alert
                key={warning}
                type="warning"
                showIcon
                message={warning}
                style={{ padding: "4px 8px" }}
              />
            ))}
          </Space>
        );
      },
    },
  ];

  return (
    <>
      {/* AKTIF / GUARDED: header dimigrasikan ke shared produksi agar konsisten, tanpa mengubah mapping/calc HPP. */}
      <ProductionPageHeader
        title="Analisis HPP Produksi"
        description="Analisa biaya realisasi bahan, tenaga kerja, dan overhead per work log completed dengan baseline layout shared yang seragam."
        onRefresh={loadData}
      />

      <PageSection
        title="Ringkasan HPP"
        subtitle="Ringkasan mengikuti hasil filter target type dan pencarian work log agar audit biaya lebih cepat."
      >
        <ProductionSummaryCards items={summaryItems} columns={{ xs: 24, sm: 12, md: 12, lg: 6 }} />
      </PageSection>

      <PageSection
        title="Filter Analisis"
        subtitle="Filter ini membantu membaca kelompok work log tertentu tanpa mengubah contract HPP aktif."
      >
        {/* AKTIF / GUARDED: action export dipertahankan di area filter agar urutan kerja user tetap sama. */}
        <Space style={{ marginBottom: 12 }}>
          <Button
            type="primary"
            icon={<FileExcelOutlined />}
            onClick={exportHppToExcel}
            disabled={filteredRows.length === 0}
          >
            Ekspor HPP XLSX
          </Button>
        </Space>
        {/* AKTIF / GUARDED: filter card shared dipakai untuk konsistensi visual; state/filter logic tidak diubah. */}
        <ProductionFilterCard>
          <Col xs={24} md={12}>
            <Input
              style={{ width: "100%" }}
              placeholder="Cari work log, target, step..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={8}>
            <Select
              style={{ width: "100%" }}
              value={targetTypeFilter}
              onChange={setTargetTypeFilter}
              options={[
                { value: "all", label: "Semua Target Type" },
                {
                  value: "semi_finished_material",
                  label: "Semi Finished Material",
                },
                { value: "product", label: "Product" },
              ]}
            />
          </Col>
        </ProductionFilterCard>
      </PageSection>

      <PageSection
        title="Tabel Analisis HPP"
        subtitle="Tabel tetap membaca Work Log completed dan payroll aktif tanpa mengubah contract biaya produksi yang sudah guarded."
        extra={<Tag color="purple">{formatNumber(filteredRows.length)} baris</Tag>}
      >
        {summary.warningRows > 0 ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={`${formatNumber(summary.warningRows)} Work Log perlu cek cost`}
            description="Angka HPP tidak diubah otomatis. Cek cost bahan/snapshot material, payroll Work Log, dan output good qty sebelum memakai HPP untuk analisis final."
          />
        ) : null}
        {/* =========================
            SECTION: tabel HPP baseline global
            Fungsi:
            - memigrasikan halaman HPP dari card layout manual ke shared page wrapper resmi
            - menjaga tabel analisis tetap seragam tanpa menyentuh logic perhitungan biaya
            Status: aktif / final
        ========================= */}
        <Table
          className="app-data-table"
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredRows}
          scroll={{ x: 1550 }}
          locale={{
            emptyText: <Empty description="Belum ada data analisis HPP" />,
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
          }}
        />
      </PageSection>
    </>
  );
};

export default ProductionHppAnalysis;
