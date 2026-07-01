// =====================================================
// Page: Analisis HPP Produksi
// Tahap 1: membaca work log completed dan payroll produksi
// untuk analisa biaya realisasi per output
// =====================================================

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  App as AntdApp,
  Button,
  Col,
  Input,
  Select,
  Space,
  Tooltip,
  Typography,
  Tag,
} from "antd";
import { FileExcelOutlined } from "@ant-design/icons";
import StatusTag from "../../components/Layout/Feedback/StatusTag";
import { getCompletedProductionWorkLogs } from "../../services/Produksi/productionWorkLogsService";
import { getAllProductionPayrolls } from "../../services/Produksi/productionPayrollsService";
import { getAllProductionSteps } from "../../services/Produksi/productionStepsService";
import ProductionSummaryCards from "../../components/Produksi/shared/ProductionSummaryCards";
import ProductionFilterCard from "../../components/Produksi/shared/ProductionFilterCard";
import ProductionPageHeader from "../../components/Produksi/shared/ProductionPageHeader";
import PageContentCanvas from "../../components/Layout/Page/PageContentCanvas";
import PageSection from "../../components/Layout/Page/PageSection";
import DataTableView from "../../components/Layout/Table/DataTableView";
import { exportJsonToExcel } from "../../utils/export/exportExcel";
import { formatDateId } from "../../utils/formatters/dateId";
import formatNumber from "../../utils/formatters/numberId";
import formatCurrency, { formatHppUnitCurrencyId } from "../../utils/formatters/currencyId";
import { getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import { resolveWorkLogLaborCostDisplay } from "../../utils/produksi/productionPayrollRuleHelpers";

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
// Status: aktif dipakai; bukan kandidat cleanup.
// =====================================================
import {
  buildHppCostWarnings,
  getDerivedHppReconcileStatus,
  getHppCostStatusTagColor,
  getHppReconcileStatusColor,
  getHppReconcileStatusLabel,
  resolveTargetTypeLabel,
  toSafeNumber,
} from "./helpers/productionHppAnalysisHelpers";

const ProductionHppAnalysis = () => {
  const { message } = AntdApp.useApp();
  const [loading, setLoading] = useState(false);
  const [workLogs, setWorkLogs] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [productionSteps, setProductionSteps] = useState([]);

  const [search, setSearch] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("all");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [workLogResult, payrollResult, productionStepResult] = await Promise.all([
        getCompletedProductionWorkLogs(),
        getAllProductionPayrolls(),
        getAllProductionSteps(),
      ]);

      setWorkLogs(workLogResult);
      setPayrolls(payrollResult);
      setProductionSteps(productionStepResult);
    } catch (error) {
      console.error(error);
      message.error("Gagal memuat analisis HPP produksi");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const rows = useMemo(() => {
    return workLogs.map((workLog) => {
      const workLogId = String(workLog.id || "").trim();
      const workNumber = String(workLog.workNumber || "").trim();
      const relatedPayrolls = payrolls.filter((item) => (
        (workLogId && String(item.workLogId || "").trim() === workLogId) ||
        (workNumber && String(item.workNumber || "").trim() === workNumber)
      ));
      const stepRule = productionSteps.find((item) => item.id === workLog.stepId) || {};
      const productionCost = resolveWorkLogLaborCostDisplay({
        workLog,
        relatedPayrolls,
        productionStep: stepRule,
      });

      const materialCost = toSafeNumber(workLog.materialCostActual);
      const displayLaborCost = toSafeNumber(productionCost.displayAmount);
      const laborExcludedFromHpp = productionCost.source === "step_excluded_from_hpp";
      const finalLaborCost = productionCost.isFinal ? toSafeNumber(productionCost.finalAmount || productionCost.amount) : 0;
      const overheadCost = toSafeNumber(workLog.overheadCostActual);
      const goodQty = toSafeNumber(workLog.goodQty);
      const isHppFinalReady = Boolean(productionCost.isFinal || laborExcludedFromHpp);
      const previewTotalCost = materialCost + displayLaborCost + overheadCost;
      const finalTotalCost = materialCost + finalLaborCost + overheadCost;
      const previewHppPerUnit = goodQty > 0 ? previewTotalCost / goodQty : 0;
      const finalHppPerUnit = isHppFinalReady && goodQty > 0 ? finalTotalCost / goodQty : 0;
      const totalCostStatus = isHppFinalReady ? "Final" : (productionCost.totalStatusLabel || productionCost.statusLabel || "Preview");
      // =====================================================
      // ACTIVE / GUARDED - warning per baris HPP.
      // Fungsi blok:
      // - memisahkan HPP final dan preview agar draft/estimasi tidak terbaca sebagai HPP final;
      // - menjaga user melihat angka preview tanpa mengubah Work Log, payroll, stok, atau master HPP.
      // Hubungan dengan flow HPP/Work Log:
      // - final hanya berasal dari payroll final atau step yang memang tidak masuk HPP;
      // - preview boleh memakai draft/estimasi Step sebagai read-only.
      // Status: aktif dipakai; bukan kandidat cleanup.
      // =====================================================
      const costWarnings = buildHppCostWarnings({
        materialCost,
        displayLaborCost,
        finalLaborCost,
        finalTotalCost,
        previewTotalCost,
        finalHppPerUnit,
        goodQty,
        productionCost,
        isHppFinalReady,
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
        displayLaborCost,
        finalLaborCost,
        overheadCost,
        previewTotalCost,
        finalTotalCost,
        previewHppPerUnit,
        finalHppPerUnit,
        productionCostStatus: productionCost.statusLabel,
        totalCostStatus,
        productionCostSource: productionCost.source,
        isFinalCost: productionCost.isFinal,
        isEstimatedCost: productionCost.isEstimated,
        isDraftCost: productionCost.isDraft,
        isHppFinalReady,
        hppReconcileStatus: getDerivedHppReconcileStatus({
          workLog,
          finalHppPerUnit,
          isHppFinalReady,
        }),
        costWarnings,
      };
    });
  }, [workLogs, payrolls, productionSteps]);

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
    const finalRows = filteredRows.filter((item) => item.isHppFinalReady);
    const totalFinalCost = finalRows.reduce(
      (sum, item) => sum + Number(item.finalTotalCost || 0),
      0,
    );
    const totalPreviewCost = filteredRows.reduce(
      (sum, item) => sum + Number(item.previewTotalCost || 0),
      0,
    );
    const totalGoodQty = filteredRows.reduce(
      (sum, item) => sum + Number(item.goodQty || 0),
      0,
    );
    const finalGoodQty = finalRows.reduce(
      (sum, item) => sum + Number(item.goodQty || 0),
      0,
    );
    const averageFinalHpp =
      finalGoodQty > 0 ? totalFinalCost / finalGoodQty : 0;
    const averagePreviewHpp =
      totalGoodQty > 0 ? totalPreviewCost / totalGoodQty : 0;
    // =====================================================
    // ACTIVE / GUARDED - ringkasan warning HPP.
    // Fungsi blok:
    // - menghitung jumlah row yang punya warning cost 0;
    // - hanya untuk visibility, tidak mengubah formula HPP atau sumber cost.
    // Status: aktif dipakai; bukan kandidat cleanup.
    // =====================================================
    const warningRows = filteredRows.filter(
      (item) => Array.isArray(item.costWarnings) && item.costWarnings.length > 0,
    ).length;

    return {
      totalLogs,
      totalFinalCost,
      totalPreviewCost,
      totalGoodQty,
      finalGoodQty,
      averageFinalHpp,
      averagePreviewHpp,
      warningRows,
    };
  }, [filteredRows]);

  const summaryItems = useMemo(
    () => [
      { key: "total-logs", title: "Total Work Log", value: formatNumber(summary.totalLogs) },
      {
        key: "total-final-cost",
        title: "Total Biaya Final",
        value: formatCurrency(summary.totalFinalCost),
      },
      { key: "final-good-qty", title: "Good Qty Final", value: formatNumber(summary.finalGoodQty) },
      { key: "avg-hpp", title: "Rata-rata HPP Final", value: formatHppUnitCurrencyId(summary.averageFinalHpp) },
      { key: "avg-hpp-preview", title: "HPP Preview", value: formatHppUnitCurrencyId(summary.averagePreviewHpp) },
      { key: "warning-rows", title: "Perlu Cek", value: formatNumber(summary.warningRows) },
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
  // Status: aktif dipakai; bukan kandidat cleanup.
  // =====================================================
  const exportHppToExcel = async () => {
    if (filteredRows.length === 0) {
      message.warning("Tidak ada data HPP untuk diekspor.");
      return;
    }

    await exportJsonToExcel({
      title: "Laporan Analisis HPP Produksi IMS Bunga Flanel",
      subtitle: "Export HPP memisahkan HPP final dan preview draft/estimasi sesuai filter aktif, tanpa mengubah data produksi.",
      fileName: "laporan-hpp-produksi",
      sheetName: "HPP Analysis",
      filters: [
        `Target Type: ${targetTypeFilter === "all" ? "Semua" : resolveTargetTypeLabel(targetTypeFilter)}`,
        `Pencarian: ${search || "-"}`,
        "Catatan: kolom Final hanya valid jika status final; Preview boleh memakai draft/estimasi read-only.",
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
        { key: "displayLaborCostDisplay", label: "Biaya Produksi Display" },
        { key: "finalLaborCostDisplay", label: "Biaya Produksi Final" },
        { key: "productionCostStatus", label: "Status Biaya Produksi" },
        { key: "overheadCostDisplay", label: "Overhead" },
        { key: "previewTotalCostDisplay", label: "Total Biaya Preview" },
        { key: "finalTotalCostDisplay", label: "Total Biaya Final" },
        { key: "totalCostStatus", label: "Status Total" },
        { key: "previewHppPerUnitDisplay", label: "HPP Preview / Unit" },
        { key: "finalHppPerUnitDisplay", label: "HPP Final / Unit" },
        { key: "hppReconcileStatusLabel", label: "Status Reconcile HPP" },
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
        displayLaborCostDisplay: formatCurrency(row.displayLaborCost),
        finalLaborCostDisplay: row.isHppFinalReady ? formatCurrency(row.finalLaborCost) : "Belum final",
        productionCostStatus: row.productionCostStatus || "-",
        overheadCostDisplay: formatCurrency(row.overheadCost),
        previewTotalCostDisplay: formatCurrency(row.previewTotalCost),
        finalTotalCostDisplay: row.isHppFinalReady ? formatCurrency(row.finalTotalCost) : "Belum final",
        totalCostStatus: row.totalCostStatus || "-",
        previewHppPerUnitDisplay: formatHppUnitCurrencyId(row.previewHppPerUnit),
        finalHppPerUnitDisplay: row.isHppFinalReady ? formatHppUnitCurrencyId(row.finalHppPerUnit) : "Belum final",
        hppReconcileStatusLabel: getHppReconcileStatusLabel(row.hppReconcileStatus),
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
  const hppAnalysisMobileCardConfig = {
    title: (record) => record.workNumber || "Work Log",
    subtitle: (record) => [
      record.targetName || "Target belum diisi",
      resolveTargetTypeLabel(record.targetType),
      `Selesai: ${formatDateId(record.completedAt, true)}`,
    ],
    tags: (record) => [
      <Tag key="cost-status" color={getHppCostStatusTagColor(record.totalCostStatus)}>{record.totalCostStatus}</Tag>,
      <Tag key="reconcile" color={getHppReconcileStatusColor(record.hppReconcileStatus)}>{getHppReconcileStatusLabel(record.hppReconcileStatus)}</Tag>,
    ],
    meta: [
      { label: "Good Qty", value: (record) => formatNumber(record.goodQty) },
      { label: "HPP/Unit", value: (record) => record.isHppFinalReady ? formatHppUnitCurrencyId(record.finalHppPerUnit) : "Belum final" },
      { label: "Final Cost", value: (record) => record.isHppFinalReady ? formatCurrency(record.finalTotalCost) : "Belum final" },
      { label: "Preview", value: (record) => formatCurrency(record.previewTotalCost) },
    ],
    subtext: (record) => record.stepName ? `Step: ${record.stepName}` : null,
    content: (record) => Array.isArray(record.costWarnings) && record.costWarnings.length > 0 ? (
      <span className="ims-cell-meta">{formatNumber(record.costWarnings.length)} warning: {record.costWarnings[0]}</span>
    ) : <StatusTag tone="success">Cost valid</StatusTag>,
  };

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
          <Typography.Text type="secondary" className="ims-cell-meta">
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
          <Typography.Text type="secondary" className="ims-cell-meta">
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
          <Space size={6} wrap>
            <Typography.Text>Biaya Produksi: {formatCurrency(record.displayLaborCost)}</Typography.Text>
            <Tag color={getHppCostStatusTagColor(record.productionCostStatus)} style={compactTagStyle}>
              {record.productionCostStatus}
            </Tag>
          </Space>
          <Typography.Text>Overhead: {formatCurrency(record.overheadCost)}</Typography.Text>
          <Space size={6} wrap>
            <Typography.Text strong>Final: {record.isHppFinalReady ? formatCurrency(record.finalTotalCost) : "Belum final"}</Typography.Text>
            <Tag color={getHppCostStatusTagColor(record.totalCostStatus)} style={compactTagStyle}>
              {record.totalCostStatus}
            </Tag>
          </Space>
          {!record.isHppFinalReady ? (
            <Typography.Text type="secondary" className="ims-cell-meta">
              Preview: {formatCurrency(record.previewTotalCost)}
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: "HPP / Unit",
      key: "hppPerUnit",
      width: "14%",
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{record.isHppFinalReady ? formatHppUnitCurrencyId(record.finalHppPerUnit) : "Belum final"}</Typography.Text>
          <Tag color={getHppCostStatusTagColor(record.totalCostStatus)} style={compactTagStyle}>
            {record.totalCostStatus}
          </Tag>
          <Tag color={getHppReconcileStatusColor(record.hppReconcileStatus)} style={compactTagStyle}>
            {getHppReconcileStatusLabel(record.hppReconcileStatus)}
          </Tag>
          {!record.isHppFinalReady ? (
            <Typography.Text type="secondary" className="ims-cell-meta">
              Preview: {formatHppUnitCurrencyId(record.previewHppPerUnit)}
            </Typography.Text>
          ) : (
            <Typography.Text type="secondary" className="ims-cell-meta">
              per good unit
            </Typography.Text>
          )}
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
          return <StatusTag tone="success" style={compactTagStyle}>Cost valid</StatusTag>;
        }

        return (
          <Space direction="vertical" size={4} style={{ width: "100%" }}>
            <Tag color="warning" style={compactTagStyle}>
              {formatNumber(warnings.length)} perlu cek
            </Tag>
            {warnings.slice(0, 2).map((warning) => (
              <Tooltip key={warning} title={warning}>
                <Typography.Text type="secondary" className="ims-cell-meta" style={compactTextClampStyle}>
                  {warning}
                </Typography.Text>
              </Tooltip>
            ))}
            {warnings.length > 2 ? (
              <Tooltip title={warnings.join("; ")}>
                <Tag color="default" style={compactTagStyle}>+{formatNumber(warnings.length - 2)} lainnya</Tag>
              </Tooltip>
            ) : null}
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
        description="Analisa biaya Work Log."
      />

      <PageContentCanvas>

      <PageSection
        title="Ringkasan HPP"
        subtitle="Ringkasan sesuai filter aktif."
      >
        <ProductionSummaryCards
          items={summaryItems}
          columns={{ xs: 24, sm: 12, md: 12, lg: 6 }}
          variant="finance"
          highlightKey="avg-hpp"
        />
      </PageSection>

      <PageSection
        title="Filter Analisis"
        subtitle="Filter kelompok Work Log."
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
        subtitle="Tabel membaca Work Log completed dan payroll aktif."
        extra={<Tag color="purple">{formatNumber(filteredRows.length)} baris</Tag>}
      >
        {/* =====================================================
            ACTIVE / GUARDED - compact warning global HPP.
            Fungsi blok:
            - memberi konteks bahwa row dengan cost 0 perlu dicek sumber datanya;
            - tidak mengubah rumus HPP dan tidak melakukan backfill data historis.
            Hubungan dengan flow HPP/Work Log: hanya membaca hasil validasi row Work Log completed.
            Status: aktif dipakai; bukan kandidat cleanup.
        ===================================================== */}
        {summary.warningRows > 0 ? (
          <div className="ims-readonly-panel" style={{ marginBottom: 16, padding: 12 }}>
            <Space size={8} wrap>
              <Tag color="warning">{formatNumber(summary.warningRows)} perlu cek</Tag>
              <Typography.Text type="secondary">
                Baca status Final/Preview sebelum angka HPP dipakai untuk keputusan biaya.
              </Typography.Text>
            </Space>
          </div>
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
        <DataTableView
          loading={loading}
          showRefreshIndicator
          className="app-data-table"
          rowKey="id"
          columns={columns}
          dataSource={filteredRows}
          mobileCardConfig={hppAnalysisMobileCardConfig}
          locale={{
            emptyText: getDataTableEmptyText(loading, "Belum ada data analisis HPP"),
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
          }}
        />
      </PageSection>
      </PageContentCanvas>
    </>
  );
};

export default ProductionHppAnalysis;
