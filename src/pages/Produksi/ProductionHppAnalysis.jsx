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
import { getAllProductionSteps } from "../../services/Produksi/productionStepsService";
import ProductionSummaryCards from "../../components/Produksi/shared/ProductionSummaryCards";
import ProductionFilterCard from "../../components/Produksi/shared/ProductionFilterCard";
import ProductionPageHeader from "../../components/Produksi/shared/ProductionPageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import { exportJsonToExcel } from "../../utils/export/exportExcel";
import { formatDateId } from "../../utils/formatters/dateId";
import formatNumber from "../../utils/formatters/numberId";
import formatCurrency from "../../utils/formatters/currencyId";
import { DataRefreshIndicator, getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import { calculatePayrollAmounts } from "../../constants/productionPayrollOptions";

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


const HPP_PRODUCTION_COST_FINAL_STATUSES = new Set(["confirmed", "paid"]);

const toSafeNumber = (value, fallback = 0) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
};

const isHppPayrollIncluded = (line = {}) =>
  line.status !== "cancelled" && line.includePayrollInHpp !== false;

const isHppPayrollFinal = (line = {}) => {
  if (!isHppPayrollIncluded(line)) return false;

  const status = String(line.status || "").toLowerCase();
  const paymentStatus = String(line.paymentStatus || "").toLowerCase();

  if (HPP_PRODUCTION_COST_FINAL_STATUSES.has(status)) return true;
  if (paymentStatus === "paid") return true;

  return !status && toSafeNumber(line.finalAmount) > 0;
};

const resolveHppEstimateOutputQty = (workLog = {}, stepRule = {}) => {
  const payrollOutputBasis = stepRule.payrollOutputBasis || workLog.payrollOutputBasis || "good_qty";

  if (payrollOutputBasis === "actual_output_qty") {
    const actualOutputQty = toSafeNumber(workLog.actualOutputQty);
    if (actualOutputQty > 0) return actualOutputQty;
  }

  const goodQty = toSafeNumber(workLog.goodQty);
  if (goodQty > 0) return goodQty;

  const actualOutputQty = toSafeNumber(workLog.actualOutputQty);
  if (actualOutputQty > 0) return actualOutputQty;

  const plannedQty = toSafeNumber(workLog.plannedQty || workLog.targetQty);
  return plannedQty > 0 ? plannedQty : 0;
};

const estimateHppProductionCostFromStep = (workLog = {}, stepRule = {}) => {
  if (!stepRule || stepRule.includePayrollInHpp === false) {
    return {
      amount: 0,
      canEstimate: false,
      excludedFromHpp: stepRule?.includePayrollInHpp === false,
      reviewReasons: stepRule?.includePayrollInHpp === false
        ? ["Step payroll tidak masuk HPP."]
        : ["Rule step produksi tidak tersedia."],
    };
  }

  const payrollMode = stepRule.payrollMode || workLog.payrollMode || "per_qty";
  const payrollRate = toSafeNumber(stepRule.payrollRate ?? workLog.payrollRate);
  const payrollQtyBase = Math.max(1, toSafeNumber(stepRule.payrollQtyBase ?? workLog.payrollQtyBase, 1));
  const outputQty = resolveHppEstimateOutputQty(workLog, stepRule);
  const reviewReasons = [];

  if (payrollRate <= 0) {
    reviewReasons.push("Rate step produksi 0/kosong.");
  }

  if (payrollMode === "per_qty" && outputQty <= 0) {
    reviewReasons.push("Good qty/output qty 0 untuk mode per_qty.");
  }

  if (payrollRate <= 0 || (payrollMode === "per_qty" && outputQty <= 0)) {
    return {
      amount: 0,
      canEstimate: false,
      excludedFromHpp: false,
      reviewReasons,
    };
  }

  const workedQty = payrollMode === "per_batch"
    ? toSafeNumber(workLog.plannedQty || workLog.targetQty || outputQty)
    : outputQty;
  const calculated = calculatePayrollAmounts({
    payrollMode,
    payrollRate,
    payrollQtyBase,
    outputQtyUsed: outputQty,
    workedQty,
  });

  return {
    amount: toSafeNumber(calculated.finalAmount),
    canEstimate: true,
    excludedFromHpp: false,
    reviewReasons: [],
  };
};

/*
=====================================================
SECTION: HPP Production Cost Resolver — GUARDED
Fungsi:
- Menentukan Biaya Produksi HPP dari payroll final, draft payroll, fallback Work Log, atau estimasi step tanpa menulis ke Firestore.

Dipakai oleh:
- Rows Analisis HPP Produksi.

Alasan perubahan:
- HPP perlu membedakan Final, Draft Payroll, Estimasi, dan Perlu cek agar estimasi tidak terbaca sebagai biaya final.

Catatan cleanup:
- Bisa dipindah ke helper shared bersama Work Log setelah alur final/estimasi stabil.

Risiko:
- Jika draft/estimasi dianggap final atau dijumlahkan bersama payroll final, HPP bisa double count.
=====================================================
*/
const resolveHppProductionCost = (workLog = {}, relatedPayrolls = [], stepRule = {}) => {
  const includedPayrolls = relatedPayrolls.filter(isHppPayrollIncluded);
  const finalPayrolls = includedPayrolls.filter(isHppPayrollFinal);
  const draftPayrolls = includedPayrolls.filter((line) => !isHppPayrollFinal(line));
  const cancelledPayrollCount = relatedPayrolls.filter((line) => line.status === "cancelled").length;
  const finalAmount = finalPayrolls.reduce((sum, line) => sum + toSafeNumber(line.finalAmount), 0);
  const draftAmount = draftPayrolls.reduce((sum, line) => sum + toSafeNumber(line.finalAmount), 0);
  const reviewReasons = [];

  if (finalPayrolls.length > 0) {
    if (finalAmount <= 0) {
      reviewReasons.push("Final amount payroll 0.");
    }

    return {
      displayAmount: finalAmount,
      finalAmount,
      estimatedAmount: 0,
      draftAmount: 0,
      source: "payroll_final",
      statusLabel: "Final",
      totalStatusLabel: "Final",
      isFinal: true,
      isEstimated: false,
      isDraft: false,
      needsReview: reviewReasons.length > 0,
      reviewReasons,
    };
  }

  if (draftPayrolls.length > 0) {
    if (draftAmount <= 0) {
      reviewReasons.push("Final amount draft payroll 0.");
    }

    return {
      displayAmount: draftAmount,
      finalAmount: 0,
      estimatedAmount: 0,
      draftAmount,
      source: "payroll_draft",
      statusLabel: "Draft Payroll",
      totalStatusLabel: "Draft Payroll",
      isFinal: false,
      isEstimated: false,
      isDraft: true,
      needsReview: reviewReasons.length > 0,
      reviewReasons,
    };
  }

  if (cancelledPayrollCount > 0) {
    reviewReasons.push("Payroll Work Log cancelled.");
  }

  const fallbackLaborCost = toSafeNumber(workLog.laborCostActual);
  if (fallbackLaborCost > 0) {
    return {
      displayAmount: fallbackLaborCost,
      finalAmount: 0,
      estimatedAmount: fallbackLaborCost,
      draftAmount: 0,
      source: "work_log_labor_cost_actual",
      statusLabel: "Estimasi",
      totalStatusLabel: "Estimasi",
      isFinal: false,
      isEstimated: true,
      isDraft: false,
      needsReview: reviewReasons.length > 0,
      reviewReasons,
    };
  }

  const estimate = estimateHppProductionCostFromStep(workLog, stepRule);

  if (estimate.excludedFromHpp) {
    return {
      displayAmount: 0,
      finalAmount: 0,
      estimatedAmount: 0,
      draftAmount: 0,
      source: "step_excluded_from_hpp",
      statusLabel: "Tidak masuk HPP",
      totalStatusLabel: "Estimasi",
      isFinal: false,
      isEstimated: false,
      isDraft: false,
      needsReview: false,
      reviewReasons: estimate.reviewReasons,
    };
  }

  if (estimate.canEstimate) {
    return {
      displayAmount: estimate.amount,
      finalAmount: 0,
      estimatedAmount: estimate.amount,
      draftAmount: 0,
      source: "step_estimate",
      statusLabel: "Estimasi dari Step",
      totalStatusLabel: "Estimasi",
      isFinal: false,
      isEstimated: true,
      isDraft: false,
      needsReview: reviewReasons.length > 0,
      reviewReasons,
    };
  }

  reviewReasons.push(...estimate.reviewReasons);
  reviewReasons.push("Payroll final belum ada.");

  return {
    displayAmount: 0,
    finalAmount: 0,
    estimatedAmount: 0,
    draftAmount: 0,
    source: "needs_review",
    statusLabel: "Perlu cek",
    totalStatusLabel: "Perlu cek",
    isFinal: false,
    isEstimated: false,
    isDraft: false,
    needsReview: true,
    reviewReasons: [...new Set(reviewReasons)],
  };
};

const getHppCostStatusTagColor = (statusLabel) => {
  if (statusLabel === "Final") return "green";
  if (statusLabel === "Draft Payroll") return "blue";
  if (String(statusLabel || "").startsWith("Estimasi")) return "gold";
  if (statusLabel === "Tidak masuk HPP") return "orange";
  return "red";
};


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
  productionCost,
}) => {
  const warnings = [];

  if (toSafeNumber(materialCost) === 0) {
    warnings.push("Biaya material 0. Cek cost bahan atau snapshot material.");
  }

  if (toSafeNumber(directLaborCost) === 0) {
    warnings.push("Biaya produksi 0. Cek operator, rate step produksi, atau payroll Work Log.");
  }

  if (productionCost?.isDraft) {
    warnings.push("Payroll masih draft. Biaya produksi belum final.");
  }

  if (productionCost?.isEstimated) {
    warnings.push("Biaya produksi masih estimasi. Final mengikuti payroll Work Log yang valid.");
  }

  if (productionCost?.needsReview) {
    warnings.push(...productionCost.reviewReasons);
  }

  if (toSafeNumber(goodQty) <= 0) {
    warnings.push("Good qty 0. HPP/unit belum valid.");
  }

  if (toSafeNumber(totalCost) === 0) {
    warnings.push("Total biaya 0. HPP belum valid untuk analisis.");
  }

  if (toSafeNumber(hppPerUnit) === 0 && toSafeNumber(goodQty) > 0 && productionCost?.isFinal) {
    warnings.push("HPP per good unit 0 walaupun good qty ada. Cek sumber biaya Work Log.");
  }

  return [...new Set(warnings)];
};

const ProductionHppAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [workLogs, setWorkLogs] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [productionSteps, setProductionSteps] = useState([]);

  const [search, setSearch] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("all");

  const loadData = async () => {
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
  };

  useEffect(() => {
    loadData();
  }, []);

  const rows = useMemo(() => {
    return workLogs.map((workLog) => {
      const relatedPayrolls = payrolls.filter((item) => item.workLogId === workLog.id);
      const stepRule = productionSteps.find((item) => item.id === workLog.stepId) || {};
      const productionCost = resolveHppProductionCost(workLog, relatedPayrolls, stepRule);

      const materialCost = toSafeNumber(workLog.materialCostActual);
      const directLaborCost = productionCost.displayAmount;
      const overheadCost = toSafeNumber(workLog.overheadCostActual);
      const totalCost = materialCost + directLaborCost + overheadCost;
      const goodQty = toSafeNumber(workLog.goodQty);
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
        productionCost,
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
        productionCostStatus: productionCost.statusLabel,
        totalCostStatus: productionCost.totalStatusLabel,
        productionCostSource: productionCost.source,
        isFinalCost: productionCost.isFinal,
        isEstimatedCost: productionCost.isEstimated,
        isDraftCost: productionCost.isDraft,
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
        "Catatan: status Final/Estimasi/Draft/Perlu cek wajib dibaca sebelum angka dipakai sebagai analisis final.",
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
        { key: "directLaborCostDisplay", label: "Biaya Produksi" },
        { key: "productionCostStatus", label: "Status Biaya Produksi" },
        { key: "overheadCostDisplay", label: "Overhead" },
        { key: "totalCostDisplay", label: "Total Biaya" },
        { key: "totalCostStatus", label: "Status Total" },
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
        productionCostStatus: row.productionCostStatus || "-",
        overheadCostDisplay: formatCurrency(row.overheadCost),
        totalCostDisplay: formatCurrency(row.totalCost),
        totalCostStatus: row.totalCostStatus || "-",
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
          <Space size={6} wrap>
            <Typography.Text>Biaya Produksi: {formatCurrency(record.directLaborCost)}</Typography.Text>
            <Tag color={getHppCostStatusTagColor(record.productionCostStatus)} style={compactTagStyle}>
              {record.productionCostStatus}
            </Tag>
          </Space>
          <Typography.Text>Overhead: {formatCurrency(record.overheadCost)}</Typography.Text>
          <Space size={6} wrap>
            <Typography.Text strong>Total: {formatCurrency(record.totalCost)}</Typography.Text>
            <Tag color={getHppCostStatusTagColor(record.totalCostStatus)} style={compactTagStyle}>
              {record.totalCostStatus}
            </Tag>
          </Space>
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
          <Tag color={getHppCostStatusTagColor(record.totalCostStatus)} style={compactTagStyle}>
            {record.totalCostStatus}
          </Tag>
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
        description="Analisa biaya Work Log."
      />

      <PageSection
        title="Ringkasan HPP"
        subtitle="Ringkasan sesuai filter aktif."
      >
        <ProductionSummaryCards items={summaryItems} columns={{ xs: 24, sm: 12, md: 12, lg: 6 }} />
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
            description="Cek cost dan output sebelum dipakai."
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
        <DataRefreshIndicator loading={loading} dataSource={filteredRows} />
        <Table
          className="app-data-table"
          rowKey="id"
          columns={columns}
          dataSource={filteredRows}
          locale={{
            emptyText: getDataTableEmptyText(loading, <Empty description="Belum ada data analisis HPP" />),
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
