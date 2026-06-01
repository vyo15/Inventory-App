import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
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
  Tooltip,
  Typography,
} from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
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
import { DataRefreshIndicator, getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";

const ProductionProfiles = () => {
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formVisible, setFormVisible] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
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

  const handleDetail = (record) => {
    setSelectedProfile(record);
    setDetailVisible(true);
  };

  const closeDetail = () => {
    setDetailVisible(false);
    setSelectedProfile(null);
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

  const renderProfileStatus = (record = {}) => (
    <Space size={[4, 4]} wrap>
      <Tag color={record.isActive !== false ? 'green' : 'default'}>
        {record.isActive !== false ? 'Aktif' : 'Nonaktif'}
      </Tag>
      {record.isDefault !== false ? <Tag color="blue">Default</Tag> : null}
    </Space>
  );

  const detailRequirementRows = (record = {}) => [
    { key: 'petals', component: 'Kelopak', qty: record.petalsPerUnit || 0, unit: 'pcs / produk' },
    { key: 'leaves', component: 'Daun', qty: record.leavesPerUnit || 0, unit: 'pcs / produk' },
    { key: 'stems', component: 'Tangkai', qty: record.stemsPerUnit || 0, unit: 'pcs / produk' },
  ];

  const detailYieldRows = (record = {}) => [
    { key: 'petal-yield', material: 'Kelopak', output: record.petalYieldPerMeter || 0, base: 'pcs / meter' },
    { key: 'leaf-yield', material: 'Daun', output: record.leafYieldPerMeter || 0, base: 'pcs / meter' },
    { key: 'stem-yield', material: 'Tangkai', output: record.stemYieldPerRod40cm || 0, base: 'pcs / batang 40 cm' },
  ];

  const summaryItems = [
    { key: 'profiles-total', title: 'Total Profil', value: summary.total, subtitle: 'Semua profil produksi yang tersimpan.', accent: 'primary' },
    { key: 'profiles-active', title: 'Profil Aktif', value: summary.active, subtitle: 'Masih aktif dipakai sebagai referensi produksi.', accent: 'success' },
    { key: 'profiles-default', title: 'Profil Default', value: summary.defaults, subtitle: 'Menjadi acuan utama untuk produk terkait.', accent: 'warning' },
    { key: 'profiles-mapped', title: 'Produk Terpetakan', value: summary.mappedProducts, subtitle: 'Jumlah produk yang sudah punya profil.', accent: 'default' },
  ];

  // =====================================================
  // SECTION: Main table compact columns — AKTIF
  // Fungsi:
  // - Menampilkan ringkasan produk/profil, kebutuhan per unit, yield, batch, status, dan aksi tanpa scroll x besar.
  // - Menjaga edit drawer existing sebagai tempat konfigurasi lengkap.
  //
  // Dipakai oleh:
  // - ProductionProfiles main table.
  //
  // Alasan perubahan:
  // - Main table sebelumnya melebar karena kebutuhan, yield, batch, status, dan aksi dipisah sebagai kolom panjang.
  //
  // Catatan cleanup:
  // - Helper presentasi angka produksi bisa dipindah ke shared UI setelah beberapa halaman master selesai dipadatkan.
  //
  // Risiko:
  // - Jangan mengubah calculateProductionProfileMetrics atau lookup produk dari section presentasi ini.
  // =====================================================
  const profileUiClassNames = {
    stack: 'ims-cell-stack ims-cell-stack-tight',
    meta: 'ims-cell-meta',
  };

  const columns = [
    {
      title: 'Produk / Profil',
      dataIndex: 'productName',
      key: 'profileSummary',
      width: '32%',
      render: (_, record) => {
        const profileTypeLabel = PRODUCTION_PROFILE_TYPE_MAP[record.profileType] || '-';

        return (
          <div className={profileUiClassNames.stack}>
            <Typography.Text strong ellipsis={{ tooltip: record.productName || '-' }}>
              {record.productName || '-'}
            </Typography.Text>
            <Typography.Text type="secondary" className={profileUiClassNames.meta} ellipsis={{ tooltip: record.profileName || '-' }}>
              {record.profileName || '-'}
            </Typography.Text>
            <Space size={[4, 4]} wrap>
              <Tag>{profileTypeLabel}</Tag>
              {record.isDefault !== false ? <Tag color="blue">Default</Tag> : null}
            </Space>
          </div>
        );
      },
    },
    {
      title: 'Kebutuhan / Unit',
      key: 'requirements',
      width: '22%',
      render: (_, record) => {
        const detail = `Kelopak ${formatNumber(record.petalsPerUnit || 0)}, Daun ${formatNumber(record.leavesPerUnit || 0)}, Tangkai ${formatNumber(record.stemsPerUnit || 0)}`;

        return (
          <Tooltip title={detail}>
            <Space direction="vertical" size={2}>
              <Typography.Text>Kelopak: {formatNumber(record.petalsPerUnit || 0)}</Typography.Text>
              <Typography.Text type="secondary">Daun/Tangkai: {formatNumber(record.leavesPerUnit || 0)} / {formatNumber(record.stemsPerUnit || 0)}</Typography.Text>
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title: 'Yield / Batch',
      key: 'yieldBatch',
      width: '24%',
      responsive: ['md'],
      render: (_, record) => {
        const yieldDetail = `Yield: kelopak ${formatNumber(record.petalYieldPerMeter || 0)}/m, daun ${formatNumber(record.leafYieldPerMeter || 0)}/m, tangkai ${formatNumber(record.stemYieldPerRod40cm || 0)}/40cm`;
        const batchDetail = `Batch: kelopak ${formatNumber(record.assemblyPetalPackCount || 0)} plastik, daun ${formatNumber(record.assemblyLeafPackCount || 0)} plastik, target ${formatNumber(record.assemblyTargetOutput || 0)} bunga`;

        return (
          <Tooltip title={`${yieldDetail}. ${batchDetail}.`}>
            <Space direction="vertical" size={2}>
              <Typography.Text>Yield kelopak/daun: {formatNumber(record.petalYieldPerMeter || 0)} / {formatNumber(record.leafYieldPerMeter || 0)}</Typography.Text>
              <Typography.Text type="secondary">Batch target: {formatNumber(record.assemblyTargetOutput || 0)} bunga</Typography.Text>
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 118,
      className: 'app-table-status-column',
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
      title: 'Aksi',
      key: 'actions',
      width: 156,
      className: 'app-table-action-column',
      render: (_, record) => (
        <Space direction="vertical" size={6} className="ims-action-group ims-action-group--vertical">
          <Button className="ims-action-button" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>
            Detail
          </Button>
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
        description="Aturan hitung hasil dan batas miss per produk."
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
        subtitle="Standar kapasitas dan target produk."
      >
        {/* =====================================================
            SECTION: Main table render — AKTIF
            Fungsi:
            - Merender tabel profil produksi compact tanpa scroll x besar.

            Dipakai oleh:
            - ProductionProfiles page.

            Alasan perubahan:
            - Status dan aksi tidak lagi fixed karena informasi panjang diringkas ke tooltip dan teks pendek.

            Catatan cleanup:
            - belum ada.

            Risiko:
            - Menyembunyikan angka penting tanpa tooltip/detail dapat membuat user salah membaca kebutuhan produksi.
        ===================================================== */}
        <DataRefreshIndicator loading={loading} dataSource={filteredData} />
        <Table
          className="ims-table"
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          locale={{
            emptyText: getDataTableEmptyText(loading, <Empty description="Belum ada profil produksi" />),
          }}
        />
      </PageSection>

      <Drawer
        title="Detail Profil Produksi"
        open={detailVisible}
        onClose={closeDetail}
        width={860}
        destroyOnClose
      >
        {selectedProfile ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {/*
=====================================================
SECTION: Detail profil produksi — AKTIF
Fungsi:
- Menampilkan ringkasan template produksi tanpa mengubah data, payload, atau rumus profil.

Dipakai oleh:
- Tombol Detail pada halaman ProductionProfiles.

Alasan perubahan:
- Template produksi sebelumnya hanya punya Edit/Toggle sehingga user tidak bisa review detail tanpa membuka form edit.

Risiko:
- Detail ini hanya presentasi; jangan memindahkan logic kalkulasi dari constants/service ke drawer.
=====================================================
*/}
            <Card size="small">
              <Row gutter={[16, 16]} align="middle">
                <Col xs={24} md={16}>
                  <Typography.Title level={4} style={{ marginBottom: 4 }}>
                    {selectedProfile.profileName || '-'}
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    {selectedProfile.productName || '-'}
                  </Typography.Text>
                </Col>
                <Col xs={24} md={8}>
                  <div style={{ textAlign: 'right' }}>{renderProfileStatus(selectedProfile)}</div>
                </Col>
              </Row>
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Statistic title="Target Batch" value={selectedProfile.assemblyTargetOutput || 0} suffix="bunga" formatter={renderStatisticValue} />
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Statistic title="Total Kawat / Batch" value={selectedProfile.assemblyStemQty || 0} formatter={renderStatisticValue} />
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Statistic title="Sisa Daun Teoritis" value={selectedProfile.assemblyLeafTheoreticalLeftover || 0} formatter={renderStatisticValue} />
                </Card>
              </Col>
            </Row>

            <Card size="small" title="Ringkasan">
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Produk">{selectedProfile.productName || '-'}</Descriptions.Item>
                <Descriptions.Item label="Tipe Profil">{PRODUCTION_PROFILE_TYPE_MAP[selectedProfile.profileType] || '-'}</Descriptions.Item>
                <Descriptions.Item label="Alert Miss">
                  Kuning {formatNumber(selectedProfile.missYellowPercent || 0)}% · Merah {formatNumber(selectedProfile.missRedPercent || 0)}%
                </Descriptions.Item>
                <Descriptions.Item label="Catatan">{selectedProfile.notes || '-'}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="Kebutuhan per Produk">
              <Table
                size="small"
                pagination={false}
                rowKey="key"
                dataSource={detailRequirementRows(selectedProfile)}
                columns={[
                  { title: 'Komponen', dataIndex: 'component', key: 'component' },
                  { title: 'Qty', dataIndex: 'qty', key: 'qty', align: 'right', render: (value) => formatNumber(value || 0) },
                  { title: 'Satuan', dataIndex: 'unit', key: 'unit' },
                ]}
              />
            </Card>

            <Card size="small" title="Hasil Standar Bahan Awal">
              <Table
                size="small"
                pagination={false}
                rowKey="key"
                dataSource={detailYieldRows(selectedProfile)}
                columns={[
                  { title: 'Material', dataIndex: 'material', key: 'material' },
                  { title: 'Output', dataIndex: 'output', key: 'output', align: 'right', render: (value) => formatNumber(value || 0) },
                  { title: 'Basis', dataIndex: 'base', key: 'base' },
                ]}
              />
            </Card>

            <Card size="small" title="Batch Assembly">
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Plastik Kelopak">{formatNumber(selectedProfile.assemblyPetalPackCount || 0)}</Descriptions.Item>
                <Descriptions.Item label="Plastik Daun">{formatNumber(selectedProfile.assemblyLeafPackCount || 0)}</Descriptions.Item>
                <Descriptions.Item label="Ikat Kawat">{formatNumber(selectedProfile.assemblyStemBundleCount || 0)}</Descriptions.Item>
                <Descriptions.Item label="Kawat Extra">{formatNumber(selectedProfile.assemblyStemExtraQty || 0)} pcs</Descriptions.Item>
              </Descriptions>
            </Card>
          </Space>
        ) : null}
      </Drawer>

      <Drawer
        title={editingProfile?.id ? 'Edit Profil Produksi' : 'Tambah Profil Produksi'}
        open={formVisible}
        onClose={() => {
          setFormVisible(false);
          resetFormState();
        }}
        width={820}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => { setFormVisible(false); resetFormState(); }}>Batal</Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>Simpan</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={DEFAULT_PRODUCTION_PROFILE_FORM}>
          {/*
=====================================================
SECTION: Drawer form profil produksi — AKTIF
Fungsi:
- Mengelompokkan konfigurasi profil produksi, kebutuhan bahan, batch, dan preview kapasitas.

Dipakai oleh:
- Halaman ProductionProfiles untuk tambah/edit template produksi per produk.

Alasan perubahan:
- Drawer profil dirapikan menjadi section Card agar angka produksi tidak bercampur dalam satu area panjang.

Catatan cleanup:
- Belum ada; field dan payload form tetap mengikuti struktur existing.

Risiko:
- Jika name Form.Item berubah, payload profile dan perhitungan kapasitas bisa rusak.
=====================================================
*/}
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Card size="small" title="Ringkasan Profil">
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
            </Card>

            <Card size="small" title="Kebutuhan per 1 Produk">
              <Row gutter={16}>
                <Col xs={24} md={8}><Form.Item label="Kelopak / Unit" name="petalsPerUnit"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item label="Daun / Unit" name="leavesPerUnit"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item label="Tangkai / Unit" name="stemsPerUnit"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
            </Card>

            <Card
              size="small"
              title="Hasil Standar Bahan Awal"
              extra={<Typography.Text type="secondary">Input hasil potongan normal.</Typography.Text>}
            >
              <Row gutter={16}>
                <Col xs={24} md={8}><Form.Item label="Kelopak / Meter" name="petalYieldPerMeter"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item label="Daun / Meter" name="leafYieldPerMeter"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item label="Tangkai / Batang 40 cm" name="stemYieldPerRod40cm"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
            </Card>

            <Card size="small" title="Batch Assembly Standar">
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
            </Card>

            <Card size="small" title="Ringkasan Kapasitas Otomatis">
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <Statistic
                    title="Bunga / Meter Kelopak"
                    value={currentMetrics.flowerEquivalentPerPetalMeter || 0}
                    formatter={renderStatisticValue}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <Statistic
                    title="Bunga / Meter Daun"
                    value={currentMetrics.flowerEquivalentPerLeafMeter || 0}
                    formatter={renderStatisticValue}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <Statistic
                    title="Bunga / Batang 40 cm"
                    value={currentMetrics.flowerEquivalentPerRod40cm || 0}
                    formatter={renderStatisticValue}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <Statistic
                    title="Total Kawat / Batch"
                    value={currentMetrics.assemblyStemQty || 0}
                    formatter={renderStatisticValue}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <Statistic
                    title="Kapasitas Kelopak / Batch"
                    value={currentMetrics.assemblyFlowerEquivalentFromPetal || 0}
                    formatter={renderStatisticValue}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <Statistic
                    title="Sisa Daun Teoritis"
                    value={currentMetrics.assemblyLeafTheoreticalLeftover || 0}
                    formatter={renderStatisticValue}
                  />
                </Col>
              </Row>
            </Card>
          </Space>
        </Form>
      </Drawer>
    </div>
  );
};

export default ProductionProfiles;
