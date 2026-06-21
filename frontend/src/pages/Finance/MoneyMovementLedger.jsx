import React, { useEffect, useMemo, useState } from "react";
import { Button, Col, Input, Select, Tag, Typography, message } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import EmptyStateBlock from "../../components/Layout/Feedback/EmptyStateBlock";
import { getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import FilterBar from "../../components/Layout/Filters/FilterBar";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import DataTableView from "../../components/Layout/Table/DataTableView";
import {
  MONEY_MOVEMENT_LEDGER_DEFAULT_LIMIT,
  getMoneyMovementLedger,
} from "../../services/Finance/moneyMovementLedgerService";
import { formatCurrencyId } from "../../utils/formatters/currencyId";
import { formatDateId } from "../../utils/formatters/dateId";
import { formatNumberId } from "../../utils/formatters/numberId";
import {
  buildFinanceMonthOptions,
  buildFinanceYearSelectOptions,
  getCurrentFinanceYear,
} from "./helpers/financePeriodHelpers";

const { Search } = Input;
const { Text } = Typography;

const MONTH_OPTIONS = buildFinanceMonthOptions({ includeAll: true });

const DIRECTION_OPTIONS = [
  { label: "Semua Arah", value: "all" },
  { label: "Masuk", value: "in" },
  { label: "Keluar", value: "out" },
];

const SOURCE_OPTIONS = [
  { label: "Semua Sumber", value: "all" },
  { label: "Penjualan Selesai", value: "sales" },
  { label: "Cash In Manual", value: "cash_in_manual" },
  { label: "Pembelian", value: "purchases" },
  { label: "Payroll Produksi", value: "production_payroll" },
  { label: "Cash Out Manual", value: "cash_out_manual" },
  { label: "Lainnya", value: "other" },
];

const LIMIT_OPTIONS = [100, 300, 500, 1000].map((value) => ({
  label: `${value} transaksi`,
  value,
}));

const getDirectionMeta = (direction) => {
  if (direction === "in") return { label: "Masuk", color: "green", sign: "+" };
  if (direction === "out") return { label: "Keluar", color: "red", sign: "-" };
  return { label: "Netral", color: "default", sign: "" };
};

const getSourceTagColor = (sourceModule) => {
  if (sourceModule === "sales") return "green";
  if (sourceModule === "cash_in_manual") return "blue";
  if (sourceModule === "purchases") return "volcano";
  if (sourceModule === "production_payroll") return "purple";
  if (sourceModule === "cash_out_manual") return "red";
  return "default";
};

const MoneyMovementLedger = () => {
  const [ledgerRows, setLedgerRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(getCurrentFinanceYear());
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedDirection, setSelectedDirection] = useState("all");
  const [selectedSource, setSelectedSource] = useState("all");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedLimit, setSelectedLimit] = useState(MONEY_MOVEMENT_LEDGER_DEFAULT_LIMIT);

  const yearOptions = useMemo(() => buildFinanceYearSelectOptions(), []);

  const fetchLedgerRows = async () => {
    setLoading(true);

    try {
      const data = await getMoneyMovementLedger({
        year: selectedYear,
        month: selectedMonth,
        direction: selectedDirection,
        source: selectedSource,
        search: searchKeyword,
        limit: selectedLimit,
      });

      setLedgerRows(data);
    } catch (error) {
      console.error("Gagal memuat Buku Besar Kas:", error);
      message.error("Gagal memuat Buku Besar Kas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isActive = true;

    const loadLedgerRows = async () => {
      setLoading(true);

      try {
        const data = await getMoneyMovementLedger({
          year: selectedYear,
          month: selectedMonth,
          direction: selectedDirection,
          source: selectedSource,
          search: searchKeyword,
          limit: selectedLimit,
        });

        if (isActive) {
          setLedgerRows(data);
        }
      } catch (error) {
        console.error("Gagal memuat Buku Besar Kas:", error);
        if (isActive) {
          message.error("Gagal memuat Buku Besar Kas.");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadLedgerRows();

    return () => {
      isActive = false;
    };
  }, [searchKeyword, selectedDirection, selectedLimit, selectedMonth, selectedSource, selectedYear]);

  const summary = useMemo(() => {
    return ledgerRows.reduce(
      (accumulator, row) => {
        const amount = Math.round(Number(row.amount || 0));

        if (row.direction === "in") {
          accumulator.totalIn += amount;
          accumulator.countIn += 1;
        }

        if (row.direction === "out") {
          accumulator.totalOut += amount;
          accumulator.countOut += 1;
        }

        accumulator.totalRows += 1;
        return accumulator;
      },
      {
        totalIn: 0,
        totalOut: 0,
        countIn: 0,
        countOut: 0,
        totalRows: 0,
      },
    );
  }, [ledgerRows]);

  const netMovement = summary.totalIn - summary.totalOut;

  const summaryItems = useMemo(
    () => [
      {
        key: "money-in",
        title: "Total Uang Masuk",
        value: formatCurrencyId(summary.totalIn),
        subtitle: `${formatNumberId(summary.countIn)} transaksi masuk.`,
        accent: "success",
      },
      {
        key: "money-out",
        title: "Total Uang Keluar",
        value: formatCurrencyId(summary.totalOut),
        subtitle: `${formatNumberId(summary.countOut)} transaksi keluar.`,
        accent: "danger",
      },
      {
        key: "net-movement",
        title: "Selisih Bersih Periode",
        value: formatCurrencyId(netMovement),
        subtitle: "Bukan saldo akhir kas.",
        accent: netMovement >= 0 ? "primary" : "warning",
      },
      {
        key: "transaction-count",
        title: "Jumlah Transaksi",
        value: formatNumberId(summary.totalRows),
        subtitle: "Row yang tampil sesuai filter.",
        accent: "primary",
      },
    ],
    [netMovement, summary],
  );

  const ledgerMobileCardConfig = useMemo(
    () => ({
      title: (record) => record.description || record.referenceCode || "Pergerakan kas",
      subtitle: (record) => [
        formatDateId(record.date, true),
        record.referenceCode || "Tanpa referensi",
        record.sourceLabel || record.sourceCollection || "Sumber tidak diketahui",
      ],
      tags: (record) => {
        const directionMeta = getDirectionMeta(record.direction);
        return <Tag color={directionMeta.color}>{directionMeta.label}</Tag>;
      },
      meta: [
        {
          label: "Nominal",
          value: (record) => {
            const directionMeta = getDirectionMeta(record.direction);
            return `${directionMeta.sign ? `${directionMeta.sign} ` : ""}${formatCurrencyId(record.amount)}`;
          },
        },
        { label: "Status", value: (record) => record.status || "-" },
      ],
      content: (record) => (
        <Tag color={getSourceTagColor(record.sourceModule)}>{record.sourceLabel || record.sourceModule || "Sumber"}</Tag>
      ),
    }),
    [],
  );

  const columns = useMemo(
    () => [
      {
        title: "Tanggal",
        dataIndex: "date",
        key: "date",
        width: 150,
        render: (value) => formatDateId(value, true),
      },
      {
        title: "Arah",
        dataIndex: "direction",
        key: "direction",
        width: 110,
        render: (value) => {
          const directionMeta = getDirectionMeta(value);
          return <Tag color={directionMeta.color}>{directionMeta.label}</Tag>;
        },
      },
      {
        title: "Sumber",
        key: "source",
        width: 220,
        render: (_, record) => (
          <div className="ims-cell-stack ims-cell-stack-tight">
            <div>
              <Tag color={getSourceTagColor(record.sourceModule)}>{record.sourceLabel}</Tag>
            </div>
            <Text type="secondary" className="ims-cell-meta">
              {record.sourceCollection}
            </Text>
          </div>
        ),
      },
      {
        title: "Referensi",
        dataIndex: "referenceCode",
        key: "referenceCode",
        width: 180,
        render: (value) => value || "-",
      },
      {
        title: "Keterangan",
        dataIndex: "description",
        key: "description",
        ellipsis: true,
        render: (value, record) => (
          <div className="ims-cell-stack ims-cell-stack-tight">
            <Text title={value || "-"} className="ims-cell-title">
              {value || "-"}
            </Text>
            {record.status ? (
              <Text type="secondary" className="ims-cell-meta">
                Status: {record.status}
              </Text>
            ) : null}
          </div>
        ),
      },
      {
        title: "Nominal",
        dataIndex: "amount",
        key: "amount",
        width: 180,
        align: "right",
        render: (value, record) => {
          const directionMeta = getDirectionMeta(record.direction);
          return (
            <Text strong>
              {directionMeta.sign ? `${directionMeta.sign} ` : ""}
              {formatCurrencyId(value)}
            </Text>
          );
        },
      },
    ],
    [],
  );

  /* =====================================================
     SECTION: Money Movement Ledger Render — AKTIF / GUARDED
     Fungsi:
     - Menampilkan Buku Besar Kas read-only dari incomes, revenues, dan expenses.
     - Tidak menyediakan tombol tambah/edit/delete agar tidak membuat posting kas baru.

     Dipakai oleh:
     - Route /finance/money-movement-ledger dan menu Kas & Biaya.

     Risiko:
     - Jangan ubah halaman ini menjadi writer transaksi; Cash In/Cash Out tetap jalur resmi input kas.
     ===================================================== */
  return (
    <>
      <PageHeader
        title="Buku Besar Kas"
        subtitle="Audit pergerakan uang read-only dari pemasukan dan pengeluaran resmi."
      />

      <PageSection
        title="Ringkasan Buku Besar Kas"
        subtitle="Ringkasan uang masuk, uang keluar, dan selisih bersih sesuai filter aktif."
      >
        <SummaryStatGrid
          items={summaryItems}
          columns={{ xs: 24, sm: 12, lg: 6 }}
          variant="finance"
          highlightKey="net-movement"
        />
      </PageSection>

      <PageSection
        title="Filter Riwayat Kas"
        subtitle="Filter hanya mengubah tampilan; halaman ini tidak membuat atau mengubah transaksi kas."
      >
        <FilterBar
          actions={
            <Button icon={<ReloadOutlined />} onClick={fetchLedgerRows} disabled={loading}>
              Refresh
            </Button>
          }
        >
          <Col xs={24} sm={12} md={6} lg={4}>
            <Select
              value={selectedYear}
              onChange={setSelectedYear}
              options={yearOptions}
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={24} sm={12} md={6} lg={5}>
            <Select
              value={selectedMonth}
              onChange={setSelectedMonth}
              options={MONTH_OPTIONS}
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={24} sm={12} md={6} lg={5}>
            <Select
              value={selectedDirection}
              onChange={setSelectedDirection}
              options={DIRECTION_OPTIONS}
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={24} sm={12} md={6} lg={5}>
            <Select
              value={selectedSource}
              onChange={setSelectedSource}
              options={SOURCE_OPTIONS}
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={24} sm={12} md={6} lg={5}>
            <Select
              value={selectedLimit}
              onChange={setSelectedLimit}
              options={LIMIT_OPTIONS}
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={24} md={12} lg={8}>
            <Search
              allowClear
              value={searchKeyword}
              placeholder="Cari referensi, deskripsi, sumber, status"
              onChange={(event) => setSearchKeyword(event.target.value)}
            />
          </Col>
        </FilterBar>
      </PageSection>

      <PageSection
        title="Tabel Riwayat Pergerakan Kas"
        subtitle="Data kas tercatat dari sumber transaksi resmi."
        extra={<Tag>{formatNumberId(ledgerRows.length)} baris tampil</Tag>}
      >
        <DataTableView
          loading={loading}
          showRefreshIndicator
          className="app-data-table"
          dataSource={ledgerRows}
          columns={columns}
          rowKey="id"
          scroll={{ x: 980 }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          mobileCardConfig={ledgerMobileCardConfig}
          locale={{
            emptyText: getDataTableEmptyText(
              loading,
              <EmptyStateBlock description="Belum ada pergerakan uang sesuai filter." />,
            ),
          }}
        />
      </PageSection>
    </>
  );
};

export default MoneyMovementLedger;
