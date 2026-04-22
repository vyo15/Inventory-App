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

// =========================
// SECTION: Helper saving pembelian
// Catatan:
// - saving tetap dibaca sebagai informasi efisiensi
// - tidak mengubah fakta bahwa laporan pembelian membaca expenses
// =========================
const getSavingMeta = (value) => {
  const amount = Math.round(Number(value || 0));

  if (amount > 0) {
    return {
      label: `Hemat ${formatCurrencyId(amount)}`,
      color: "green",
    };
  }

  if (amount < 0) {
    return {
      label: `Lebih Mahal ${formatCurrencyId(Math.abs(amount))}`,
      color: "red",
    };
  }

  return {
    label: "Sesuai Referensi",
    color: "default",
  };
};

const PurchasesReport = () => {
  const [purchasesData, setPurchasesData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPurchases = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(
          query(collection(db, "expenses"), orderBy("date", "desc")),
        );

        const data = querySnapshot.docs
          .map((documentItem) => ({
            id: documentItem.id,
            ...documentItem.data(),
          }))
          .filter(
            (item) =>
              item.sourceModule === "purchases" ||
              item.type === "Pembelian Bahan/Barang",
          );

        setPurchasesData(data);
      } catch (error) {
        console.error("Gagal mengambil data laporan pembelian:", error);
        message.error("Gagal memuat laporan pembelian.");
      } finally {
        setLoading(false);
      }
    };

    fetchPurchases();
  }, []);

  const summary = useMemo(() => {
    return purchasesData.reduce(
      (accumulator, item) => {
        accumulator.totalActual += Math.round(Number(item.amount || 0));
        accumulator.totalReference += Math.round(Number(item.totalReferenceAmount || 0));
        accumulator.totalSaving += Math.round(Number(item.savingAmount || 0));
        accumulator.totalTransactions += 1;
        return accumulator;
      },
      {
        totalActual: 0,
        totalReference: 0,
        totalSaving: 0,
        totalTransactions: 0,
      },
    );
  }, [purchasesData]);

  const summaryItems = useMemo(
    () => [
      {
        key: "total-actual-purchase",
        title: "Total Aktual Pembelian",
        value: formatCurrencyId(summary.totalActual),
        subtitle: "Total expense pembelian yang benar-benar diakui.",
        accent: "danger",
      },
      {
        key: "total-reference-purchase",
        title: "Total Referensi",
        value: formatCurrencyId(summary.totalReference),
        subtitle: "Nilai referensi untuk pembanding efisiensi pembelian.",
        accent: "primary",
      },
      {
        key: "total-saving-purchase",
        title: "Total Saving",
        value:
          summary.totalSaving < 0
            ? `- ${formatCurrencyId(Math.abs(summary.totalSaving))}`
            : formatCurrencyId(summary.totalSaving),
        subtitle: "Saving tetap ditampilkan sebagai info, bukan pengurang kas keluar.",
        accent: summary.totalSaving >= 0 ? "success" : "danger",
      },
      {
        key: "purchase-transaction-count",
        title: "Jumlah Transaksi",
        value: formatNumberId(summary.totalTransactions),
        subtitle: "Jumlah transaksi pembelian yang terbaca dari expenses.",
        accent: "warning",
      },
    ],
    [summary],
  );

  const exportToExcel = async () => {
    const exportData = purchasesData.map((purchase) => ({
      "ID Expense": purchase.id,
      Tanggal: purchase.date?.toDate
        ? dayjs(purchase.date.toDate()).format("DD-MM-YYYY HH:mm")
        : "-",
      Supplier: purchase.supplierName || "-",
      Item: purchase.relatedItemName || purchase.description || "-",
      "Aktual Keluar": Math.round(Number(purchase.amount || 0)),
      Referensi: Math.round(Number(purchase.totalReferenceAmount || 0)),
      Saving: Math.round(Number(purchase.savingAmount || 0)),
      Tipe: purchase.type || "-",
      Deskripsi: purchase.description || "-",
    }));

    await exportJsonToExcel({
      data: exportData,
      sheetName: "Laporan Pembelian",
      fileName: "Laporan-Pembelian",
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
        title: "Supplier",
        dataIndex: "supplierName",
        key: "supplierName",
        render: (value) => value || "-",
      },
      {
        title: "Item",
        key: "itemName",
        render: (_, record) => record.relatedItemName || record.description || "-",
      },
      {
        title: "Aktual Keluar",
        dataIndex: "amount",
        key: "amount",
        render: (value) => formatCurrencyId(value),
      },
      {
        title: "Referensi",
        dataIndex: "totalReferenceAmount",
        key: "totalReferenceAmount",
        render: (value) => (value ? formatCurrencyId(value) : "-"),
      },
      {
        title: "Saving",
        dataIndex: "savingAmount",
        key: "savingAmount",
        render: (value) => {
          const meta = getSavingMeta(value);
          return <Tag color={meta.color}>{meta.label}</Tag>;
        },
      },
      {
        title: "Deskripsi",
        dataIndex: "description",
        key: "description",
        render: (value) => value || "-",
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Laporan Pembelian"
        subtitle="Laporan ini tetap membaca expenses sesuai business rule aktif, lalu distandardisasi ke pola section dan summary card yang reusable."
      />

      <PageSection
        title="Ringkasan Pembelian"
        subtitle="Ringkasan membantu membaca total aktual, total referensi, dan saving pembelian dengan cepat."
      >
        <SummaryStatGrid items={summaryItems} columns={{ xs: 24, sm: 12, md: 12, lg: 6 }} />
      </PageSection>

      <PageSection
        title="Detail Pembelian"
        subtitle="Data tabel tetap bersumber dari expenses yang ditandai sebagai pembelian aktif."
        extra={
          <Button type="primary" onClick={exportToExcel} disabled={purchasesData.length === 0}>
            Ekspor ke Excel
          </Button>
        }
      >
        <Table
          dataSource={purchasesData}
          columns={columns}
          rowKey="id"
          loading={loading}
          locale={{
            emptyText: <EmptyStateBlock description="Belum ada data pembelian untuk ditampilkan." />,
          }}
        />
      </PageSection>
    </>
  );
};

export default PurchasesReport;
