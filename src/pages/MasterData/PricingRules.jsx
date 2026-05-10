// src/Pages/MasterData/PricingRules.jsx

// SECTION: import hooks React
import { useEffect, useMemo, useState } from "react";
import { DataRefreshIndicator, getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";

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
  Tag,
  message,
  Popconfirm,
  Card,
  Row,
  Col,
  Statistic,
  Alert,
  Typography,
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
import { formatNumberID, parseIntegerIdInput } from "../../utils/formatters/numberId";
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

// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data lama decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema Firestore tetap sama.

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

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

  /* =====================================================
  SECTION: Kolom Pricing Rules compact — AKTIF / GUARDED
  Fungsi:
  - Merapikan table utama rule pricing tanpa fixed right dan tanpa horizontal scroll wajib.
  - Menggabungkan target/base cost serta formula margin/buffer/pembulatan agar jumlah kolom lebih sedikit.

  Dipakai oleh:
  - Halaman Master Data / Pricing Rules table utama.

  Alasan perubahan:
  - Detail simulasi dampak rule sudah berada di modal Detail; table utama cukup menjadi list ringkas dan action entry point.

  Catatan cleanup:
  - Preview modal masih memakai table lebar karena berisi breakdown perhitungan; itu bukan target compact main table batch ini.

  Risiko:
  - Jangan mengubah normalizePricingRule, buildPricingPreview, applyPricingRuleToItems, atau guard item manual dari section UI ini.
  ===================================================== */
  const rulesColumns = [
    {
      title: "Rule",
      dataIndex: "name",
      width: "24%",
      render: (value, record) => (
        <div className="ims-cell-stack ims-cell-stack-tight">
          <Text strong>{value || "-"}</Text>
          <Text type="secondary" className="ims-cell-meta">
            {record?.description || "Tidak ada deskripsi"}
          </Text>
        </div>
      ),
    },
    {
      title: "Target / Base",
      key: "targetBase",
      width: "22%",
      render: (_, record) => (
        <div className="ims-cell-stack ims-cell-stack-tight">
          <Tag color={record?.targetType === "products" ? "blue" : "gold"}>
            {getTargetTypeLabel(record?.targetType)}
          </Tag>
          <Text type="secondary" className="ims-cell-meta">
            {getBaseCostSourceLabel(record?.baseCostSource)}
          </Text>
        </div>
      ),
    },
    {
      title: "Formula",
      key: "formula",
      width: "30%",
      render: (_, record) => {
        const marginText = record?.marginType === "nominal"
          ? formatCurrencyIDR(record?.marginValue || 0)
          : `${formatNumberID(record?.marginValue || 0)}%`;
        const bufferText = !record?.includeMarketplaceBuffer
          ? "Buffer tidak dipakai"
          : record?.marketplaceBufferType === "nominal"
            ? `Buffer ${formatCurrencyIDR(record?.marketplaceBufferValue || 0)}`
            : `Buffer ${formatNumberID(record?.marketplaceBufferValue || 0)}%`;

        return (
          <div className="ims-cell-stack ims-cell-stack-tight">
            <Text>{`Margin ${marginText}`}</Text>
            <Text type="secondary" className="ims-cell-meta">{bufferText}</Text>
            <Text type="secondary" className="ims-cell-meta">
              {`Pembulatan ${String(record?.roundingType || "up").toUpperCase()} / ${formatNumberID(record?.roundingUnit || 0)}`}
            </Text>
          </div>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "isActive",
      key: "isActive",
      width: "10%",
      align: "center",
      render: (value) =>
        value ? <Tag color="green">Aktif</Tag> : <Tag>Nonaktif</Tag>,
    },
    {
      title: "Aksi",
      key: "actions",
      width: "14%",
      className: "app-table-action-column",
      render: (_, record) => (
        <div className="ims-action-group ims-action-group--vertical">
          {/* AKTIF / GUARDED: action Pricing Rules tetap Detail/Edit/Hapus; hanya layout table yang dipadatkan. */}
          <Button
            className="ims-action-button ims-action-button--block"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handlePreviewRule(record)}
          >
            Detail
          </Button>

          <Button className="ims-action-button ims-action-button--block" size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
            Edit
          </Button>

          <Popconfirm
            title="Hapus pricing rule?"
            description="Rule yang dihapus tidak bisa dikembalikan."
            okText="Ya"
            cancelText="Batal"
            onConfirm={() => handleDeleteRule(record?.id)}
          >
            <Button className="ims-action-button ims-action-button--block" size="small" danger icon={<DeleteOutlined />}>
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
      title: "Item",
      dataIndex: "itemName",
      width: "26%",
      render: (value, record) => (
        <div className="ims-cell-stack ims-cell-stack-tight">
          <Text strong>{value || "-"}</Text>
          <Text type="secondary" className="ims-cell-meta">
            {record?.pricingMode === "manual" ? "Manual - dilewati" : "Pricing Rule - diproses jika valid"}
          </Text>
        </div>
      ),
    },
    {
      title: "Harga Saat Ini",
      dataIndex: "currentPrice",
      width: "16%",
      render: (value) => <Text strong>{formatCurrencyIDR(value || 0)}</Text>,
    },
    {
      title: "Perhitungan",
      key: "calculation",
      width: "30%",
      render: (_, record) => (
        <div className="ims-cell-stack ims-cell-stack-tight">
          <Text>{`Base ${Number(record?.baseCost || 0) > 0 ? formatCurrencyIDR(record.baseCost) : "-"}`}</Text>
          <Text type="secondary" className="ims-cell-meta">
            {`Margin ${Number(record?.marginAmount || 0) > 0 ? formatCurrencyIDR(record.marginAmount) : "-"} · Buffer ${Number(record?.marketplaceBufferAmount || 0) > 0 ? formatCurrencyIDR(record.marketplaceBufferAmount) : "-"}`}
          </Text>
          <Text type="secondary" className="ims-cell-meta">
            {`Sebelum pembulatan ${Number(record?.finalBeforeRounding || 0) > 0 ? formatCurrencyIDR(record.finalBeforeRounding) : "-"}`}
          </Text>
        </div>
      ),
    },
    {
      title: "Harga Baru",
      dataIndex: "roundedPrice",
      width: "14%",
      render: (value, record) => (
        <div className="ims-cell-stack ims-cell-stack-tight">
          <Text strong>{formatCurrencyIDR(value || 0)}</Text>
          {record?.willUpdate ? <Tag color="blue">Update</Tag> : <Tag>Tetap</Tag>}
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: "14%",
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
        subtitle="Aturan harga otomatis."
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
        message="Pricing Rules berlaku untuk item mode rule; item manual dilewati."
      />

      <SummaryStatGrid items={summaryItems} columns={{ xs: 24, md: 8 }} />

      {/* SECTION: tabel pricing rules */}
      <PageSection
        title="Daftar Pricing Rules"
        subtitle="Hanya item mode rule yang diproses."
      >
        {/* SECTION: tabel utama pricing rule memakai foundation global supaya seragam */}
        <DataRefreshIndicator loading={pageLoading} dataSource={rules} />
        <Table
          className="app-data-table"
          rowKey="id"
          dataSource={rules}
          columns={rulesColumns}
          pagination={{ pageSize: 10 }}
          tableLayout="fixed"
          locale={{ emptyText: getDataTableEmptyText(pageLoading) }}
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
                label="Target Rule"
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
                  <Option value="raw_materials">Bahan Baku</Option>
                  <Option value="products">Produk Jadi</Option>
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
            label="Sumber Biaya Dasar"
            name="baseCostSource"
            rules={[
              { required: true, message: "Sumber biaya dasar wajib dipilih." },
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
                label="Tipe Margin"
                name="marginType"
                rules={[
                  { required: true, message: "Tipe margin wajib dipilih." },
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
                label="Nilai Margin"
                name="marginValue"
                rules={[
                  { required: true, message: "Nilai margin wajib diisi." },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  step={1}
                  precision={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={parseIntegerIdInput}
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
                  label="Tipe Buffer Marketplace"
                  name="marketplaceBufferType"
                  rules={[
                    {
                      required: true,
                      message: "Tipe buffer marketplace wajib dipilih.",
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
                  label="Nilai Buffer Marketplace"
                  name="marketplaceBufferValue"
                  rules={[
                    {
                      required: true,
                      message: "Nilai buffer marketplace wajib diisi.",
                    },
                  ]}
                >
                  <InputNumber
                    style={{ width: "100%" }}
                    min={0}
                    step={1}
                    precision={0}
                    formatter={(value) => formatNumberID(value)}
                    parser={parseIntegerIdInput}
                  />
                </Form.Item>
              </Col>
            </Row>
          )}

          {/* SECTION: pengaturan pembulatan */}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Tipe Pembulatan"
                name="roundingType"
                rules={[
                  { required: true, message: "Tipe pembulatan wajib dipilih." },
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
                label="Kelipatan Pembulatan"
                name="roundingUnit"
                rules={[
                  { required: true, message: "Kelipatan pembulatan wajib diisi." },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={1}
                  step={1}
                  precision={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={parseIntegerIdInput}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* SECTION: catatan bantuan */}
          <Alert
            type="warning"
            showIcon
            message="Bahan baku memakai modal/restock; produk memakai HPP."
          />
        </Form>
      </Modal>

      {/* =====================================================
          SECTION: Pricing Rule Preview Modal — GUARDED
          Fungsi:
          - Menampilkan ringkasan target rule, dampak harga, status item, dan tombol Terapkan Rule.

          Dipakai oleh:
          - Halaman Master Data / Pricing Rules saat user klik Detail.

          Alasan perubahan:
          - Copy form dan detail dibuat lebih natural tanpa mengubah kalkulasi pricing.

          Catatan cleanup:
          - Belum ada.

          Risiko:
          - Jangan ubah normalizePricingRule, buildPricingPreview, applyPricingRuleToItems, prioritas, target matching, atau validasi harga dari section ini.
      ===================================================== */}
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
          message="Preview/apply memproses item mode rule dengan biaya valid."
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
                title="Biaya Dasar Invalid"
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
        <DataRefreshIndicator loading={previewLoading} dataSource={previewData} />
        <Table
          className="app-data-table"
          rowKey="itemId"
          dataSource={previewData}
          columns={previewColumns}
          pagination={{ pageSize: 10 }}
          tableLayout="fixed"
          locale={{ emptyText: getDataTableEmptyText(previewLoading) }}
        />
      </Modal>
    </div>
  );
};

export default PricingRules;
