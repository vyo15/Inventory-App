// =====================================================
// Page: Laporan Payroll
//
// ACTIVE / FINAL
// Halaman ini menjadi area rekap periode / total / export untuk payroll line
// final. Bukan tempat finalisasi transaksi payroll dan bukan source of truth
// baru di luar collection payroll.
// =====================================================

import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Col,
  DatePicker,
  Empty,
  message,
  Select,
  Space,
  Table,
  Tag,
} from "antd";
import dayjs from "dayjs";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import FilterBar from "../../components/Layout/Filters/FilterBar";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import {
  PAYROLL_CLASSIFICATION_MAP,
  PAYROLL_MODE_MAP,
  PAYROLL_STATUS_MAP,
} from "../../constants/productionPayrollOptions";
import { getAllProductionPayrolls } from "../../services/Produksi/productionPayrollsService";
import { exportJsonToExcel } from "../../utils/export/exportExcel";
import { formatCurrencyId } from "../../utils/formatters/currencyId";
import { formatDateId } from "../../utils/formatters/dateId";
import { formatNumberId } from "../../utils/formatters/numberId";

const { RangePicker } = DatePicker;

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
        const result = await getAllProductionPayrolls();
        setPayrolls(result);
      } catch (error) {
        console.error(error);
        message.error("Gagal memuat laporan payroll");
      } finally {
        setLoading(false);
      }
    };

    loadPayrollReport();
  }, []);

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
        if (item.status === "draft") acc.totalDraft += 1;
        if (item.status === "confirmed") acc.totalConfirmed += 1;
        if (item.status === "paid") acc.totalPaid += 1;
        if (item.status === "cancelled") acc.totalCancelled += 1;
        if (item.status !== "cancelled") acc.totalNominal += amount;
        if (item.payrollClassification === "support_fulfillment") acc.totalSupport += amount;
        else acc.totalDirect += amount;
        if (item.includePayrollInHpp !== false) acc.totalInHpp += amount;
        if (!(item.status === "paid" && item.paymentStatus === "paid") && item.status !== "cancelled") {
          acc.totalUnpaid += amount;
        }
        return acc;
      },
      {
        totalDraft: 0,
        totalConfirmed: 0,
        totalPaid: 0,
        totalCancelled: 0,
        totalNominal: 0,
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
  // ACTIVE / FINAL
  // Tabel laporan tetap line-centric. Work Log number hanya tampil sebagai
  // konteks audit/grouping visual, bukan batch entity baru.
  // =====================================================
  const payrollColumns = useMemo(
    () => [
      {
        title: "No. Payroll",
        dataIndex: "payrollNumber",
        key: "payrollNumber",
        width: 180,
        render: (value, record) => (
          <div>
            <div style={{ fontWeight: 600 }}>{value || "-"}</div>
            <div style={{ fontSize: 12, color: "#8c8c8c" }}>{record.workNumber || "-"}</div>
          </div>
        ),
      },
      {
        title: "Tanggal",
        dataIndex: "payrollDate",
        key: "payrollDate",
        width: 140,
        render: (value) => formatDateId(value, true),
      },
      {
        title: "Operator",
        dataIndex: "workerName",
        key: "workerName",
        width: 180,
        render: (value) => value || "-",
      },
      {
        title: "Step",
        dataIndex: "stepName",
        key: "stepName",
        width: 160,
        render: (value) => value || "-",
      },
      {
        title: "Mode / Qty",
        key: "modeQty",
        width: 180,
        render: (_, record) => (
          <div>
            <div>{PAYROLL_MODE_MAP[record.payrollMode] || record.payrollMode || "-"}</div>
            <div style={{ fontSize: 12, color: "#8c8c8c" }}>
              Basis: {formatNumberId(record.workedQty)} / {formatNumberId(record.outputQtyUsed)}
            </div>
          </div>
        ),
      },
      {
        title: "Nominal",
        dataIndex: "finalAmount",
        key: "finalAmount",
        width: 150,
        render: (value) => formatCurrencyId(value),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 130,
        render: (value) => <Tag>{PAYROLL_STATUS_MAP[value] || value || "-"}</Tag>,
      },
      {
        title: "Klasifikasi",
        dataIndex: "payrollClassification",
        key: "payrollClassification",
        width: 180,
        render: (value) => PAYROLL_CLASSIFICATION_MAP[value] || value || "-",
      },
      {
        title: "Masuk HPP",
        dataIndex: "includePayrollInHpp",
        key: "includePayrollInHpp",
        width: 120,
        render: (value) => (value === false ? "Tidak" : "Ya"),
      },
      {
        title: "Confirmed / Paid",
        key: "confirmedPaid",
        width: 180,
        render: (_, record) => (
          <div>
            <div>{formatDateId(record.confirmedAt, true)}</div>
            <div style={{ fontSize: 12, color: "#8c8c8c" }}>{formatDateId(record.paidAt, true)}</div>
          </div>
        ),
      },
    ],
    [],
  );

  // =====================================================
  // ACTIVE / FINAL
  // Export minimum yang dibutuhkan: detail lines dan rekap operator.
  // CSV/XLSX dibuka di level laporan agar tidak membebani Payroll Produksi.
  // =====================================================
  const exportDetailXlsx = async () => {
    await exportJsonToExcel({
      data: filteredPayrolls.map((item) => ({
        "No. Payroll": item.payrollNumber || "-",
        "Tanggal Payroll": formatDateId(item.payrollDate, true),
        "Work Log": item.workNumber || "-",
        Operator: item.workerName || "-",
        Step: item.stepName || "-",
        Mode: PAYROLL_MODE_MAP[item.payrollMode] || item.payrollMode || "-",
        "Worked Qty": Number(item.workedQty || 0),
        "Output Qty": Number(item.outputQtyUsed || 0),
        Nominal: Number(item.finalAmount || 0),
        Status: PAYROLL_STATUS_MAP[item.status] || item.status || "-",
        Klasifikasi: PAYROLL_CLASSIFICATION_MAP[item.payrollClassification] || item.payrollClassification || "-",
        "Masuk HPP": item.includePayrollInHpp === false ? "Tidak" : "Ya",
        "Confirmed At": formatDateId(item.confirmedAt, true),
        "Paid At": formatDateId(item.paidAt, true),
      })),
      sheetName: "Payroll Detail",
      fileName: "Laporan-Payroll-Detail",
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
          totalLines: 0,
          totalDraft: 0,
          totalConfirmed: 0,
          totalPaid: 0,
          totalCancelled: 0,
          totalNominal: 0,
        };
      }

      acc[key].totalLines += 1;
      if (item.status === "draft") acc[key].totalDraft += 1;
      if (item.status === "confirmed") acc[key].totalConfirmed += 1;
      if (item.status === "paid") acc[key].totalPaid += 1;
      if (item.status === "cancelled") acc[key].totalCancelled += 1;
      if (item.status !== "cancelled") {
        acc[key].totalNominal += Number(item.finalAmount || 0);
      }

      return acc;
    }, {});

    await exportJsonToExcel({
      data: Object.values(recapMap).map((item) => ({
        Operator: item.operator,
        "Total Line": item.totalLines,
        Draft: item.totalDraft,
        Confirmed: item.totalConfirmed,
        Paid: item.totalPaid,
        Cancelled: item.totalCancelled,
        "Total Nominal": item.totalNominal,
      })),
      sheetName: "Payroll Rekap Operator",
      fileName: "Laporan-Payroll-Rekap-Operator",
    });
    message.success("Rekap payroll per operator berhasil diekspor ke Excel.");
  };

  return (
    <>
      <PageHeader
        title="Laporan Payroll"
        subtitle="Area laporan periode untuk membaca payroll lines final, nominal per periode, direct labor vs support, dan export detail maupun rekap operator."
      />

      <PageSection
        title="Filter Periode Payroll"
        subtitle="Periode resmi tahap awal dipakai untuk filter/report terlebih dahulu, belum menjadi closing operasional yang mengunci data."
      >
        <FilterBar
          actions={[
            <Space key="payroll-report-export" wrap>
              <Button onClick={exportDetailXlsx} disabled={filteredPayrolls.length === 0}>
                Export Detail XLSX
              </Button>
              <Button onClick={exportDetailCsv} disabled={filteredPayrolls.length === 0}>
                Export Detail CSV
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
        subtitle="Summary cards membaca payroll final line-centric sesuai filter aktif. Draft tetap tampil agar owner/admin bisa memantau queue operasional sebelum closing pembayaran."
      >
        <SummaryStatGrid items={summaryItems} columns={{ xs: 24, sm: 12, md: 8, lg: 6, xl: 6 }} />
      </PageSection>

      <PageSection
        title="Detail Payroll Lines"
        subtitle="Tabel laporan tetap line-centric. Work Log number hanya menjadi grouping visual dan referensi audit, bukan batch entity baru."
      >
        <Table
          className="app-data-table"
          rowKey="id"
          loading={loading}
          columns={payrollColumns}
          dataSource={filteredPayrolls}
          scroll={{ x: 1600 }}
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: <Empty description="Belum ada data payroll pada filter aktif" />,
          }}
        />
      </PageSection>
    </>
  );
};

export default PayrollReport;
