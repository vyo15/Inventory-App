import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  message,
  Empty,
  InputNumber,
  Row,
  Col,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getSupplierDisplayName,
  getSupplierStoreLink,
  isManagedSupplierRecord,
  listenSuppliers,
  syncRawMaterialsWithSupplier,
} from '../../services/MasterData/suppliersService';

const { Option } = Select;
const { Search } = Input;

// -----------------------------------------------------------------------------
// Format angka Indonesia tanpa desimal.
// -----------------------------------------------------------------------------
const formatNumberID = (value) => {
  return Number(value || 0).toLocaleString('id-ID', {
    maximumFractionDigits: 0,
  });
};

// -----------------------------------------------------------------------------
// Format rupiah Indonesia tanpa desimal.
// -----------------------------------------------------------------------------
const formatCurrencyIDR = (value) => {
  return `Rp ${formatNumberID(value)}`;
};

const SupplierPurchases = () => {
  // ---------------------------------------------------------------------------
  // State utama halaman supplier.
  // Versi ini disederhanakan lagi: fokus ke master supplier aktif.
  // ---------------------------------------------------------------------------
  const [suppliers, setSuppliers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [syncingRowId, setSyncingRowId] = useState(null);

  // ---------------------------------------------------------------------------
  // State filter UI.
  // ---------------------------------------------------------------------------
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(undefined);
  const [materialFilter, setMaterialFilter] = useState(undefined);

  const [form] = Form.useForm();

  const location = useLocation();
  const navigate = useNavigate();

  // ---------------------------------------------------------------------------
  // Baca filter material dari query URL agar halaman supplier bisa dibuka dari
  // bahan baku atau pembelian dengan filter otomatis.
  // ---------------------------------------------------------------------------
  const searchParams = new URLSearchParams(location.search);
  const materialIdFromQuery = searchParams.get('materialId');

  const selectedMaterialFromQuery = useMemo(() => {
    return materials.find((item) => item.id === materialIdFromQuery);
  }, [materials, materialIdFromQuery]);

  // ---------------------------------------------------------------------------
  // Opsi kategori untuk dropdown filter.
  // ---------------------------------------------------------------------------
  const categoryOptions = useMemo(() => {
    const uniqueCategories = [
      ...new Set((suppliers || []).map((item) => item.category).filter(Boolean)),
    ];

    return uniqueCategories.sort((leftCategory, rightCategory) =>
      leftCategory.localeCompare(rightCategory, 'id-ID'),
    );
  }, [suppliers]);

  // ---------------------------------------------------------------------------
  // Sinkron supplier master dan bahan baku dari Firestore.
  // Supplier hanya diambil dari master supplierPurchases agar halaman stabil.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const unsubscribeSuppliers = listenSuppliers(
      (nextSuppliers) => {
        setSuppliers(nextSuppliers);
      },
      (error) => {
        console.error(error);
        message.error('Gagal memuat supplier.');
      },
    );

    const unsubscribeMaterials = onSnapshot(
      collection(db, 'raw_materials'),
      (snapshot) => {
        const nextMaterials = snapshot.docs.map((documentItem) => ({
          id: documentItem.id,
          ...documentItem.data(),
        }));

        setMaterials(nextMaterials);
      },
      (error) => {
        console.error(error);
        message.error('Gagal memuat bahan baku untuk referensi supplier.');
      },
    );

    return () => {
      unsubscribeSuppliers();
      unsubscribeMaterials();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Filter supplier dari query URL + filter manual user.
  // ---------------------------------------------------------------------------
  const filteredSuppliers = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return (suppliers || [])
      .filter((supplier) => {
        if (!materialIdFromQuery) return true;
        return (supplier.supportedMaterialIds || []).includes(materialIdFromQuery);
      })
      .filter((supplier) => {
        if (!materialFilter) return true;
        return (supplier.supportedMaterialIds || []).includes(materialFilter);
      })
      .filter((supplier) => {
        if (!categoryFilter) return true;
        return (supplier.category || '') === categoryFilter;
      })
      .filter((supplier) => {
        if (!keyword) return true;

        const searchableText = [
          getSupplierDisplayName(supplier),
          supplier.category,
          getSupplierStoreLink(supplier),
          ...(supplier.supportedMaterialNames || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchableText.includes(keyword);
      })
      .sort((leftSupplier, rightSupplier) =>
        getSupplierDisplayName(leftSupplier).localeCompare(
          getSupplierDisplayName(rightSupplier),
          'id-ID',
        ),
      );
  }, [suppliers, materialIdFromQuery, materialFilter, categoryFilter, searchText]);

  // ---------------------------------------------------------------------------
  // Reset filter UI manual.
  // ---------------------------------------------------------------------------
  const resetManualFilters = () => {
    setSearchText('');
    setCategoryFilter(undefined);
    setMaterialFilter(undefined);
  };

  // ---------------------------------------------------------------------------
  // Reset state modal agar buka/tutup form selalu bersih.
  // ---------------------------------------------------------------------------
  const resetSupplierModalState = () => {
    setModalVisible(false);
    setIsEditing(false);
    setEditingId(null);
    setSaving(false);
    form.resetFields();
  };

  // ---------------------------------------------------------------------------
  // Normalisasi payload supplier sebelum dikirim ke master supplier.
  // Material yang dipilih akan disimpan sekaligus dipakai untuk sinkron ke bahan.
  // ---------------------------------------------------------------------------
  const buildSupplierPayload = (values) => {
    const materialDetails = (values.materialDetails || [])
      .filter((item) => item.materialId)
      .map((item) => {
        const selectedMaterial = materials.find((material) => material.id === item.materialId);

        return {
          materialId: item.materialId,
          materialName: selectedMaterial?.name || item.materialName || '',
          productLink: item.productLink || '',
          referencePrice: Math.round(Number(item.referencePrice || 0)),
          note: item.note || '',
        };
      });

    return {
      category: values.category || '',
      storeName: values.storeName,
      storeLink: values.storeLink || '',
      supportedMaterialIds: materialDetails.map((item) => item.materialId),
      supportedMaterialNames: materialDetails.map((item) => item.materialName),
      materialDetails,
      updatedAt: serverTimestamp(),
    };
  };

  // ---------------------------------------------------------------------------
  // Simpan supplier baru / edit supplier.
  // Setelah disimpan, bahan yang dipilih di supplier akan langsung disinkronkan.
  // Jadi user cukup bikin supplier baru lalu pilih material yang terkait.
  // ---------------------------------------------------------------------------
  const handleSaveSupplier = async (values) => {
    try {
      setSaving(true);

      const payload = buildSupplierPayload(values);
      const previousSupplier = suppliers.find((item) => item.id === editingId) || null;
      let savedSupplierId = editingId;

      if (isEditing && editingId) {
        await updateDoc(doc(db, 'supplierPurchases', editingId), payload);
        message.success('Supplier berhasil diupdate.');
      } else {
        const createdDoc = await addDoc(collection(db, 'supplierPurchases'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        savedSupplierId = createdDoc.id;
        message.success('Supplier berhasil ditambahkan.');
      }

      const syncResult = await syncRawMaterialsWithSupplier(
        {
          ...payload,
          id: savedSupplierId,
          masterSupplierId: savedSupplierId,
          sourceCollection: 'supplierPurchases',
        },
        previousSupplier,
      );

      if (syncResult.updatedCount > 0) {
        message.success(
          `${formatNumberID(syncResult.updatedCount)} bahan baku berhasil disinkronkan dengan supplier.`,
        );
      }

      resetSupplierModalState();
    } catch (error) {
      console.error(error);
      message.error('Gagal menyimpan supplier.');
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Isi modal saat edit supplier.
  // ---------------------------------------------------------------------------
  const handleEditSupplier = (record) => {
    setIsEditing(true);
    setEditingId(record.id);
    setModalVisible(true);

    form.setFieldsValue({
      category: record.category || '',
      storeName: getSupplierDisplayName(record),
      storeLink: getSupplierStoreLink(record),
      materialDetails:
        (record.materialDetails || []).length > 0
          ? record.materialDetails.map((item) => ({
              materialId: item.materialId,
              materialName: item.materialName,
              productLink: item.productLink || '',
              referencePrice: Math.round(Number(item.referencePrice || 0)),
              note: item.note || '',
            }))
          : [],
    });
  };

  // ---------------------------------------------------------------------------
  // Hapus supplier hanya menghapus master supplier.
  // Data supplier yang sudah menempel di bahan baku tidak disentuh otomatis,
  // supaya tidak ada perubahan data mendadak di operasional harian.
  // ---------------------------------------------------------------------------
  const handleDeleteSupplier = async (record) => {
    if (!isManagedSupplierRecord(record)) {
      message.warning('Supplier ini bukan record master yang bisa dihapus dari halaman ini.');
      return;
    }

    try {
      await deleteDoc(doc(db, 'supplierPurchases', record.id));
      message.success('Supplier berhasil dihapus dari master supplier.');
    } catch (error) {
      console.error(error);
      message.error('Gagal menghapus supplier.');
    }
  };

  // ---------------------------------------------------------------------------
  // Buka drawer detail supplier.
  // ---------------------------------------------------------------------------
  const openSupplierDrawer = (record) => {
    setSelectedSupplier(record);
    setDrawerVisible(true);
  };

  // ---------------------------------------------------------------------------
  // Sinkron manual supplier ke bahan baku.
  // Dipakai jika user edit daftar material supplier atau ingin refresh relasi.
  // ---------------------------------------------------------------------------
  const handleSyncSupplierMaterials = async (record) => {
    try {
      setSyncingRowId(record.id);
      const result = await syncRawMaterialsWithSupplier(record, record);
      message.success(
        `${formatNumberID(result.updatedCount || 0)} bahan baku berhasil disinkronkan.`,
      );
    } catch (error) {
      console.error(error);
      message.error('Gagal menyinkronkan supplier ke bahan baku.');
    } finally {
      setSyncingRowId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Kolom tabel supplier.
  // ---------------------------------------------------------------------------
  const columns = [
    {
      title: 'Nama Supplier',
      dataIndex: 'storeName',
      key: 'storeName',
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Button
            type="link"
            onClick={() => openSupplierDrawer(record)}
            style={{ padding: 0, height: 'auto' }}
          >
            {getSupplierDisplayName(record)}
          </Button>
          <Tag color="blue">Master Supplier</Tag>
        </Space>
      ),
    },
    {
      title: 'Kategori / Keterangan',
      dataIndex: 'category',
      key: 'category',
      render: (value, record) => (
        <Space direction="vertical" size={2}>
          <span>{value || '-'}</span>
          {getSupplierStoreLink(record) ? (
            <a href={getSupplierStoreLink(record)} target="_blank" rel="noreferrer">
              Buka Link Supplier
            </a>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Material Tersedia',
      key: 'materials',
      render: (_, record) => {
        const materialNames = record.supportedMaterialNames || [];
        if (!materialNames.length) return '-';

        return (
          <Space size={[4, 4]} wrap>
            {materialNames.slice(0, 2).map((name, index) => (
              <Tag key={`${name}-${index}`}>{name}</Tag>
            ))}
            {materialNames.length > 2 && <Tag>+{materialNames.length - 2}</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 280,
      render: (_, record) => {
        const isRowSyncing = syncingRowId === record.id;

        return (
          <Space wrap>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditSupplier(record)}
            >
              Edit
            </Button>
            <Button
              type="link"
              size="small"
              icon={<SyncOutlined />}
              loading={isRowSyncing}
              onClick={() => handleSyncSupplierMaterials(record)}
            >
              Sinkronkan Bahan
            </Button>
            <Popconfirm
              title="Yakin hapus supplier ini?"
              onConfirm={() => handleDeleteSupplier(record)}
              okText="Ya"
              cancelText="Batal"
            >
              <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                Hapus
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ marginBottom: 4 }}>Supplier</h2>
          {materialIdFromQuery && selectedMaterialFromQuery ? (
            <div style={{ color: '#666' }}>
              Menampilkan supplier untuk bahan: <strong>{selectedMaterialFromQuery.name}</strong>{' '}
              <Button
                type="link"
                size="small"
                onClick={() => navigate('/suppliers')}
                style={{ paddingInline: 4 }}
              >
                Reset Filter URL
              </Button>
            </div>
          ) : (
            <div style={{ color: '#666' }}>Daftar master supplier aktif</div>
          )}
        </div>

        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setModalVisible(true);
            setIsEditing(false);
            setEditingId(null);
            form.resetFields();
            form.setFieldsValue({
              materialDetails: [],
            });
          }}
        >
          Tambah Supplier
        </Button>
      </div>

      {/* -------------------------------------------------------------------
          Info singkat arah supplier final yang lebih sederhana.
      ------------------------------------------------------------------- */}
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Alur supplier disederhanakan"
        description="Buat supplier baru di sini, pilih bahan baku yang terkait, lalu sistem akan menyinkronkan supplier tersebut ke bahan baku yang dipilih."
      />

      {/* -------------------------------------------------------------------
          Filter supplier manual.
      ------------------------------------------------------------------- */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={10}>
          <Search
            placeholder="Cari nama supplier, kategori, bahan, atau link"
            allowClear
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
        </Col>

        <Col xs={24} md={6}>
          <Select
            placeholder="Filter kategori"
            allowClear
            value={categoryFilter}
            onChange={setCategoryFilter}
            style={{ width: '100%' }}
          >
            {categoryOptions.map((item) => (
              <Option key={item} value={item}>
                {item}
              </Option>
            ))}
          </Select>
        </Col>

        <Col xs={24} md={6}>
          <Select
            placeholder="Filter bahan"
            allowClear
            value={materialFilter}
            onChange={setMaterialFilter}
            style={{ width: '100%' }}
            showSearch
            optionFilterProp="children"
          >
            {materials.map((item) => (
              <Option key={item.id} value={item.id}>
                {item.name}
              </Option>
            ))}
          </Select>
        </Col>

        <Col xs={24} md={2}>
          <Button block onClick={resetManualFilters}>
            Reset
          </Button>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={filteredSuppliers}
        rowKey="id"
        locale={{
          emptyText: materialIdFromQuery ? (
            <Empty description="Belum ada supplier yang menyediakan bahan ini" />
          ) : (
            <Empty description="Belum ada data supplier" />
          ),
        }}
      />

      <Modal
        title={isEditing ? 'Edit Supplier' : 'Tambah Supplier'}
        open={modalVisible}
        onCancel={resetSupplierModalState}
        onOk={() => form.submit()}
        okText="Simpan"
        okButtonProps={{ loading: saving }}
        cancelText="Batal"
        width={820}
      >
        <Form form={form} layout="vertical" onFinish={handleSaveSupplier}>
          <Form.Item name="category" label="Kategori / Keterangan Supplier">
            <Input placeholder="Contoh: Supplier Flanel / Supplier Aksesoris" />
          </Form.Item>

          <Form.Item
            name="storeName"
            label="Nama Supplier / Toko"
            rules={[{ required: true, message: 'Nama supplier wajib diisi' }]}
          >
            <Input placeholder="Nama toko / supplier" />
          </Form.Item>

          <Form.Item name="storeLink" label="Link Toko">
            <Input placeholder="https://..." />
          </Form.Item>

          {/* -----------------------------------------------------------------
              Detail bahan yang dijual supplier.
              Data ini jadi dasar sinkronisasi supplier ke bahan baku terkait.
          ----------------------------------------------------------------- */}
          <Form.List name="materialDetails">
            {(fields, { add, remove }) => (
              <>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Material + Link Produk</div>

                {fields.map(({ key, name, ...restField }) => (
                  <div
                    key={key}
                    style={{
                      border: '1px solid #f0f0f0',
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 12,
                    }}
                  >
                    <Form.Item
                      {...restField}
                      name={[name, 'materialId']}
                      label="Bahan"
                      rules={[{ required: true, message: 'Pilih bahan' }]}
                    >
                      <Select placeholder="Pilih bahan baku" showSearch optionFilterProp="children">
                        {materials.map((item) => (
                          <Option key={item.id} value={item.id}>
                            {item.name}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>

                    <Form.Item {...restField} name={[name, 'productLink']} label="Link Produk">
                      <Input placeholder="https://link-produk-spesifik..." />
                    </Form.Item>

                    <Form.Item
                      {...restField}
                      name={[name, 'referencePrice']}
                      label="Harga Catatan"
                      extra="Opsional. Dipakai sebagai catatan harga supplier ini."
                    >
                      <InputNumber
                        min={0}
                        style={{ width: '100%' }}
                        addonBefore="Rp"
                        formatter={(value) => formatNumberID(value)}
                        parser={(value) => value?.replace(/\./g, '') || ''}
                      />
                    </Form.Item>

                    <Form.Item {...restField} name={[name, 'note']} label="Catatan">
                      <Input placeholder="Contoh: meteran / roll / warna tertentu" />
                    </Form.Item>

                    <Button danger onClick={() => remove(name)}>
                      Hapus Baris
                    </Button>
                  </div>
                ))}

                <Button
                  type="dashed"
                  block
                  icon={<PlusOutlined />}
                  onClick={() =>
                    add({
                      materialId: undefined,
                      productLink: '',
                      referencePrice: 0,
                      note: '',
                    })
                  }
                >
                  Tambah Material
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Drawer
        title={`Detail Supplier: ${getSupplierDisplayName(selectedSupplier || {}) || '-'}`}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setSelectedSupplier(null);
        }}
        width={820}
      >
        {selectedSupplier && (
          <>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginBottom: 24,
              }}
            >
              <tbody>
                <tr>
                  <td
                    style={{
                      width: 220,
                      padding: 10,
                      border: '1px solid #f0f0f0',
                    }}
                  >
                    Nama Supplier
                  </td>
                  <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>
                    {getSupplierDisplayName(selectedSupplier)}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>Sumber Data</td>
                  <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>Master supplier</td>
                </tr>
                <tr>
                  <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>
                    Kategori / Keterangan
                  </td>
                  <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>
                    {selectedSupplier.category || '-'}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>Link Toko</td>
                  <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>
                    {getSupplierStoreLink(selectedSupplier) ? (
                      <a
                        href={getSupplierStoreLink(selectedSupplier)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {getSupplierStoreLink(selectedSupplier)}
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>
                    Material Terdaftar
                  </td>
                  <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>
                    {(selectedSupplier.supportedMaterialNames || []).length ? (
                      <Space size={[6, 6]} wrap>
                        {(selectedSupplier.supportedMaterialNames || []).map((name, index) => (
                          <Tag key={`${name}-${index}`}>{name}</Tag>
                        ))}
                      </Space>
                    ) : (
                      'Belum ada material terdaftar'
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ fontWeight: 600, marginBottom: 12 }}>Detail Bahan & Link Produk</div>

            <Table
              rowKey={(record, index) => `${record.materialId || record.materialName || 'material'}-${index}`}
              pagination={false}
              dataSource={selectedSupplier.materialDetails || []}
              columns={[
                {
                  title: 'Bahan',
                  dataIndex: 'materialName',
                  render: (value) => value || '-',
                },
                {
                  title: 'Link Produk',
                  dataIndex: 'productLink',
                  render: (value) =>
                    value ? (
                      <a href={value} target="_blank" rel="noopener noreferrer">
                        Buka Link
                      </a>
                    ) : (
                      '-'
                    ),
                },
                {
                  title: 'Harga Catatan',
                  dataIndex: 'referencePrice',
                  render: (value) => (value ? formatCurrencyIDR(value) : '-'),
                },
                {
                  title: 'Catatan',
                  dataIndex: 'note',
                  render: (value) => value || '-',
                },
              ]}
            />
          </>
        )}
      </Drawer>
    </div>
  );
};

export default SupplierPurchases;
