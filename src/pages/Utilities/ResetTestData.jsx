// src/Pages/Utilities/ResetTestData.jsx

// SECTION: import React dan hooks
import React, { useMemo, useState } from "react";

// SECTION: import komponen ant design
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Input,
  List,
  Modal,
  Result,
  Row,
  Space,
  Statistic,
  Typography,
  message,
  theme,
} from "antd";

// SECTION: import icon
import {
  DeleteOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@ant-design/icons";

// SECTION: import service reset data
import {
  resetAllTestData,
  TRANSACTION_COLLECTIONS_TO_DELETE,
} from "../../services/Utilities/resetTestDataService";

// SECTION: alias typography
const { Title, Paragraph, Text } = Typography;

// SECTION: format angka Indonesia tanpa desimal
const formatNumberID = (value) => {
  return Number(value || 0).toLocaleString("id-ID", {
    maximumFractionDigits: 0,
  });
};

const ResetTestData = () => {
  // SECTION: ambil token theme ant design agar ikut light/dark mode
  const { token } = theme.useToken();

  // SECTION: state modal konfirmasi
  const [confirmVisible, setConfirmVisible] = useState(false);

  // SECTION: state checkbox dan input konfirmasi
  const [understandRisk, setUnderstandRisk] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");

  // SECTION: state proses reset
  const [submitting, setSubmitting] = useState(false);

  // SECTION: state hasil reset
  const [lastResult, setLastResult] = useState(null);

  // SECTION: phrase wajib ketik sebelum reset
  const requiredPhrase = "RESET DATA UJI";

  // SECTION: validasi apakah user sudah boleh eksekusi reset
  const canSubmit = useMemo(() => {
    return understandRisk && confirmationText.trim() === requiredPhrase;
  }, [understandRisk, confirmationText]);

  // SECTION: style helper agar konsisten dengan theme aktif
  const pageStyle = {
    padding: 24,
    background: token.colorBgLayout,
    minHeight: "100%",
  };

  const subtleTextStyle = {
    color: token.colorTextSecondary,
  };

  const cardBodyStyle = {
    borderRadius: token.borderRadiusLG,
  };

  // SECTION: buka modal konfirmasi
  const openConfirmModal = () => {
    setConfirmVisible(true);
  };

  // SECTION: tutup modal konfirmasi
  const closeConfirmModal = () => {
    if (submitting) return;

    setConfirmVisible(false);
    setUnderstandRisk(false);
    setConfirmationText("");
  };

  // SECTION: jalankan reset
  const handleResetData = async () => {
    try {
      if (!canSubmit) {
        message.warning("Checklist dan teks konfirmasi wajib sesuai.");
        return;
      }

      setSubmitting(true);

      const result = await resetAllTestData();
      setLastResult(result);

      message.success("Data uji berhasil dibersihkan.");
      closeConfirmModal();
    } catch (error) {
      console.error("Gagal reset data uji:", error);
      message.error("Gagal reset data uji.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={pageStyle}>
      {/* SECTION: header halaman */}
      <div style={{ marginBottom: 16 }}>
        <Title level={2} style={{ marginBottom: 8, color: token.colorText }}>
          Reset Data Uji
        </Title>

        <Paragraph style={{ marginBottom: 0, ...subtleTextStyle }}>
          Halaman utilitas untuk menghapus data transaksi, log, pemasukan,
          pengeluaran, dan data uji lain tanpa menghapus master data inti.
        </Paragraph>
      </div>

      {/* SECTION: warning utama */}
      <Alert
        style={{ marginBottom: 16 }}
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        message="Gunakan hanya saat reset database testing"
        description="Aksi ini akan menghapus semua data transaksi dan log. Nama bahan baku, produk, kategori, supplier, pelanggan, komposisi produk, dan pricing rules tetap dipertahankan."
      />

      {/* SECTION: ringkasan yang dipertahankan vs direset */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card
            title="Data yang Tetap Dipertahankan"
            bordered
            style={{
              borderRadius: token.borderRadiusLG,
            }}
            bodyStyle={cardBodyStyle}
          >
            <List
              size="small"
              dataSource={[
                "Nama bahan baku",
                "Nama produk",
                "Kategori",
                "Supplier",
                "Pelanggan",
                "Komposisi produk",
                "Pricing rules",
                "Harga referensi dan setup master lainnya",
              ]}
              renderItem={(item) => (
                <List.Item style={{ color: token.colorText }}>{item}</List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card
            title="Data yang Akan Dihapus / Direset"
            bordered
            style={{
              borderRadius: token.borderRadiusLG,
            }}
            bodyStyle={cardBodyStyle}
          >
            <List
              size="small"
              dataSource={[
                "Penjualan",
                "Pembelian",
                "Retur",
                "Produksi",
                "Penyesuaian stok",
                "Riwayat log stok",
                "Kas masuk",
                "Kas keluar",
                "Log pricing",
                "Stok bahan baku dan produk",
                "Average actual unit cost bahan baku",
                "HPP per unit produk",
              ]}
              renderItem={(item) => (
                <List.Item style={{ color: token.colorText }}>{item}</List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* SECTION: statistik koleksi target */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card
            bordered
            style={{ borderRadius: token.borderRadiusLG }}
            bodyStyle={cardBodyStyle}
          >
            <Statistic
              title="Koleksi Transaksi / Log Target"
              value={TRANSACTION_COLLECTIONS_TO_DELETE.length}
            />
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card
            bordered
            style={{ borderRadius: token.borderRadiusLG }}
            bodyStyle={cardBodyStyle}
          >
            <Statistic
              title="Master Data Dipertahankan"
              value={7}
              suffix="jenis"
            />
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card
            bordered
            style={{ borderRadius: token.borderRadiusLG }}
            bodyStyle={cardBodyStyle}
          >
            <Statistic
              title="Mode Aksi"
              value="Testing Reset"
              valueStyle={{
                fontSize: 24,
                color: token.colorText,
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* SECTION: daftar koleksi yang dihapus */}
      <Card
        title="Koleksi Firestore yang Akan Dihapus"
        style={{
          marginBottom: 16,
          borderRadius: token.borderRadiusLG,
        }}
        bordered
        bodyStyle={cardBodyStyle}
      >
        <List
          bordered
          size="small"
          dataSource={TRANSACTION_COLLECTIONS_TO_DELETE}
          renderItem={(item) => (
            <List.Item style={{ color: token.colorText }}>{item}</List.Item>
          )}
        />
      </Card>

      {/* SECTION: tombol reset */}
      <Card
        bordered
        style={{
          borderRadius: token.borderRadiusLG,
        }}
        bodyStyle={cardBodyStyle}
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Alert
            type="error"
            showIcon
            message="Aksi ini tidak bisa di-undo"
            description="Pastikan hanya dipakai untuk mereset data uji. Setelah tombol dijalankan, data transaksi dan log akan hilang."
          />

          <Button
            danger
            type="primary"
            icon={<DeleteOutlined />}
            size="large"
            onClick={openConfirmModal}
          >
            Reset Semua Data Uji
          </Button>
        </Space>
      </Card>

      {/* SECTION: hasil reset terakhir */}
      {lastResult && (
        <Card
          style={{
            marginTop: 16,
            borderRadius: token.borderRadiusLG,
          }}
          title="Hasil Reset Terakhir"
          bordered
          bodyStyle={cardBodyStyle}
        >
          <Result
            status="success"
            title="Reset data uji selesai"
            subTitle={`Total dokumen terhapus: ${formatNumberID(
              lastResult.totalDeletedDocs || 0,
            )}`}
            extra={[
              <Button key="refresh" icon={<ReloadOutlined />}>
                Refresh halaman bila perlu
              </Button>,
            ]}
          />

          <Divider />

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} md={8}>
              <Card
                bordered
                style={{ borderRadius: token.borderRadiusLG }}
                bodyStyle={cardBodyStyle}
              >
                <Statistic
                  title="Raw Materials Direset"
                  value={lastResult.rawMaterialsResetCount || 0}
                />
              </Card>
            </Col>

            <Col xs={24} md={8}>
              <Card
                bordered
                style={{ borderRadius: token.borderRadiusLG }}
                bodyStyle={cardBodyStyle}
              >
                <Statistic
                  title="Products Direset"
                  value={lastResult.productsResetCount || 0}
                />
              </Card>
            </Col>

            <Col xs={24} md={8}>
              <Card
                bordered
                style={{ borderRadius: token.borderRadiusLG }}
                bodyStyle={cardBodyStyle}
              >
                <Statistic
                  title="Total Koleksi Diproses"
                  value={
                    Object.keys(lastResult.deletedSummary || {}).length || 0
                  }
                />
              </Card>
            </Col>
          </Row>

          <List
            bordered
            dataSource={Object.entries(lastResult.deletedSummary || {})}
            renderItem={([collectionName, deletedCount]) => (
              <List.Item>
                <Space
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: token.colorText }}>
                    {collectionName}
                  </Text>
                  <Text strong style={{ color: token.colorText }}>
                    {formatNumberID(deletedCount)} dokumen
                  </Text>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* SECTION: modal konfirmasi final */}
      <Modal
        open={confirmVisible}
        onCancel={closeConfirmModal}
        onOk={handleResetData}
        okText="Ya, Reset Sekarang"
        cancelText="Batal"
        okButtonProps={{
          danger: true,
          disabled: !canSubmit,
          loading: submitting,
        }}
        cancelButtonProps={{
          disabled: submitting,
        }}
        title="Konfirmasi Reset Data Uji"
        destroyOnClose
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Alert
            type="warning"
            showIcon
            message="Konfirmasi terakhir"
            description="Aksi ini akan menghapus data transaksi dan log. Master data inti tetap ada, tetapi stok, average actual unit cost, dan HPP akan direset."
          />

          <Checkbox
            checked={understandRisk}
            onChange={(e) => setUnderstandRisk(e.target.checked)}
          >
            Saya paham bahwa aksi ini akan menghapus data transaksi dan log.
          </Checkbox>

          <div>
            <Paragraph style={{ marginBottom: 8, color: token.colorText }}>
              Ketik teks berikut untuk lanjut:
            </Paragraph>

            <Text strong style={{ color: token.colorText }}>
              {requiredPhrase}
            </Text>

            <Input
              style={{ marginTop: 8 }}
              placeholder="Ketik teks konfirmasi"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default ResetTestData;
