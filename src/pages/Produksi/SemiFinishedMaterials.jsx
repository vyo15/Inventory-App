// =====================================================
// Page: Semi Finished Materials
// Master stok internal produksi
// Tidak dijual ke customer
// Revisi:
// - Master item tetap ringkas
// - Stok disimpan per varian fleksibel
// - Total master dihitung otomatis dari seluruh varian
// =====================================================

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  calculateSemiFinishedTotalsFromVariants,
  DEFAULT_SEMI_FINISHED_FORM,
  DEFAULT_SEMI_FINISHED_VARIANT,
  formatSemiFinishedStockSummary,
  normalizeSemiFinishedVariants,
  SEMI_FINISHED_CATEGORIES,
  SEMI_FINISHED_CATEGORY_MAP,
  SEMI_FINISHED_COLOR_MAP,
  SEMI_FINISHED_GROUP_OPTIONS,
  SEMI_FINISHED_GROUP_MAP,
} from "../../constants/semiFinishedMaterialOptions";
import {
  createSemiFinishedMaterial,
  getAllSemiFinishedMaterials,
  toggleSemiFinishedMaterialActive,
  updateSemiFinishedMaterial,
} from "../../services/Produksi/semiFinishedMaterialsService";
import formatNumber, { parseIntegerIdInput } from "../../utils/formatters/numberId";
import formatCurrency from "../../utils/formatters/currencyId";
import ProductionFilterCard from "../../components/Produksi/shared/ProductionFilterCard";
import ProductionPageHeader from "../../components/Produksi/shared/ProductionPageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import ProductionSummaryCards from "../../components/Produksi/shared/ProductionSummaryCards";

// =====================================================
// Formatter final lintas aplikasi
// ACTIVE / FINAL: master semi finished memakai helper shared untuk qty dan Rupiah.
// =====================================================

// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data lama decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema Firestore tetap sama.

const normalizeFormVariants = (variants = [], hasVariants = true) => {
  if (!hasVariants) {
    return [];
  }

  const normalized = normalizeSemiFinishedVariants(variants);

  if (normalized.length > 0) {
    return normalized;
  }

  return [{ ...DEFAULT_SEMI_FINISHED_VARIANT }];
};

const buildFormValues = (record = {}) => {
  const hasVariants = record?.hasVariants === true || (record?.variants || []).length > 0;
  const totals = calculateSemiFinishedTotalsFromVariants(record.variants || []);

  return {
    ...DEFAULT_SEMI_FINISHED_FORM,
    ...record,
    hasVariants,
    variantLabel: record.variantLabel || 'Varian',
    variants: normalizeFormVariants(record.variants || [], hasVariants),
    currentStock: hasVariants ? totals.currentStock : Number(record.currentStock || 0),
    reservedStock: hasVariants ? totals.reservedStock : Number(record.reservedStock || 0),
    availableStock:
      hasVariants
        ? totals.availableStock
        : Math.max(
            Number(record.currentStock || 0) - Number(record.reservedStock || 0),
            0,
          ),
    minStockAlert: hasVariants ? totals.minStockAlert : Number(record.minStockAlert || 0),
    averageCostPerUnit:
      hasVariants
        ? Number(totals.averageCostPerUnit || 0)
        : Number(record.averageCostPerUnit || 0),
  };
};

// -----------------------------------------------------------------------------
// Helper tampilan stok.
// Dipakai bersama oleh tabel list dan drawer detail supaya format angka, varian,
// dan ringkasan varian selalu konsisten di seluruh halaman.
// -----------------------------------------------------------------------------
const formatStockWithUnit = (value, unit = "pcs") => `${formatNumber(value)} ${unit}`;

const getVariantDisplayLabel = (variant = {}, index = 0) =>
  variant.variantLabel || variant.label || variant.name || SEMI_FINISHED_COLOR_MAP[variant.color] || variant.color || `Varian ${index + 1}`;

// -----------------------------------------------------------------------------
// Helper tampilan varian pada kolom stok.
// Semua varian ditampilkan langsung dalam bentuk pill supaya user tidak
// perlu membuka detail hanya untuk membaca rincian stok per varian.
// -----------------------------------------------------------------------------
const renderVariantStockPills = (variants = [], unit = "pcs") => {
  const normalizedVariants = Array.isArray(variants)
    ? variants.filter((variant) => String(variant?.variantLabel || variant?.name || variant?.color || "").trim())
    : [];

  if (normalizedVariants.length === 0) {
    return null;
  }

  return (
    <div className="stock-variant-pill-wrap">
      {normalizedVariants.map((variant, index) => {
        const variantLabel = getVariantDisplayLabel(variant, index);

        return (
          <span key={`${variant.variantKey || variant.color || "variant"}-${index}`} className="stock-variant-pill">
            <Typography.Text className="stock-variant-pill-label">
              {`${variantLabel}:`}
            </Typography.Text>
            <Typography.Text className="stock-variant-pill-value">
              {formatStockWithUnit(variant.currentStock || 0, unit)}
            </Typography.Text>
          </span>
        );
      })}
    </div>
  );
};

const getStockStatusMeta = (record = {}) => {
  const totalStock = Number(record.currentStock || 0);
  const minStockAlert = Number(record.minStockAlert || 0);

  if (!record.isActive) {
    return { color: "default", label: "Nonaktif", alertType: "info" };
  }

  if (totalStock <= 0) {
    return { color: "red", label: "Kosong", alertType: "error" };
  }

  if (totalStock <= minStockAlert) {
    return { color: "orange", label: "Stok Rendah", alertType: "warning" };
  }

  return { color: "green", label: "Aman", alertType: "success" };
};

const compactCellStyles = {
  stack: { display: "flex", flexDirection: "column", gap: 2 },
  meta: { fontSize: 12, lineHeight: 1.35 },
};

const SemiFinishedMaterials = () => {
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [flowerGroupFilter, setFlowerGroupFilter] = useState("all");

  const [formVisible, setFormVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState(null);

  const [form] = Form.useForm();

  // GUARDED: mode edit master hanya boleh mengubah metadata non-stok.
  // ALASAN: stok semi finished dipakai flow produksi/Work Log, sehingga edit master tidak boleh menimpa stok tanpa audit.
  // STATUS: AKTIF untuk mengunci field stok di UI; service update tetap menjadi guard utama.
  // IMS NOTE [GUARDED | behavior-preserving]: flag edit dipakai untuk mengunci stok semi finished.
  // Hubungan flow: stok semi finished dipakai produksi, jadi edit master tidak boleh menjadi jalur mutasi.
  const isEditingMaterial = Boolean(editingMaterial?.id);
  const editingMaterialHasVariants = Boolean(editingMaterial?.hasVariants || (editingMaterial?.variants || []).length > 0);
  const canActivateVariantsForEditing = isEditingMaterial
    && !editingMaterialHasVariants
    && Number(editingMaterial?.currentStock ?? editingMaterial?.stock ?? 0) <= 0
    && Number(editingMaterial?.reservedStock || 0) <= 0
    && Number(editingMaterial?.availableStock ?? 0) <= 0;
  const hasVariantModeSwitchLocked = isEditingMaterial && !canActivateVariantsForEditing;
  const stockEditHelpText = 'Ubah stok lewat Stock Management / Stock Adjustment / transaksi resmi.';

  // ---------------------------------------------------------------------------
  // Loader utama halaman.
  // Semua data list di-refresh dari service yang sama agar source of truth tetap
  // satu pintu dan lebih mudah dilacak saat maintenance.
  // ---------------------------------------------------------------------------
  const loadData = async () => {
    try {
      setLoading(true);
      const result = await getAllSemiFinishedMaterials();
      setMaterials(result);
    } catch (error) {
      console.error(error);
      message.error("Gagal memuat data semi finished materials");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ---------------------------------------------------------------------------
  // Watcher form dipakai untuk membuat preview stok di drawer form tetap realtime
  // tanpa harus menunggu user menekan tombol simpan.
  // ---------------------------------------------------------------------------
  const hasVariantsValue = Form.useWatch("hasVariants", form);
  const variantLabelValue = Form.useWatch("variantLabel", form);
  const watchedVariants = Form.useWatch("variants", form);
  const watchedCurrentStock = Form.useWatch("currentStock", form) || 0;
  const watchedReservedStock = Form.useWatch("reservedStock", form) || 0;
  const watchedMinStockAlert = Form.useWatch("minStockAlert", form) || 0;
  const watchedAverageCost = Form.useWatch("averageCostPerUnit", form) || 0;

  const calculatedTotals = useMemo(
    () => hasVariantsValue ? calculateSemiFinishedTotalsFromVariants(watchedVariants) : {
      currentStock: Number(watchedCurrentStock || 0),
      reservedStock: Number(watchedReservedStock || 0),
      availableStock: Math.max(Number(watchedCurrentStock || 0) - Number(watchedReservedStock || 0), 0),
      minStockAlert: Number(watchedMinStockAlert || 0),
      averageCostPerUnit: Number(watchedAverageCost || 0),
      variantCount: 0,
      activeVariantCount: 0,
      variants: [],
    },
    [hasVariantsValue, watchedVariants, watchedCurrentStock, watchedReservedStock, watchedMinStockAlert, watchedAverageCost],
  );

  // ---------------------------------------------------------------------------
  // Ringkasan card atas halaman.
  // Fokusnya hanya metrik operasional yang paling sering dipakai user harian.
  // ---------------------------------------------------------------------------
  const summary = useMemo(() => {
    const total = materials.length;
    const active = materials.filter((item) => item.isActive).length;
    const inactive = total - active;

    const lowStock = materials.filter((item) => {
      const available = Number(item.availableStock || 0);
      const min = Number(item.minStockAlert || 0);
      return available <= min;
    }).length;

    return { total, active, inactive, lowStock };
  }, [materials]);

  const summaryItems = [
    { key: "semi-total", title: "Total Item", value: summary.total, subtitle: "Seluruh item semi finished yang tersimpan.", accent: "primary" },
    { key: "semi-active", title: "Item Aktif", value: summary.active, subtitle: "Masih aktif dipakai dalam flow produksi.", accent: "success" },
    { key: "semi-inactive", title: "Item Nonaktif", value: summary.inactive, subtitle: "Disimpan untuk histori tetapi tidak aktif dipakai.", accent: "warning" },
    { key: "semi-low", title: "Perlu Dicek", value: summary.lowStock, subtitle: "Item yang kosong atau mendekati batas minimum.", accent: "default" },
  ];

  // ---------------------------------------------------------------------------
  // Filter list utama.
  // Sorting tetap mengikuti urutan data dari service, sedangkan halaman ini hanya
  // bertugas menyaring data sesuai kebutuhan user.
  // ---------------------------------------------------------------------------
  const filteredData = useMemo(() => {
    return materials.filter((item) => {
      const searchText = search.trim().toLowerCase();
      const variantColorTexts = Array.isArray(item.variants)
        ? item.variants.map((variant, index) => getVariantDisplayLabel(variant, index))
        : [];

      const matchSearch =
        !searchText ||
        String(item.code || "").toLowerCase().includes(searchText) ||
        String(item.name || "").toLowerCase().includes(searchText) ||
        String(item.description || "").toLowerCase().includes(searchText) ||
        variantColorTexts.some((text) => String(text || "").toLowerCase().includes(searchText));

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.isActive) ||
        (statusFilter === "inactive" && !item.isActive);

      const matchCategory =
        categoryFilter === "all" || item.category === categoryFilter;

      const matchFlowerGroup =
        flowerGroupFilter === "all" || item.flowerGroup === flowerGroupFilter;

      return matchSearch && matchStatus && matchCategory && matchFlowerGroup;
    });
  }, [materials, search, statusFilter, categoryFilter, flowerGroupFilter]);

  // ---------------------------------------------------------------------------
  // Helper reset form agar state create/edit tidak saling tercampur.
  // ---------------------------------------------------------------------------
  const resetFormState = () => {
    setEditingMaterial(null);
    form.resetFields();
    form.setFieldsValue(buildFormValues(DEFAULT_SEMI_FINISHED_FORM));
  };

  // ---------------------------------------------------------------------------
  // Handler drawer form.
  // Create dan edit memakai form yang sama agar maintenance lebih ringan.
  // ---------------------------------------------------------------------------
  const handleAdd = () => {
    setEditingMaterial(null);
    form.setFieldsValue(buildFormValues(DEFAULT_SEMI_FINISHED_FORM));
    setFormVisible(true);
  };

  const handleEdit = (record) => {
    setEditingMaterial(record);
    form.setFieldsValue(buildFormValues(record));
    setFormVisible(true);
  };

  const handleViewDetail = (record) => {
    setSelectedMaterial(record);
    setDetailVisible(true);
  };

  // ---------------------------------------------------------------------------
  // Submit create / edit.
  // Payload tetap dinormalisasi di sini supaya service menerima struktur data
  // yang bersih, baik item memakai varian maupun non-varian.
  // ---------------------------------------------------------------------------
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const payload = {
        ...values,
        hasVariants: values.hasVariants === true,
        variantLabel: values.hasVariants === true ? values.variantLabel || 'Varian' : '',
        variants: normalizeFormVariants(values.variants || [], values.hasVariants === true),
        maxStockTarget:
          values.maxStockTarget === null || values.maxStockTarget === undefined
            ? null
            : Number(values.maxStockTarget || 0),
        referenceCostPerUnit: Number(values.referenceCostPerUnit || 0),
        lastProductionCostPerUnit: Number(
          values.lastProductionCostPerUnit || 0,
        ),
      };

      setSubmitting(true);

      if (editingMaterial?.id) {
        await updateSemiFinishedMaterial(editingMaterial.id, payload, [], null);
        message.success("Semi finished material berhasil diperbarui");
      } else {
        await createSemiFinishedMaterial(payload, [], null);
        message.success("Semi finished material berhasil ditambahkan");
      }

      setFormVisible(false);
      resetFormState();
      await loadData();
    } catch (error) {
      if (error?.errorFields) return;

      if (error?.type === "validation" && error?.errors) {
        const fields = Object.entries(error.errors).map(([name, errors]) => ({
          name: name.startsWith("variants.") ? name.split(".") : name,
          errors: [errors],
        }));
        form.setFields(fields);
        return;
      }

      console.error(error);
      message.error("Gagal menyimpan semi finished material");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Toggle aktif/nonaktif master item.
  // Flow ini tetap dipakai aktif karena user perlu mengarsipkan item tanpa
  // menghapus histori stok atau varian yang sudah ada.
  // ---------------------------------------------------------------------------
  const handleToggleActive = async (record) => {
    try {
      await toggleSemiFinishedMaterialActive(record.id, !record.isActive, null);
      message.success(
        `Semi finished material berhasil ${
          record.isActive ? "dinonaktifkan" : "diaktifkan"
        }`,
      );
      await loadData();
    } catch (error) {
      console.error(error);
      message.error("Gagal mengubah status semi finished material");
    }
  };

  // ---------------------------------------------------------------------------
  // Definisi kolom list utama.
  // Tujuan utamanya membuat halaman lebih padat, rapi, dan mudah dibaca tanpa
  // harus membuka drawer detail untuk informasi stok yang paling penting.
  // ---------------------------------------------------------------------------
  const columns = [
    {
      title: "Semi Finished Material",
      dataIndex: "name",
      key: "name",
      width: 260,
      render: (_, record) => (
        <div style={compactCellStyles.stack}>
          <Typography.Text strong>{record.name || "-"}</Typography.Text>
          <Typography.Text type="secondary" style={compactCellStyles.meta}>
            {record.code || "-"}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Kategori",
      key: "category",
      width: 150,
      render: (_, record) => (
        <div style={compactCellStyles.stack}>
          <Typography.Text>
            {SEMI_FINISHED_CATEGORY_MAP[record.category] || "-"}
          </Typography.Text>
          <Typography.Text type="secondary" style={compactCellStyles.meta}>
            {SEMI_FINISHED_GROUP_MAP[record.flowerGroup] || "-"}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Stok",
      key: "stock",
      width: 360,
      render: (_, record) => {
        const variants = Array.isArray(record.variants) ? record.variants : [];
        const hasVariants = record.hasVariants === true && variants.length > 0;
        const unitLabel = record.unit || "pcs";
        const totalStock = Number(record.currentStock || 0);
        const availableStock = Number(record.availableStock || 0);

        return (
          <div style={compactCellStyles.stack}>
            <Typography.Text strong>
              Total {formatStockWithUnit(totalStock, unitLabel)}
            </Typography.Text>
            <Typography.Text type="secondary" style={compactCellStyles.meta}>
              Tersedia {formatStockWithUnit(availableStock, unitLabel)}
            </Typography.Text>

            {hasVariants ? (
              renderVariantStockPills(variants, unitLabel)
            ) : (
              <Typography.Text type="secondary" style={compactCellStyles.meta}>
                Non-varian
              </Typography.Text>
            )}
          </div>
        );
      },
    },
    {
      title: "Status",
      key: "status",
      width: 120,
      align: "center",
      // Kolom status dibuat menempel di kanan agar perilaku tabel seragam.
      fixed: "right",
      render: (_, record) => {
        const statusMeta = getStockStatusMeta(record);
        return <Tag color={statusMeta.color}>{statusMeta.label}</Tag>;
      },
    },
    {
      title: "Aksi",
      key: "actions",
      width: 170,
      // Tombol aksi utama disimpan di sisi kanan seperti halaman bahan baku.
      fixed: "right",
      className: "app-table-action-column",
      render: (_, record) => (
        <Space direction="vertical" size={6} className="ims-action-group ims-action-group--vertical">
          {/* AKTIF / GUARDED: action semi finished dibuat 3 baris visual-only; logic produksi, stok varian, PO, Work Log, payroll, dan HPP tidak disentuh. */}
          <Button
            className="ims-action-button ims-action-button--block"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            Detail
          </Button>

          <Button
            className="ims-action-button ims-action-button--block"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>

          <Popconfirm
            title={
              record.isActive ? "Nonaktifkan item ini?" : "Aktifkan item ini?"
            }
            description={
              record.isActive
                ? "Item tidak akan bisa dipilih untuk data baru."
                : "Item akan aktif kembali untuk data baru."
            }
            onConfirm={() => handleToggleActive(record)}
            okText="Ya"
            cancelText="Batal"
          >
            <Button className="ims-action-button ims-action-button--block" size="small">
              {record.isActive ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // State turunan khusus drawer detail.
  // Dipisah dari JSX agar render drawer lebih mudah dibaca dan tidak dipenuhi
  // perhitungan kecil yang berulang.
  // ---------------------------------------------------------------------------
  const selectedMaterialStatusMeta = selectedMaterial
    ? getStockStatusMeta(selectedMaterial)
    : null;
  const selectedMaterialVariants = Array.isArray(selectedMaterial?.variants)
    ? selectedMaterial.variants
    : [];
  const selectedMaterialUnit = selectedMaterial?.unit || "pcs";

  return (
    <div className="page-container">
      {/* ------------------------------------------------------------------ */}
      {/* Header halaman. Menjadi titik masuk utama user sebelum melihat list. */}
      {/* ------------------------------------------------------------------ */}
      {/* AKTIF / GUARDED: migrasi header ke shared produksi agar konsisten, tanpa ubah flow CRUD semi finished material. */}
      <ProductionPageHeader
        title="Semi Finished Materials"
        description="Master stok internal produksi dengan varian fleksibel, tidak dijual ke customer."
        onRefresh={loadData}
        onAdd={handleAdd}
        addLabel="Tambah Item"
      />

      {/* ------------------------------------------------------------------ */}
      {/* Summary cards. Tetap dipertahankan karena user produksi butuh ringkasan */}
      {/* cepat tanpa harus membaca seluruh tabel. */}
      {/* ------------------------------------------------------------------ */}
      {/* AKTIF / GUARDED: summary card shared menjaga konsistensi visual, nilai tetap dari helper existing. */}
      <ProductionSummaryCards items={summaryItems} />

      {/* ------------------------------------------------------------------ */}
      {/* Filter list. Dipisah di card sendiri agar user bisa scan filter dengan */}
      {/* cepat tanpa mengganggu area tabel utama. */}
      {/* ------------------------------------------------------------------ */}
      {/* AKTIF / GUARDED: filter card shared dipakai untuk keseragaman layout; behavior filter tidak diubah. */}
      <ProductionFilterCard>
          <Col xs={24} md={8}>
            <Input
              placeholder="Cari kode, nama, deskripsi, varian..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>

          <Col xs={24} md={5}>
            <Select
              style={{ width: "100%" }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "Semua Status" },
                { value: "active", label: "Aktif" },
                { value: "inactive", label: "Nonaktif" },
              ]}
            />
          </Col>

          <Col xs={24} md={5}>
            <Select
              style={{ width: "100%" }}
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: "all", label: "Semua Kategori" },
                ...SEMI_FINISHED_CATEGORIES,
              ]}
            />
          </Col>

          <Col xs={24} md={6}>
            <Select
              style={{ width: "100%" }}
              value={flowerGroupFilter}
              onChange={setFlowerGroupFilter}
              options={[
                { value: "all", label: "Semua Jenis Bunga" },
                ...SEMI_FINISHED_GROUP_OPTIONS,
              ]}
            />
          </Col>
      </ProductionFilterCard>

      {/* ------------------------------------------------------------------ */}
      {/* Tabel list utama. Di-set compact agar jarak antar elemen tidak terlalu */}
      {/* tinggi dan informasi stok per varian tetap terbaca pada satu layar. */}
      {/* ------------------------------------------------------------------ */}
      <PageSection
        title="Daftar Semi Finished Materials"
        subtitle="Tabel ini merangkum stok master dan varian fleksibel untuk kebutuhan produksi internal."
      >
        <Table
          // AKTIF / GUARDED UI: class standar hanya menyamakan surface table; flow semi finished material dan produksi tidak diubah.
          className="app-data-table"
          rowKey="id"
          size="small"
          tableLayout="fixed"
          loading={loading}
          columns={columns}
          dataSource={filteredData}
          // Lebar horizontal sedikit diperluas supaya kolom kanan tetap rapi.
          scroll={{ x: 1100 }}
          locale={{
            emptyText: (
              <Empty description="Belum ada data semi finished materials" />
            ),
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} item`,
          }}
        />
      </PageSection>

      {/* ------------------------------------------------------------------ */}
      {/* Drawer form create/edit. Tetap satu komponen agar logic form tidak */}
      {/* terpecah ke banyak tempat dan maintenance lebih ringan. */}
      {/* ------------------------------------------------------------------ */}
      <Drawer
        title={
          editingMaterial?.id
            ? "Edit Semi Finished Material"
            : "Tambah Semi Finished Material"
        }
        open={formVisible}
        onClose={() => {
          setFormVisible(false);
          resetFormState();
        }}
        width={860}
        destroyOnClose
        extra={
          <Space>
            <Button
              onClick={() => {
                setFormVisible(false);
                resetFormState();
              }}
            >
              Batal
            </Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              Simpan
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={buildFormValues(DEFAULT_SEMI_FINISHED_FORM)}
        >
          <Divider orientation="left">Informasi Dasar</Divider>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="Kode Item"
                name="code"
                rules={[{ required: true, message: "Kode wajib diisi" }]}
              >
                <Input placeholder="Contoh: SFM-KEL-MWR-S" />
              </Form.Item>
            </Col>

            <Col xs={24} md={16}>
              <Form.Item
                label="Nama Item"
                name="name"
                rules={[{ required: true, message: "Nama wajib diisi" }]}
              >
                <Input placeholder="Contoh: Kelopak Mawar Potong S" />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="Deskripsi" name="description">
                <Input.TextArea rows={2} placeholder="Deskripsi item..." />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Kategori"
                name="category"
                rules={[{ required: true, message: "Kategori wajib dipilih" }]}
              >
                <Select options={SEMI_FINISHED_CATEGORIES} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Jenis Bunga"
                name="flowerGroup"
                rules={[{ required: true, message: "Jenis bunga wajib dipilih" }]}
              >
                <Select options={SEMI_FINISHED_GROUP_OPTIONS} />
              </Form.Item>
            </Col>

          </Row>

          {/* IMS NOTE [GUARDED | behavior-preserving]: mode varian dikunci saat edit
              agar bucket stok produksi tidak berubah tanpa audit. */}
          <Form.Item
            label="Pakai Varian"
            name="hasVariants"
            valuePropName="checked"
            extra={isEditingMaterial
              ? canActivateVariantsForEditing
                ? 'Semi Product lama dengan stok 0 boleh mulai memakai varian. Semua varian baru tetap stok 0.'
                : 'Mode varian dikunci setelah item dibuat agar bucket stok produksi tidak berubah tanpa audit.'
              : undefined}
          >
            <Switch
              checkedChildren="Ya"
              unCheckedChildren="Tidak"
              disabled={hasVariantModeSwitchLocked}
              onChange={(checked) => {
                if (hasVariantModeSwitchLocked) return;
                if (checked) {
                  form.setFieldsValue({
                    variantLabel: form.getFieldValue('variantLabel') || 'Varian',
                    variants: normalizeFormVariants(form.getFieldValue('variants') || [], true),
                    currentStock: isEditingMaterial ? 0 : form.getFieldValue('currentStock'),
                    reservedStock: isEditingMaterial ? 0 : form.getFieldValue('reservedStock'),
                  });
                } else {
                  form.setFieldsValue({ variants: [], variantLabel: 'Varian' });
                }
              }}
            />
          </Form.Item>

          {hasVariantsValue ? (
            <Form.Item
              label="Label Varian"
              name="variantLabel"
              extra="AKTIF: label ini hanya metadata tampilan. Contoh: Warna, Ukuran, Tipe, Motif, Spesifikasi."
            >
              <Input placeholder="Contoh: Warna" />
            </Form.Item>
          ) : null}

          <Divider orientation="left">{hasVariantsValue ? "Varian & Stok" : "Stok Master"}</Divider>

          <Alert
            style={{ marginBottom: 16 }}
            type="info"
            showIcon
            message={isEditingMaterial
              ? canActivateVariantsForEditing
                ? 'Semi Product lama ini stoknya 0, jadi boleh mulai memakai varian. Stok tiap varian baru tetap 0 sampai diubah lewat Stock Adjustment/produksi/transaksi resmi.'
                : stockEditHelpText
              : hasVariantsValue
                ? "Gunakan 1 master item untuk 1 jenis komponen. Tambahkan nama varian sesuai label seperti Warna, Ukuran, Tipe, Motif, atau Spesifikasi. Total stok item dihitung otomatis dari semua varian."
                : "Item tanpa varian memakai stok awal langsung di master semi finished material."}
            description={isEditingMaterial && hasVariantsValue
              ? "Mengubah nama varian hanya mengganti label tampilan. Bucket stok/reference tetap dijaga melalui variantKey existing."
              : undefined}
          />

          {hasVariantsValue ? (
          <Form.List name="variants">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: "100%" }} size={12}>
                {fields.map((field, index) => (
                  <Card
                    key={field.key}
                    size="small"
                    title={`${variantLabelValue || 'Varian'} ${index + 1}`}
                    extra={
                      fields.length > 1 ? (
                        <Button
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          disabled={fields.length === 1}
                          onClick={() => remove(field.name)}
                        >
                          Hapus Varian
                        </Button>
                      ) : null
                    }
                  >
                    <Row gutter={16}>
                      {/* IMS NOTE [GUARDED | identity-safe]: hidden identity field
                          menjaga variantKey lama tetap terkirim saat nama varian diganti.
                          Hubungan flow: service memakai key ini untuk preserve bucket
                          stok/reference PO/Work Log. STATUS: AKTIF. */}
                      <Form.Item name={[field.name, "variantKey"]} hidden>
                        <Input />
                      </Form.Item>
                      <Col xs={24} md={8}>
                        <Form.Item
                          {...field}
                          label={`Nama ${variantLabelValue || 'Varian'}`}
                          name={[field.name, "color"]}
                          rules={[{ required: true, message: "Nama varian wajib diisi" }]}
                        >
                          <Input placeholder="Contoh: Merah, Ukuran S, Motif Polkadot" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={8}>
                        <Form.Item
                          {...field}
                          label="Kode Variant"
                          name={[field.name, "sku"]}
                        >
                          <Input placeholder="Opsional: KEL-S-MERAH" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={8}>
                        <Form.Item
                          {...field}
                          label="Status Varian"
                          name={[field.name, "isActive"]}
                          valuePropName="checked"
                        >
                          <Switch />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={6}>
                        <Form.Item
                          {...field}
                          label="Current Stock"
                          name={[field.name, "currentStock"]}
                          extra={isEditingMaterial ? stockEditHelpText : undefined}
                        >
                          <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} disabled={isEditingMaterial} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={6}>
                        <Form.Item
                          {...field}
                          label="Reserved Stock"
                          name={[field.name, "reservedStock"]}
                          extra={isEditingMaterial ? 'Reserved stock dikunci karena memengaruhi available stock.' : undefined}
                        >
                          <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} disabled />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={6}>
                        <Form.Item
                          {...field}
                          label="Min Stock Alert"
                          name={[field.name, "minStockAlert"]}
                        >
                          <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={6}>
                        <Form.Item
                          {...field}
                          label="Average Cost / Unit"
                          name={[field.name, "averageCostPerUnit"]}
                        >
                          <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}

                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => add({ ...DEFAULT_SEMI_FINISHED_VARIANT })}
                  block
                >
                  Tambah Varian
                </Button>
              </Space>
            )}
          </Form.List>
          ) : (
            <Row gutter={16}>
              <Col xs={24} md={6}>
                <Form.Item label="Current Stock" name="currentStock" extra={isEditingMaterial ? stockEditHelpText : undefined}>
                  <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} disabled={isEditingMaterial} />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label="Reserved Stock" name="reservedStock" extra={isEditingMaterial ? 'Reserved stock dikunci karena memengaruhi available stock.' : undefined}>
                  <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} disabled={isEditingMaterial} />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label="Min Stock Alert" name="minStockAlert">
                  <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label="Average Cost / Unit" name="averageCostPerUnit">
                  <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Divider orientation="left">Ringkasan Stok Master</Divider>

          <Alert
            style={{ marginBottom: 16 }}
            type="info"
            showIcon
            message={hasVariantsValue
              ? "Current Stock, Reserved Stock, Available Stock, dan Min Stock Alert total di bawah ini adalah hasil akumulasi seluruh varian."
              : "Ringkasan di bawah ini adalah nilai stok master langsung karena item ini tidak memakai varian."}
          />

          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item label="Total Current Stock">
                <Input value={formatNumber(calculatedTotals.currentStock)} disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Total Reserved Stock">
                <Input value={formatNumber(calculatedTotals.reservedStock)} disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Total Available Stock">
                <Input value={formatNumber(calculatedTotals.availableStock)} disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Total Min Stock Alert">
                <Input value={formatNumber(calculatedTotals.minStockAlert)} disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Max Stock Target" name="maxStockTarget">
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Status Aktif"
                name="isActive"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Jumlah Varian Aktif">
                <Input
                  value={`${formatNumber(calculatedTotals.activeVariantCount)} dari ${formatNumber(calculatedTotals.variantCount)} varian`}
                  disabled
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Biaya Master</Divider>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="Reference Cost / Unit"
                name="referenceCostPerUnit"
              >
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Last Production Cost / Unit"
                name="lastProductionCostPerUnit"
              >
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Average Cost / Unit (Otomatis)">
                <Input value={formatCurrency(calculatedTotals.averageCostPerUnit)} disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Ringkasan">
                <Card size="small">
                  <Space direction="vertical" size={0}>
                    <Typography.Text>
                      {formatSemiFinishedStockSummary(calculatedTotals)}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      Average Cost: {formatCurrency(calculatedTotals.averageCostPerUnit)}
                    </Typography.Text>
                  </Space>
                </Card>
              </Form.Item>
            </Col>
          </Row>

        </Form>
      </Drawer>

      {/* ------------------------------------------------------------------ */}
      {/* Drawer detail. Dipakai aktif untuk audit item, stok total, dan rincian */}
      {/* varian tanpa menambah kepadatan informasi pada list utama. */}
      {/* ------------------------------------------------------------------ */}
      <Drawer
        title="Detail Semi Finished Material"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={820}
      >
        {!selectedMaterial ? (
          <Empty description="Tidak ada data" />
        ) : (
          <Space direction="vertical" style={{ width: "100%" }} size={16}>
            {/* -------------------------------------------------------------- */}
            {/* Alert kondisi stok dipakai aktif untuk memberi konteks cepat    */}
            {/* sebelum user membaca angka detail yang lebih panjang di bawah.  */}
            {/* -------------------------------------------------------------- */}
            <Alert
              type={selectedMaterialStatusMeta?.alertType || "info"}
              showIcon
              message={`Status item: ${selectedMaterialStatusMeta?.label || "-"}`}
              description={
                selectedMaterial.isActive
                  ? `Total stok ${formatStockWithUnit(
                      selectedMaterial.currentStock,
                      selectedMaterialUnit,
                    )} dengan stok tersedia ${formatStockWithUnit(
                      selectedMaterial.availableStock,
                      selectedMaterialUnit,
                    )}.`
                  : "Item sedang nonaktif namun histori stok dan variant tetap disimpan."
              }
            />

            {/* -------------------------------------------------------------- */}
            {/* Summary cards drawer. Fokus ke metrik yang paling sering dicek  */}
            {/* user saat audit stok semi finished.                             */}
            {/* -------------------------------------------------------------- */}
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12} md={8}>
                <Card size="small">
                  <Statistic
                    title="Total Stok"
                    value={formatStockWithUnit(
                      selectedMaterial.currentStock,
                      selectedMaterialUnit,
                    )}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Card size="small">
                  <Statistic
                    title="Stok Tersedia"
                    value={formatStockWithUnit(
                      selectedMaterial.availableStock,
                      selectedMaterialUnit,
                    )}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Card size="small">
                  <Statistic
                    title="Varian Aktif"
                    value={`${formatNumber(selectedMaterial.activeVariantCount)} / ${formatNumber(
                      selectedMaterial.variantCount,
                    )}`}
                  />
                </Card>
              </Col>
            </Row>

            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Kode">
                {selectedMaterial.code || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Nama">
                {selectedMaterial.name || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Deskripsi">
                {selectedMaterial.description || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Kategori">
                {SEMI_FINISHED_CATEGORY_MAP[selectedMaterial.category] || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Jenis Bunga">
                {SEMI_FINISHED_GROUP_MAP[selectedMaterial.flowerGroup] || "-"}
              </Descriptions.Item>
              <Descriptions.Item label={selectedMaterial.variantLabel || "Varian Aktif"}>
                {formatNumber(selectedMaterial.activeVariantCount)} / {formatNumber(
                  selectedMaterial.variantCount,
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Current Stock Total">
                {formatStockWithUnit(selectedMaterial.currentStock, selectedMaterialUnit)}
              </Descriptions.Item>
              <Descriptions.Item label="Reserved Stock Total">
                {formatStockWithUnit(selectedMaterial.reservedStock, selectedMaterialUnit)}
              </Descriptions.Item>
              <Descriptions.Item label="Available Stock Total">
                {formatStockWithUnit(selectedMaterial.availableStock, selectedMaterialUnit)}
              </Descriptions.Item>
              <Descriptions.Item label="Min Stock Alert Total">
                {formatStockWithUnit(selectedMaterial.minStockAlert, selectedMaterialUnit)}
              </Descriptions.Item>
              <Descriptions.Item label="Max Stock Target">
                {selectedMaterial.maxStockTarget === null
                  ? "-"
                  : formatStockWithUnit(
                      selectedMaterial.maxStockTarget,
                      selectedMaterialUnit,
                    )}
              </Descriptions.Item>
              <Descriptions.Item label="Reference Cost / Unit">
                {formatCurrency(selectedMaterial.referenceCostPerUnit)}
              </Descriptions.Item>
              <Descriptions.Item label="Last Production Cost / Unit">
                {formatCurrency(selectedMaterial.lastProductionCostPerUnit)}
              </Descriptions.Item>
              <Descriptions.Item label="Average Cost / Unit">
                {formatCurrency(selectedMaterial.averageCostPerUnit)}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={selectedMaterialStatusMeta?.color || "default"}>
                  {selectedMaterialStatusMeta?.label || "-"}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <Card title="Rincian Varian Semi Finished" size="small">
              <Table
                size="small"
                rowKey={(record, index) => `${record.variantKey || record.color}-${index}`}
                pagination={false}
                dataSource={selectedMaterialVariants}
                locale={{ emptyText: "Belum ada varian" }}
                columns={[
                  {
                    title: selectedMaterial.variantLabel || "Varian",
                    dataIndex: "color",
                    key: "color",
                    render: (_, variant, index) => getVariantDisplayLabel(variant, index),
                  },
                  {
                    title: "Kode Variant",
                    dataIndex: "sku",
                    key: "sku",
                    render: (value) => value || "-",
                  },
                  {
                    title: "Current",
                    dataIndex: "currentStock",
                    key: "currentStock",
                    render: (value) => formatStockWithUnit(value, selectedMaterialUnit),
                  },
                  {
                    title: "Reserved",
                    dataIndex: "reservedStock",
                    key: "reservedStock",
                    render: (value) => formatStockWithUnit(value, selectedMaterialUnit),
                  },
                  {
                    title: "Available",
                    key: "available",
                    render: (_, record) =>
                      formatStockWithUnit(
                        Math.max(
                          Number(record.currentStock || 0) - Number(record.reservedStock || 0),
                          0,
                        ),
                        selectedMaterialUnit,
                      ),
                  },
                  {
                    title: "Min Alert",
                    dataIndex: "minStockAlert",
                    key: "minStockAlert",
                    render: (value) => formatStockWithUnit(value, selectedMaterialUnit),
                  },
                  {
                    title: "Avg Cost",
                    dataIndex: "averageCostPerUnit",
                    key: "averageCostPerUnit",
                    render: (value) => formatCurrency(value),
                  },
                  {
                    title: "Status",
                    dataIndex: "isActive",
                    key: "isActive",
                    render: (value) => (value ? "Aktif" : "Nonaktif"),
                  },
                ]}
                // Lebar horizontal sedikit diperluas supaya kolom kanan tetap rapi.
          scroll={{ x: 1100 }}
              />
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default SemiFinishedMaterials;
