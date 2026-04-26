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
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { formatNumberID } from '../../utils/formatters/numberId';
import { formatCurrencyIDR } from '../../utils/formatters/currencyId';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  cascadeSupplierSnapshotToRawMaterials,
  clearSupplierSnapshotFromRawMaterials,
  getSupplierDisplayName,
  getSupplierStoreLink,
  isManagedSupplierRecord,
  listenSuppliers,
} from '../../services/MasterData/suppliersService';

const { Option } = Select;
const { Search } = Input;

// -----------------------------------------------------------------------------
// Formatter final lintas aplikasi.
// ACTIVE / FINAL: supplier memakai helper shared agar format angka/Rupiah seragam.
// -----------------------------------------------------------------------------

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
  // Load master supplier dan referensi bahan baku dari Firestore.
  // ACTIVE: halaman Supplier membaca katalog vendor/restock dan hanya melakukan cascade snapshot terbatas saat supplier diedit atau dihapus.
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
  // ACTIVE: materialDetails disimpan sebagai katalog restock read-only untuk referensi, bukan untuk menulis otomatis ke raw material.
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
  // FUNGSI: menyimpan master vendor dan katalog restock di collection Supplier.
  // ALASAN: saat edit, snapshot nama/link di Raw Material yang sudah memilih
  // supplierId ini ikut diperbarui agar tampilan tetap konsisten dengan master.
  // STATUS: aktif; cascade ini hanya menyentuh snapshot supplierId yang cocok dan
  // tidak memasang supplier baru dari materialDetails.
  // ---------------------------------------------------------------------------
  const handleSaveSupplier = async (values) => {
    try {
      setSaving(true);

      const payload = buildSupplierPayload(values);

      if (isEditing && editingId) {
        await updateDoc(doc(db, 'supplierPurchases', editingId), payload);

        // -------------------------------------------------------------------
        // Cascade snapshot setelah edit master Supplier.
        // FUNGSI: memperbarui nama/link di Raw Material yang supplierId-nya sama.
        // ALASAN: jika cascade gagal, master Supplier tetap tersimpan dan user
        // diberi warning agar tidak salah mengira perubahan supplier gagal total.
        // STATUS: aktif; bukan kandidat cleanup selama snapshot supplier dipakai.
        // -------------------------------------------------------------------
        try {
          const affectedMaterials = await cascadeSupplierSnapshotToRawMaterials(editingId, {
            id: editingId,
            ...payload,
          });

          message.success(
            affectedMaterials > 0
              ? `Supplier berhasil diupdate. Snapshot ${affectedMaterials} bahan ikut diperbarui.`
              : 'Supplier berhasil diupdate.',
          );
        } catch (snapshotError) {
          console.error('Gagal memperbarui snapshot supplier di Raw Material.', snapshotError);
          message.warning('Supplier berhasil diupdate, tetapi snapshot bahan belum ikut diperbarui. Coba simpan ulang supplier.');
        }
      } else {
        await addDoc(collection(db, 'supplierPurchases'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        message.success('Supplier berhasil ditambahkan.');
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
  // Hapus supplier dari master dan bersihkan snapshot pada Raw Material terkait.
  // FUNGSI: Raw Material yang supplierId-nya sama tidak lagi menampilkan supplier
  // yang sudah dihapus dari master Supplier.
  // ALASAN: data supplier manual harus tetap konsisten, tetapi pembersihan hanya
  // dilakukan pada supplierId yang cocok agar tidak menimpa bahan lain.
  // STATUS: aktif; tidak mengubah stok, harga, purchase, atau katalog material.
  // ---------------------------------------------------------------------------
  const handleDeleteSupplier = async (record) => {
    if (!isManagedSupplierRecord(record)) {
      message.warning('Supplier ini bukan record master yang bisa dihapus dari halaman ini.');
      return;
    }

    try {
      await deleteDoc(doc(db, 'supplierPurchases', record.id));

      // -------------------------------------------------------------------
      // Clear snapshot setelah master Supplier dihapus.
      // FUNGSI: mengosongkan supplier di Raw Material yang masih menunjuk
      // supplierId yang sama.
      // ALASAN: jika clear gagal, supplier tetap sudah terhapus dan user diberi
      // warning agar data bahan bisa dicek ulang tanpa menyentuh stok/purchase.
      // STATUS: aktif; bukan kandidat cleanup selama delete Supplier perlu
      // membersihkan snapshot manual terkait.
      // -------------------------------------------------------------------
      try {
        const clearedMaterials = await clearSupplierSnapshotFromRawMaterials(record.id);

        message.success(
          clearedMaterials > 0
            ? `Supplier berhasil dihapus. Snapshot supplier di ${clearedMaterials} bahan ikut dibersihkan.`
            : 'Supplier berhasil dihapus dari master supplier.',
        );
      } catch (snapshotError) {
        console.error('Gagal membersihkan snapshot supplier di Raw Material.', snapshotError);
        message.warning('Supplier berhasil dihapus, tetapi snapshot di bahan belum ikut dibersihkan. Cek Raw Material terkait.');
      }
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
  // Kolom tabel supplier.
  // ---------------------------------------------------------------------------
  const columns = [
    {
      title: 'Nama Supplier',
      dataIndex: 'storeName',
      key: 'storeName',
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <span style={{ fontWeight: 600 }}>{getSupplierDisplayName(record)}</span>
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
              Buka Link Toko
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
      // ---------------------------------------------------------------------------
      // Kolom aksi supplier sekarang mengikuti baseline final.
      // Fungsi:
      // - Supplier Purchases diperlakukan sebagai detail-capable page karena sudah punya drawer detail read-only
      // - tombol Detail dipindah ke kolom aksi agar user tidak perlu menebak bahwa nama supplier bisa diklik
      // Status: aktif / final
      // ---------------------------------------------------------------------------
      title: 'Aksi',
      key: 'actions',
      width: 280,
      fixed: 'right',
      className: 'app-table-action-column',
      render: (_, record) => {
        return (
          <div className="ims-action-group">
            <Button
              className="ims-action-button"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openSupplierDrawer(record)}
            >
              Detail
            </Button>
            <Button
              className="ims-action-button"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditSupplier(record)}
            >
              Edit
            </Button>
            <Popconfirm
              title="Yakin hapus supplier ini?"
              onConfirm={() => handleDeleteSupplier(record)}
              okText="Ya"
              cancelText="Batal"
            >
              <Button className="ims-action-button" danger size="small" icon={<DeleteOutlined />}>
                Hapus
              </Button>
            </Popconfirm>
          </div>
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
          ACTIVE: wording ini mengunci bahwa Supplier hanya memperbarui/membersihkan snapshot bahan yang sudah memilih supplierId sama, bukan memasang supplier baru dari katalog material.
      ------------------------------------------------------------------- */}
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Supplier adalah katalog vendor/restock"
        description="Supplier menyimpan katalog barang untuk referensi restock. Supplier pada Raw Material tetap dipilih manual; jika master supplier diedit atau dihapus, hanya snapshot bahan yang sudah memilih supplier tersebut yang diperbarui/dibersihkan."
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

      {/* -----------------------------------------------------------------------
          Table supplier memakai class global agar tombol dan sticky column seragam.
      ----------------------------------------------------------------------- */}
      <Table
        className="app-data-table"
        columns={columns}
        dataSource={filteredSuppliers}
        rowKey="id"
        scroll={{ x: 1180 }}
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
              ACTIVE: data ini hanya katalog restock reference-only; tidak menulis otomatis ke raw material.
          ----------------------------------------------------------------- */}
          <Form.List name="materialDetails">
            {(fields, { add, remove }) => (
              <>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Katalog Material + Link Produk</div>

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
                      label="Harga Referensi Supplier"
                      extra="Opsional. Hanya sebagai referensi restock, bukan harga aktual pembelian."
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

            <div style={{ fontWeight: 600, marginBottom: 12 }}>Katalog Bahan & Link Produk Restock</div>

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
                  title: 'Harga Referensi Supplier',
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
