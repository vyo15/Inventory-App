import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Col,
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
  Typography,
} from 'antd';
import { PlusOutlined, ReloadOutlined, EditOutlined } from '@ant-design/icons';
import {
  DEFAULT_PRODUCTION_PROFILE_FORM,
  PRODUCTION_PROFILE_TYPES,
  PRODUCTION_PROFILE_TYPE_MAP,
  calculateProductionProfileMetrics,
} from '../../constants/productionProfileOptions';
import {
  createProductionProfile,
  getAllProductionProfiles,
  toggleProductionProfileActive,
  updateProductionProfile,
} from '../../services/Produksi/productionProfilesService';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '../../firebase';
import formatNumber from '../../utils/formatters/numberId';
import ProductionFilterCard from '../../components/Produksi/shared/ProductionFilterCard';
import ProductionPageHeader from '../../components/Produksi/shared/ProductionPageHeader';
import PageSection from '../../components/Layout/Page/PageSection';
import ProductionSummaryCards from '../../components/Produksi/shared/ProductionSummaryCards';

const ProductionProfiles = () => {
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formVisible, setFormVisible] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const watchedProfileValues = Form.useWatch([], form);

  const productLookup = useMemo(
    () => (products || []).reduce((acc, item) => ({ ...acc, [item.id]: item }), {}),
    [products],
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const [profileResult, productsSnap] = await Promise.all([
        getAllProductionProfiles(),
        getDocs(collection(db, 'products')),
      ]);

      const productItems = productsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item) => item.isActive !== false)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'id-ID'));

      setProfiles(profileResult);
      setProducts(productItems);
    } catch (error) {
      console.error(error);
      message.error('Gagal memuat profil produksi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const summary = useMemo(() => {
    const total = profiles.length;
    const active = profiles.filter((item) => item.isActive !== false).length;
    const defaults = profiles.filter((item) => item.isDefault !== false).length;
    const mappedProducts = new Set(profiles.map((item) => item.productId).filter(Boolean)).size;
    return { total, active, defaults, mappedProducts };
  }, [profiles]);

  const filteredData = useMemo(() => {
    const keyword = String(search || '').trim().toLowerCase();
    return profiles.filter((item) => {
      const matchSearch =
        !keyword ||
        String(item.profileName || '').toLowerCase().includes(keyword) ||
        String(item.productName || '').toLowerCase().includes(keyword);
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && item.isActive !== false) ||
        (statusFilter === 'inactive' && item.isActive === false);
      return matchSearch && matchStatus;
    });
  }, [profiles, search, statusFilter]);

  const currentMetrics = useMemo(() => {
    return calculateProductionProfileMetrics({
      ...DEFAULT_PRODUCTION_PROFILE_FORM,
      ...(watchedProfileValues || {}),
    });
  }, [watchedProfileValues]);

  const resetFormState = () => {
    setEditingProfile(null);
    form.resetFields();
    form.setFieldsValue({ ...DEFAULT_PRODUCTION_PROFILE_FORM });
  };

  const handleAdd = () => {
    setEditingProfile(null);
    form.setFieldsValue({ ...DEFAULT_PRODUCTION_PROFILE_FORM });
    setFormVisible(true);
  };

  const handleEdit = (record) => {
    setEditingProfile(record);
    form.setFieldsValue({ ...DEFAULT_PRODUCTION_PROFILE_FORM, ...record });
    setFormVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingProfile?.id) {
        await updateProductionProfile(editingProfile.id, values, null, productLookup);
        message.success('Profil produksi berhasil diperbarui');
      } else {
        await createProductionProfile(values, null, productLookup);
        message.success('Profil produksi berhasil ditambahkan');
      }
      setFormVisible(false);
      resetFormState();
      await loadData();
    } catch (error) {
      if (error?.errorFields) return;
      if (error?.type === 'validation' && error?.errors) {
        form.setFields(
          Object.entries(error.errors).map(([name, msg]) => ({ name, errors: [msg] })),
        );
        return;
      }
      console.error(error);
      message.error('Gagal menyimpan profil produksi');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStatisticValue = (value) => formatNumber(value || 0);

  const summaryItems = [
    { key: 'profiles-total', title: 'Total Profil', value: summary.total, subtitle: 'Semua profil produksi yang tersimpan.', accent: 'primary' },
    { key: 'profiles-active', title: 'Profil Aktif', value: summary.active, subtitle: 'Masih aktif dipakai sebagai referensi produksi.', accent: 'success' },
    { key: 'profiles-default', title: 'Profil Default', value: summary.defaults, subtitle: 'Menjadi acuan utama untuk produk terkait.', accent: 'warning' },
    { key: 'profiles-mapped', title: 'Produk Terpetakan', value: summary.mappedProducts, subtitle: 'Jumlah produk yang sudah punya profil.', accent: 'default' },
  ];

  // ---------------------------------------------------------------------------
  // Helper presentasi batch 1.
  // Dipakai untuk menyatukan metadata tabel, status badge, dan tombol aksi.
  // ---------------------------------------------------------------------------
  const profileUiClassNames = {
    stack: 'ims-cell-stack ims-cell-stack-tight',
    meta: 'ims-cell-meta',
  };

  const columns = [
    {
      title: 'Produk',
      dataIndex: 'productName',
      key: 'productName',
      width: 220,
      render: (_, record) => (
        <div className={profileUiClassNames.stack}>
          <Typography.Text strong>{record.productName || '-'}</Typography.Text>
          <Typography.Text type="secondary" className={profileUiClassNames.meta}>{record.profileName || '-'}</Typography.Text>
        </div>
      ),
    },
    {
      title: 'Tipe',
      dataIndex: 'profileType',
      key: 'profileType',
      width: 110,
      render: (value) => PRODUCTION_PROFILE_TYPE_MAP[value] || '-',
    },
    {
      title: 'Kebutuhan / Unit',
      key: 'requirements',
      width: 180,
      render: (_, record) => (
        <div className={profileUiClassNames.stack}>
          <Typography.Text>Kelopak: {formatNumber(record.petalsPerUnit || 0)}</Typography.Text>
          <Typography.Text>Daun: {formatNumber(record.leavesPerUnit || 0)}</Typography.Text>
          <Typography.Text>Tangkai: {formatNumber(record.stemsPerUnit || 0)}</Typography.Text>
        </div>
      ),
    },
    {
      title: 'Hasil Bahan Awal',
      key: 'yields',
      width: 200,
      render: (_, record) => (
        <div className={profileUiClassNames.stack}>
          <Typography.Text>Kelopak / 1 meter: {formatNumber(record.petalYieldPerMeter || 0)}</Typography.Text>
          <Typography.Text>Daun / 1 meter: {formatNumber(record.leafYieldPerMeter || 0)}</Typography.Text>
          <Typography.Text>Tangkai / 40 cm: {formatNumber(record.stemYieldPerRod40cm || 0)}</Typography.Text>
        </div>
      ),
    },
    {
      title: 'Batch Standar',
      key: 'batch',
      width: 180,
      render: (_, record) => (
        <div className={profileUiClassNames.stack}>
          <Typography.Text>Kelopak: {formatNumber(record.assemblyPetalPackCount || 0)} plastik</Typography.Text>
          <Typography.Text>Daun: {formatNumber(record.assemblyLeafPackCount || 0)} plastik</Typography.Text>
          <Typography.Text>Target: {formatNumber(record.assemblyTargetOutput || 0)} bunga</Typography.Text>
        </div>
      ),
    },
    {
      // =====================================================
      // SECTION: status sticky
      // Fungsi:
      // - simple config page yang tetap butuh status terlihat saat tabel melebar
      // - mengikuti baseline final: status boleh sticky sebelum aksi untuk tabel dengan scroll.x
      // =====================================================
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 120,
      fixed: 'right',
      className: 'app-table-status-column app-table-fixed-secondary',
      render: (value, record) => (
        <div className="ims-badge-stack">
          <span className="ims-badge-inline">
            <Badge status={value !== false ? 'success' : 'default'} text={value !== false ? 'Aktif' : 'Nonaktif'} />
          </span>
          {record.isDefault !== false ? <span className="ims-badge-inline"><Badge color="blue" text="Default" /></span> : null}
        </div>
      ),
    },
    {
      // =====================================================
      // SECTION: aksi sticky
      // Fungsi:
      // - Production Profiles termasuk simple config page, jadi tidak wajib punya Detail
      // - kolom aksi tetap di-fixed right supaya pola config page seragam dengan Tahapan Produksi
      // =====================================================
      title: 'Aksi',
      key: 'actions',
      width: 180,
      fixed: 'right',
      className: 'app-table-action-column',
      render: (_, record) => (
        <Space direction="vertical" size={6} className="ims-action-group ims-action-group--vertical">
          <Button className="ims-action-button" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title={record.isActive !== false ? 'Nonaktifkan profil ini?' : 'Aktifkan profil ini?'}
            onConfirm={() => toggleProductionProfileActive(record.id, record.isActive === false, null).then(loadData)}
          >
            <Button className="ims-action-button" size="small">{record.isActive !== false ? 'Nonaktifkan' : 'Aktifkan'}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container ims-page">
      {/* AKTIF / GUARDED: migrasi header ke shared produksi, menjaga konsistensi tampilan tanpa mengubah rule profil produksi. */}
      <ProductionPageHeader
        title="Profil Produksi"
        description="Simpan rumus hasil, batch assembly, dan batas miss per produk. BOM tetap jadi resep bahan, sedangkan profil produksi menjadi aturan hitung operasional."
        onRefresh={loadData}
        onAdd={handleAdd}
        addLabel="Tambah Profil"
      />

      {/* AKTIF / GUARDED: summary cards shared dipakai untuk merapikan UI, sumber data tetap sama. */}
      <ProductionSummaryCards items={summaryItems} />

      {/* AKTIF / GUARDED: kartu filter shared hanya ubah presentasi, tidak ubah state filter/query. */}
      <ProductionFilterCard>
          <Col xs={24} md={14}>
            <Input.Search
              placeholder="Cari nama profil atau produk..."
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Col>
          <Col xs={24} md={10}>
            <Select
              className="ims-filter-control"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'Semua Status' },
                { value: 'active', label: 'Aktif' },
                { value: 'inactive', label: 'Nonaktif' },
              ]}
            />
          </Col>
      </ProductionFilterCard>

      <PageSection
        title="Daftar Profil Produksi"
        subtitle="Profil membantu standarisasi hitung kapasitas dan target operasional per produk."
      >
        <Table
          className="ims-table"
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredData}
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          locale={{ emptyText: <Empty description="Belum ada profil produksi" /> }}
        />
      </PageSection>

      <Drawer
        title={editingProfile?.id ? 'Edit Profil Produksi' : 'Tambah Profil Produksi'}
        open={formVisible}
        onClose={() => {
          setFormVisible(false);
          resetFormState();
        }}
        width={720}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => { setFormVisible(false); resetFormState(); }}>Batal</Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>Simpan</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={DEFAULT_PRODUCTION_PROFILE_FORM}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Produk" name="productId" rules={[{ required: true, message: 'Produk wajib dipilih' }]}> 
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={(products || []).map((item) => ({ value: item.id, label: item.name || '-' }))}
                  placeholder="Pilih produk..."
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Nama Profil" name="profileName" rules={[{ required: true, message: 'Nama profil wajib diisi' }]}> 
                <Input placeholder="Contoh: Profil Mawar Reguler" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Tipe Profil" name="profileType">
                <Select options={PRODUCTION_PROFILE_TYPES} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Default" name="isDefault" valuePropName="checked">
                <Switch checkedChildren="Ya" unCheckedChildren="Tidak" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Status Aktif" name="isActive" valuePropName="checked">
                <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
              </Form.Item>
            </Col>
          </Row>

          <Typography.Title level={5}>Kebutuhan per 1 Produk</Typography.Title>
          <Row gutter={16}>
            <Col xs={24} md={8}><Form.Item label="Kelopak / Unit" name="petalsPerUnit"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item label="Daun / Unit" name="leavesPerUnit"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item label="Tangkai / Unit" name="stemsPerUnit"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>

          <Typography.Title level={5} style={{ marginBottom: 8 }}>Hasil Standar dari Bahan Awal</Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
            Isi dengan hasil potongan normal dari bahan mentah, bukan hasil bunga jadi. Contoh: 1 meter flanel kelopak menghasilkan 480 kelopak, 1 meter flanel daun menghasilkan 256 daun, dan 1 batang kawat 40 cm menghasilkan 2 tangkai.
          </Typography.Paragraph>
          <Row gutter={16}>
            <Col xs={24} md={8}><Form.Item label="Hasil Kelopak dari 1 Meter Flanel" name="petalYieldPerMeter"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item label="Hasil Daun dari 1 Meter Flanel" name="leafYieldPerMeter"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item label="Hasil Tangkai dari 1 Batang Kawat 40 cm" name="stemYieldPerRod40cm"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>

          <Typography.Title level={5}>Batch Assembly Standar</Typography.Title>
          <Row gutter={16}>
            <Col xs={24} md={6}><Form.Item label="Plastik Kelopak" name="assemblyPetalPackCount"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={6}><Form.Item label="Plastik Daun" name="assemblyLeafPackCount"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={6}><Form.Item label="Ikat Kawat" name="assemblyStemBundleCount"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={6}><Form.Item label="Kawat Extra pcs" name="assemblyStemExtraQty"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item label="Target Output Batch" name="assemblyTargetOutput"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item label="Alert Kuning %" name="missYellowPercent"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item label="Alert Merah %" name="missRedPercent"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>

          <Form.Item label="Catatan" name="notes">
            <Input.TextArea rows={3} placeholder="Catatan operasional atau asumsi batch" />
          </Form.Item>

          <Card size="small" type="inner" title="Ringkasan Kapasitas Otomatis">
            <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
              Bagian ini mengubah hasil bahan awal menjadi kapasitas bunga agar lebih mudah dibaca operator.
            </Typography.Paragraph>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Statistic
                  title="Kapasitas Bunga dari 1 Meter Kelopak"
                  value={currentMetrics.flowerEquivalentPerPetalMeter || 0}
                  formatter={renderStatisticValue}
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title="Kapasitas Bunga dari 1 Meter Daun"
                  value={currentMetrics.flowerEquivalentPerLeafMeter || 0}
                  formatter={renderStatisticValue}
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title="Kapasitas Bunga dari 1 Batang 40 cm"
                  value={currentMetrics.flowerEquivalentPerRod40cm || 0}
                  formatter={renderStatisticValue}
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title="Total Kawat per Batch"
                  value={currentMetrics.assemblyStemQty || 0}
                  formatter={renderStatisticValue}
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title="Kapasitas Kelopak per Batch"
                  value={currentMetrics.assemblyFlowerEquivalentFromPetal || 0}
                  formatter={renderStatisticValue}
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title="Sisa Teoritis Daun per Batch"
                  value={currentMetrics.assemblyLeafTheoreticalLeftover || 0}
                  formatter={renderStatisticValue}
                />
              </Col>
            </Row>
          </Card>
        </Form>
      </Drawer>
    </div>
  );
};

export default ProductionProfiles;
