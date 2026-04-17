// =====================================================
// Page: BOM Produksi
// Rule final:
// - BOM target product = assembly, material hanya semi_finished_material
// - BOM target semi_finished_material = material boleh raw / semi_finished_material
// =====================================================

import React, { useEffect, useMemo, useState } from "react";
import { buildCountSummary, createKeywordMatcher, matchActiveStatus, matchFieldValue } from '../../utils/produksi/productionPageHelpers';
import { getBomMaterialItemOptions, getBomTargetOptions, toReferenceOptions } from '../../utils/produksi/productionReferenceHelpers';
import ProductionPageHeader from '../../components/Produksi/shared/ProductionPageHeader';
import ProductionSummaryCards from '../../components/Produksi/shared/ProductionSummaryCards';
import ProductionFilterCard from '../../components/Produksi/shared/ProductionFilterCard';
import EditableLineSection from '../../components/Produksi/shared/EditableLineSection';
import ReadonlyLineSection from '../../components/Produksi/shared/ReadonlyLineSection';
import {
  Alert,
  Badge,
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
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  BOM_MATERIAL_ITEM_TYPE_MAP,
  BOM_TARGET_TYPE_MAP,
  DEFAULT_BOM_MATERIAL_LINE,
  DEFAULT_BOM_STEP_LINE,
  DEFAULT_PRODUCTION_BOM_FORM,
  PRODUCTION_BOM_MATERIAL_ITEM_TYPES,
  PRODUCTION_BOM_TARGET_TYPES,
} from "../../constants/productionBomOptions";
import {
  createProductionBom,
  getActiveBomReferenceData,
  getAllProductionBoms,
  toggleProductionBomActive,
  updateProductionBom,
} from "../../services/Produksi/productionBomsService";

// =====================================================
// SECTION: helper format angka Indonesia
// =====================================================
import formatNumber from "../../utils/formatters/numberId";
import formatCurrency from "../../utils/formatters/currencyId";
import { getFormArrayValue, getNextSequenceNumber, removeArrayItemByIndex, upsertArrayItemByIndex } from "../../utils/forms/formArrayHelpers";
import { buildBomMaterialFormLine, buildBomStepFormLine } from "../../utils/produksi/productionLineBuilders";
import { inferHasVariants } from "../../utils/variants/variantStockHelpers";

// =====================================================
// SECTION: helper label item
// =====================================================

const compactTagStyle = {
  display: "inline-flex",
  whiteSpace: "normal",
  lineHeight: 1.25,
  paddingTop: 4,
  paddingBottom: 4,
  maxWidth: 180,
};

const clampTwoLineStyle = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  lineHeight: 1.45,
};

const ProductionBoms = () => {
  // SECTION: state loading dan data utama
  const [loading, setLoading] = useState(false);
  const [boms, setBoms] = useState([]);
  const [referenceData, setReferenceData] = useState({
    products: [],
    rawMaterials: [],
    semiFinishedMaterials: [],
    productionSteps: [],
  });

  // SECTION: state filter
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [targetTypeFilter, setTargetTypeFilter] = useState("all");

  // SECTION: state form/detail
  const [formVisible, setFormVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editingBom, setEditingBom] = useState(null);
  const [selectedBom, setSelectedBom] = useState(null);

  // SECTION: state modal line
  const [materialModalVisible, setMaterialModalVisible] = useState(false);
  const [stepModalVisible, setStepModalVisible] = useState(false);

  const [editingMaterialIndex, setEditingMaterialIndex] = useState(null);
  const [editingStepIndex, setEditingStepIndex] = useState(null);

  // SECTION: form instances
  const [form] = Form.useForm();
  const [materialForm] = Form.useForm();
  const [stepForm] = Form.useForm();

  // =====================================================
  // SECTION: load data halaman
  // Penting:
  // - BOM dan reference dimuat terpisah agar salah satu gagal tidak mematikan semua
  // - ini perbaikan inti supaya target products tetap terbaca
  // =====================================================
  const loadData = async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      }

      const [bomResult, refResult] = await Promise.allSettled([
        getAllProductionBoms(),
        getActiveBomReferenceData(),
      ]);

      if (bomResult.status === "fulfilled") {
        setBoms(Array.isArray(bomResult.value) ? bomResult.value : []);
      } else {
        console.error("Gagal memuat daftar BOM", bomResult.reason);
        setBoms([]);
        message.error("Daftar BOM gagal dimuat");
      }

      if (refResult.status === "fulfilled") {
        const nextReference = {
          products: Array.isArray(refResult.value?.products)
            ? refResult.value.products
            : [],
          rawMaterials: Array.isArray(refResult.value?.rawMaterials)
            ? refResult.value.rawMaterials
            : [],
          semiFinishedMaterials: Array.isArray(
            refResult.value?.semiFinishedMaterials,
          )
            ? refResult.value.semiFinishedMaterials
            : [],
          productionSteps: Array.isArray(refResult.value?.productionSteps)
            ? refResult.value.productionSteps
            : [],
        };

        setReferenceData(nextReference);
      } else {
        console.error("Gagal memuat referensi BOM", refResult.reason);
        setReferenceData({
          products: [],
          rawMaterials: [],
          semiFinishedMaterials: [],
          productionSteps: [],
        });
        message.error("Master referensi BOM gagal dimuat");
      }
    } catch (error) {
      console.error(error);
      message.error("Gagal memuat data BOM produksi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // =====================================================
  // SECTION: summary card
  // =====================================================
  const summary = useMemo(() => {
    return buildCountSummary(boms, {
      active: (item) => item.isActive,
      inactive: (item) => !item.isActive,
      defaultCount: (item) => item.isDefault,
    });
  }, [boms]);

  // =====================================================
  // SECTION: data hasil filter
  // =====================================================
  const filteredData = useMemo(() => {
    return boms.filter((item) => {
      const matchSearch = createKeywordMatcher(
        item,
        ["code", "name", "targetName"],
        search,
      );

      const matchStatus = matchActiveStatus(item, statusFilter);
      const matchTargetType = matchFieldValue(item, targetTypeFilter, "targetType");

      return matchSearch && matchStatus && matchTargetType;
    });
  }, [boms, search, statusFilter, targetTypeFilter]);

  // =====================================================
  // SECTION: option target product / semi finished
  // =====================================================
  const stepOptions = useMemo(
    () => toReferenceOptions(referenceData.productionSteps || []),
    [referenceData.productionSteps],
  );

  // =====================================================
  // SECTION: helper state form
  // =====================================================
  const resetFormState = () => {
    setEditingBom(null);
    form.resetFields();
    form.setFieldsValue({
      ...DEFAULT_PRODUCTION_BOM_FORM,
      targetType: "product",
      materialLines: [],
      stepLines: [],
    });
  };

  const getCurrentTargetType = () =>
    form.getFieldValue("targetType") || "product";

  const getTargetOptions = (targetType) =>
    getBomTargetOptions(referenceData, targetType);

  const getMaterialItemOptions = (targetType, itemType) =>
    getBomMaterialItemOptions(referenceData, targetType, itemType);

  // =====================================================
  // SECTION: buka tambah BOM
  // =====================================================
  const handleAdd = () => {
    setEditingBom(null);
    form.resetFields();
    form.setFieldsValue({
      ...DEFAULT_PRODUCTION_BOM_FORM,
      targetType: "product",
      materialLines: [],
      stepLines: [],
      isActive: true,
      isDefault: true,
    });
    setFormVisible(true);
  };

  // =====================================================
  // SECTION: buka edit BOM
  // =====================================================
  const handleEdit = (record) => {
    setEditingBom(record);

    form.setFieldsValue({
      ...DEFAULT_PRODUCTION_BOM_FORM,
      ...record,
      targetType: record.targetType || "product",
      materialLines: record.materialLines || [],
      stepLines: record.stepLines || [],
    });

    setFormVisible(true);
  };

  // =====================================================
  // SECTION: buka detail BOM
  // =====================================================
  const handleViewDetail = (record) => {
    setSelectedBom(record);
    setDetailVisible(true);
  };

  // =====================================================
  // SECTION: modal material line
  // =====================================================
  const openMaterialModal = (index = null, record = null) => {
    setEditingMaterialIndex(index);

    const targetType = getCurrentTargetType();

    if (record) {
      materialForm.setFieldsValue({
        ...DEFAULT_BOM_MATERIAL_LINE,
        ...record,
        itemType:
          targetType === "product"
            ? "semi_finished_material"
            : record.itemType || "raw_material",
        materialVariantStrategy:
          record.materialHasVariants === true ? "inherit" : "none",
      });
    } else {
      materialForm.setFieldsValue({
        ...DEFAULT_BOM_MATERIAL_LINE,
        itemType:
          targetType === "product" ? "semi_finished_material" : "raw_material",
        materialVariantStrategy: "none",
        fixedVariantKey: "",
        fixedVariantLabel: "",
      });
    }

    setMaterialModalVisible(true);
  };

  // =====================================================
  // SECTION: modal step line
  // =====================================================
  const openStepModal = (index = null, record = null) => {
    setEditingStepIndex(index);

    if (record) {
      stepForm.setFieldsValue({ ...DEFAULT_BOM_STEP_LINE, ...record });
    } else {
      const currentLines = getFormArrayValue(form, "stepLines");
      const nextSequenceNo = getNextSequenceNumber(currentLines);
      stepForm.setFieldsValue({
        ...DEFAULT_BOM_STEP_LINE,
        sequenceNo: nextSequenceNo,
      });
    }

    setStepModalVisible(true);
  };

  // =====================================================
  // SECTION: simpan material line
  // =====================================================
  const handleSaveMaterialLine = async () => {
    try {
      const values = await materialForm.validateFields();
      const targetType = getCurrentTargetType();

      const forcedItemType =
        targetType === "product" ? "semi_finished_material" : values.itemType;

      const options = getMaterialItemOptions(targetType, forcedItemType);
      const selected = options.find(
        (item) => item.value === values.itemId,
      )?.raw;

      const line = buildBomMaterialFormLine({
        values,
        selectedItem: selected,
        itemType: forcedItemType,
      });

      const currentLines = getFormArrayValue(form, "materialLines");
      const nextLines = upsertArrayItemByIndex(
        currentLines,
        editingMaterialIndex,
        line,
      );

      form.setFieldValue("materialLines", nextLines);
      setMaterialModalVisible(false);
      setEditingMaterialIndex(null);
      materialForm.resetFields();
    } catch (error) {
      if (error?.errorFields) return;
      console.error(error);
      message.error("Gagal menyimpan material line");
    }
  };

  // =====================================================
  // SECTION: hapus material line
  // =====================================================
  const handleRemoveMaterialLine = (index) => {
    const currentLines = getFormArrayValue(form, "materialLines");
    form.setFieldValue(
      "materialLines",
      removeArrayItemByIndex(currentLines, index),
    );
  };

  // =====================================================
  // SECTION: simpan step line
  // =====================================================
  const handleSaveStepLine = async () => {
    try {
      const values = await stepForm.validateFields();

      const selectedStep = (referenceData.productionSteps || []).find(
        (item) => item.id === values.stepId,
      );

      const line = buildBomStepFormLine({
        values,
        selectedStep,
      });

      const currentLines = getFormArrayValue(form, "stepLines");
      const nextLines = upsertArrayItemByIndex(
        currentLines,
        editingStepIndex,
        line,
      );

      nextLines.sort(
        (a, b) => Number(a.sequenceNo || 0) - Number(b.sequenceNo || 0),
      );

      form.setFieldValue("stepLines", nextLines);
      setStepModalVisible(false);
      setEditingStepIndex(null);
      stepForm.resetFields();
    } catch (error) {
      if (error?.errorFields) return;
      console.error(error);
      message.error("Gagal menyimpan step line");
    }
  };

  // =====================================================
  // SECTION: hapus step line
  // =====================================================
  const handleRemoveStepLine = (index) => {
    const currentLines = getFormArrayValue(form, "stepLines");
    form.setFieldValue(
      "stepLines",
      removeArrayItemByIndex(currentLines, index),
    );
  };

  // =====================================================
  // SECTION: submit BOM
  // =====================================================
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const targetOptions = getTargetOptions(values.targetType);
      const selectedTarget = targetOptions.find(
        (item) => item.value === values.targetId,
      )?.raw;

      const targetName = selectedTarget?.name || "";
      const targetCode = selectedTarget?.code || "";
      const normalizedTargetName = String(targetName || "BOM").trim();
      const normalizedTargetCode =
        String(targetCode || normalizedTargetName)
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "BOM";

      const payload = {
        ...values,
        code: values.code || `BOM-${normalizedTargetCode}`,
        name: values.name || `BOM ${normalizedTargetName}`,
        description: values.description || "",
        targetCode,
        targetName,
        targetUnit: selectedTarget?.unit || values.targetUnit || "pcs",
        targetHasVariants: inferHasVariants(selectedTarget || {}),
      };

      setSubmitting(true);

      if (editingBom?.id) {
        await updateProductionBom(editingBom.id, payload, null);
        message.success("BOM produksi berhasil diperbarui");
      } else {
        await createProductionBom(payload, null);
        message.success("BOM produksi berhasil ditambahkan");
      }

      setFormVisible(false);
      resetFormState();
      await loadData({ silent: true });
    } catch (error) {
      if (error?.errorFields) return;

      if (error?.type === "validation" && error?.errors) {
        const normalFields = [];
        const globalMessages = [];

        Object.entries(error.errors).forEach(([name, errors]) => {
          if (["materialLines", "stepLines"].includes(name)) {
            globalMessages.push(errors);
          } else {
            normalFields.push({
              name,
              errors: [errors],
            });
          }
        });

        if (normalFields.length > 0) {
          form.setFields(normalFields);
        }

        if (globalMessages.length > 0) {
          message.error(globalMessages[0]);
        }

        return;
      }

      console.error(error);
      message.error("Gagal menyimpan BOM produksi");
    } finally {
      setSubmitting(false);
    }
  };

  // =====================================================
  // SECTION: toggle aktif BOM
  // =====================================================
  const handleToggleActive = async (record) => {
    try {
      await toggleProductionBomActive(record.id, !record.isActive, null);
      message.success(
        `BOM berhasil ${record.isActive ? "dinonaktifkan" : "diaktifkan"}`,
      );
      await loadData({ silent: true });
    } catch (error) {
      console.error(error);
      message.error("Gagal mengubah status BOM");
    }
  };

  // =====================================================
  // SECTION: kolom tabel utama
  // =====================================================
  const columns = [
    {
      title: "Nama BOM",
      key: "name",
      width: 260,
      render: (_, record) => (
        <div>
          <Typography.Text strong>{record.name || "-"}</Typography.Text>
          <div style={{ fontSize: 12, color: "#8c8c8c", marginTop: 4 }}>
            {record.code || "Tanpa kode"}
          </div>
          <Tooltip title={record.description || "Belum ada deskripsi"}>
            <Typography.Text
              type="secondary"
              style={{ ...clampTwoLineStyle, marginTop: 6 }}
            >
              {record.description || "Belum ada deskripsi"}
            </Typography.Text>
          </Tooltip>
        </div>
      ),
    },
    {
      title: "Target",
      key: "target",
      width: 240,
      render: (_, record) => (
        <Space direction="vertical" size={6}>
          <Tag color="blue" style={compactTagStyle}>
            {BOM_TARGET_TYPE_MAP[record.targetType] || "-"}
          </Tag>
          <Typography.Text>{record.targetName || "-"}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "Komposisi",
      key: "counts",
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text>
            Material: {formatNumber(record.materialLines?.length || 0)}
          </Typography.Text>
          <Typography.Text>
            Step: {formatNumber(record.stepLines?.length || 0)}
          </Typography.Text>
          <Typography.Text type="secondary">
            Output batch: {formatNumber(record.batchOutputQty || 0)}{" "}
            {record.targetUnit || "pcs"}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Estimasi",
      key: "estimate",
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text>
            Material: {formatCurrency(record.materialCostEstimate || 0)}
          </Typography.Text>
          <Typography.Text>
            Tenaga kerja: {formatCurrency(record.laborCostEstimate || 0)}
          </Typography.Text>
          <Typography.Text strong>
            Total: {formatCurrency(record.totalCostEstimate || 0)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 130,
      align: "center",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          {record.isActive ? (
            <Badge status="success" text="Aktif" />
          ) : (
            <Badge status="default" text="Nonaktif" />
          )}
          {record.isDefault ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Default
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: "Aksi",
      key: "actions",
      width: 220,
      render: (_, record) => (
        <Space wrap>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            Detail
          </Button>

          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>

          <Popconfirm
            title={
              record.isActive ? "Nonaktifkan BOM ini?" : "Aktifkan BOM ini?"
            }
            onConfirm={() => handleToggleActive(record)}
            okText="Ya"
            cancelText="Batal"
          >
            <Button size="small">
              {record.isActive ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <ProductionPageHeader
        title="BOM Produksi"
        description="Komposisi produksi untuk target semi finished maupun produk jadi, agar PO bisa otomatis menarik kebutuhan bahan dan step"
        onRefresh={() => loadData()}
        onAdd={handleAdd}
        addLabel="Tambah BOM"
      />

      <ProductionSummaryCards
        items={[
          { key: "total", title: "Total BOM", value: summary.total },
          { key: "active", title: "BOM Aktif", value: summary.active },
          { key: "inactive", title: "BOM Nonaktif", value: summary.inactive },
          { key: "default", title: "BOM Default", value: summary.defaultCount },
        ]}
      />

      {/* SECTION: info referensi */}
      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message={`Referensi aktif: Product ${formatNumber(
          referenceData.products.length,
        )}, Semi Finished ${formatNumber(
          referenceData.semiFinishedMaterials.length,
        )}, Raw Material ${formatNumber(
          referenceData.rawMaterials.length,
        )}, Production Step ${formatNumber(
          referenceData.productionSteps.length,
        )}`}
      />

      {/* SECTION: filter */}
      <ProductionFilterCard>
          <Col xs={24} md={8}>
            <Input
              placeholder="Cari kode, nama BOM, target..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>

          <Col xs={24} md={8}>
            <Select
              style={{ width: "100%" }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "Semua Status" },
                { value: "active", label: "Aktif" },
                { value: "inactive", label: "Nonaktif" },
              ]}
            />
          </Col>

          <Col xs={24} md={8}>
            <Select
              style={{ width: "100%" }}
              value={targetTypeFilter}
              onChange={setTargetTypeFilter}
              options={[
                { value: "all", label: "Semua Target" },
                ...PRODUCTION_BOM_TARGET_TYPES,
              ]}
            />
          </Col>
      </ProductionFilterCard>

      {/* SECTION: tabel BOM */}
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredData}
          scroll={{ x: 1180 }}
          locale={{
            emptyText: <Empty description="Belum ada data BOM produksi" />,
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
          }}
        />
      </Card>

      {/* SECTION: drawer form tambah/edit BOM */}
      <Drawer
        title={editingBom?.id ? "Edit BOM Produksi" : "Tambah BOM Produksi"}
        open={formVisible}
        onClose={() => {
          setFormVisible(false);
          resetFormState();
        }}
        width={980}
        destroyOnClose
        extra={
          <Space>
            <Button
              onClick={() => {
                setFormVisible(false);
                resetFormState();
              }}
            >
              Batal
            </Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              Simpan
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            ...DEFAULT_PRODUCTION_BOM_FORM,
            targetType: "product",
          }}
        >
          <Divider orientation="left">Informasi Dasar</Divider>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="Kode BOM"
                name="code"
                rules={[{ required: true, message: "Kode BOM wajib diisi" }]}
              >
                <Input placeholder="Contoh: BOM-MAWAR-V1" />
              </Form.Item>
            </Col>

            <Col xs={24} md={16}>
              <Form.Item
                label="Nama BOM"
                name="name"
                rules={[{ required: true, message: "Nama BOM wajib diisi" }]}
              >
                <Input placeholder="Contoh: BOM Produksi Mawar Standar" />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="Deskripsi" name="description">
                <Input.TextArea rows={2} placeholder="Deskripsi BOM..." />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Target BOM</Divider>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const targetType = getFieldValue("targetType") || "product";
              const targetOptions = getTargetOptions(targetType);

              return (
                <>
                  {targetType === "product" && targetOptions.length === 0 ? (
                    <Alert
                      style={{ marginBottom: 16 }}
                      type="warning"
                      showIcon
                      message="Target product belum terbaca. Pastikan master Produk Jadi sudah ada dan halaman BOM sudah refresh."
                    />
                  ) : null}

                  {targetType === "semi_finished_material" &&
                  targetOptions.length === 0 ? (
                    <Alert
                      style={{ marginBottom: 16 }}
                      type="warning"
                      showIcon
                      message="Target semi finished belum tersedia. Tambahkan Semi Finished Materials terlebih dahulu."
                    />
                  ) : null}

                  <Row gutter={16}>
                    <Col xs={24} md={8}>
                      <Form.Item
                        label="Target Type"
                        name="targetType"
                        rules={[
                          {
                            required: true,
                            message: "Target type wajib dipilih",
                          },
                        ]}
                      >
                        <Select
                          options={PRODUCTION_BOM_TARGET_TYPES}
                          onChange={(value) => {
                            form.setFieldsValue({
                              targetId: undefined,
                            });

                            const currentMaterialLines =
                              form.getFieldValue("materialLines") || [];

                            if (value === "product") {
                              const normalizedLines = currentMaterialLines
                                .filter(
                                  (line) =>
                                    line.itemType === "semi_finished_material",
                                )
                                .map((line) => ({
                                  ...line,
                                  itemType: "semi_finished_material",
                                }));

                              form.setFieldValue(
                                "materialLines",
                                normalizedLines,
                              );
                            }
                          }}
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={16}>
                      <Form.Item
                        label="Target Item"
                        name="targetId"
                        rules={[
                          {
                            required: true,
                            message: "Target item wajib dipilih",
                          },
                        ]}
                      >
                        <Select
                          key={`target-${targetType}-${targetOptions.length}`}
                          showSearch
                          optionFilterProp="label"
                          options={targetOptions}
                          placeholder="Pilih target BOM..."
                          notFoundContent="Tidak ada target yang bisa dipilih"
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Hasil per Produksi"
                        name="batchOutputQty"
                        extra="Isi jumlah output yang dihasilkan untuk 1 resep BOM ini. Contoh: 1 bunga, 10 tangkai, atau 20 potong komponen."
                      >
                        <InputNumber min={1} style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Status Aktif"
                        name="isActive"
                        valuePropName="checked"
                        extra="Biarkan aktif kalau resep ini masih dipakai. Nonaktifkan hanya jika BOM lama sudah tidak digunakan."
                      >
                        <Switch />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              );
            }}
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const targetType = getFieldValue("targetType") || "product";
              const materialLines = getFieldValue("materialLines") || [];
              const stepLines = getFieldValue("stepLines") || [];

              const materialColumns = [
                {
                  title: "Item",
                  key: "item",
                  render: (_, record) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{record.itemName || "-"}</div>
                      <div style={{ fontSize: 12, color: "#8c8c8c" }}>{record.itemCode || "-"}</div>
                    </div>
                  ),
                },
                {
                  title: "Tipe",
                  dataIndex: "itemType",
                  width: 160,
                  render: (value) => <Tag>{BOM_MATERIAL_ITEM_TYPE_MAP[value] || "-"}</Tag>,
                },
                {
                  title: "Kebutuhan per Produksi",
                  key: "qty",
                  width: 220,
                  render: (_, record) => (
                    <Space direction="vertical" size={0}>
                      <Typography.Text>
                        {formatNumber(record.qtyPerBatch)} {record.unit || "pcs"}
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        Estimasi biaya: {formatCurrency(record.totalCostSnapshot)}
                      </Typography.Text>
                    </Space>
                  ),
                },
                {
                  title: "Aksi",
                  width: 140,
                  render: (_, record, index) => (
                    <Space>
                      <Button size="small" onClick={() => openMaterialModal(index, record)}>
                        Edit
                      </Button>
                      <Popconfirm
                        title="Hapus material line ini?"
                        onConfirm={() => handleRemoveMaterialLine(index)}
                        okText="Ya"
                        cancelText="Batal"
                      >
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  ),
                },
              ];

              const stepColumns = [
                {
                  title: "Urutan Langkah",
                  key: "step",
                  render: (_, record) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        Langkah {formatNumber(record.sequenceNo)} - {record.stepName || "-"}
                      </div>
                      <div style={{ fontSize: 12, color: "#8c8c8c" }}>
                        {record.notes || record.stepCode || "Step produksi"}
                      </div>
                    </div>
                  ),
                },
                {
                  title: "Aksi",
                  width: 140,
                  render: (_, record, index) => (
                    <Space>
                      <Button size="small" onClick={() => openStepModal(index, record)}>
                        Edit
                      </Button>
                      <Popconfirm
                        title="Hapus step line ini?"
                        onConfirm={() => handleRemoveStepLine(index)}
                        okText="Ya"
                        cancelText="Batal"
                      >
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  ),
                },
              ];

              return (
                <>
                  <EditableLineSection
                    title="Komposisi Bahan"
                    description={
                      targetType === "product"
                        ? "Untuk target produk jadi, komposisi bahan hanya boleh mengambil Semi Finished Materials agar proses assembly tetap rapi."
                        : "Untuk target semi finished, komposisi bahan boleh mengambil Raw Materials atau Semi Finished Materials sesuai kebutuhan proses."
                    }
                    addButtonText="Tambah Bahan"
                    onAdd={() => openMaterialModal()}
                    dataSource={materialLines}
                    columns={materialColumns}
                    emptyText="Belum ada material line"
                  />

                  <EditableLineSection
                    title="Alur Step Produksi"
                    alert={{
                      type: "info",
                      message:
                        "QC tidak perlu dibuat sebagai step terpisah. Gunakan step produksi nyata saja, lalu pengecekan kualitas dicatat di work log pada setiap proses.",
                    }}
                    addButtonText="Tambah Step BOM"
                    onAdd={() => openStepModal()}
                    dataSource={stepLines}
                    columns={stepColumns}
                    emptyText="Belum ada step line"
                  />
                </>
              );
            }}
          </Form.Item>

          <Divider orientation="left">Biaya Estimasi</Divider>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item shouldUpdate noStyle>
                {({ getFieldValue }) => {
                  const materialLines = getFieldValue("materialLines") || [];
                  const total = materialLines.reduce(
                    (sum, item) => sum + Number(item.totalCostSnapshot || 0),
                    0,
                  );

                  return (
                    <Form.Item label="Estimasi Biaya Material">
                      <Input value={formatCurrency(total)} disabled />
                    </Form.Item>
                  );
                }}
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item shouldUpdate noStyle>
                {({ getFieldValue }) => {
                  const stepLines = getFieldValue("stepLines") || [];
                  const total = stepLines.reduce(
                    (sum, item) => sum + Number(item.payrollRate || 0),
                    0,
                  );

                  return (
                    <Form.Item label="Estimasi Biaya Tenaga Kerja">
                      <Input value={formatCurrency(total)} disabled />
                    </Form.Item>
                  );
                }}
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Estimasi Biaya Overhead"
                name="overheadCostEstimate"
              >
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Catatan</Divider>

          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item label="Catatan Internal" name="notes">
                <Input.TextArea rows={3} placeholder="Catatan BOM..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>

      {/* SECTION: drawer detail BOM */}
      <Drawer
        title="Detail BOM Produksi"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={760}
      >
        {!selectedBom ? (
          <Empty description="Tidak ada data" />
        ) : (
          <>
            <Descriptions
              column={1}
              bordered
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label="Kode">
                {selectedBom.code || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Nama">
                {selectedBom.name || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Target Type">
                {BOM_TARGET_TYPE_MAP[selectedBom.targetType] || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Target Name">
                {selectedBom.targetName || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Estimasi Total">
                {formatCurrency(selectedBom.totalCostEstimate)}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                {selectedBom.isActive ? "Aktif" : "Nonaktif"}
              </Descriptions.Item>
              <Descriptions.Item label="Catatan">
                {selectedBom.notes || "-"}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">Komposisi Bahan</Divider>

            <Table
              rowKey={(record) => record.id}
              pagination={false}
              size="small"
              dataSource={selectedBom.materialLines || []}
              locale={{ emptyText: "Belum ada material line" }}
              columns={[
                {
                  title: "Item",
                  key: "item",
                  render: (_, record) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {record.itemName || "-"}
                      </div>
                      <div style={{ fontSize: 12, color: "#8c8c8c" }}>
                        {record.itemCode || "-"}
                      </div>
                    </div>
                  ),
                },
                {
                  title: "Tipe",
                  dataIndex: "itemType",
                  render: (value) => (
                    <Tag>{BOM_MATERIAL_ITEM_TYPE_MAP[value] || "-"}</Tag>
                  ),
                },
                {
                  title: "Qty Total",
                  dataIndex: "totalRequiredQty",
                  render: (value) => formatNumber(value),
                },
                {
                  title: "Total Cost",
                  dataIndex: "totalCostSnapshot",
                  render: (value) => formatCurrency(value),
                },
              ]}
            />

            <Divider orientation="left">Alur Step Produksi</Divider>

            <Table
              rowKey={(record) => record.id}
              pagination={false}
              size="small"
              dataSource={selectedBom.stepLines || []}
              locale={{ emptyText: "Belum ada step line" }}
              columns={[
                {
                  title: "Urutan Langkah",
                  key: "step",
                  render: (_, record) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        Langkah {formatNumber(record.sequenceNo)} -{" "}
                        {record.stepName || "-"}
                      </div>
                      <div style={{ fontSize: 12, color: "#8c8c8c" }}>
                        {record.notes || record.stepCode || "Step produksi"}
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </>
        )}
      </Drawer>

      {/* SECTION: modal material line */}
      <Modal
        title={
          editingMaterialIndex !== null
            ? "Edit Material Line"
            : "Tambah Material Line"
        }
        open={materialModalVisible}
        onCancel={() => {
          setMaterialModalVisible(false);
          setEditingMaterialIndex(null);
          materialForm.resetFields();
        }}
        onOk={handleSaveMaterialLine}
        okText="Simpan"
        destroyOnClose
      >
        <Form
          form={materialForm}
          layout="vertical"
          initialValues={DEFAULT_BOM_MATERIAL_LINE}
        >
          <Form.Item shouldUpdate noStyle>
            {() => {
              const targetType = getCurrentTargetType();
              const forceSemiFinished = targetType === "product";

              return (
                <Form.Item
                  label="Jenis Bahan"
                  name="itemType"
                  rules={[
                    { required: true, message: "Jenis bahan wajib dipilih" },
                  ]}
                  extra={
                    forceSemiFinished
                      ? "Untuk target produk jadi, bahan hanya boleh mengambil Semi Finished Materials agar proses assembly tetap rapi."
                      : undefined
                  }
                >
                  <Select
                    options={PRODUCTION_BOM_MATERIAL_ITEM_TYPES}
                    disabled={forceSemiFinished}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const targetType = getCurrentTargetType();
              const itemType =
                targetType === "product"
                  ? "semi_finished_material"
                  : getFieldValue("itemType");

              const options = getMaterialItemOptions(targetType, itemType);

              return (
                <Form.Item
                  label="Item Bahan"
                  name="itemId"
                  rules={[
                    {
                      required: true,
                      message: "Item bahan wajib dipilih",
                    },
                  ]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={options}
                    placeholder="Pilih item bahan..."
                    notFoundContent="Tidak ada item bahan yang bisa dipilih"
                    onChange={(value) => {
                      const selected = options.find(
                        (item) => item.value === value,
                      )?.raw;

                      const materialHasVariants = inferHasVariants(selected || {});

                      materialForm.setFieldsValue({
                        unit: selected?.unit || "pcs",
                        costPerUnitSnapshot: Number(
                          selected?.averageCostPerUnit ||
                            selected?.referenceCostPerUnit ||
                            selected?.costPerUnit ||
                            0,
                        ),
                        materialHasVariants,
                        materialVariantStrategy: materialHasVariants ? "inherit" : "none",
                        fixedVariantKey: "",
                        fixedVariantLabel: "",
                      });
                    }}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const targetType = getCurrentTargetType();
              const itemType =
                targetType === "product"
                  ? "semi_finished_material"
                  : getFieldValue("itemType");
              const options = getMaterialItemOptions(targetType, itemType);
              const selectedItem = options.find((item) => item.value === getFieldValue("itemId"))?.raw;
              const hasVariants = inferHasVariants(selectedItem || {});

              return (
                <>
                  <Form.Item name="materialHasVariants" hidden>
                    <Input />
                  </Form.Item>

                  <Form.Item name="materialVariantStrategy" hidden>
                    <Input />
                  </Form.Item>

                  <Form.Item name="fixedVariantKey" hidden>
                    <Input />
                  </Form.Item>

                  <Form.Item name="fixedVariantLabel" hidden>
                    <Input />
                  </Form.Item>

                  <Alert
                    type={hasVariants ? "info" : "success"}
                    showIcon
                    message={
                      hasVariants
                        ? "Item ini memakai varian. BOM tetap resep master; varian bahan akan otomatis mengikuti varian target saat Production Order dibuat."
                        : "Item ini non-varian. Saat Production Order dibuat, stok bahan akan dibaca langsung dari master item."
                    }
                    style={{ marginBottom: 16 }}
                  />
                </>
              );
            }}
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                label="Kebutuhan per Produksi"
                name="qtyPerBatch"
                extra="Isi jumlah bahan yang dibutuhkan untuk 1 kali produksi sesuai output BOM ini."
              >
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Satuan Bahan"
                name="unit"
                extra="Diambil otomatis dari master bahan yang dipilih."
              >
                <Input disabled />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Catatan" name="notes">
            <Input.TextArea rows={2} placeholder="Opsional" />
          </Form.Item>
        </Form>
      </Modal>

      {/* SECTION: modal step line */}
      <Modal
        title={
          editingStepIndex !== null ? "Edit Step Line" : "Tambah Step Line"
        }
        open={stepModalVisible}
        onCancel={() => {
          setStepModalVisible(false);
          setEditingStepIndex(null);
          stepForm.resetFields();
        }}
        onOk={handleSaveStepLine}
        okText="Simpan"
        width={720}
        destroyOnClose
      >
        <Form
          form={stepForm}
          layout="vertical"
          initialValues={DEFAULT_BOM_STEP_LINE}
        >
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item
                label="Step Produksi"
                name="stepId"
                rules={[{ required: true, message: "Step wajib dipilih" }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={stepOptions}
                  placeholder="Pilih step produksi..."
                  notFoundContent="Belum ada production step"
                />
              </Form.Item>
            </Col>

            <Col span={10}>
              <Form.Item
                label="Urutan Langkah"
                name="sequenceNo"
                extra="Terisi otomatis sesuai urutan penambahan step."
              >
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Catatan" name="notes">
            <Input.TextArea rows={2} placeholder="Opsional" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProductionBoms;
