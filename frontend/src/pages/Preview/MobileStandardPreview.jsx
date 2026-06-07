import React, { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import FilterBar from "../../components/Layout/Filters/FilterBar";
import ResponsiveDataView from "../../components/Layout/Mobile/ResponsiveDataView";
import MobileActionMenu from "../../components/Layout/Mobile/MobileActionMenu";
import MobileDetailDrawer from "../../components/Layout/Mobile/MobileDetailDrawer";
import ResponsiveFormSection from "../../components/Layout/Mobile/ResponsiveFormSection";
import MobileStateBlock from "../../components/Layout/Mobile/MobileStateBlock";
import MobileFilterDrawer from "../../components/Layout/Mobile/MobileFilterDrawer";
import { formatCurrencyId } from "../../utils/formatters/currencyId";
import "./MobileStandardPreview.css";

const { Text } = Typography;

const sampleRows = [
  {
    id: "prd-1",
    name: "Mawar Putih Flanel",
    code: "PRD-MWR-PTH-001",
    categoryName: "Bunga Jadi",
    currentStock: 120,
    minimumStock: 20,
    sellPrice: 15000,
    hpp: 9200,
    status: "Aktif",
    stockStatus: "Aman",
    badgeColor: "green",
  },
  {
    id: "prd-2",
    name: "Mawar Merah Flanel",
    code: "PRD-MWR-MRH-001",
    categoryName: "Bunga Jadi",
    currentStock: 14,
    minimumStock: 20,
    sellPrice: 15000,
    hpp: 9300,
    status: "Aktif",
    stockStatus: "Stok Rendah",
    badgeColor: "orange",
  },
  {
    id: "sale-1",
    name: "SALE-05062026-001",
    code: "Customer: Siti · Channel Shopee",
    categoryName: "Sales",
    currentStock: 3,
    minimumStock: 0,
    sellPrice: 150000,
    hpp: 82000,
    status: "Diproses",
    stockStatus: "Stok Keluar",
    badgeColor: "blue",
  },
];

const roadmapRows = [
  ["M1", "Foundation", "AppLayout, AppHeader, PageHeader, FilterBar, ResponsiveDataView", "Preview aman"],
  ["M2", "Master Data", "Products, Raw Materials, Semi Finished, Customers, Suppliers", "Card/list"],
  ["M3", "Inventory & Transaksi", "Stock, Sales, Purchases, Returns", "Tanpa ubah logic"],
  ["M4", "Produksi", "BOM, Planning, Work Log, Payroll, HPP", "Detail drawer"],
  ["M5", "Reports & Maintenance", "Dashboard, Reports, Backup/Restore", "Guarded"],
];

const buildColumns = (openDetail) => [
  {
    title: "Nama / Referensi",
    dataIndex: "name",
    key: "name",
    render: (value, record) => (
      <div className="ims-cell-stack ims-cell-stack-tight">
        <Text strong>{value}</Text>
        <Text type="secondary" className="ims-cell-meta">{record.code}</Text>
      </div>
    ),
  },
  {
    title: "Stok / Qty",
    key: "stock",
    render: (_, record) => `${record.currentStock} pcs`,
  },
  {
    title: "Harga / Total",
    key: "price",
    render: (_, record) => formatCurrencyId(record.sellPrice),
  },
  {
    title: "Status",
    key: "status",
    render: (_, record) => <Tag color={record.badgeColor}>{record.stockStatus}</Tag>,
  },
  {
    title: "Aksi",
    key: "actions",
    render: (_, record) => (
      <Space>
        <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>Detail</Button>
        <Button size="small" icon={<EditOutlined />}>Edit</Button>
      </Space>
    ),
  },
];

const PhoneCard = ({ row, onDetail }) => (
  <article className="mobile-preview-phone-card">
    <div className="mobile-preview-phone-card__header">
      <div>
        <strong>{row.name}</strong>
        <span>{row.code}</span>
      </div>
      <Tag color={row.badgeColor}>{row.stockStatus}</Tag>
    </div>
    <div className="mobile-preview-phone-card__meta">
      <div><span>Stok/Qty</span><strong>{row.currentStock} pcs</strong></div>
      <div><span>Minimum</span><strong>{row.minimumStock || "-"}</strong></div>
      <div><span>Harga/Total</span><strong>{formatCurrencyId(row.sellPrice)}</strong></div>
      <div><span>Status</span><strong>{row.status}</strong></div>
    </div>
    <MobileActionMenu
      primaryActions={[
        { key: "detail", label: "Detail", icon: <EyeOutlined />, onClick: () => onDetail(row) },
        { key: "edit", label: "Edit", icon: <EditOutlined /> },
      ]}
      moreActions={[
        { key: "history", label: "Riwayat" },
        { key: "archive", label: "Nonaktifkan", danger: true },
      ]}
    />
  </article>
);

const MobileStandardPreview = () => {
  const [selectedRecord, setSelectedRecord] = useState(sampleRows[0]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const openDetail = (record) => {
    setSelectedRecord(record);
    setDetailOpen(true);
  };

  const columns = buildColumns(openDetail);

  const mobileCardConfig = {
    title: (record) => record.name,
    subtitle: (record) => `${record.code} · ${record.categoryName}`,
    tags: (record) => <Tag color={record.badgeColor}>{record.stockStatus}</Tag>,
    meta: [
      { label: "Stok/Qty", value: (record) => `${record.currentStock} pcs` },
      { label: "Minimum", value: (record) => record.minimumStock || "-" },
      { label: "Harga/Total", value: (record) => formatCurrencyId(record.sellPrice) },
      { label: "Status", value: (record) => record.status },
    ],
    actions: (record) => (
      <MobileActionMenu
        primaryActions={[
          { key: "detail", label: "Detail", icon: <EyeOutlined />, onClick: () => openDetail(record) },
          { key: "edit", label: "Edit", icon: <EditOutlined /> },
        ]}
        moreActions={[
          { key: "history", label: "Riwayat" },
          { key: "archive", label: "Nonaktifkan", danger: true },
        ]}
      />
    ),
  };

  return (
    <div className="page-container ims-page mobile-standard-preview-page">
      <PageHeader
        title="Preview Standar Mobile IMS M1-M5"
        subtitle="Live coding preview phase M1-M5: foundation, master, transaksi, produksi, finance/report, dan maintenance."
        actions={[
          { key: "add-preview", type: "primary", icon: <PlusOutlined />, label: "Contoh Tambah", onClick: () => {} },
        ]}
      />

      <Alert
        showIcon
        type="info"
        className="ims-page-alert"
        message="Preview ini UI-only: tidak mengubah stok, transaksi, finance, production, backup, atau schema."
        description="Gunakan route ini untuk menilai arah mobile: card/list, drawer detail, MobileFilterDrawer, action menu titik tiga, form 1 kolom, dan state block."
      />

      <div className="mobile-standard-preview-layout">
        <Card className="mobile-standard-preview-phone-shell">
          <div className="mobile-preview-phone">
            <div className="mobile-preview-phone__topbar">
              <button type="button">☰</button>
              <div>
                <strong>IMS Bunga Flanel</strong>
                <span>Database Lokal</span>
              </div>
              <b>D</b>
            </div>

            <div className="mobile-preview-phone__body">
              <div className="mobile-preview-phone__page-head">
                <div>
                  <h3>Produk</h3>
                  <p>120 data · 8 stok rendah</p>
                </div>
                <Button type="primary" size="small">+ Tambah</Button>
              </div>

              <div className="mobile-preview-phone__filter">
                <Input placeholder="Cari produk, kode..." />
                <Button onClick={() => setFilterOpen(true)}>Filter</Button>
              </div>

              <div className="mobile-preview-phone__summary">
                <div><span>Total Produk</span><strong>120</strong></div>
                <div><span>Stok Rendah</span><strong>8</strong></div>
              </div>

              <div className="mobile-preview-phone__cards">
                {sampleRows.map((row) => (
                  <PhoneCard key={row.id} row={row} onDetail={openDetail} />
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className="mobile-standard-preview-info">
          <PageSection
            title="Foundation yang dipreview"
            subtitle="Komponen ini disiapkan agar patch mobile berikutnya tidak berulang dan tidak balik ke tabel desktop di HP."
          >
            <Row gutter={[12, 12]}>
              <Col xs={24} md={12}>
                <Card className="mobile-standard-preview-card-note">
                  <SafetyCertificateOutlined />
                  <strong>MobileActionMenu</strong>
                  <span>Maksimal dua aksi utama, aksi tambahan/destructive masuk titik tiga.</span>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card className="mobile-standard-preview-card-note">
                  <SafetyCertificateOutlined />
                  <strong>MobileDetailDrawer</strong>
                  <span>Detail panjang masuk drawer, bukan memenuhi card utama.</span>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card className="mobile-standard-preview-card-note">
                  <SafetyCertificateOutlined />
                  <strong>ResponsiveFormSection</strong>
                  <span>Form mobile 1 kolom dan form panjang dipisah per section.</span>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card className="mobile-standard-preview-card-note">
                  <SafetyCertificateOutlined />
                  <strong>MobileStateBlock</strong>
                  <span>Loading, empty, error state user-friendly.</span>
                </Card>
              </Col>
            </Row>
          </PageSection>

          <PageSection
            title="ResponsiveDataView / DataTableView"
            subtitle="Desktop tetap table, mobile menjadi card/list saat viewport HP."
          >
            <FilterBar>
              <Col xs={24} md={9}>
                <Input placeholder="Cari data preview..." />
              </Col>
              <Col xs={24} md={7}>
                <Select className="ims-filter-control" defaultValue="all">
                  <Select.Option value="all">Semua Status</Select.Option>
                  <Select.Option value="low">Stok Rendah</Select.Option>
                  <Select.Option value="active">Aktif</Select.Option>
                </Select>
              </Col>
              <Col xs={24} md={8}>
                <Select className="ims-filter-control" defaultValue="all">
                  <Select.Option value="all">Semua Modul</Select.Option>
                  <Select.Option value="product">Produk</Select.Option>
                  <Select.Option value="sales">Sales</Select.Option>
                </Select>
              </Col>
            </FilterBar>

            <ResponsiveDataView
              rowKey="id"
              dataSource={sampleRows}
              columns={columns}
              size="small"
              tableLayout="fixed"
              pagination={false}
              mobileCardConfig={mobileCardConfig}
            />
          </PageSection>
        </div>
      </div>

      <PageSection
        title="Contoh form mobile 1 kolom"
        subtitle="Di mobile, semua field turun menjadi satu kolom dan dipisah per section."
      >
        <Form layout="vertical" className="mobile-standard-preview-form">
          <ResponsiveFormSection title="Informasi Utama" subtitle="Contoh section untuk create/edit produk.">
            <Row gutter={[12, 12]}>
              <Col xs={24} md={12}>
                <Form.Item label="Nama Produk">
                  <Input placeholder="Mawar Putih Flanel" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Kategori">
                  <Select placeholder="Pilih kategori" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Harga Jual">
                  <InputNumber className="ims-full-width" min={0} placeholder="15000" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Minimum Stok">
                  <InputNumber className="ims-full-width" min={0} placeholder="20" />
                </Form.Item>
              </Col>
            </Row>
          </ResponsiveFormSection>

          <ResponsiveFormSection title="State standar" subtitle="Contoh empty/error/loading agar tidak whitescreen.">
            <Row gutter={[12, 12]}>
              <Col xs={24} md={8}><MobileStateBlock type="loading" description="Memuat data mobile..." /></Col>
              <Col xs={24} md={8}><MobileStateBlock type="empty" description="Belum ada data preview." actionLabel="Tambah" onAction={() => {}} /></Col>
              <Col xs={24} md={8}><MobileStateBlock type="error" title="Data gagal dimuat" actionLabel="Coba Lagi" onAction={() => {}} /></Col>
            </Row>
          </ResponsiveFormSection>
        </Form>
      </PageSection>

      <PageSection title="Roadmap patch mobile" subtitle="Urutan implementasi agar tidak mengganggu business logic.">
        <div className="mobile-standard-roadmap-list">
          {roadmapRows.map(([phase, title, scope, status]) => (
            <Card key={phase} className="mobile-standard-roadmap-card">
              <Tag color="blue">{phase}</Tag>
              <strong>{title}</strong>
              <span>{scope}</span>
              <Text type="secondary">{status}</Text>
            </Card>
          ))}
        </div>
      </PageSection>

      <MobileFilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={() => setFilterOpen(false)}
        onReset={() => setFilterOpen(false)}
        title="Filter lanjutan"
        subtitle="Search tetap di halaman; filter kategori, status, tanggal, dan channel masuk drawer."
      >
        <ResponsiveFormSection title="Contoh Filter" subtitle="Field ini hanya preview UI, tidak mengubah data asli.">
          <Form layout="vertical">
            <Form.Item label="Kategori">
              <Select placeholder="Pilih kategori" options={[{ label: "Produk", value: "product" }, { label: "Sales", value: "sales" }]} />
            </Form.Item>
            <Form.Item label="Status">
              <Select placeholder="Pilih status" options={[{ label: "Aktif", value: "active" }, { label: "Stok Rendah", value: "low" }]} />
            </Form.Item>
          </Form>
        </ResponsiveFormSection>
      </MobileFilterDrawer>

      <MobileDetailDrawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={selectedRecord?.name}
        subtitle={selectedRecord?.code}
        status={<Tag color={selectedRecord?.badgeColor}>{selectedRecord?.stockStatus}</Tag>}
        items={[
          { label: "Kategori", value: selectedRecord?.categoryName },
          { label: "Stok/Qty", value: `${selectedRecord?.currentStock || 0} pcs` },
          { label: "Minimum", value: selectedRecord?.minimumStock || "-" },
          { label: "Harga/Total", value: formatCurrencyId(selectedRecord?.sellPrice || 0) },
          { label: "Status", value: selectedRecord?.status },
        ]}
        actions={<Button type="primary">Edit Preview</Button>}
      />
    </div>
  );
};

export default MobileStandardPreview;
