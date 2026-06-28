// =====================================================
// Page: Laporan Payroll
//
// ACTIVE / FINAL
// Halaman ini menjadi area rekap periode / total / export untuk payroll line
// final. Bukan tempat finalisasi transaksi payroll dan bukan source of truth
// baru di luar collection payroll.
// =====================================================

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Col,
  DatePicker,
  Empty,
  message,
  Select,
  Space,
  Tag,
  Tooltip,
} from "antd";
import dayjs from "dayjs";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import FilterBar from "../../components/Layout/Filters/FilterBar";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import DataTableView from "../../components/Layout/Table/DataTableView";
import { CompactCellText } from "../../components/Layout/Table/CompactCell";
import {
  PAYROLL_CLASSIFICATION_MAP,
  PAYROLL_MODE_MAP,
  PAYROLL_STATUS_MAP,
  getCompactPayrollStatusTags,
} from "../../constants/productionPayrollOptions";
import {
  getAllProductionPayrolls,
  getProductionPayrollsByDateRange,
} from "../../services/Produksi/productionPayrollsService";
import { exportJsonToExcel } from "../../utils/export/exportExcel";
import { formatCurrencyId } from "../../utils/formatters/currencyId";
import { formatDateId } from "../../utils/formatters/dateId";
import { formatNumberId } from "../../utils/formatters/numberId";
import { getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import { resolveDisplayReference } from "../../utils/references/displayReferenceResolver";
import { normalizeReportDateRange } from "../../utils/reports/reportDateRange";
import { tallyPayrollStatus } from "./helpers/payrollReportHelpers";

const { RangePicker } = DatePicker;

const renderPayrollStatusTags = (record = {}) => (
  <Space size={4} wrap>
    {getCompactPayrollStatusTags(record).map((item) => (
      <Tag key={item.key} color={item.color}>
        {item.label}
      </Tag>
    ))}
  </Space>
);

// =====================================================
// SECTION: Compact Table Text Renderer — AKTIF
// Fungsi:
// - Menyediakan render teks ellipsis + tooltip untuk baris compact di tabel laporan payroll.
//
// Dipakai oleh:
// - Halaman Laporan Payroll, khususnya kolom compact Detail Payroll Lines.
//
// Alasan perubahan:
// - Field audit tetap bisa dibaca penuh lewat tooltip tanpa membutuhkan horizontal scroll besar.
//
// Catatan cleanup:
// - belum ada.
//
// Risiko:
// - Jika style ellipsis/tooltip diubah sembarangan, nilai payroll penting bisa terpotong tanpa akses baca penuh.
// =====================================================
const renderCompactLine = (value, options = {}) => (
  <CompactCellText
    value={value}
    fallback={options.fallback}
    strong={options.strong}
    secondary={options.muted}
  />
);

// =====================================================
// ACTIVE / FINAL
// Preset periode tahap awal dipakai untuk filter/report terlebih dahulu.
// Closing operasional formal sengaja belum ditambahkan agar model line-centric
// tetap sederhana dan stabil.
// =====================================================
const PERIOD_PRESET_OPTIONS = [
  { value: "weekly", label: "Mingguan" },
  { value: "monthly", label: "Bulanan" },
  { value: "custom", label: "Custom Range" },
];

const getPresetRange = (preset) => {
  if (preset === "weekly") {
    return [dayjs().startOf("week"), dayjs().endOf("week")];
  }

  return [dayjs().startOf("month"), dayjs().endOf("month")];
};

const toDateValue = (value) => {
  const rawValue = value?.toDate ? value.toDate() : value;
  if (!rawValue) return null;

  return rawValue instanceof Date ? rawValue : new Date(rawValue);
};

const isDateWithinRange = (value, range = []) => {
  if (!Array.isArray(range) || range.length !== 2 || !range[0] || !range[1]) {
    return true;
  }

  const dateValue = toDateValue(value);
  if (!dateValue) return false;

  const current = dayjs(dateValue);
  const start = dayjs(range[0]).startOf("day");
  const end = dayjs(range[1]).endOf("day");

  return current.isAfter(start) && current.isBefore(end) || current.isSame(start) || current.isSame(end);
};

const downloadCsv = (rows = [], fileName = "payroll-report") => {
  const csvRows = rows.map((row) =>
    row
      .map((value) => {
        const normalized = String(value ?? "").replace(/"/g, '""');
        return `"${normalized}"`;
      })
      .join(","),
  );

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${fileName}-${dayjs().format("YYYY-MM-DD")}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const PayrollReport = () => {
  const [loading, setLoading] = useState(false);
  const [payrolls, setPayrolls] = useState([]);
  const [periodPreset, setPeriodPreset] = useState("monthly");
  const [dateRange, setDateRange] = useState(getPresetRange("monthly"));
  const [operatorFilter, setOperatorFilter] = useState("all");
  const [stepFilter, setStepFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [classificationFilter, setClassificationFilter] = useState("all");
  const [includeHppFilter, setIncludeHppFilter] = useState("all");

  useEffect(() => {
    const loadPayrollReport = async () => {
      try {
        setLoading(true);
        const dateRangeBounds = normalizeReportDateRange(dateRange);
        const result = dateRangeBounds
          ? await getProductionPayrollsByDateRange({
              startDate: dateRangeBounds.startDate,
              endDateExclusive: dateRangeBounds.endDateExclusive,
            })
          : await getAllProductionPayrolls();
        setPayrolls(result);
      } catch (error) {
        console.error(error);
        message.error("Gagal memuat laporan payroll");
      } finally {
        setLoading(false);
      }
    };

    loadPayrollReport();
  }, [dateRange]);

  const operatorOptions = useMemo(() => {
    const names = Array.from(new Set(payrolls.map((item) => item.workerName).filter(Boolean)));
    return [
      { value: "all", label: "Semua Operator" },
      ...names.sort((left, right) => left.localeCompare(right)).map((name) => ({ value: name, label: name })),
    ];
  }, [payrolls]);

  const stepOptions = useMemo(() => {
    const names = Array.from(new Set(payrolls.map((item) => item.stepName).filter(Boolean)));
    return [
      { value: "all", label: "Semua Step" },
      ...names.sort((left, right) => left.localeCompare(right)).map((name) => ({ value: name, label: name })),
    ];
  }, [payrolls]);

  // =====================================================
  // ACTIVE / FINAL
  // Seluruh filter laporan membaca payroll line final. Draft tetap boleh ikut
  // laporan agar owner/admin bisa memantau queue operasional per periode.
  // =====================================================
  const filteredPayrolls = useMemo(() => {
    return payrolls.filter((item) => {
      const dateMatch = isDateWithinRange(item.payrollDate || item.createdAt, dateRange);
      const operatorMatch = operatorFilter === "all" || item.workerName === operatorFilter;
      const stepMatch = stepFilter === "all" || item.stepName === stepFilter;
      const statusMatch = statusFilter === "all" || item.status === statusFilter;
      const classificationMatch =
        classificationFilter === "all" || item.payrollClassification === classificationFilter;
      const includeHppMatch =
        includeHppFilter === "all" ||
        (includeHppFilter === "yes" && item.includePayrollInHpp !== false) ||
        (includeHppFilter === "no" && item.includePayrollInHpp === false);

      return (
        dateMatch &&
        operatorMatch &&
        stepMatch &&
        statusMatch &&
        classificationMatch &&
        includeHppMatch
      );
    });
  }, [payrolls, dateRange, operatorFilter, stepFilter, statusFilter, classificationFilter, includeHppFilter]);

  // =====================================================
  // ACTIVE / FINAL
  // Summary cards dipisah dari transaksi payroll harian dan fokus ke rekap
  // periode: status, direct labor vs support, include HPP, dan nominal aktif.
  // =====================================================
  const summaryItems = useMemo(() => {
    const totals = filteredPayrolls.reduce(
      (acc, item) => {
        const amount = Number(item.finalAmount || 0);
        if (item.payrollClassification === "support_fulfillment") acc.totalSupport += amount;
        else acc.totalDirect += amount;
        if (item.includePayrollInHpp !== false) acc.totalInHpp += amount;
        if (!(item.status === "paid" && item.paymentStatus === "paid") && item.status !== "cancelled") {
          acc.totalUnpaid += amount;
        }
        return acc;
      },
      {
        ...tallyPayrollStatus(filteredPayrolls),
        totalDirect: 0,
        totalSupport: 0,
        totalInHpp: 0,
        totalUnpaid: 0,
      },
    );

    return [
      { key: "draft", title: "Total Draft", value: formatNumberId(totals.totalDraft), subtitle: "Line payroll draft pada filter aktif.", accent: "warning" },
      { key: "confirmed", title: "Total Confirmed", value: formatNumberId(totals.totalConfirmed), subtitle: "Line payroll siap pembayaran.", accent: "primary" },
      { key: "paid", title: "Total Paid", value: formatNumberId(totals.totalPaid), subtitle: "Line payroll yang sudah dibayar.", accent: "success" },
      { key: "cancelled", title: "Total Cancelled", value: formatNumberId(totals.totalCancelled), subtitle: "Line payroll dibatalkan.", accent: "danger" },
      { key: "nominal", title: "Total Nominal Periode", value: formatCurrencyId(totals.totalNominal), subtitle: "Nominal line non-cancelled pada filter aktif.", accent: "primary" },
      { key: "direct", title: "Total Direct Labor", value: formatCurrencyId(totals.totalDirect), subtitle: "Klasifikasi direct labor pada filter aktif.", accent: "success" },
      { key: "support", title: "Total Support", value: formatCurrencyId(totals.totalSupport), subtitle: "Klasifikasi support / fulfillment pada filter aktif.", accent: "warning" },
      { key: "hpp", title: "Total Masuk HPP", value: formatCurrencyId(totals.totalInHpp), subtitle: "Nominal payroll dengan include HPP aktif.", accent: "primary" },
      { key: "unpaid", title: "Total Belum Paid", value: formatCurrencyId(totals.totalUnpaid), subtitle: "Draft/confirmed yang belum dibayar.", accent: "danger" },
    ];
  }, [filteredPayrolls]);

  // =====================================================
  // SECTION: Detail Payroll Lines Compact Columns — GUARDED
  // Fungsi:
  // - Merapikan presentasi main table payroll line menjadi kolom gabungan
  //   yang tetap menampilkan field audit penting lewat baris ringkas dan tooltip.
  //
  // Dipakai oleh:
  // - Halaman Laporan Payroll, khususnya tabel Detail Payroll Lines.
  //
  // Alasan perubahan:
  // - Mengurangi kebutuhan horizontal scroll besar tanpa mengubah source payroll,
  //   filter, summary, export, mapper, service, schema, route, role, atau business logic.
  //
  // Catatan cleanup:
  // - belum ada.
  //
  // Risiko:
  // - Jika render kolom diubah sembarangan, field audit payroll/expense bisa tidak
  //   terbaca di UI meskipun data export tetap lengkap.
  // =====================================================
  const payrollReportMobileCardConfig = useMemo(
    () => ({
      title: (record) => record.payrollNumber || record.workerName || "Payroll line",
      subtitle: (record) => [
        formatDateId(record.payrollDate, true),
        record.workerName || "Operator belum diisi",
        record.stepName || "Step belum diisi",
      ],
      tags: (record) => renderPayrollStatusTags(record),
      meta: [
        { label: "Nominal", value: (record) => formatCurrencyId(record.finalAmount || 0) },
        { label: "Mode", value: (record) => PAYROLL_MODE_MAP[record.payrollMode] || record.payrollMode || "-" },
        { label: "Worked", value: (record) => formatNumberId(record.workedQty || 0) },
        { label: "Output", value: (record) => formatNumberId(record.outputQtyUsed || 0) },
      ],
      subtext: (record) => [
        `Work Log: ${record.workNumber || "-"}`,
        `HPP: ${record.includePayrollInHpp === false ? "Tidak" : "Ya"}`,
      ],
      content: (record) => record.expenseSyncStatus ? (
        <span className="ims-cell-meta">Cash Out Sync: {record.expenseSyncStatus}</span>
      ) : null,
    }),
    [],
  );

  const payrollColumns = useMemo(
    () => [
      {
        title: "Payroll / Work Log",
        key: "payrollWorkLog",
        width: 210,
        render: (_, record) => (
          <div style={{ minWidth: 0 }}>
            {renderCompactLine(record.payrollNumber, { strong: true })}
            {renderCompactLine(`Tanggal: ${formatDateId(record.payrollDate, true)}`, { muted: true })}
            {renderCompactLine(`Work Log: ${record.workNumber || "-"}`, { muted: true })}
          </div>
        ),
      },
      {
        title: "Operator / Step",
        key: "operatorStep",
        width: 210,
        render: (_, record) => (
          <div style={{ minWidth: 0 }}>
            {renderCompactLine(record.workerName, { strong: true })}
            {renderCompactLine(`Step: ${record.stepName || "-"}`, { muted: true })}
          </div>
        ),
      },
      {
        title: "Mode / Qty",
        key: "modeQty",
        width: 170,
        render: (_, record) => (
          <div style={{ minWidth: 0 }}>
            {renderCompactLine(PAYROLL_MODE_MAP[record.payrollMode] || record.payrollMode || "-", { strong: true })}
            {renderCompactLine(`Worked: ${formatNumberId(record.workedQty || 0)}`, { muted: true })}
            {renderCompactLine(`Output: ${formatNumberId(record.outputQtyUsed || 0)}`, { muted: true })}
          </div>
        ),
      },
      {
        title: "Nominal / HPP",
        key: "nominalHpp",
        width: 200,
        render: (_, record) => (
          <div style={{ minWidth: 0 }}>
            {renderCompactLine(formatCurrencyId(record.finalAmount || 0), { strong: true })}
            {renderCompactLine(
              PAYROLL_CLASSIFICATION_MAP[record.payrollClassification] || record.payrollClassification || "-",
              { muted: true },
            )}
            {renderCompactLine(`HPP: ${record.includePayrollInHpp === false ? "Tidak" : "Ya"}`, { muted: true })}
          </div>
        ),
      },
      {
        title: "Status",
        key: "statusPayment",
        width: 190,
        render: (_, record) => (
          <div style={{ minWidth: 0 }}>
            {renderPayrollStatusTags(record)}
            {renderCompactLine(`Confirmed: ${formatDateId(record.confirmedAt, true)}`, { muted: true })}
            {renderCompactLine(`Paid: ${formatDateId(record.paidAt, true)}`, { muted: true })}
          </div>
        ),
      },
      {
        title: "Cash Out Ref",
        key: "expenseRef",
        width: 190,
        render: (_, record) => {
          // =====================================================
          // SECTION: Cash Out Ref Compact Audit Render — GUARDED
          // Fungsi:
          // - Menampilkan status sinkronisasi Cash Out payroll paid, referensi expense,
          //   dan expenseSyncStatus dalam layout compact.
          //
          // Dipakai oleh:
          // - Halaman Laporan Payroll, kolom Cash Out Ref di Detail Payroll Lines.
          //
          // Alasan perubahan:
          // - Mempertahankan audit trail Cash Out dalam tabel compact tanpa mengubah
          //   payroll source data atau export detail/rekap.
          //
          // Catatan cleanup:
          // - belum ada.
          //
          // Risiko:
          // - Jika logic status ini diganti sembarangan, operator/admin bisa salah
          //   membaca apakah Cash Out sudah dibuat, nominal nol, atau belum dibuat.
          // =====================================================
          const expenseReference = resolveDisplayReference(
            {
              cashOutNumber: record.cashOutNumber,
              referenceNumber: record.expenseReferenceNumber,
              sourceRef: record.expenseSourceRef,
              expenseId: record.expenseId,
            },
            { fallback: record.expenseId || "-", allowTechnicalId: true },
          );
          const expenseSyncStatus = record.expenseSyncStatus || "-";

          if (record.expenseSyncStatus === "created" || record.expenseSyncStatus === "already_exists") {
            return (
              <div style={{ minWidth: 0 }}>
                <Tag color="purple">Cash Out</Tag>
                {renderCompactLine(expenseReference, { muted: true })}
                {renderCompactLine(`Sync: ${expenseSyncStatus}`, { muted: true })}
              </div>
            );
          }

          if (record.expenseSyncStatus === "skipped_zero_amount") {
            return (
              <div style={{ minWidth: 0 }}>
                <Tag color="orange">Nominal 0</Tag>
                {renderCompactLine(`Sync: ${expenseSyncStatus}`, { muted: true })}
              </div>
            );
          }

          return (
            <div style={{ minWidth: 0 }}>
              <Tag>Belum dibuat</Tag>
              {renderCompactLine(`Sync: ${expenseSyncStatus}`, { muted: true })}
            </div>
          );
        },
      },
    ],
    [],
  );

  // =====================================================
  // ACTIVE / FINAL
  // Export minimum yang dibutuhkan: detail lines dan rekap operator.
  // XLSX menjadi export final Task 5; CSV dipertahankan sebagai export compatibility manual.
  // Blok ini aktif dipakai dan tidak mengubah source/perhitungan payroll.
  // =====================================================
  const exportDetailXlsx = async () => {
    await exportJsonToExcel({
      title: "Laporan Payroll IMS Bunga Flanel",
      subtitle: "Detail payroll line sesuai filter periode dan status yang sedang tampil.",
      sheetName: "Payroll Report",
      fileName: "Laporan-Payroll-Detail",
      filters: [
        `Periode: ${formatDateId(dateRange?.[0]?.toDate?.(), false)} - ${formatDateId(dateRange?.[1]?.toDate?.(), false)}`,
        `Status: ${statusFilter === "all" ? "Semua" : PAYROLL_STATUS_MAP[statusFilter] || statusFilter}`,
        `Operator: ${operatorFilter === "all" ? "Semua" : operatorFilter}`,
      ],
      data: filteredPayrolls.map((item) => ({
        "No. Payroll": item.payrollNumber || "-",
        "Tanggal Payroll": formatDateId(item.payrollDate, true),
        "Work Log": item.workNumber || "-",
        Operator: item.workerName || "-",
        Step: item.stepName || "-",
        Mode: PAYROLL_MODE_MAP[item.payrollMode] || item.payrollMode || "-",
        "Worked Qty": formatNumberId(item.workedQty || 0),
        "Output Qty": formatNumberId(item.outputQtyUsed || 0),
        Nominal: formatCurrencyId(item.finalAmount || 0),
        Status: PAYROLL_STATUS_MAP[item.status] || item.status || "-",
        Klasifikasi: PAYROLL_CLASSIFICATION_MAP[item.payrollClassification] || item.payrollClassification || "-",
        "Masuk HPP": item.includePayrollInHpp === false ? "Tidak" : "Ya",
        "Confirmed At": formatDateId(item.confirmedAt, true),
        "Paid At": formatDateId(item.paidAt, true),
        "Cash Out Ref": resolveDisplayReference(
          {
            cashOutNumber: item.cashOutNumber,
            referenceNumber: item.expenseReferenceNumber,
            sourceRef: item.expenseSourceRef,
            expenseId: item.expenseId,
          },
          { fallback: item.expenseId || "-", allowTechnicalId: true },
        ),
        "Expense Sync": item.expenseSyncStatus || "-",
      })),
    });
    message.success("Detail payroll berhasil diekspor ke Excel.");
  };

  const exportDetailCsv = () => {
    const rows = [
      [
        "No. Payroll",
        "Tanggal Payroll",
        "Work Log",
        "Operator",
        "Step",
        "Mode",
        "Worked Qty",
        "Output Qty",
        "Nominal",
        "Status",
        "Klasifikasi",
        "Masuk HPP",
        "Confirmed At",
        "Paid At",
        "Cash Out Ref",
        "Expense Sync",
      ],
      ...filteredPayrolls.map((item) => [
        item.payrollNumber || "-",
        formatDateId(item.payrollDate, true),
        item.workNumber || "-",
        item.workerName || "-",
        item.stepName || "-",
        PAYROLL_MODE_MAP[item.payrollMode] || item.payrollMode || "-",
        Number(item.workedQty || 0),
        Number(item.outputQtyUsed || 0),
        Number(item.finalAmount || 0),
        PAYROLL_STATUS_MAP[item.status] || item.status || "-",
        PAYROLL_CLASSIFICATION_MAP[item.payrollClassification] || item.payrollClassification || "-",
        item.includePayrollInHpp === false ? "Tidak" : "Ya",
        formatDateId(item.confirmedAt, true),
        formatDateId(item.paidAt, true),
        resolveDisplayReference(
          {
            cashOutNumber: item.cashOutNumber,
            referenceNumber: item.expenseReferenceNumber,
            sourceRef: item.expenseSourceRef,
            expenseId: item.expenseId,
          },
          { fallback: item.expenseId || "-", allowTechnicalId: true },
        ),
        item.expenseSyncStatus || "-",
      ]),
    ];

    downloadCsv(rows, "Laporan-Payroll-Detail");
    message.success("Detail payroll berhasil diekspor ke CSV.");
  };

  const exportOperatorRecapXlsx = async () => {
    const recapMap = filteredPayrolls.reduce((acc, item) => {
      const key = item.workerId || item.workerCode || item.workerName || "UNKNOWN";
      if (!acc[key]) {
        acc[key] = {
          operator: item.workerName || "-",
          items: [],
        };
      }

      acc[key].items.push(item);
      return acc;
    }, {});

    await exportJsonToExcel({
      title: "Rekap Payroll per Operator",
      subtitle: "Ringkasan payroll operator sesuai filter periode dan status yang sedang tampil.",
      sheetName: "Payroll Recap",
      fileName: "Laporan-Payroll-Rekap-Operator",
      filters: [
        `Periode: ${formatDateId(dateRange?.[0]?.toDate?.(), false)} - ${formatDateId(dateRange?.[1]?.toDate?.(), false)}`,
        `Status: ${statusFilter === "all" ? "Semua" : PAYROLL_STATUS_MAP[statusFilter] || statusFilter}`,
      ],
      data: Object.values(recapMap).map((item) => {
        const totals = tallyPayrollStatus(item.items);
        return {
          Operator: item.operator,
          "Total Line": formatNumberId(item.items.length),
          Draft: formatNumberId(totals.totalDraft),
          Confirmed: formatNumberId(totals.totalConfirmed),
          Paid: formatNumberId(totals.totalPaid),
          Cancelled: formatNumberId(totals.totalCancelled),
          "Total Nominal": formatCurrencyId(totals.totalNominal),
        };
      }),
    });
    message.success("Rekap payroll per operator berhasil diekspor ke Excel.");
  };

  return (
    <>
      <PageHeader
        title="Laporan Payroll"
        subtitle="Laporan payroll line final per periode."
      />

      <PageSection
        title="Filter Periode Payroll"
        subtitle="Periode dipakai untuk filter laporan."
      >
        <FilterBar
          actions={[
            <Space key="payroll-report-export" wrap>
              <Button onClick={exportDetailXlsx} disabled={filteredPayrolls.length === 0}>
                Export Detail XLSX
              </Button>
              <Button onClick={exportDetailCsv} disabled={filteredPayrolls.length === 0}>
                Export Detail CSV (Compatibility)
              </Button>
              <Button type="primary" onClick={exportOperatorRecapXlsx} disabled={filteredPayrolls.length === 0}>
                Export Rekap Operator
              </Button>
            </Space>,
          ]}
        >
          <Col xs={24} md={6}>
            <Select
              style={{ width: "100%" }}
              value={periodPreset}
              onChange={(value) => {
                setPeriodPreset(value);
                if (value !== "custom") {
                  setDateRange(getPresetRange(value));
                }
              }}
              options={PERIOD_PRESET_OPTIONS}
            />
          </Col>
          <Col xs={24} md={8}>
            <RangePicker
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
              value={dateRange}
              onChange={(value) => setDateRange(value || [])}
              disabled={periodPreset !== "custom"}
            />
          </Col>
          <Col xs={24} md={5}>
            <Select style={{ width: "100%" }} value={operatorFilter} onChange={setOperatorFilter} options={operatorOptions} />
          </Col>
          <Col xs={24} md={5}>
            <Select style={{ width: "100%" }} value={stepFilter} onChange={setStepFilter} options={stepOptions} />
          </Col>
          <Col xs={24} md={6}>
            <Select
              style={{ width: "100%" }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "Semua Status" },
                { value: "draft", label: "Draft" },
                { value: "confirmed", label: "Confirmed" },
                { value: "paid", label: "Paid" },
                { value: "cancelled", label: "Cancelled" },
              ]}
            />
          </Col>
          <Col xs={24} md={6}>
            <Select
              style={{ width: "100%" }}
              value={classificationFilter}
              onChange={setClassificationFilter}
              options={[
                { value: "all", label: "Semua Klasifikasi" },
                { value: "direct_labor", label: "Direct Labor" },
                { value: "support_fulfillment", label: "Support / Fulfillment" },
              ]}
            />
          </Col>
          <Col xs={24} md={6}>
            <Select
              style={{ width: "100%" }}
              value={includeHppFilter}
              onChange={setIncludeHppFilter}
              options={[
                { value: "all", label: "Semua Include HPP" },
                { value: "yes", label: "Masuk HPP" },
                { value: "no", label: "Di luar HPP" },
              ]}
            />
          </Col>
        </FilterBar>
      </PageSection>

      <PageSection
        title="Ringkasan Payroll Periode"
        subtitle="Ringkasan payroll sesuai filter aktif."
      >
        <SummaryStatGrid items={summaryItems} columns={{ xs: 24, sm: 12, md: 8, lg: 6, xl: 6 }} variant="finance" highlightKey="nominal" />
      </PageSection>

      <PageSection
        title="Detail Payroll Lines"
        subtitle="Tabel payroll per line operator."
      >
        <DataTableView
          loading={loading}
          showRefreshIndicator
          className="app-data-table"
          rowKey="id"
          columns={payrollColumns}
          dataSource={filteredPayrolls}
          pagination={{ pageSize: 10 }}
          mobileCardConfig={payrollReportMobileCardConfig}
          locale={{
            emptyText: getDataTableEmptyText(loading, <Empty description="Belum ada data payroll pada filter aktif" />),
          }}
        />
      </PageSection>
    </>
  );
};

export default PayrollReport;
