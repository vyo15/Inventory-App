// =====================================================
// Page: Analisis HPP Produksi
// Tahap 1: membaca work log completed dan payroll produksi
// untuk analisa biaya realisasi per output
// =====================================================

import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Col, Empty, Input, Select, Space, Table, Tooltip, Typography, message, Tag } from "antd";
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

  const rows = useMemo(() => {
    return workLogs.map((workLog) => {
      // =====================================================
      // ACTIVE / FINAL
      // HPP inti tidak boleh menarik semua payroll non-cancelled secara longgar.
      // Setelah flow payroll difinalkan, direct labor HPP hanya membaca payroll
      // yang sudah lolos review minimal confirmed/paid dan memang diizinkan masuk
      // HPP melalui rule step snapshot pada payroll line.
      // =====================================================
      const relatedPayrolls = payrolls.filter(
        (item) =>
          item.workLogId === workLog.id &&
          ["confirmed", "paid"].includes(item.status) &&
          item.status !== "cancelled" &&
          item.includePayrollInHpp !== false,
      );

      const payrollTotal = relatedPayrolls.reduce(
        (sum, item) => sum + Number(item.finalAmount || 0),
        0,
      );

      const materialCost = Number(workLog.materialCostActual || 0);
      const directLaborCost =
        payrollTotal > 0 ? payrollTotal : Number(workLog.laborCostActual || 0);
      const overheadCost = Number(workLog.overheadCostActual || 0);
      const totalCost = materialCost + directLaborCost + overheadCost;
      const goodQty = Number(workLog.goodQty || 0);
      const hppPerUnit = goodQty > 0 ? totalCost / goodQty : 0;
      // =====================================================
      // ACTIVE / GUARDED - warning per baris HPP.
      // Fungsi blok:
      // - menempelkan daftar warning cost 0 ke row tabel tanpa mengubah angka cost;
      // - menjaga user membaca HPP sebagai data analisis yang perlu dicek jika sumber cost kosong.
      // Hubungan dengan flow HPP/Work Log:
      // - angka tetap berasal dari Work Log completed + payroll final;
      // - warning hanya visibility UI dan tidak mem-posting ulang Work Log.
      // Status: aktif dipakai; bukan legacy/kandidat cleanup.
      // =====================================================
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
    });
  }, [workLogs, payrolls]);

  const filteredRows = useMemo(() => {
    return rows.filter((item) => {
      const searchText = search.trim().toLowerCase();

      const matchSearch =
        !searchText ||
        String(item.workNumber || "")
          .toLowerCase()
          .includes(searchText) ||
        String(item.targetName || "")
          .toLowerCase()
          .includes(searchText) ||
        String(item.stepName || "")
          .toLowerCase()
          .includes(searchText);

      const matchTargetType =
        targetTypeFilter === "all" || item.targetType === targetTypeFilter;

      return matchSearch && matchTargetType;
    });
  }, [rows, search, targetTypeFilter]);

  const summary = useMemo(() => {
    const totalLogs = filteredRows.length;
    const totalProductionCost = filteredRows.reduce(
      (sum, item) => sum + Number(item.totalCost || 0),
      0,
    );
    const totalGoodQty = filteredRows.reduce(
      (sum, item) => sum + Number(item.goodQty || 0),
      0,
    );
    const averageHpp =
      totalGoodQty > 0 ? totalProductionCost / totalGoodQty : 0;
    // =====================================================
    // ACTIVE / GUARDED - ringkasan warning HPP.
    // Fungsi blok:
    // - menghitung jumlah row yang punya warning cost 0;
    // - hanya untuk visibility, tidak mengubah formula HPP atau sumber cost.
    // Status: aktif dipakai; bukan legacy/kandidat cleanup.
    // =====================================================
    const warningRows = filteredRows.filter(
      (item) => Array.isArray(item.costWarnings) && item.costWarnings.length > 0,
    ).length;

    return {
      totalLogs,
      totalProductionCost,
      totalGoodQty,
      averageHpp,
      warningRows,
    };
  }, [filteredRows]);

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
      data: filteredRows.map((row) => ({
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
        costValidation:
          Array.isArray(row.costWarnings) && row.costWarnings.length > 0
            ? row.costWarnings.join("; ")
            : "Cost valid",
      })),
    });

    message.success("Laporan HPP berhasil diekspor ke Excel.");
  };

  const compactTextClampStyle = {
    display: "-webkit-box",
    overflow: "hidden",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
  };

  const compactTagStyle = { marginInlineEnd: 0 };

  // =====================================================
  // SECTION: Main Table Analisis HPP Compact — GUARDED
  // Fungsi:
  // - Memadatkan kolom utama HPP produksi agar tabel bisa dibaca tanpa horizontal scroll besar.
  // - Menjaga work number, target, step, good qty, material, tenaga kerja, overhead, total, HPP/unit, dan validasi cost tetap terlihat atau terbaca lewat tooltip.
  //
  // Dipakai oleh:
  // - Halaman ProductionHppAnalysis.jsx pada section Tabel Analisis HPP.
  //
  // Alasan perubahan:
  // - Main table sebelumnya memakai scroll x besar sehingga audit HPP kurang nyaman; patch ini hanya mengubah presentasi kolom UI.
  //
  // Catatan cleanup:
  // - Belum ada; export, filter, summary, source Work Log, payroll final, dan rumus HPP tetap dijaga.
  //
  // Risiko:
  // - Mengubah render ini sembarangan dapat menyembunyikan angka HPP, warning cost, atau konteks Work Log yang dipakai user untuk audit biaya produksi.
  // =====================================================
  const columns = [
    {
      title: "Work Log / Target",
      key: "workLogTarget",
      width: "28%",
      render: (_, record) => (
        <Space direction="vertical" size={6} style={{ width: "100%" }}>
          <Space size={6} wrap>
            <Tooltip title={record.workNumber || "-"}>
              <Typography.Text strong style={{ ...compactTextClampStyle, maxWidth: 180 }}>
                {record.workNumber || "-"}
              </Typography.Text>
            </Tooltip>
            <Tag color="blue" style={compactTagStyle}>
              {resolveTargetTypeLabel(record.targetType)}
            </Tag>
          </Space>
          <Tooltip title={record.targetName || "-"}>
            <Typography.Text style={compactTextClampStyle}>
              {record.targetName || "-"}
            </Typography.Text>
          </Tooltip>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Selesai: {formatDateId(record.completedAt, true)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Qty / Step",
      key: "qtyStep",
      width: "16%",
      render: (_, record) => (
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Good Qty
          </Typography.Text>
          <Typography.Text strong>{formatNumber(record.goodQty)}</Typography.Text>
          <Tooltip title={record.stepName || "-"}>
            <Typography.Text type="secondary" style={compactTextClampStyle}>
              {record.stepName || "-"}
            </Typography.Text>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: "Biaya Produksi",
      key: "productionCost",
      width: "28%",
      render: (_, record) => (
        <Space direction="vertical" size={2} style={{ width: "100%" }}>
          <Typography.Text>Material: {formatCurrency(record.materialCost)}</Typography.Text>
          <Typography.Text>Tenaga kerja: {formatCurrency(record.directLaborCost)}</Typography.Text>
          <Typography.Text>Overhead: {formatCurrency(record.overheadCost)}</Typography.Text>
          <Typography.Text strong>Total: {formatCurrency(record.totalCost)}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "HPP / Unit",
      key: "hppPerUnit",
      width: "14%",
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{formatCurrency(record.hppPerUnit)}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            per good unit
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Validasi",
      dataIndex: "costWarnings",
      key: "costWarnings",
      width: "14%",
      render: (warnings) => {
        if (!Array.isArray(warnings) || warnings.length === 0) {
          return <Tag color="green" style={compactTagStyle}>Cost valid</Tag>;
        }

        return (
          <Space direction="vertical" size={4} style={{ width: "100%" }}>
            <Tag color="warning" style={compactTagStyle}>
              {formatNumber(warnings.length)} warning cost
            </Tag>
            {warnings.map((warning) => (
              <Tooltip key={warning} title={warning}>
                <Alert
                  type="warning"
                  showIcon
                  message={(
                    <Typography.Text style={{ ...compactTextClampStyle, fontSize: 12 }}>
                      {warning}
                    </Typography.Text>
                  )}
                  style={{ padding: "4px 8px" }}
                />
              </Tooltip>
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
        {/* =====================================================
            ACTIVE / GUARDED - alert warning global HPP.
            Fungsi blok:
            - memberi konteks bahwa row dengan cost 0 perlu dicek sumber datanya;
            - tidak mengubah rumus HPP dan tidak melakukan backfill data lama.
            Hubungan dengan flow HPP/Work Log: hanya membaca hasil validasi row Work Log completed.
            Status: aktif dipakai; bukan legacy/kandidat cleanup.
        ===================================================== */}
        {summary.warningRows > 0 ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={`${formatNumber(summary.warningRows)} Work Log perlu cek cost`}
            description="Angka HPP tidak diubah otomatis. Cek cost bahan/snapshot material, payroll Work Log, dan output good qty sebelum memakai HPP untuk analisis final."
          />
        ) : null}
        {/* =====================================================
            SECTION: Tabel Analisis HPP Render — GUARDED
            Fungsi:
            - Menampilkan rows HPP produksi memakai columns compact tanpa horizontal scroll besar.

            Dipakai oleh:
            - Halaman ProductionHppAnalysis.jsx pada main table analisis HPP.

            Alasan perubahan:
            - Scroll x besar dihapus setelah kolom HPP digabung menjadi stack ringkas yang tetap audit-friendly.

            Catatan cleanup:
            - Belum ada; table tetap memakai filteredRows, export mapper existing, dan pagination existing.

            Risiko:
            - Mengubah table props ini sembarangan dapat membuat angka HPP atau warning cost sulit dibaca pada layar kecil.
        ===================================================== */}
        <Table
          className="app-data-table"
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredRows}
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
