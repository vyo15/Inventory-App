import React, { useEffect, useMemo, useState } from "react";
import { Card, Table, message, Row, Col, Statistic, Button, Tag } from "antd";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import dayjs from "dayjs";
import { exportJsonToExcel } from "../../utils/export/exportExcel";

// SECTION: format angka Indonesia tanpa desimal
const formatNumberID = (value) => {
  return Number(value || 0).toLocaleString("id-ID", {
    maximumFractionDigits: 0,
  });
};

// SECTION: format rupiah Indonesia tanpa desimal
const formatCurrencyIDR = (value) => {
  return `Rp ${formatNumberID(value)}`;
};

// SECTION: helper label saving pembelian
const getSavingMeta = (value) => {
  const amount = Math.round(Number(value || 0));

  if (amount > 0) {
    return {
      label: `Hemat ${formatCurrencyIDR(amount)}`,
      color: "green",
    };
  }

  if (amount < 0) {
    return {
      label: `Lebih Mahal ${formatCurrencyIDR(Math.abs(amount))}`,
      color: "red",
    };
  }

  return {
    label: "Sesuai Referensi",
    color: "default",
  };
};

const PurchasesReport = () => {
  // SECTION: state utama laporan pembelian
  const [purchasesData, setPurchasesData] = useState([]);
  const [loading, setLoading] = useState(true);

  // SECTION: ambil data pembelian dari expenses agar sesuai requirement terbaru
  useEffect(() => {
    const fetchPurchases = async () => {
      setLoading(true);
      try {
        const expensesRef = collection(db, "expenses");
        const q = query(expensesRef, orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);

        const data = querySnapshot.docs
          .map((docItem) => ({
            id: docItem.id,
            ...docItem.data(),
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

  // SECTION: ringkasan total keseluruhan pembelian
  const summary = useMemo(() => {
    return purchasesData.reduce(
      (acc, item) => {
        acc.totalActual += Math.round(Number(item.amount || 0));
        acc.totalReference += Math.round(
          Number(item.totalReferenceAmount || 0),
        );
        acc.totalSaving += Math.round(Number(item.savingAmount || 0));
        acc.totalTransactions += 1;
        return acc;
      },
      {
        totalActual: 0,
        totalReference: 0,
        totalSaving: 0,
        totalTransactions: 0,
      },
    );
  }, [purchasesData]);

  // SECTION: ekspor laporan pembelian ke excel
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

  // SECTION: kolom tabel laporan pembelian
  const columns = [
    {
      title: "Tanggal",
      dataIndex: "date",
      render: (val) =>
        val?.toDate ? dayjs(val.toDate()).format("DD-MM-YYYY HH:mm") : "-",
    },
    {
      title: "Supplier",
      dataIndex: "supplierName",
      render: (text) => text || "-",
    },
    {
      title: "Item",
      key: "itemName",
      render: (_, record) =>
        record.relatedItemName || record.description || "-",
    },
    {
      title: "Aktual Keluar",
      dataIndex: "amount",
      render: (val) => formatCurrencyIDR(val),
    },
    {
      title: "Referensi",
      dataIndex: "totalReferenceAmount",
      render: (val) => (val ? formatCurrencyIDR(val) : "-"),
    },
    {
      title: "Saving",
      dataIndex: "savingAmount",
      render: (val) => {
        const meta = getSavingMeta(val);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: "Deskripsi",
      dataIndex: "description",
      render: (text) => text || "-",
    },
  ];

  return (
    <div>
      <h2>Laporan Pembelian</h2>

      {/* SECTION: ringkasan total keseluruhan pembelian */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Total Aktual Pembelian"
              value={summary.totalActual}
              formatter={(value) => formatCurrencyIDR(value)}
            />
          </Card>
        </Col>

        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Total Referensi"
              value={summary.totalReference}
              formatter={(value) => formatCurrencyIDR(value)}
            />
          </Card>
        </Col>

        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Total Saving"
              value={summary.totalSaving}
              formatter={(value) => {
                const amount = Math.round(Number(value || 0));
                if (amount < 0) {
                  return `- ${formatCurrencyIDR(Math.abs(amount))}`;
                }
                return formatCurrencyIDR(amount);
              }}
            />
          </Card>
        </Col>

        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Jumlah Transaksi"
              value={summary.totalTransactions}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Detail Pembelian">
        <div style={{ marginBottom: 16, textAlign: "right" }}>
          <Button
            type="primary"
            onClick={exportToExcel}
            disabled={purchasesData.length === 0}
          >
            Ekspor ke Excel
          </Button>
        </div>

        <Table
          dataSource={purchasesData}
          columns={columns}
          rowKey="id"
          loading={loading}
        />
      </Card>
    </div>
  );
};

export default PurchasesReport;
