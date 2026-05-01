// src/Pages/MasterData/PricingRules.jsx

// SECTION: import React dan hooks
import React, { useEffect, useMemo, useState } from "react";

// SECTION: import komponen Ant Design
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Space,
  Tag,
  message,
  Popconfirm,
  Card,
  Row,
  Col,
  Statistic,
  Alert,
} from "antd";

// SECTION: import icon
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CheckOutlined,
} from "@ant-design/icons";

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
import { formatNumberID } from "../../utils/formatters/numberId";
import { formatCurrencyIDR } from "../../utils/formatters/currencyId";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";

// SECTION: import pricing service
import {
  normalizePricingRule,
  buildPricingPreview,
  buildPricingPreviewSummary,
  applyPricingRuleToItems,
} from "../../services/Pricing/pricingService";

// SECTION: alias komponen select
const { Option } = Select;
const { TextArea } = Input;

// SECTION: formatter final lintas aplikasi
// ACTIVE / FINAL: semua angka dan Rupiah di Pricing Rules memakai helper shared
// agar tidak ada lagi formatter lokal yang beda aturan.

// SECTION: label target type
const getTargetTypeLabel = (value) => {
  if (value === "products") return "Produk Jadi";
  return "Bahan Baku";
};

// SECTION: label base cost source
const getBaseCostSourceLabel = (value) => {
  const map = {
    averageActualUnitCost: "Modal Aktual Rata-rata",
    restockReferencePrice: "Harga Referensi Restock",
    hppPerUnit: "HPP per Unit",
  };

  return map[value] || value || "-";
};

// SECTION: meta status preview
const getPreviewStatusMeta = (status) => {
  if (status === "ready") {
    return { color: "green", label: "Siap Dihitung" };
  }

  if (status === "skipped_manual") {
    return { color: "orange", label: "Mode Manual - Dilewati" };
  }

  if (status === "invalid_base_cost") {
    return { color: "red", label: "Base Cost Kosong" };
  }

  if (status === "invalid_marketplace_buffer") {
    return { color: "magenta", label: "Buffer Marketplace Tidak Valid" };
  }

  if (status === "inactive_rule") {
    return { color: "default", label: "Rule Nonaktif" };
  }

  return { color: "default", label: status || "-" };
};

const PricingRules = () => {
  // SECTION: state data utama
  const [rules, setRules] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [products, setProducts] = useState([]);

  // SECTION: state loading tabel utama
  const [pageLoading, setPageLoading] = useState(true);

  // SECTION: state modal form rule
  const [form] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);

  // SECTION: state preview rule
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewRule, setPreviewRule] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);

  // SECTION: sinkron data pricing rules, bahan baku, dan produk
  useEffect(() => {
    setPageLoading(true);

    const unsubRules = onSnapshot(
      collection(db, "pricing_rules"),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setRules(data);
        setPageLoading(false);
      },
      (error) => {
        console.error("Gagal sinkron pricing rules:", error);
        message.error("Gagal memuat data pricing rules.");
        setPageLoading(false);
      },
    );

    const unsubRawMaterials = onSnapshot(
      collection(db, "raw_materials"),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setRawMaterials(data);
      },
      (error) => {
        console.error("Gagal sinkron raw materials:", error);
      },
    );

    const unsubProducts = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setProducts(data);
      },
      (error) => {
        console.error("Gagal sinkron products:", error);
      },
    );

    return () => {
      unsubRules();
      unsubRawMaterials();
      unsubProducts();
    };
  }, []);

  // SECTION: watch field target type agar pilihan base cost otomatis berubah
  const targetTypeValue = Form.useWatch("targetType", form);

  // SECTION: watch field include marketplace buffer
  const includeMarketplaceBufferValue = Form.useWatch(
    "includeMarketplaceBuffer",
    form,
  );

  // SECTION: opsi base cost dinamis sesuai target final yang disepakati
  const baseCostOptions = useMemo(() => {
    if (targetTypeValue === "products") {
      return [{ value: "hppPerUnit", label: "HPP per Unit" }];
    }

    return [
      {
        value: "averageActualUnitCost",
        label: "Modal Aktual Rata-rata",
      },
      {
        value: "restockReferencePrice",
        label: "Harga Referensi Restock",
      },
    ];
  }, [targetTypeValue]);

  // SECTION: ambil item target berdasarkan jenis rule
  const getTargetItems = (targetType) => {
    if (targetType === "products") {
      return products || [];
    }

    return rawMaterials || [];
  };

  // SECTION: reset state form
  const resetFormState = () => {
    form.resetFields();
    setIsEditing(false);
    setEditingRuleId(null);
    setSaveLoading(false);
  };

  // SECTION: buka modal tambah rule
  const openCreateModal = () => {
    resetFormState();
    setIsModalVisible(true);

    form.setFieldsValue({
      name: "",
      targetType: "raw_materials",
      isActive: true,
      baseCostSource: "averageActualUnitCost",
      marginType: "percent",
      marginValue: 30,
      includeMarketplaceBuffer: true,
      marketplaceBufferType: "percent",
      marketplaceBufferValue: 15,
      roundingType: "up",
      roundingUnit: 100,
    });
  };

  // SECTION: buka modal edit rule
  const openEditModal = (record) => {
    const normalizedRule = normalizePricingRule(record);

    resetFormState();
    setIsEditing(true);
    setEditingRuleId(record?.id || null);
    setIsModalVisible(true);

    form.setFieldsValue({
      name: normalizedRule.name || "",
      targetType: normalizedRule.targetType || "raw_materials",
      isActive: !!normalizedRule.isActive,
      baseCostSource: normalizedRule.baseCostSource,
      marginType: normalizedRule.marginType,
      marginValue: Number(normalizedRule.marginValue || 0),
      includeMarketplaceBuffer: !!normalizedRule.includeMarketplaceBuffer,
      marketplaceBufferType: normalizedRule.marketplaceBufferType,
      marketplaceBufferValue: Number(
        normalizedRule.marketplaceBufferValue || 0,
      ),
      roundingType: normalizedRule.roundingType,
      roundingUnit: Number(normalizedRule.roundingUnit || 100),
    });
  };

  // SECTION: tutup modal form
  const closeFormModal = () => {
    setIsModalVisible(false);
    resetFormState();
  };

  // SECTION: simpan rule baru atau edit rule
  const handleSaveRule = async (values) => {
    try {
      setSaveLoading(true);

      const normalizedTargetType = values?.targetType || "raw_materials";

      const payload = {
        name: values?.name || "",
        targetType: normalizedTargetType,
        isActive: !!values?.isActive,
        baseCostSource:
          values?.baseCostSource ||
          (normalizedTargetType === "products"
            ? "hppPerUnit"
            : "averageActualUnitCost"),
        marginType: values?.marginType || "percent",
        marginValue: Math.round(Number(values?.marginValue || 0)),
        includeMarketplaceBuffer: !!values?.includeMarketplaceBuffer,
        marketplaceBufferType: values?.marketplaceBufferType || "percent",
        marketplaceBufferValue: Math.round(
          Number(values?.marketplaceBufferValue || 0),
        ),
        roundingType: values?.roundingType || "up",
        roundingUnit: Math.round(Number(values?.roundingUnit || 100)),
        updatedAt: Timestamp.now(),
      };

      if (isEditing && editingRuleId) {
        await updateDoc(doc(db, "pricing_rules", editingRuleId), payload);
        message.success("Pricing rule berhasil diupdate.");
      } else {
        await addDoc(collection(db, "pricing_rules"), {
          ...payload,
          createdAt: Timestamp.now(),
        });
        message.success("Pricing rule berhasil ditambahkan.");
      }

      closeFormModal();
    } catch (error) {
      console.error("Gagal menyimpan pricing rule:", error);
      message.error("Gagal menyimpan pricing rule.");
    } finally {
      setSaveLoading(false);
    }
  };

  // SECTION: hapus rule
  const handleDeleteRule = async (ruleId) => {
    try {
      await deleteDoc(doc(db, "pricing_rules", ruleId));
      message.success("Pricing rule berhasil dihapus.");
    } catch (error) {
      console.error("Gagal menghapus pricing rule:", error);
      message.error("Gagal menghapus pricing rule.");
    }
  };

  // SECTION: buka preview rule
  const handlePreviewRule = async (rule) => {
    try {
      setPreviewLoading(true);

      const normalizedRule = normalizePricingRule(rule);
      const targetItems = getTargetItems(normalizedRule.targetType);
      const result = buildPricingPreview(targetItems, normalizedRule);

      setPreviewRule({
        ...normalizedRule,
        id: rule?.id || normalizedRule?.id || null,
      });
      setPreviewData(result);
      setPreviewVisible(true);
    } catch (error) {
      console.error("Gagal membuat preview pricing:", error);
      message.error("Gagal membuat preview pricing.");
    } finally {
      setPreviewLoading(false);
    }
  };

  // SECTION: tutup modal preview
  const closePreviewModal = () => {
    setPreviewVisible(false);
    setPreviewRule(null);
    setPreviewData([]);
    setPreviewLoading(false);
    setApplyLoading(false);
  };

  // SECTION: summary preview dari service agar sinkron dengan status terbaru
  const previewSummary = useMemo(() => {
    return buildPricingPreviewSummary(previewData || []);
  }, [previewData]);

  // SECTION: apply rule ke semua item target
  const handleApplyRule = async () => {
    if (!previewRule?.id) {
      message.warning("Rule preview belum valid atau belum dipilih.");
      return;
    }

    try {
      setApplyLoading(true);

      const targetItems = getTargetItems(previewRule.targetType);

      const result = await applyPricingRuleToItems({
        items: targetItems,
        rule: previewRule,
        targetType: previewRule.targetType,
        changeSource: "pricing_rule_apply",
        notes: `Apply rule: ${previewRule?.name || "-"}`,
      });

      setPreviewData(result?.previewData || []);

      const summary = result?.summary || {};

      message.success(
        `Apply selesai. Updated: ${formatNumberID(
          summary.updatedCount || 0,
        )}, Manual dilewati: ${formatNumberID(
          summary.skippedManualCount || 0,
        )}, Base cost kosong: ${formatNumberID(
          summary.invalidBaseCostCount || 0,
        )}, Buffer invalid: ${formatNumberID(
          summary.invalidMarketplaceBufferCount || 0,
        )}, Tidak berubah: ${formatNumberID(summary.unchangedCount || 0)}`,
      );
    } catch (error) {
      console.error("Gagal menerapkan pricing rule:", error);
      message.error("Gagal menerapkan pricing rule.");
    } finally {
      setApplyLoading(false);
    }
  };

  // SECTION: kolom tabel pricing rules
  const rulesColumns = [
    {
      title: "Nama Rule",
      dataIndex: "name",
      render: (value) => value || "-",
    },
    {
      title: "Target",
      dataIndex: "targetType",
      render: (value) => getTargetTypeLabel(value),
    },
    {
      title: "Base Cost",
      dataIndex: "baseCostSource",
      render: (value) => getBaseCostSourceLabel(value),
    },
    {
      title: "Margin",
      key: "margin",
      render: (_, record) => {
        if (record?.marginType === "nominal") {
          return formatCurrencyIDR(record?.marginValue || 0);
        }

        return `${formatNumberID(record?.marginValue || 0)}%`;
      },
    },
    {
      title: "Buffer Marketplace",
      key: "buffer",
      render: (_, record) => {
        if (!record?.includeMarketplaceBuffer) {
          return <Tag>Tidak Dipakai</Tag>;
        }

        if (record?.marketplaceBufferType === "nominal") {
          return (
            <Tag color="blue">
              {formatCurrencyIDR(record?.marketplaceBufferValue || 0)}
            </Tag>
          );
        }

        return (
          <Tag color="blue">
            {formatNumberID(record?.marketplaceBufferValue || 0)}%
          </Tag>
        );
      },
    },
    {
      title: "Pembulatan",
      key: "rounding",
      render: (_, record) => {
        return `${String(record?.roundingType || "up").toUpperCase()} / ${formatNumberID(
          record?.roundingUnit || 0,
        )}`;
      },
    },
    {
      // =========================
      // SECTION: status sticky
      // Fungsi:
      // - menjaga status rule tetap terlihat saat tabel pricing digeser ke kanan
      // =========================
      title: "Status",
      dataIndex: "isActive",
      key: "isActive",
      width: 128,
      fixed: "right",
      className: "app-table-status-column app-table-fixed-secondary",
      render: (value) =>
        value ? <Tag color="green">Aktif</Tag> : <Tag>Nonaktif</Tag>,
    },
    {
      // =========================
      // SECTION: aksi sticky
      // Fungsi:
      // - Pricing Rules dianggap detail-capable karena modal preview sekarang diposisikan sebagai detail rule + simulasi dampaknya
      // - label Preview diganti menjadi Detail agar tidak membuat variasi aksi liar di luar baseline final
      // Status: aktif / final
      // =========================
      title: "Aksi",
      key: "actions",
      width: 240,
      fixed: "right",
      className: "app-table-action-column",
      render: (_, record) => (
        <div className="ims-action-group">
          <Button
            className="ims-action-button"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handlePreviewRule(record)}
          >
            Detail
          </Button>

          <Button className="ims-action-button" size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
            Edit
          </Button>

          <Popconfirm
            title="Hapus pricing rule?"
            description="Rule yang dihapus tidak bisa dikembalikan."
            okText="Ya"
            cancelText="Batal"
            onConfirm={() => handleDeleteRule(record?.id)}
          >
            <Button className="ims-action-button" size="small" danger icon={<DeleteOutlined />}>
              Hapus
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  // SECTION: kolom tabel preview item
  const previewColumns = [
    {
      title: "Nama Item",
      dataIndex: "itemName",
      render: (value) => value || "-",
      fixed: "left",
      width: 220,
    },
    {
      title: "Mode",
      dataIndex: "pricingMode",
      width: 120,
      render: (value) =>
        value === "manual" ? (
          <Tag color="orange">Manual</Tag>
        ) : (
          <Tag color="green">Rule</Tag>
        ),
    },
    {
      title: "Harga Lama",
      dataIndex: "currentPrice",
      width: 140,
      render: (value) => formatCurrencyIDR(value || 0),
    },
    {
      title: "Base Cost",
      dataIndex: "baseCost",
      width: 140,
      render: (value) =>
        Number(value || 0) > 0 ? formatCurrencyIDR(value) : "-",
    },
    {
      title: "Margin",
      dataIndex: "marginAmount",
      width: 140,
      render: (value) =>
        Number(value || 0) > 0 ? formatCurrencyIDR(value) : "-",
    },
    {
      title: "Buffer",
      dataIndex: "marketplaceBufferAmount",
      width: 140,
      render: (value) =>
        Number(value || 0) > 0 ? formatCurrencyIDR(value) : "-",
    },
    {
      title: "Harga Hitung",
      dataIndex: "finalBeforeRounding",
      width: 150,
      render: (value) =>
        Number(value || 0) > 0 ? formatCurrencyIDR(value) : "-",
    },
    {
      title: "Harga Baru",
      dataIndex: "roundedPrice",
      width: 140,
      render: (value) => formatCurrencyIDR(value || 0),
    },
    {
      title: "Update?",
      key: "willUpdate",
      width: 120,
      render: (_, record) =>
        record?.willUpdate ? <Tag color="blue">Ya</Tag> : <Tag>Tidak</Tag>,
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 220,
      render: (value) => {
        const meta = getPreviewStatusMeta(value);

        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
  ];

  const summaryItems = [
    {
      key: "pricing-rules-total",
      title: "Total Pricing Rules",
      value: rules.length,
      subtitle: "Semua rule harga yang tersimpan di master pricing.",
      accent: "primary",
    },
    {
      key: "pricing-rules-active",
      title: "Rule Aktif",
      value: rules.filter((item) => item?.isActive).length,
      subtitle: "Rule yang masih aktif dipakai untuk preview dan apply.",
      accent: "success",
    },
    {
      key: "pricing-rules-targets",
      title: "Target Item Tersedia",
      value: rawMaterials.length + products.length,
      subtitle: "Gabungan bahan baku dan produk jadi yang bisa jadi target rule.",
      accent: "warning",
    },
  ];

  return (
    <div className="page-container">
      <PageHeader
        title="Pricing Rules"
        subtitle="Aturan harga jual otomatis untuk bahan baku dan produk jadi, tanpa mengubah item yang masih memakai mode manual."
        actions={[
          {
            key: "create-pricing-rule",
            type: "primary",
            icon: <PlusOutlined />,
            label: "Tambah Rule",
            onClick: openCreateModal,
          },
        ]}
      />

      {/* SECTION: informasi penting aturan pricing */}
      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="Harga dihitung dari base cost + margin + buffer marketplace + pembulatan. Item dengan pricingMode manual akan dilewati saat apply."
      />

      <SummaryStatGrid items={summaryItems} columns={{ xs: 24, md: 8 }} />

      {/* SECTION: tabel pricing rules */}
      <PageSection
        title="Daftar Pricing Rules"
        subtitle="Rule tetap menjadi layer pricing. Apply rule hanya memengaruhi item yang memang memakai mode rule."
      >
        {/* SECTION: tabel utama pricing rule memakai foundation global supaya seragam */}
        <Table
          className="app-data-table"
          rowKey="id"
          loading={pageLoading}
          dataSource={rules}
          columns={rulesColumns}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1200 }}
        />
      </PageSection>

      {/* SECTION: modal tambah / edit rule */}
      <Modal
        title={isEditing ? "Edit Pricing Rule" : "Tambah Pricing Rule"}
        open={isModalVisible}
        onCancel={closeFormModal}
        onOk={() => form.submit()}
        okText="Simpan"
        cancelText="Batal"
        confirmLoading={saveLoading}
        width={760}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSaveRule}>
          {/* SECTION: nama dan target rule */}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Nama Rule"
                name="name"
                rules={[{ required: true, message: "Nama rule wajib diisi." }]}
              >
                <Input placeholder="Contoh: Rule Shopee Bahan Baku" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Target Type"
                name="targetType"
                rules={[
                  { required: true, message: "Target type wajib dipilih." },
                ]}
              >
                <Select
                  onChange={(value) => {
                    form.setFieldsValue({
                      baseCostSource:
                        value === "products"
                          ? "hppPerUnit"
                          : "averageActualUnitCost",
                    });
                  }}
                >
                  <Option value="raw_materials">Raw Materials</Option>
                  <Option value="products">Products</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* SECTION: status aktif */}
          <Form.Item
            label="Status Aktif"
            name="isActive"
            valuePropName="checked"
          >
            <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
          </Form.Item>

          {/* SECTION: sumber biaya dasar */}
          <Form.Item
            label="Base Cost Source"
            name="baseCostSource"
            rules={[
              { required: true, message: "Base cost source wajib dipilih." },
            ]}
          >
            <Select>
              {baseCostOptions.map((item) => (
                <Option key={item.value} value={item.value}>
                  {item.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* SECTION: margin */}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Margin Type"
                name="marginType"
                rules={[
                  { required: true, message: "Margin type wajib dipilih." },
                ]}
              >
                <Select>
                  <Option value="percent">Persen</Option>
                  <Option value="nominal">Nominal</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Margin Value"
                name="marginValue"
                rules={[
                  { required: true, message: "Margin value wajib diisi." },
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

          {/* SECTION: pengaturan buffer marketplace */}
          <Form.Item
            label="Gunakan Buffer Marketplace"
            name="includeMarketplaceBuffer"
            valuePropName="checked"
          >
            <Switch checkedChildren="Ya" unCheckedChildren="Tidak" />
          </Form.Item>

          {includeMarketplaceBufferValue && (
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Marketplace Buffer Type"
                  name="marketplaceBufferType"
                  rules={[
                    {
                      required: true,
                      message: "Marketplace buffer type wajib dipilih.",
                    },
                  ]}
                >
                  <Select>
                    <Option value="percent">Persen</Option>
                    <Option value="nominal">Nominal</Option>
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  label="Marketplace Buffer Value"
                  name="marketplaceBufferValue"
                  rules={[
                    {
                      required: true,
                      message: "Marketplace buffer value wajib diisi.",
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
          )}

          {/* SECTION: pengaturan pembulatan */}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Rounding Type"
                name="roundingType"
                rules={[
                  { required: true, message: "Rounding type wajib dipilih." },
                ]}
              >
                <Select>
                  <Option value="up">Naik (Up)</Option>
                  <Option value="nearest">Terdekat (Nearest)</Option>
                  <Option value="down">Turun (Down)</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Rounding Unit"
                name="roundingUnit"
                rules={[
                  { required: true, message: "Rounding unit wajib diisi." },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={1}
                  formatter={(value) => formatNumberID(value)}
                  parser={(value) => value?.replace(/\./g, "") || ""}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* SECTION: catatan bantuan */}
          <Alert
            type="warning"
            showIcon
            message="Untuk raw materials gunakan averageActualUnitCost sebagai source utama. Untuk products gunakan hppPerUnit sebagai source utama."
          />
        </Form>
      </Modal>

      {/* SECTION: modal preview pricing */}
      <Modal
        title={`Detail Pricing Rule${
          previewRule?.name ? ` - ${previewRule.name}` : ""
        }`}
        open={previewVisible}
        onCancel={closePreviewModal}
        footer={[
          <Button key="close" onClick={closePreviewModal}>
            Tutup
          </Button>,
          <Button
            key="apply"
            type="primary"
            icon={<CheckOutlined />}
            loading={applyLoading}
            onClick={handleApplyRule}
          >
            Terapkan Rule
          </Button>,
        ]}
        width={1280}
        destroyOnClose
      >
        {/* SECTION: info preview */}
        <Alert
          style={{ marginBottom: 16 }}
          type="info"
          showIcon
          message="Detail rule ini juga menampilkan preview dampak harga pada item terkait. Item dengan mode manual akan dilewati. Item dengan base cost kosong atau buffer marketplace tidak valid tidak akan diupdate."
        />

        {/* SECTION: ringkasan preview */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={4}>
            <Card>
              <Statistic title="Total Item" value={previewSummary.totalItems} />
            </Card>
          </Col>

          <Col xs={24} md={4}>
            <Card>
              <Statistic title="Ready" value={previewSummary.readyCount} />
            </Card>
          </Col>

          <Col xs={24} md={4}>
            <Card>
              <Statistic
                title="Akan Berubah"
                value={previewSummary.willUpdateCount}
              />
            </Card>
          </Col>

          <Col xs={24} md={4}>
            <Card>
              <Statistic
                title="Manual"
                value={previewSummary.skippedManualCount}
              />
            </Card>
          </Col>

          <Col xs={24} md={4}>
            <Card>
              <Statistic
                title="Base Cost Invalid"
                value={previewSummary.invalidBaseCostCount}
              />
            </Card>
          </Col>

          <Col xs={24} md={4}>
            <Card>
              <Statistic
                title="Buffer Invalid"
                value={previewSummary.invalidMarketplaceBufferCount}
              />
            </Card>
          </Col>
        </Row>

        {/* SECTION: tabel preview */}
        <Table
          rowKey="itemId"
          loading={previewLoading}
          dataSource={previewData}
          columns={previewColumns}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1500 }}
        />
      </Modal>
    </div>
  );
};

export default PricingRules;
