import React, { useEffect, useMemo, useState } from "react";
import { Button, Table, Tag, message } from "antd";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import dayjs from "dayjs";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import EmptyStateBlock from "../../components/Layout/Feedback/EmptyStateBlock";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import { db } from "../../firebase";
import { exportJsonToExcel } from "../../utils/export/exportExcel";
import { formatCurrencyId } from "../../utils/formatters/currencyId";
import { formatDateId } from "../../utils/formatters/dateId";
import { formatNumberId } from "../../utils/formatters/numberId";

const SalesReport = () => {
  // =========================
  // SECTION: State utama laporan
  // =========================
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(true);

  // =========================
  // SECTION: Fetch data laporan penjualan
  // Catatan business rule:
  // - source laporan tetap membaca collection sales
  // - refactor ini hanya menata presentasi, bukan mengubah sumber laporan
  // =========================
  useEffect(() => {
    const fetchSales = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(
          query(collection(db, "sales"), orderBy("createdAt", "desc")),
        );

        const data = querySnapshot.docs.map((documentItem) => ({
          id: documentItem.id,
          ...documentItem.data(),
        }));

        setSalesData(data);
      } catch (error) {
        console.error("Gagal mengambil data laporan penjualan:", error);
        message.error("Gagal memuat laporan penjualan.");
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, []);

  // =========================
  // SECTION: Summary data
  // =========================
  const summary = useMemo(() => {
    return salesData.reduce(
      (accumulator, item) => {
        const total = Math.round(Number(item.total || 0));
        accumulator.totalRevenue += total;
        accumulator.totalSalesCount += 1;

        if ((item.status || "") === "Selesai") {
          accumulator.totalCompletedRevenue += total;
          accumulator.totalCompletedCount += 1;
        }

        return accumulator;
      },
      {
        totalRevenue: 0,
        totalSalesCount: 0,
        totalCompletedRevenue: 0,
        totalCompletedCount: 0,
      },
    );
  }, [salesData]);

  const summaryItems = useMemo(
    () => [
      {
        key: "all-revenue",
        title: "Total Omzet Semua Transaksi",
        value: formatCurrencyId(summary.totalRevenue),
        subtitle: "Total nominal seluruh transaksi sales.",
        accent: "primary",
      },
      {
        key: "sales-count",
        title: "Jumlah Transaksi",
        value: formatNumberId(summary.totalSalesCount),
        subtitle: "Jumlah dokumen penjualan yang tercatat.",
        accent: "success",
      },
      {
        key: "completed-revenue",
        title: "Omzet Status Selesai",
        value: formatCurrencyId(summary.totalCompletedRevenue),
        subtitle: "Bagian omzet dari transaksi berstatus selesai.",
        accent: "warning",
      },
      {
        key: "completed-count",
        title: "Transaksi Selesai",
        value: formatNumberId(summary.totalCompletedCount),
        subtitle: "Jumlah transaksi dengan status selesai.",
        accent: "danger",
      },
    ],
    [summary],
  );

  // =========================
  // SECTION: Export helper
  // =========================
  const exportToExcel = async () => {
    const exportData = salesData.map((sale) => ({
      "ID Transaksi": sale.id,
      Tanggal: sale.date?.toDate
        ? dayjs(sale.date.toDate()).format("DD-MM-YYYY HH:mm")
        : "-",
      Pelanggan: sale.customerName || "-",
      Channel: sale.salesChannel || "-",
      Resi: sale.referenceNumber || "-",
      "Item Terjual": (sale.items || [])
        .map((item) => `${item.itemName} (${item.quantity})`)
        .join(", "),
      Total: Math.round(Number(sale.total || 0)),
      Status: sale.status || "-",
      Catatan: sale.note || "-",
    }));

    await exportJsonToExcel({
      data: exportData,
      sheetName: "Laporan Penjualan",
      fileName: "Laporan-Penjualan",
    });
    message.success("Laporan berhasil diekspor ke Excel!");
  };

  const columns = useMemo(
    () => [
      {
        title: "Tanggal",
        dataIndex: "date",
        key: "date",
        render: (value) => formatDateId(value, true),
      },
      {
        title: "Pelanggan",
        dataIndex: "customerName",
        key: "customerName",
        render: (value) => value || "-",
      },
      {
        title: "Item",
        dataIndex: "items",
        key: "items",
        render: (items) =>
          Array.isArray(items) && items.length > 0 ? (
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {items.map((item, index) => (
                <li key={`${item.itemName}-${index}`}>
                  {item.itemName} ({item.quantity}) - {formatCurrencyId(item.pricePerUnit)}
                </li>
              ))}
            </ul>
          ) : (
            "-"
          ),
      },
      {
        title: "Channel",
        dataIndex: "salesChannel",
        key: "salesChannel",
        render: (value) => value || "-",
      },
      {
        title: "Resi / Referensi",
        dataIndex: "referenceNumber",
        key: "referenceNumber",
        render: (value) => value || "-",
      },
      {
        title: "Total",
        dataIndex: "total",
        key: "total",
        render: (value) => formatCurrencyId(value),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (status) => {
          const statusColors = {
            Selesai: "green",
            Dikirim: "orange",
            Diproses: "blue",
            Dibatalkan: "red",
          };

          return <Tag color={statusColors[status] || "default"}>{status || "-"}</Tag>;
        },
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Laporan Penjualan"
        subtitle="Laporan ini tetap membaca collection sales aktif, lalu ditata ulang ke pattern page header, summary card, dan table section yang seragam."
      />

      <PageSection
        title="Ringkasan Penjualan"
        subtitle="Ringkasan membantu membaca performa transaksi keseluruhan dan status selesai secara cepat."
      >
        <SummaryStatGrid items={summaryItems} columns={{ xs: 24, sm: 12, md: 12, lg: 6 }} />
      </PageSection>

      <PageSection
        title="Detail Penjualan"
        subtitle="Data item, pelanggan, channel, dan status tetap mengikuti dokumen sales yang tersimpan di Firestore."
        extra={
          <Button type="primary" onClick={exportToExcel} disabled={salesData.length === 0}>
            Ekspor ke Excel
          </Button>
        }
      >
        {/* =========================
            SECTION: tabel laporan penjualan baseline global
            Fungsi:
            - menyamakan surface tabel laporan dengan baseline global tanpa mengubah logic sumber data sales
            - tidak ada aksi row karena halaman laporan cukup fokus pada baca + ekspor
            Status: aktif / final
        ========================= */}
        <Table
          className="app-data-table"
          dataSource={salesData}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: <EmptyStateBlock description="Belum ada data penjualan untuk ditampilkan." />,
          }}
        />
      </PageSection>
    </>
  );
};

export default SalesReport;
