// src/Pages/MasterData/RawMaterials.jsx

// SECTION: import React dan hooks
import React, { useEffect, useMemo, useState } from "react";

// SECTION: import komponen Ant Design
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Space,
  Popconfirm,
  message,
  Select,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Alert,
} from "antd";

// SECTION: import icon
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";

// SECTION: import firestore helper
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";

// SECTION: import firebase db
import { db } from "../../firebase";

// SECTION: import link router
import { Link } from "react-router-dom";

// SECTION: import dayjs untuk format tanggal
import dayjs from "dayjs";

// SECTION: alias Select Option
const { Option } = Select;

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

// SECTION: daftar satuan stok
const unitOptions = ["pcs", "meter", "yard", "kg", "gram", "liter", "ml"];

// SECTION: helper tag mode pricing
const renderPricingModeTag = (mode) => {
  if (mode === "manual") {
    return <Tag color="orange">Manual</Tag>;
  }

  return <Tag color="green">Rule</Tag>;
};

// SECTION: helper tag status stok
const renderStockStatusTag = (stock, minStock) => {
  const numericStock = Number(stock || 0);
  const numericMinStock = Number(minStock || 0);

  if (numericStock <= 0) {
    return <Tag color="red">Habis</Tag>;
  }

  if (numericMinStock > 0 && numericStock <= numericMinStock) {
    return <Tag color="gold">Minimum</Tag>;
  }

  return <Tag color="green">Aman</Tag>;
};

const RawMaterials = () => {
  // SECTION: state data utama
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [loading, setLoading] = useState(false);

  // SECTION: state modal/form
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [currentStockValue, setCurrentStockValue] = useState(0);
  const [form] = Form.useForm();

  // SECTION: ambil semua data realtime
  useEffect(() => {
    setLoading(true);

    // SECTION: ambil bahan baku realtime
    const unsubMaterials = onSnapshot(
      collection(db, "raw_materials"),
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setMaterials(data);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        message.error("Gagal memuat bahan baku.");
        setLoading(false);
      },
    );

    // SECTION: ambil supplier realtime
    const unsubSuppliers = onSnapshot(
      collection(db, "supplierPurchases"),
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setSuppliers(data);
      },
      (error) => {
        console.error(error);
        message.error("Gagal memuat supplier.");
      },
    );

    // SECTION: ambil pricing rules khusus raw materials
    const unsubPricingRules = onSnapshot(
      collection(db, "pricing_rules"),
      (snapshot) => {
        const data = snapshot.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
          }))
          .filter((item) => item?.targetType === "raw_materials");

        setPricingRules(data);
      },
      (error) => {
        console.error(error);
        message.error("Gagal memuat pricing rules.");
      },
    );

    return () => {
      unsubMaterials();
      unsubSuppliers();
      unsubPricingRules();
    };
  }, []);

  // SECTION: watch pricing mode
  const pricingModeValue = Form.useWatch("pricingMode", form);

  // SECTION: map nama pricing rule
  const pricingRuleMap = useMemo(() => {
    const map = {};

    (pricingRules || []).forEach((item) => {
      map[item.id] = item.name;
    });

    return map;
  }, [pricingRules]);

  // SECTION: helper hitung jumlah supplier yang menyediakan bahan
  const getSupplierCountForMaterial = (materialId) => {
    return (suppliers || []).filter((supplier) =>
      (supplier?.supportedMaterialIds || []).includes(materialId),
    ).length;
  };

  // SECTION: buka modal tambah
  const openCreateModal = () => {
    setModalVisible(true);
    setIsEditing(false);
    setEditingId(null);
    setCurrentStockValue(0);
    form.resetFields();

    form.setFieldsValue({
      name: "",
      supplierId: null,
      stockUnit: "pcs",
      stock: 0,
      minStock: 0,
      restockReferencePrice: 0,
      averageActualUnitCost: 0,
      sellingPrice: 0,
      pricingMode: "rule",
      pricingRuleId: null,
    });
  };

  // SECTION: tutup modal
  const closeModal = () => {
    setModalVisible(false);
    setIsEditing(false);
    setEditingId(null);
    setCurrentStockValue(0);
    form.resetFields();
  };

  // SECTION: simpan bahan baku
  const handleSaveMaterial = async (values) => {
    try {
      const selectedSupplier = (suppliers || []).find(
        (s) => s.id === values.supplierId,
      );

      const payload = {
        name: values.name || "",
        supplierId: values.supplierId || null,
        supplierName: selectedSupplier?.storeName || null,
        supplierLink: selectedSupplier?.storeLink || null,
        stockUnit: values.stockUnit || "pcs",
        minStock: Math.round(Number(values.minStock || 0)),

        // SECTION: field stok referensi dan pricing
        restockReferencePrice: Math.round(
          Number(values.restockReferencePrice || 0),
        ),
        averageActualUnitCost: Math.round(
          Number(values.averageActualUnitCost || 0),
        ),
        sellingPrice: Math.round(Number(values.sellingPrice || 0)),
        pricingMode: values.pricingMode || "rule",
        pricingRuleId:
          values.pricingMode === "rule" ? values.pricingRuleId || null : null,

        // SECTION: update timestamp pricing manual
        lastPricingUpdatedAt:
          values.pricingMode === "manual" ? Timestamp.now() : null,
      };

      // RULE:
      // stok master hanya boleh diisi saat create awal
      if (isEditing) {
        await updateDoc(doc(db, "raw_materials", editingId), payload);
        message.success("Bahan baku berhasil diupdate.");
      } else {
        await addDoc(collection(db, "raw_materials"), {
          ...payload,
          stock: Math.round(Number(values.stock || 0)),
          createdAt: Timestamp.now(),
        });
        message.success("Bahan baku berhasil ditambahkan.");
      }

      closeModal();
    } catch (error) {
      console.error(error);
      message.error("Gagal menyimpan bahan baku.");
    }
  };

  // SECTION: hapus bahan baku
  const handleDeleteMaterial = async (id) => {
    try {
      await deleteDoc(doc(db, "raw_materials", id));
      message.success("Bahan baku berhasil dihapus.");
    } catch (error) {
      console.error(error);
      message.error("Gagal menghapus bahan baku.");
    }
  };

  // SECTION: edit bahan baku
  const handleEditMaterial = (record) => {
    setIsEditing(true);
    setModalVisible(true);
    setEditingId(record.id);
    setCurrentStockValue(Math.round(Number(record.stock || 0)));

    form.setFieldsValue({
      name: record.name || "",
      supplierId: record.supplierId || null,
      stockUnit: record.stockUnit || "pcs",
      stock: Math.round(Number(record.stock || 0)),
      minStock: Math.round(Number(record.minStock || 0)),
      restockReferencePrice: Math.round(
        Number(record.restockReferencePrice || 0),
      ),
      averageActualUnitCost: Math.round(
        Number(record.averageActualUnitCost || 0),
      ),
      sellingPrice: Math.round(Number(record.sellingPrice || 0)),
      pricingMode: record.pricingMode || "rule",
      pricingRuleId: record.pricingRuleId || null,
    });
  };

  // SECTION: kolom tabel
  const columns = [
    {
      title: "Nama Bahan Baku",
      dataIndex: "name",
      key: "name",
      width: 220,
    },
    {
      title: "Satuan",
      dataIndex: "stockUnit",
      key: "stockUnit",
      width: 100,
      render: (val) => val || "-",
    },
    {
      title: "Stok",
      dataIndex: "stock",
      key: "stock",
      width: 110,
      render: (val) => formatNumberID(val),
    },
    {
      title: "Min.",
      dataIndex: "minStock",
      key: "minStock",
      width: 100,
      render: (val) => formatNumberID(val),
    },
    {
      title: "Harga Referensi Restock",
      dataIndex: "restockReferencePrice",
      key: "restockReferencePrice",
      width: 190,
      render: (val, record) => (
        <span>
          {formatCurrencyIDR(val)} / {record.stockUnit || "-"}
        </span>
      ),
    },
    {
      title: "Modal Aktual Rata-rata",
      dataIndex: "averageActualUnitCost",
      key: "averageActualUnitCost",
      width: 190,
      render: (val, record) => (
        <span>
          {val ? formatCurrencyIDR(val) : "-"} / {record.stockUnit || "-"}
        </span>
      ),
    },
    {
      title: "Harga Jual",
      dataIndex: "sellingPrice",
      key: "sellingPrice",
      width: 170,
      render: (val, record) => (
        <span>
          {formatCurrencyIDR(val)} / {record.stockUnit || "-"}
        </span>
      ),
    },
    {
      title: "Mode Pricing",
      dataIndex: "pricingMode",
      key: "pricingMode",
      width: 130,
      render: (val) => renderPricingModeTag(val),
    },
    {
      title: "Rule Pricing",
      dataIndex: "pricingRuleId",
      key: "pricingRuleId",
      width: 190,
      render: (val) => pricingRuleMap[val] || "-",
    },
    {
      title: "Update Pricing",
      dataIndex: "lastPricingUpdatedAt",
      key: "lastPricingUpdatedAt",
      width: 170,
      render: (val) =>
        val?.toDate ? dayjs(val.toDate()).format("DD-MM-YYYY HH:mm") : "-",
    },
    {
      title: "Supplier",
      key: "supplierAction",
      width: 170,
      render: (_, record) => {
        const supplierCount = getSupplierCountForMaterial(record.id);

        return (
          <Space direction="vertical" size={0}>
            <Link to={`/suppliers`}>Lihat Supplier</Link>
            <span style={{ color: "#666", fontSize: 12 }}>
              {formatNumberID(supplierCount)} supplier
            </span>
          </Space>
        );
      },
    },
    {
      title: "Status",
      key: "stockStatus",
      width: 120,
      render: (_, record) =>
        renderStockStatusTag(record?.stock, record?.minStock),
    },
    {
      title: "Aksi",
      key: "actions",
      width: 150,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => handleEditMaterial(record)}>
            Edit
          </Button>

          <Popconfirm
            title="Hapus bahan baku?"
            description="Data yang dihapus tidak bisa dikembalikan."
            okText="Ya"
            cancelText="Batal"
            onConfirm={() => handleDeleteMaterial(record.id)}
          >
            <Button danger size="small">
              Hapus
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* SECTION: header halaman */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Raw Materials</h2>
          <p style={{ margin: "8px 0 0 0", color: "#666" }}>
            Master bahan baku dengan dukungan mode pricing manual dan rule
          </p>
        </div>

        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreateModal}
        >
          Tambah Bahan Baku
        </Button>
      </div>

      {/* SECTION: info aturan */}
      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="Harga jual bahan baku bisa diatur manual atau mengikuti Pricing Rules. Stok master tidak boleh diubah saat edit, kecuali melalui penyesuaian stok."
      />

      {/* SECTION: ringkasan data */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Total Bahan Baku" value={materials.length} />
          </Card>
        </Col>

        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Mode Rule"
              value={
                materials.filter((item) => item?.pricingMode !== "manual")
                  .length
              }
            />
          </Card>
        </Col>

        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Mode Manual"
              value={
                materials.filter((item) => item?.pricingMode === "manual")
                  .length
              }
            />
          </Card>
        </Col>

        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Rule Tersedia"
              value={pricingRules.filter((item) => item?.isActive).length}
            />
          </Card>
        </Col>
      </Row>

      {/* SECTION: tabel bahan baku */}
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={materials}
          columns={columns}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1700 }}
        />
      </Card>

      {/* SECTION: modal form bahan baku */}
      <Modal
        title={isEditing ? "Edit Bahan Baku" : "Tambah Bahan Baku"}
        open={modalVisible}
        onCancel={closeModal}
        onOk={() => form.submit()}
        okText="Simpan"
        cancelText="Batal"
        width={760}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSaveMaterial}>
          {/* SECTION: nama dan supplier */}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label="Nama Bahan Baku"
                rules={[
                  { required: true, message: "Nama bahan baku wajib diisi." },
                ]}
              >
                <Input placeholder="Contoh: Kain flanel merah" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item name="supplierId" label="Supplier">
                <Select
                  allowClear
                  placeholder="Pilih supplier"
                  optionFilterProp="children"
                  showSearch
                >
                  {(suppliers || []).map((supplier) => (
                    <Option key={supplier.id} value={supplier.id}>
                      {(supplier.item ? `${supplier.item} - ` : "") +
                        (supplier.storeName || "-")}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* SECTION: satuan dan stok */}
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="stockUnit"
                label="Satuan Stok"
                rules={[
                  { required: true, message: "Satuan stok wajib dipilih." },
                ]}
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
              <Form.Item
                name="stock"
                label={
                  isEditing
                    ? `Stok Saat Ini (${formatNumberID(currentStockValue)})`
                    : "Stok Awal"
                }
                extra={
                  isEditing
                    ? "Saat edit, stok master tidak boleh diubah manual. Gunakan penyesuaian stok."
                    : "Stok awal hanya untuk setup awal item."
                }
              >
                <InputNumber
                  disabled={isEditing}
                  style={{ width: "100%" }}
                  min={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={(value) => value?.replace(/\./g, "") || ""}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="minStock"
                label="Minimum Stok"
                rules={[
                  { required: true, message: "Minimum stok wajib diisi." },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={(value) => value?.replace(/\./g, "") || ""}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* SECTION: harga referensi dan modal aktual */}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="restockReferencePrice"
                label="Harga Referensi Restock / Satuan"
                rules={[
                  {
                    required: true,
                    message: "Harga referensi restock wajib diisi.",
                  },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={(value) => value?.replace(/\./g, "") || ""}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="averageActualUnitCost"
                label="Modal Aktual Rata-rata / Satuan"
                rules={[
                  {
                    required: true,
                    message: "Modal aktual rata-rata wajib diisi.",
                  },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={(value) => value?.replace(/\./g, "") || ""}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* SECTION: mode pricing */}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="pricingMode"
                label="Mode Pricing"
                rules={[
                  { required: true, message: "Mode pricing wajib dipilih." },
                ]}
              >
                <Select
                  onChange={(value) => {
                    if (value === "manual") {
                      form.setFieldsValue({
                        pricingRuleId: null,
                      });
                    }
                  }}
                >
                  <Option value="rule">Rule</Option>
                  <Option value="manual">Manual</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="pricingRuleId"
                label="Pricing Rule"
                rules={[
                  {
                    required: pricingModeValue === "rule",
                    message: "Pricing rule wajib dipilih untuk mode rule.",
                  },
                ]}
              >
                <Select
                  allowClear
                  disabled={pricingModeValue !== "rule"}
                  placeholder="Pilih pricing rule"
                >
                  {(pricingRules || []).map((rule) => (
                    <Option key={rule.id} value={rule.id}>
                      {rule.name}
                      {rule?.isActive ? "" : " (Nonaktif)"}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* SECTION: harga jual */}
          <Form.Item
            name="sellingPrice"
            label="Harga Jual / Satuan"
            extra={
              pricingModeValue === "rule"
                ? "Pada mode rule, field ini tetap disimpan sebagai harga master terakhir hasil rule/apply."
                : "Pada mode manual, harga ini akan menjadi harga jual aktif item."
            }
            rules={[{ required: true, message: "Harga jual wajib diisi." }]}
          >
            <InputNumber
              style={{ width: "100%" }}
              min={0}
              formatter={(value) => formatNumberID(value)}
              parser={(value) => value?.replace(/\./g, "") || ""}
            />
          </Form.Item>

          {/* SECTION: bantuan */}
          <Alert
            type="warning"
            showIcon
            message="Kalau item pakai mode rule, harga akan ikut Pricing Rules saat rule diterapkan. Kalau pakai mode manual, item ini akan dilewati saat apply rule."
          />
        </Form>
      </Modal>
    </div>
  );
};

export default RawMaterials;
