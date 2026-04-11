import React, { useEffect, useMemo, useState } from "react";
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
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useLocation, useNavigate } from "react-router-dom";

const { Option } = Select;
const { Search } = Input;

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

const SupplierPurchases = () => {
  // SECTION: state utama
  const [suppliers, setSuppliers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // SECTION: state filter UI
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(undefined);
  const [materialFilter, setMaterialFilter] = useState(undefined);

  const [form] = Form.useForm();

  const location = useLocation();
  const navigate = useNavigate();

  // SECTION: baca materialId dari query URL
  const searchParams = new URLSearchParams(location.search);
  const materialIdFromQuery = searchParams.get("materialId");

  const selectedMaterialFromQuery = useMemo(() => {
    return materials.find((item) => item.id === materialIdFromQuery);
  }, [materials, materialIdFromQuery]);

  // SECTION: opsi kategori untuk filter dropdown
  const categoryOptions = useMemo(() => {
    const unique = [
      ...new Set(suppliers.map((item) => item.category).filter(Boolean)),
    ];
    return unique.sort((a, b) => a.localeCompare(b, "id-ID"));
  }, [suppliers]);

  // SECTION: sinkron supplier dan bahan baku dari firestore
  useEffect(() => {
    const unsubSuppliers = onSnapshot(
      collection(db, "supplierPurchases"),
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setSuppliers(data);
      },
    );

    const unsubMaterials = onSnapshot(
      collection(db, "raw_materials"),
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMaterials(data);
      },
    );

    return () => {
      unsubSuppliers();
      unsubMaterials();
    };
  }, []);

  // SECTION: filter supplier dari query URL + filter manual user
  const filteredSuppliers = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return suppliers
      .filter((supplier) => {
        if (!materialIdFromQuery) return true;
        return (supplier.supportedMaterialIds || []).includes(
          materialIdFromQuery,
        );
      })
      .filter((supplier) => {
        if (!materialFilter) return true;
        return (supplier.supportedMaterialIds || []).includes(materialFilter);
      })
      .filter((supplier) => {
        if (!categoryFilter) return true;
        return (supplier.category || "") === categoryFilter;
      })
      .filter((supplier) => {
        if (!keyword) return true;

        const searchableText = [
          supplier.storeName,
          supplier.category,
          supplier.storeLink,
          ...(supplier.supportedMaterialNames || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(keyword);
      })
      .sort((a, b) =>
        (a.storeName || "").localeCompare(b.storeName || "", "id-ID"),
      );
  }, [
    suppliers,
    materialIdFromQuery,
    materialFilter,
    categoryFilter,
    searchText,
  ]);

  // SECTION: reset filter UI manual
  const resetManualFilters = () => {
    setSearchText("");
    setCategoryFilter(undefined);
    setMaterialFilter(undefined);
  };

  // SECTION: simpan supplier baru / edit supplier
  const handleSaveSupplier = async (values) => {
    try {
      const materialDetails = (values.materialDetails || [])
        .filter((item) => item.materialId)
        .map((item) => {
          const selectedMaterial = materials.find(
            (m) => m.id === item.materialId,
          );

          return {
            materialId: item.materialId,
            materialName: selectedMaterial?.name || "",
            productLink: item.productLink || "",
            referencePrice: Math.round(Number(item.referencePrice || 0)),
            note: item.note || "",
          };
        });

      const payload = {
        category: values.category || "",
        storeName: values.storeName,
        storeLink: values.storeLink || "",
        supportedMaterialIds: materialDetails.map((item) => item.materialId),
        supportedMaterialNames: materialDetails.map(
          (item) => item.materialName,
        ),
        materialDetails,
      };

      if (isEditing) {
        await updateDoc(doc(db, "supplierPurchases", editingId), payload);
        message.success("Supplier berhasil diupdate!");
      } else {
        await addDoc(collection(db, "supplierPurchases"), payload);
        message.success("Supplier berhasil ditambahkan!");
      }

      setModalVisible(false);
      setIsEditing(false);
      setEditingId(null);
      form.resetFields();
    } catch (error) {
      console.error(error);
      message.error("Gagal menyimpan supplier.");
    }
  };

  // SECTION: isi modal saat edit supplier
  const handleEditSupplier = (record) => {
    setIsEditing(true);
    setEditingId(record.id);
    setModalVisible(true);

    form.setFieldsValue({
      category: record.category || "",
      storeName: record.storeName || "",
      storeLink: record.storeLink || "",
      materialDetails:
        (record.materialDetails || []).length > 0
          ? record.materialDetails.map((item) => ({
              materialId: item.materialId,
              productLink: item.productLink || "",
              referencePrice: Math.round(Number(item.referencePrice || 0)),
              note: item.note || "",
            }))
          : [],
    });
  };

  // SECTION: hapus supplier
  const handleDeleteSupplier = async (id) => {
    try {
      await deleteDoc(doc(db, "supplierPurchases", id));
      message.success("Supplier berhasil dihapus!");
    } catch (error) {
      console.error(error);
      message.error("Gagal menghapus supplier.");
    }
  };

  // SECTION: buka drawer detail supplier
  const openSupplierDrawer = (record) => {
    setSelectedSupplier(record);
    setDrawerVisible(true);
  };

  // SECTION: kolom tabel supplier
  const columns = [
    {
      title: "Nama Supplier",
      dataIndex: "storeName",
      key: "storeName",
      render: (text, record) => (
        <Button
          type="link"
          onClick={() => openSupplierDrawer(record)}
          style={{ padding: 0 }}
        >
          {text}
        </Button>
      ),
    },
    {
      title: "Kategori / Keterangan",
      dataIndex: "category",
      key: "category",
      render: (val) => val || "-",
    },
    {
      title: "Material Tersedia",
      key: "materials",
      render: (_, record) => {
        const names = record.supportedMaterialNames || [];
        if (!names.length) return "-";

        return (
          <Space size={[4, 4]} wrap>
            {names.slice(0, 2).map((name, index) => (
              <Tag key={index}>{name}</Tag>
            ))}
            {names.length > 2 && <Tag>+{names.length - 2}</Tag>}
          </Space>
        );
      },
    },
    {
      title: "Aksi",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditSupplier(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Yakin hapus supplier ini?"
            onConfirm={() => handleDeleteSupplier(record.id)}
            okText="Ya"
            cancelText="Batal"
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              Hapus
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ marginBottom: 4 }}>Supplier</h2>
          {materialIdFromQuery && selectedMaterialFromQuery ? (
            <div style={{ color: "#666" }}>
              Menampilkan supplier untuk bahan:{" "}
              <strong>{selectedMaterialFromQuery.name}</strong>{" "}
              <Button
                type="link"
                size="small"
                onClick={() => navigate("/suppliers")}
                style={{ paddingInline: 4 }}
              >
                Reset Filter URL
              </Button>
            </div>
          ) : (
            <div style={{ color: "#666" }}>Daftar semua supplier</div>
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

      {/* SECTION: filter supplier manual */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={10}>
          <Search
            placeholder="Cari nama supplier, kategori, bahan, atau link"
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </Col>

        <Col xs={24} md={6}>
          <Select
            placeholder="Filter kategori"
            allowClear
            value={categoryFilter}
            onChange={setCategoryFilter}
            style={{ width: "100%" }}
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
            style={{ width: "100%" }}
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
        title={isEditing ? "Edit Supplier" : "Tambah Supplier"}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setIsEditing(false);
          setEditingId(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText="Simpan"
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
            rules={[{ required: true, message: "Nama supplier wajib diisi" }]}
          >
            <Input placeholder="Nama toko / supplier" />
          </Form.Item>

          <Form.Item name="storeLink" label="Link Toko">
            <Input placeholder="https://..." />
          </Form.Item>

          {/* SECTION: detail bahan yang dijual supplier */}
          <Form.List name="materialDetails">
            {(fields, { add, remove }) => (
              <>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  Material + Link Produk
                </div>

                {fields.map(({ key, name, ...restField }) => (
                  <div
                    key={key}
                    style={{
                      border: "1px solid #f0f0f0",
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 12,
                    }}
                  >
                    <Form.Item
                      {...restField}
                      name={[name, "materialId"]}
                      label="Bahan"
                      rules={[{ required: true, message: "Pilih bahan" }]}
                    >
                      <Select
                        placeholder="Pilih bahan baku"
                        showSearch
                        optionFilterProp="children"
                      >
                        {materials.map((item) => (
                          <Option key={item.id} value={item.id}>
                            {item.name}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>

                    <Form.Item
                      {...restField}
                      name={[name, "productLink"]}
                      label="Link Produk"
                    >
                      <Input placeholder="https://link-produk-spesifik..." />
                    </Form.Item>

                    <Form.Item
                      {...restField}
                      name={[name, "referencePrice"]}
                      label="Harga Catatan"
                      extra="Opsional. Bisa dipakai untuk catatan harga supplier ini."
                    >
                      <InputNumber
                        min={0}
                        style={{ width: "100%" }}
                        addonBefore="Rp"
                        formatter={(value) => formatNumberID(value)}
                        parser={(value) => value?.replace(/\./g, "") || ""}
                      />
                    </Form.Item>

                    <Form.Item
                      {...restField}
                      name={[name, "note"]}
                      label="Catatan"
                    >
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
                      productLink: "",
                      referencePrice: 0,
                      note: "",
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
        title={`Detail Supplier: ${selectedSupplier?.storeName || "-"}`}
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
                width: "100%",
                borderCollapse: "collapse",
                marginBottom: 24,
              }}
            >
              <tbody>
                <tr>
                  <td
                    style={{
                      width: 220,
                      padding: 10,
                      border: "1px solid #f0f0f0",
                    }}
                  >
                    Nama Supplier
                  </td>
                  <td style={{ padding: 10, border: "1px solid #f0f0f0" }}>
                    {selectedSupplier.storeName || "-"}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: 10, border: "1px solid #f0f0f0" }}>
                    Kategori / Keterangan
                  </td>
                  <td style={{ padding: 10, border: "1px solid #f0f0f0" }}>
                    {selectedSupplier.category || "-"}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: 10, border: "1px solid #f0f0f0" }}>
                    Link Toko
                  </td>
                  <td style={{ padding: 10, border: "1px solid #f0f0f0" }}>
                    {selectedSupplier.storeLink ? (
                      <a
                        href={selectedSupplier.storeLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {selectedSupplier.storeLink}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: 10, border: "1px solid #f0f0f0" }}>
                    Material Terdaftar
                  </td>
                  <td style={{ padding: 10, border: "1px solid #f0f0f0" }}>
                    {(selectedSupplier.supportedMaterialNames || []).length ? (
                      <Space size={[6, 6]} wrap>
                        {(selectedSupplier.supportedMaterialNames || []).map(
                          (name, index) => (
                            <Tag key={index}>{name}</Tag>
                          ),
                        )}
                      </Space>
                    ) : (
                      "Belum ada material terdaftar"
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ fontWeight: 600, marginBottom: 12 }}>
              Detail Bahan & Link Produk
            </div>

            <Table
              rowKey={(record, index) => `${record.materialId}-${index}`}
              pagination={false}
              dataSource={selectedSupplier.materialDetails || []}
              columns={[
                {
                  title: "Bahan",
                  dataIndex: "materialName",
                  render: (value) => value || "-",
                },
                {
                  title: "Link Produk",
                  dataIndex: "productLink",
                  render: (value) =>
                    value ? (
                      <a href={value} target="_blank" rel="noopener noreferrer">
                        Buka Link
                      </a>
                    ) : (
                      "-"
                    ),
                },
                {
                  title: "Harga Catatan",
                  dataIndex: "referencePrice",
                  render: (value) => (value ? formatCurrencyIDR(value) : "-"),
                },
                {
                  title: "Catatan",
                  dataIndex: "note",
                  render: (value) => value || "-",
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
