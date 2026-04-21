import React, { useEffect, useMemo, useState } from 'react';
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
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { formatNumberID } from '../../utils/formatters/numberId';
import { formatCurrencyId } from '../../utils/formatters/currencyId';
import { formatDateId } from '../../utils/formatters/dateId';
import {
  createRawMaterial,
  listenRawMaterials,
  RAW_MATERIAL_DEFAULT_FORM,
  toggleRawMaterialActive,
  updateRawMaterial,
} from '../../services/MasterData/rawMaterialsService';
import {
  getSupplierDisplayName,
  getSupplierOptionLabel,
  listenSupplierCatalog,
} from '../../services/MasterData/suppliersService';
import {
  DEFAULT_RAW_MATERIAL_VARIANT,
  ensureAtLeastOneRawMaterialVariant,
} from '../../utils/variants/rawMaterialVariantHelpers';

const { Option } = Select;
const { Text, Link } = Typography;

// -----------------------------------------------------------------------------
// Opsi satuan bahan baku.
// Tetap disimpan lokal di halaman agar form edit/create mudah dibaca dan dirawat.
// -----------------------------------------------------------------------------
const unitOptions = ['pcs', 'meter', 'yard', 'kg', 'gram', 'liter', 'ml', 'roll', 'pack', 'batang'];

// -----------------------------------------------------------------------------
// Builder nilai awal form.
// Dipakai saat create dan edit agar struktur data form selalu konsisten.
// -----------------------------------------------------------------------------
const buildFormValues = (record = {}) => ({
  ...RAW_MATERIAL_DEFAULT_FORM,
  ...record,
  hasVariants: record.hasVariants === true,
  variants:
    record.hasVariants === true
      ? ensureAtLeastOneRawMaterialVariant(record.variants || [])
      : [],
});

// -----------------------------------------------------------------------------
// Parser angka integer format Indonesia.
// Menghapus separator titik sebelum nilai dikirim ke InputNumber.
// -----------------------------------------------------------------------------
const integerParser = (value) => value?.replace(/\./g, '') || '';

// -----------------------------------------------------------------------------
// Helper tampilan stok supaya format di tabel dan drawer seragam.
// -----------------------------------------------------------------------------
const formatStockWithUnit = (value, unit = 'pcs') => `${formatNumberID(value)} ${unit}`;

const compactCellStyles = {
  stack: { display: 'flex', flexDirection: 'column', gap: 2 },
  meta: { fontSize: 12, lineHeight: 1.35 },
  variantPillWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    maxWidth: '100%',
  },
  // ---------------------------------------------------------------------------
  // Catatan:
  // - warna pill tidak disimpan di inline style lagi
  // - visualnya dipindah ke class CSS agar light/dark mode lebih mudah dirawat
  // - pendekatan ini masih dipakai karena halaman bahan baku butuh pill yang rapat
  //   tetapi tetap ikut tema global aplikasi
  // ---------------------------------------------------------------------------
  variantPillLabel: { fontSize: 12, lineHeight: 1.35 },
  variantPillValue: { fontSize: 12, lineHeight: 1.35, fontWeight: 600 },
};

// -----------------------------------------------------------------------------
// Helper tampilan varian pada kolom stok.
// Variant ditampilkan penuh dalam bentuk pill agar lebih rapat, rapi, dan user
// tidak perlu membuka drawer hanya untuk melihat stok per varian.
// -----------------------------------------------------------------------------
const renderVariantStockPills = (
  variants = [],
  unit = 'pcs',
  getLabel = (variant, index) => variant?.name || `Varian ${index + 1}`,
) => {
  const normalizedVariants = Array.isArray(variants)
    ? variants.filter((variant) => String(variant?.name || variant?.variantName || '').trim())
    : [];

  if (normalizedVariants.length === 0) {
    return null;
  }

  return (
    <div style={compactCellStyles.variantPillWrap}>
      {normalizedVariants.map((variant, index) => (
        <span
          key={`${variant.variantKey || variant.sku || variant.name || 'variant'}-${index}`}
          className="raw-material-variant-pill"
        >
          <Text className="raw-material-variant-pill-label" style={compactCellStyles.variantPillLabel}>{`${getLabel(variant, index)}:`}</Text>
          <Text className="raw-material-variant-pill-value" style={compactCellStyles.variantPillValue}>
            {formatStockWithUnit(variant.currentStock || 0, unit)}
          </Text>
        </span>
      ))}
    </div>
  );
};

// -----------------------------------------------------------------------------
// Status stok bahan baku.
// Disamakan arahnya dengan Semi Finished Materials: nonaktif, kosong, rendah, aman.
// -----------------------------------------------------------------------------
const getRawMaterialStatusMeta = (record = {}) => {
  const currentStock = Number(record.currentStock ?? record.stock ?? 0);
  const minStock = Number(record.minStock || 0);

  if (record.isActive === false) {
    return { color: 'default', label: 'Nonaktif' };
  }

  if (currentStock <= 0) {
    return { color: 'red', label: 'Kosong' };
  }

  if (currentStock <= minStock) {
    return { color: 'orange', label: 'Stok Rendah' };
  }

  return { color: 'green', label: 'Aman' };
};

const RawMaterials = () => {
  // ---------------------------------------------------------------------------
  // State utama data dan tampilan halaman.
  // ---------------------------------------------------------------------------
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState(null);

  // ---------------------------------------------------------------------------
  // State filter agar layout raw materials sejalan dengan semi finished.
  // ---------------------------------------------------------------------------
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [variantModeFilter, setVariantModeFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');

  const [form] = Form.useForm();

  // ---------------------------------------------------------------------------
  // Watcher form dipakai untuk preview ringkasan varian secara realtime.
  // ---------------------------------------------------------------------------
  const pricingModeValue = Form.useWatch('pricingMode', form);
  const hasVariantsValue = Form.useWatch('hasVariants', form);
  const variantLabelValue = Form.useWatch('variantLabel', form);
  const watchedVariants = Form.useWatch('variants', form) || [];

  // ---------------------------------------------------------------------------
  // Loader data master.
  // Semua source of truth tetap datang dari service dan Firestore listener.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setLoading(true);

    const unsubMaterials = listenRawMaterials(
      (data) => {
        setMaterials(data);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        message.error('Gagal memuat bahan baku.');
        setLoading(false);
      },
    );

    const unsubSuppliers = listenSupplierCatalog(
      (data) => {
        // -------------------------------------------------------------------
        // Supplier dibaca dari katalog gabungan agar supplier lama yang masih
        // tersimpan di bahan baku tetap muncul dan bisa dipilih kembali.
        // -------------------------------------------------------------------
        setSuppliers(data);
      },
      (error) => {
        console.error(error);
        message.error('Gagal memuat supplier.');
      },
    );

    const unsubPricingRules = onSnapshot(
      collection(db, 'pricing_rules'),
      (snapshot) => {
        setPricingRules(
          snapshot.docs
            .map((docItem) => ({ id: docItem.id, ...docItem.data() }))
            .filter((item) => item?.targetType === 'raw_materials'),
        );
      },
      (error) => {
        console.error(error);
        message.error('Gagal memuat pricing rules.');
      },
    );

    return () => {
      unsubMaterials();
      unsubSuppliers();
      unsubPricingRules();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Ringkasan card atas halaman.
  // Fokus pada metrik yang paling kepakai saat operasional harian.
  // ---------------------------------------------------------------------------
  const summary = useMemo(() => {
    const total = materials.length;
    const withVariants = materials.filter((item) => item.hasVariants).length;
    const noVariants = materials.filter((item) => !item.hasVariants).length;
    const lowStock = materials.filter((item) => {
      const statusMeta = getRawMaterialStatusMeta(item);
      return statusMeta.label === 'Kosong' || statusMeta.label === 'Stok Rendah';
    }).length;

    return { total, withVariants, noVariants, lowStock };
  }, [materials]);

  // ---------------------------------------------------------------------------
  // Ringkasan realtime isi form saat mode varian aktif.
  // ---------------------------------------------------------------------------
  const variantStats = useMemo(() => {
    if (!Array.isArray(watchedVariants) || watchedVariants.length === 0) {
      return { count: 0, stock: 0 };
    }

    return watchedVariants.reduce(
      (acc, item) => ({
        count: acc.count + (String(item?.name || '').trim() ? 1 : 0),
        stock: acc.stock + Number(item?.currentStock || 0),
      }),
      { count: 0, stock: 0 },
    );
  }, [watchedVariants]);

  // ---------------------------------------------------------------------------
  // Filter list utama.
  // Search dibuat ringan supaya user cepat cari bahan, supplier, atau nama varian.
  // ---------------------------------------------------------------------------
  const filteredMaterials = useMemo(() => {
    const selectedSupplier = (suppliers || []).find((item) => String(item.id) === String(supplierFilter));
    const selectedSupplierName = String(getSupplierDisplayName(selectedSupplier) || '').trim().toLowerCase();

    return materials.filter((item) => {
      const keyword = search.trim().toLowerCase();
      const statusMeta = getRawMaterialStatusMeta(item);
      const variantNames = Array.isArray(item.variants)
        ? item.variants.map((variant) => String(variant?.name || '').toLowerCase())
        : [];

      const matchesSearch = !keyword
        ? true
        : [
            item.name,
            item.supplierName,
            item.variantLabel,
            ...variantNames,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(keyword));

      const matchesStatus = statusFilter === 'all' ? true : statusMeta.label === statusFilter;
      const matchesVariantMode =
        variantModeFilter === 'all'
          ? true
          : variantModeFilter === 'variant'
            ? item.hasVariants === true
            : item.hasVariants !== true;

      const matchesSupplier =
        supplierFilter === 'all'
          ? true
          : String(item.supplierId || '') === String(supplierFilter)
            ? true
            : selectedSupplierName
              ? String(item.supplierName || '').trim().toLowerCase() === selectedSupplierName
              : false;

      return matchesSearch && matchesStatus && matchesVariantMode && matchesSupplier;
    });
  }, [materials, search, statusFilter, variantModeFilter, supplierFilter, suppliers]);

  // ---------------------------------------------------------------------------
  // Handler buka drawer form create.
  // ---------------------------------------------------------------------------
  const openCreateDrawer = () => {
    setEditingRecord(null);
    form.setFieldsValue(buildFormValues(RAW_MATERIAL_DEFAULT_FORM));
    setFormVisible(true);
  };

  // ---------------------------------------------------------------------------
  // Handler tutup drawer form.
  // Form di-reset agar saat buka lagi tidak membawa state lama.
  // ---------------------------------------------------------------------------
  const closeFormDrawer = () => {
    setFormVisible(false);
    setSubmitting(false);
    setEditingRecord(null);
    form.resetFields();
  };

  // ---------------------------------------------------------------------------
  // Handler edit.
  // ---------------------------------------------------------------------------
  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue(buildFormValues(record));
    setFormVisible(true);
  };

  // ---------------------------------------------------------------------------
  // Handler buka detail.
  // ---------------------------------------------------------------------------
  const handleViewDetail = (record) => {
    setSelectedMaterial(record);
    setDetailVisible(true);
  };

  // ---------------------------------------------------------------------------
  // Handler aktif/nonaktif bahan baku.
  // Data master tidak dihapus agar histori stok dan log transaksi tetap aman.
  // ---------------------------------------------------------------------------
  const handleToggleActive = async (record) => {
    try {
      await toggleRawMaterialActive(record.id, record.isActive === false);
      message.success(`Bahan baku berhasil ${record.isActive === false ? 'diaktifkan' : 'dinonaktifkan'}.`);
    } catch (error) {
      console.error(error);
      message.error('Gagal mengubah status bahan baku.');
    }
  };

  // ---------------------------------------------------------------------------
  // Submit create/update bahan baku.
  // Validasi backend tetap dipakai agar aturan data tetap satu pintu.
  // ---------------------------------------------------------------------------
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (editingRecord?.id) {
        await updateRawMaterial(editingRecord.id, values, suppliers);
        message.success('Bahan baku berhasil diupdate.');
      } else {
        await createRawMaterial(values, suppliers);
        message.success('Bahan baku berhasil ditambahkan.');
      }

      closeFormDrawer();
    } catch (error) {
      if (error?.errorFields) return;
      if (error?.type === 'validation' && error?.errors) {
        form.setFields(
          Object.entries(error.errors).map(([name, err]) => ({
            name,
            errors: [err],
          })),
        );
        return;
      }

      console.error(error);
      message.error(error?.message || 'Gagal menyimpan bahan baku.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Kolom tabel utama.
  // Struktur tabel disamakan dengan semi finished: nama, stok, harga, status, aksi.
  // ---------------------------------------------------------------------------
  const columns = [
    {
      title: 'Bahan Baku',
      dataIndex: 'name',
      key: 'name',
      width: 280,
      render: (value, record) => (
        <div style={compactCellStyles.stack}>
          <Text strong>{value || '-'}</Text>
          <Text type="secondary" style={compactCellStyles.meta}>
            {record.supplierName || '-'}
          </Text>
          <Space size={6} wrap>
            <Tag color={record.hasVariants ? 'blue' : 'default'}>
              {record.hasVariants ? 'Pakai Varian' : 'Tanpa Varian'}
            </Tag>
            {record.hasVariants ? (
              <Tag color="purple">{formatNumberID(record.variantCount || 0)} varian</Tag>
            ) : null}
          </Space>
        </div>
      ),
    },
    {
      title: 'Stok',
      key: 'stock',
      width: 360,
      render: (_, record) => {
        const unit = record.stockUnit || 'pcs';
        const variants = Array.isArray(record.variants) ? record.variants : [];
        const hasVariants = record.hasVariants === true && variants.length > 0;

        return (
          <div style={compactCellStyles.stack}>
            <Text strong>{`Total ${formatStockWithUnit(record.currentStock ?? record.stock ?? 0, unit)}`}</Text>
            <Text type="secondary" style={compactCellStyles.meta}>
              {`Tersedia ${formatStockWithUnit(record.availableStock ?? record.currentStock ?? record.stock ?? 0, unit)}`}
            </Text>

            {hasVariants ? (
              renderVariantStockPills(variants, unit, (variant, index) => variant.name || `Varian ${index + 1}`)
            ) : (
              <Text type="secondary" style={compactCellStyles.meta}>Non-varian</Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Harga',
      key: 'priceInfo',
      width: 260,
      render: (_, record) => (
        <div style={compactCellStyles.stack}>
          <Text strong>{`Restock ${formatCurrencyId(record.restockReferencePrice || 0)} / ${record.stockUnit || '-'}`}</Text>
          <Text type="secondary" style={compactCellStyles.meta}>
            {`Modal ${record.averageActualUnitCost ? formatCurrencyId(record.averageActualUnitCost) : '-'} / ${record.stockUnit || '-'}`}
          </Text>
          <Text type="secondary" style={compactCellStyles.meta}>
            {`Jual ${formatCurrencyId(record.sellingPrice || 0)} / ${record.stockUnit || '-'}`}
          </Text>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      align: 'center',
      render: (_, record) => {
        const statusMeta = getRawMaterialStatusMeta(record);
        return <Tag color={statusMeta.color}>{statusMeta.label}</Tag>;
      },
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 230,
      fixed: 'right',
      render: (_, record) => (
        <Space size={8} wrap>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            Detail
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title={record.isActive === false ? 'Aktifkan kembali bahan baku?' : 'Nonaktifkan bahan baku?'}
            description={
              record.isActive === false
                ? 'Bahan baku akan aktif kembali untuk dipakai pada transaksi baru.'
                : 'Bahan baku tidak akan muncul sebagai pilihan data baru, tetapi histori tetap aman.'
            }
            okText="Ya"
            cancelText="Batal"
            onConfirm={() => handleToggleActive(record)}
          >
            <Button size="small">{record.isActive === false ? 'Aktifkan' : 'Nonaktifkan'}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="raw-materials-page" style={{ padding: 24 }}>
      {/* ---------------------------------------------------------------------
          Header halaman utama.
          Layout dibuat sama arah visualnya dengan halaman master lain.
      --------------------------------------------------------------------- */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Typography.Title level={3} style={{ margin: 0 }}>
              Bahan Baku
            </Typography.Title>
            <Typography.Text type="secondary">
              Master bahan baku dengan stok master atau stok per varian agar tampilan lebih rapi dan mudah dipantau.
            </Typography.Text>
          </Col>

          <Col>
            <Space wrap>
              <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
                Refresh
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateDrawer}>
                Tambah Bahan Baku
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="Gunakan varian hanya jika bahan memang punya turunan seperti warna, ukuran, atau spesifikasi. Lem atau lakban tetap lebih rapi tanpa varian."
      />

      {/* ---------------------------------------------------------------------
          Summary cards atas halaman.
      --------------------------------------------------------------------- */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card size="small">
            <Statistic title="Total Bahan Baku" value={summary.total} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card size="small">
            <Statistic title="Pakai Varian" value={summary.withVariants} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card size="small">
            <Statistic title="Tanpa Varian" value={summary.noVariants} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card size="small">
            <Statistic title="Perlu Dicek" value={summary.lowStock} />
          </Card>
        </Col>
      </Row>

      {/* ---------------------------------------------------------------------
          Filter bar utama.
      --------------------------------------------------------------------- */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={8}>
            <Input
              allowClear
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama bahan, supplier, atau varian..."
            />
          </Col>
          <Col xs={24} md={5}>
            <Select value={statusFilter} onChange={setStatusFilter} style={{ width: '100%' }}>
              <Option value="all">Semua Status</Option>
              <Option value="Aman">Aman</Option>
              <Option value="Stok Rendah">Stok Rendah</Option>
              <Option value="Kosong">Kosong</Option>
              <Option value="Nonaktif">Nonaktif</Option>
            </Select>
          </Col>
          <Col xs={24} md={5}>
            <Select value={variantModeFilter} onChange={setVariantModeFilter} style={{ width: '100%' }}>
              <Option value="all">Semua Mode Varian</Option>
              <Option value="variant">Pakai Varian</Option>
              <Option value="single">Tanpa Varian</Option>
            </Select>
          </Col>
          <Col xs={24} md={6}>
            <Select value={supplierFilter} onChange={setSupplierFilter} style={{ width: '100%' }} showSearch optionFilterProp="children">
              <Option value="all">Semua Supplier</Option>
              {(suppliers || []).map((supplier) => (
                <Option key={supplier.id} value={supplier.id}>
                  {getSupplierOptionLabel(supplier)}
                </Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      {/* ---------------------------------------------------------------------
          Tabel utama daftar bahan baku.
          size small dipakai supaya jarak cell lebih rapat dan tidak terlalu renggang.
      --------------------------------------------------------------------- */}
      <Card size="small">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={filteredMaterials}
          columns={columns}
          size="small"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1200 }}
          locale={{ emptyText: <Empty description="Belum ada data bahan baku" /> }}
        />
      </Card>

      {/* ---------------------------------------------------------------------
          Drawer form create/edit.
          Ukuran drawer disamakan arah visualnya dengan halaman produk.
      --------------------------------------------------------------------- */}
      <Drawer
        title={editingRecord ? 'Edit Bahan Baku' : 'Tambah Bahan Baku'}
        open={formVisible}
        onClose={closeFormDrawer}
        width={860}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={closeFormDrawer}>Batal</Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              Simpan
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={buildFormValues(RAW_MATERIAL_DEFAULT_FORM)}>
          {/* -----------------------------------------------------------------
              Section identitas utama bahan baku.
          ----------------------------------------------------------------- */}
          <Divider orientation="left">Informasi Utama</Divider>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label="Nama Bahan Baku"
                rules={[{ required: true, message: 'Nama bahan baku wajib diisi.' }]}
              >
                <Input placeholder="Contoh: Kain Flanel" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="supplierId" label="Supplier">
                <Select allowClear placeholder="Pilih supplier" optionFilterProp="children" showSearch>
                  {(suppliers || []).map((supplier) => (
                    <Option key={supplier.id} value={supplier.id}>
                      {getSupplierOptionLabel(supplier)}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="stockUnit"
                label="Satuan Stok"
                rules={[{ required: true, message: 'Satuan stok wajib dipilih.' }]}
              >
                <Select placeholder="Pilih satuan">
                  {unitOptions.map((unit) => (
                    <Option key={unit} value={unit}>
                      {unit}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="hasVariants" label="Pakai Varian" valuePropName="checked">
                <Switch
                  checkedChildren="Ya"
                  unCheckedChildren="Tidak"
                  onChange={(checked) => {
                    if (checked) {
                      form.setFieldsValue({
                        stock: 0,
                        variants: ensureAtLeastOneRawMaterialVariant(form.getFieldValue('variants') || []),
                      });
                    } else {
                      form.setFieldsValue({
                        variants: [],
                        variantLabel: '',
                      });
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="variantLabel" label="Label Varian" extra="Opsional. Contoh: Warna, Ukuran, Spesifikasi">
                <Input disabled={!hasVariantsValue} placeholder="Contoh: Warna" />
              </Form.Item>
            </Col>
          </Row>

          <Card size="small" style={{ marginBottom: 16 }}>
            <Alert
              type="info"
              showIcon
              message="Sesuai konsep final: stok berada di variant jika pakai varian, tetapi minimum stok, harga referensi restock, modal aktual rata-rata, dan harga jual tetap disimpan di master bahan baku."
            />
          </Card>

          {/* -----------------------------------------------------------------
              Section aturan stok dan pricing master.
          ----------------------------------------------------------------- */}
          <Divider orientation="left">Stok & Pricing Master</Divider>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="stock"
                label={hasVariantsValue ? 'Stok Master (Otomatis)' : 'Stok Awal'}
                extra={
                  hasVariantsValue
                    ? 'Kalau pakai varian, stok master dihitung otomatis dari total semua varian.'
                    : 'Stok awal hanya dipakai untuk item tanpa varian.'
                }
              >
                <InputNumber
                  disabled={hasVariantsValue || Boolean(editingRecord)}
                  style={{ width: '100%' }}
                  min={0}
                  precision={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={integerParser}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="minStock"
                label="Minimum Stok Master"
                rules={[{ required: true, message: 'Minimum stok wajib diisi.' }]}
                extra="Berlaku untuk bahan utama, bukan dipecah per varian."
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={integerParser}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="pricingMode"
                label="Mode Pricing"
                rules={[{ required: true, message: 'Mode pricing wajib dipilih.' }]}
              >
                <Select
                  onChange={(value) => {
                    if (value === 'manual') {
                      form.setFieldsValue({ pricingRuleId: null });
                    }
                  }}
                >
                  <Option value="rule">Rule</Option>
                  <Option value="manual">Manual</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="restockReferencePrice"
                label="Harga Referensi Restock / Satuan"
                rules={[{ required: true, message: 'Harga referensi restock wajib diisi.' }]}
                extra="Tetap disimpan di master meskipun bahan memakai varian."
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={integerParser}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="averageActualUnitCost"
                label="Modal Aktual Rata-rata / Satuan"
                rules={[{ required: true, message: 'Modal aktual rata-rata wajib diisi.' }]}
                extra="Dipakai sebagai base cost utama untuk pricing raw materials."
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={integerParser}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="pricingRuleId"
                label="Pricing Rule"
                rules={[
                  {
                    required: pricingModeValue === 'rule',
                    message: 'Pricing rule wajib dipilih untuk mode rule.',
                  },
                ]}
              >
                <Select allowClear disabled={pricingModeValue !== 'rule'} placeholder="Pilih pricing rule">
                  {(pricingRules || []).map((rule) => (
                    <Option key={rule.id} value={rule.id}>
                      {rule.name}
                      {rule?.isActive ? '' : ' (Nonaktif)'}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="sellingPrice"
                label="Harga Jual / Satuan"
                rules={[{ required: true, message: 'Harga jual wajib diisi.' }]}
                extra="Master price tetap satu agar maintenance harga lebih rapi."
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={integerParser}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* -----------------------------------------------------------------
              Section varian bahan baku.
              Saat aktif, stok tampil per varian dengan layout lebih rapat.
          ----------------------------------------------------------------- */}
          {hasVariantsValue ? (
            <>
              <Divider orientation="left">Varian Bahan</Divider>
              <Alert
                style={{ marginBottom: 16 }}
                type="info"
                showIcon
                message={`Gunakan varian untuk ${variantLabelValue || 'turunan bahan'} seperti warna, ukuran, atau spesifikasi lain. Pada tahap ini varian hanya menyimpan identitas dan stok.`}
              />

              <Form.List name="variants">
                {(fields, { remove }) => (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    {fields.map((field, index) => (
                      <Card
                        key={field.key}
                        size="small"
                        title={`${variantLabelValue || 'Varian'} ${index + 1}`}
                        extra={
                          <Button danger type="text" icon={<DeleteOutlined />} onClick={() => remove(field.name)}>
                            Hapus
                          </Button>
                        }
                      >
                        <Row gutter={12}>
                          <Col xs={24} md={8}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'name']}
                              label={`Nama ${variantLabelValue || 'Varian'}`}
                              rules={[{ required: true, message: 'Nama varian wajib diisi.' }]}
                            >
                              <Input
                                placeholder={variantLabelValue ? `Contoh: ${variantLabelValue} Merah` : 'Contoh: Merah'}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={6}>
                            <Form.Item {...field} name={[field.name, 'sku']} label="Kode / SKU Varian">
                              <Input placeholder="Opsional" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={5}>
                            <Form.Item {...field} name={[field.name, 'currentStock']} label="Stok Varian">
                              <InputNumber
                                style={{ width: '100%' }}
                                min={0}
                                precision={0}
                                formatter={(value) => formatNumberID(value)}
                                parser={integerParser}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={5}>
                            <Form.Item {...field} name={[field.name, 'isActive']} label="Aktif" valuePropName="checked">
                              <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                    ))}

                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        const current = form.getFieldValue('variants') || [];
                        form.setFieldsValue({
                          variants: [...current, { ...DEFAULT_RAW_MATERIAL_VARIANT }],
                        });
                      }}
                      block
                    >
                      Tambah Varian
                    </Button>
                  </Space>
                )}
              </Form.List>

              <Alert
                style={{ marginTop: 16 }}
                type="success"
                showIcon
                message={`Ringkasan varian: ${formatNumberID(variantStats.count)} varian | total stok ${formatNumberID(variantStats.stock)}`}
              />
            </>
          ) : null}

          <Alert
            style={{ marginTop: 16 }}
            type="warning"
            showIcon
            message="Mode varian dipakai hanya kalau memang perlu. Kalau item sederhana seperti lem, lakban, atau bahan tanpa turunan, tetap lebih rapi tanpa varian."
          />
        </Form>
      </Drawer>

      {/* ---------------------------------------------------------------------
          Drawer detail bahan baku.
          Dipakai untuk melihat rincian stok tanpa harus masuk mode edit.
      --------------------------------------------------------------------- */}
      <Drawer
        title="Detail Bahan Baku"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={820}
        destroyOnClose
      >
        {selectedMaterial ? (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Nama Bahan Baku">{selectedMaterial.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="Supplier">{selectedMaterial.supplierName || '-'}</Descriptions.Item>
              <Descriptions.Item label="Link Supplier">
                {selectedMaterial.supplierLink ? (
                  <Link href={selectedMaterial.supplierLink} target="_blank" rel="noreferrer">
                    Buka Link Supplier
                  </Link>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Mode Varian">
                <Tag color={selectedMaterial.hasVariants ? 'blue' : 'default'}>
                  {selectedMaterial.hasVariants ? 'Pakai Varian' : 'Tanpa Varian'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Minimum Stok">
                {formatStockWithUnit(selectedMaterial.minStock || 0, selectedMaterial.stockUnit || 'pcs')}
              </Descriptions.Item>
              <Descriptions.Item label="Harga Referensi Restock">
                {`${formatCurrencyId(selectedMaterial.restockReferencePrice || 0)} / ${selectedMaterial.stockUnit || '-'}`}
              </Descriptions.Item>
              <Descriptions.Item label="Modal Aktual Rata-rata">
                {`${selectedMaterial.averageActualUnitCost ? formatCurrencyId(selectedMaterial.averageActualUnitCost) : '-'} / ${selectedMaterial.stockUnit || '-'}`}
              </Descriptions.Item>
              <Descriptions.Item label="Harga Jual">
                {`${formatCurrencyId(selectedMaterial.sellingPrice || 0)} / ${selectedMaterial.stockUnit || '-'}`}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getRawMaterialStatusMeta(selectedMaterial).color}>
                  {getRawMaterialStatusMeta(selectedMaterial).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Update Terakhir">
                {formatDateId(selectedMaterial.updatedAt, true)}
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title={selectedMaterial.hasVariants ? 'Rincian Varian Bahan Baku' : 'Rincian Stok Master'}>
              {selectedMaterial.hasVariants ? (
                <Table
                  rowKey={(variant, index) => `${selectedMaterial.id}-${variant.variantKey || variant.name}-${index}`}
                  pagination={false}
                  size="small"
                  dataSource={selectedMaterial.variants || []}
                  columns={[
                    {
                      title: selectedMaterial.variantLabel || 'Varian',
                      dataIndex: 'name',
                      key: 'name',
                      render: (value) => value || '-',
                    },
                    {
                      title: 'Kode / SKU',
                      dataIndex: 'sku',
                      key: 'sku',
                      render: (value) => value || '-',
                    },
                    {
                      title: 'Stok',
                      dataIndex: 'currentStock',
                      key: 'currentStock',
                      render: (value) => formatStockWithUnit(value || 0, selectedMaterial.stockUnit || 'pcs'),
                    },
                    {
                      title: 'Reserved',
                      dataIndex: 'reservedStock',
                      key: 'reservedStock',
                      render: (value) => formatStockWithUnit(value || 0, selectedMaterial.stockUnit || 'pcs'),
                    },
                    {
                      title: 'Tersedia',
                      key: 'availableStock',
                      render: (_, variant) => formatStockWithUnit(
                        Math.max(Number(variant.currentStock || 0) - Number(variant.reservedStock || 0), 0),
                        selectedMaterial.stockUnit || 'pcs',
                      ),
                    },
                    {
                      title: 'Status',
                      dataIndex: 'isActive',
                      key: 'isActive',
                      render: (value) => (
                        <Tag color={value === false ? 'default' : 'green'}>
                          {value === false ? 'Nonaktif' : 'Aktif'}
                        </Tag>
                      ),
                    },
                  ]}
                />
              ) : (
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label="Stok Total">
                    {formatStockWithUnit(selectedMaterial.currentStock ?? selectedMaterial.stock ?? 0, selectedMaterial.stockUnit || 'pcs')}
                  </Descriptions.Item>
                  <Descriptions.Item label="Reserved Stock">
                    {formatStockWithUnit(selectedMaterial.reservedStock || 0, selectedMaterial.stockUnit || 'pcs')}
                  </Descriptions.Item>
                  <Descriptions.Item label="Stok Tersedia">
                    {formatStockWithUnit(selectedMaterial.availableStock ?? selectedMaterial.currentStock ?? selectedMaterial.stock ?? 0, selectedMaterial.stockUnit || 'pcs')}
                  </Descriptions.Item>
                </Descriptions>
              )}
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </div>
  );
};

export default RawMaterials;
