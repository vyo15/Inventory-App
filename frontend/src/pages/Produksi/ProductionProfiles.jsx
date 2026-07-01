import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  App as AntdApp,
  Badge,
  Col,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { EditOutlined, EyeOutlined } from '@ant-design/icons';
import { DEFAULT_PRODUCTION_PROFILE_FORM, PRODUCTION_PROFILE_TYPE_MAP, calculateProductionProfileMetrics } from '../../constants/productionProfileOptions';
import {
  createProductionProfile,
  getAllProductionProfiles,
  toggleProductionProfileActive,
  updateProductionProfile,
} from '../../services/Produksi/productionProfilesService';
import { listenProducts } from '../../services/MasterData/productsService';
import formatNumber from '../../utils/formatters/numberId';
import ProductionFilterCard from '../../components/Produksi/shared/ProductionFilterCard';
import ProductionPageHeader from '../../components/Produksi/shared/ProductionPageHeader';
import PageContentCanvas from '../../components/Layout/Page/PageContentCanvas';
import PageSection from '../../components/Layout/Page/PageSection';
import DataTableView from '../../components/Layout/Table/DataTableView';
import TableActionMenu from '../../components/Layout/Table/TableActionMenu';
import ProductionSummaryCards from '../../components/Produksi/shared/ProductionSummaryCards';
import { getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import ProductionProfileDetailDrawer from "./components/ProductionProfileDetailDrawer";
import ProductionProfileFormDrawer from "./components/ProductionProfileFormDrawer";

const ProductionProfiles = () => {
  const { message } = AntdApp.useApp();
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

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const profileResult = await getAllProductionProfiles();
      const productItems = await new Promise((resolve, reject) => {
        let unsubscribe = null;
        unsubscribe = listenProducts((rows) => {
          if (unsubscribe) unsubscribe();
          resolve((rows || []).filter((item) => item.isActive !== false));
        }, reject);
      });

      setProfiles(profileResult);
      setProducts(productItems.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'id-ID')));
    } catch (error) {
      console.error(error);
      message.error('Gagal memuat profil produksi');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      width: 132,
      className: 'app-table-action-column',
      render: (_, record) => (
        <TableActionMenu
          visibleActions={[
            {
              key: 'detail',
              label: 'Detail',
              icon: <EyeOutlined />,
              onClick: () => handleDetail(record),
            },
          ]}
          moreActions={[
            {
              key: 'edit',
              label: 'Edit',
              icon: <EditOutlined />,
              onClick: () => handleEdit(record),
            },
            {
              key: 'toggle',
              label: record.isActive !== false ? 'Nonaktifkan' : 'Aktifkan',
              danger: record.isActive !== false,
              confirm: {
                title: record.isActive !== false ? 'Nonaktifkan profil ini?' : 'Aktifkan profil ini?',
                okText: 'Ya',
                cancelText: 'Batal',
              },
              onClick: () => toggleProductionProfileActive(record.id, record.isActive === false, null).then(loadData),
            },
          ]}
        />
      ),
    },
  ];

  const profilesMobileCardConfig = {
    title: (record) => record.productName || "Produk",
    subtitle: (record) => [record.profileName || "Profil belum diisi", PRODUCTION_PROFILE_TYPE_MAP[record.profileType] || "Tipe belum diisi"],
    tags: (record) => [
      <Badge key="active" status={record.isActive !== false ? "success" : "default"} text={record.isActive !== false ? "Aktif" : "Nonaktif"} />,
      record.isDefault !== false ? <Tag key="default" color="blue">Default</Tag> : null,
    ].filter(Boolean),
    meta: [
      { label: "Kelopak", value: (record) => formatNumber(record.petalsPerUnit || 0) },
      { label: "Daun", value: (record) => formatNumber(record.leavesPerUnit || 0) },
      { label: "Tangkai", value: (record) => formatNumber(record.stemsPerUnit || 0) },
      { label: "Target Batch", value: (record) => `${formatNumber(record.assemblyTargetOutput || 0)} bunga` },
    ],
    primaryActions: (record) => [
      {
        key: 'detail',
        label: 'Detail',
        icon: <EyeOutlined />,
        onClick: () => handleDetail(record),
      },
    ],
    moreActions: (record) => [
      {
        key: 'edit',
        label: 'Edit',
        icon: <EditOutlined />,
        onClick: () => handleEdit(record),
      },
      {
        key: 'toggle',
        label: record.isActive !== false ? 'Nonaktifkan' : 'Aktifkan',
        danger: record.isActive !== false,
        confirm: {
          title: record.isActive !== false ? 'Nonaktifkan profil ini?' : 'Aktifkan profil ini?',
          okText: 'Ya',
          cancelText: 'Batal',
        },
        onClick: () => toggleProductionProfileActive(record.id, record.isActive === false, null).then(loadData),
      },
    ],
  };

  const requirementMobileCardConfig = {
    title: (record) => record.component || "Komponen",
    meta: [
      { label: "Qty", value: (record) => formatNumber(record.qty || 0) },
      { label: "Satuan", value: (record) => record.unit || "-" },
    ],
  };

  const yieldMobileCardConfig = {
    title: (record) => record.material || "Material",
    meta: [
      { label: "Output", value: (record) => formatNumber(record.output || 0) },
      { label: "Basis", value: (record) => record.base || "-" },
    ],
  };

  return (
    <div className="page-container ims-page">
      {/* AKTIF / GUARDED: migrasi header ke shared produksi, menjaga konsistensi tampilan tanpa mengubah rule profil produksi. */}
      <ProductionPageHeader
        title="Profil Produksi"
        description="Aturan hitung hasil dan batas miss per produk."
        onAdd={handleAdd}
        addLabel="Tambah Profil"
      />

      <PageContentCanvas>

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
        <DataTableView
          loading={loading}
          showRefreshIndicator
          className="ims-table"
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          mobileCardConfig={profilesMobileCardConfig}
          locale={{
            emptyText: getDataTableEmptyText(loading, "Belum ada profil produksi"),
          }}
        />
      </PageSection>

      </PageContentCanvas>

<ProductionProfileDetailDrawer
        closeDetail={closeDetail}
        detailRequirementRows={detailRequirementRows}
        detailVisible={detailVisible}
        detailYieldRows={detailYieldRows}
        renderProfileStatus={renderProfileStatus}
        renderStatisticValue={renderStatisticValue}
        requirementMobileCardConfig={requirementMobileCardConfig}
        selectedProfile={selectedProfile}
        yieldMobileCardConfig={yieldMobileCardConfig}
      />

<ProductionProfileFormDrawer
        currentMetrics={currentMetrics}
        editingProfile={editingProfile}
        form={form}
        formVisible={formVisible}
        handleSubmit={handleSubmit}
        products={products}
        renderStatisticValue={renderStatisticValue}
        resetFormState={resetFormState}
        setFormVisible={setFormVisible}
        submitting={submitting}
      />
    </div>
  );
};

export default ProductionProfiles;
