// =====================================================
// Page: Work Log Produksi
// Revisi:
// - bisa ambil draft dari BOM
// - bisa ambil draft dari Production Order
// - Produksi lebih fokus ke eksekusi, bukan planning dari nol
// =====================================================

import React, { useEffect, useMemo, useState } from "react";
import { buildCountSummary, createKeywordMatcher, matchFieldValue } from '../../utils/produksi/productionPageHelpers';
import { getWorkLogMaterialOptions, getWorkLogTargetOptions, toReferenceOptions } from '../../utils/produksi/productionReferenceHelpers';
import ProductionPageHeader from '../../components/Produksi/shared/ProductionPageHeader';
import ProductionSummaryCards from '../../components/Produksi/shared/ProductionSummaryCards';
import ProductionFilterCard from '../../components/Produksi/shared/ProductionFilterCard';
import EditableLineSection from '../../components/Produksi/shared/EditableLineSection';
import ReadonlyLineSection from '../../components/Produksi/shared/ReadonlyLineSection';
import {
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
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
  Table,
  Tag,
  Typography,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  DEFAULT_PRODUCTION_WORK_LOG_FORM,
  DEFAULT_WORK_LOG_MATERIAL_USAGE,
  DEFAULT_WORK_LOG_OUTPUT,
  PRODUCTION_WORK_LOG_SOURCE_TYPES,
  PRODUCTION_WORK_LOG_STATUSES,
  WORK_LOG_SOURCE_TYPE_MAP,
  WORK_LOG_STATUS_MAP,
  WORK_LOG_TARGET_TYPE_MAP,
  calculateProductionMonitoring,
} from "../../constants/productionWorkLogOptions";
import {
  buildWorkLogDraftFromBom,
  buildWorkLogDraftFromProductionOrder,
  createProductionWorkLog,
  completeProductionWorkLog,
  createProductionWorkLogFromOrder,
  getAllProductionWorkLogs,
  getWorkLogReferenceData,
  updateProductionWorkLog,
} from "../../services/Produksi/productionWorkLogsService";

import formatNumber from "../../utils/formatters/numberId";
import formatCurrency from "../../utils/formatters/currencyId";
import { getFormArrayValue, removeArrayItemByIndex, upsertArrayItemByIndex } from "../../utils/forms/formArrayHelpers";
import { buildWorkLogMaterialUsageFormLine, buildWorkLogOutputFormLine } from "../../utils/produksi/productionLineBuilders";
import { buildVariantOptionsFromItem, inferHasVariants } from "../../utils/variants/variantStockHelpers";

const ProductionWorkLogs = () => {
  // SECTION: state utama
  const [loading, setLoading] = useState(false);
  const [workLogs, setWorkLogs] = useState([]);
  const [referenceData, setReferenceData] = useState({
    boms: [],
    productionOrders: [],
    employees: [],
    rawMaterials: [],
    semiFinishedMaterials: [],
    products: [],
    productionSteps: [],
    productionProfiles: [],
  });

  // SECTION: state filter
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // SECTION: state form
  const [formVisible, setFormVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);

  // SECTION: modal line
  const [materialModalVisible, setMaterialModalVisible] = useState(false);
  const [outputModalVisible, setOutputModalVisible] = useState(false);
  const [editingMaterialIndex, setEditingMaterialIndex] = useState(null);
  const [editingOutputIndex, setEditingOutputIndex] = useState(null);

  // SECTION: form instances
  const [form] = Form.useForm();
  const [materialForm] = Form.useForm();
  const [outputForm] = Form.useForm();

  // SECTION: watch source
  const targetTypeValue = Form.useWatch("targetType", form);
  const targetIdValue = Form.useWatch("targetId", form);
  const stepIdValue = Form.useWatch("stepId", form);
  const productionProfileIdValue = Form.useWatch("productionProfileId", form);
  const goodQtyValue = Form.useWatch("goodQty", form);
  const baseInputQtyValue = Form.useWatch("baseInputQty", form);
  const leftoverLeafQtyValue = Form.useWatch("leftoverLeafQty", form);
  const leftoverStemQtyValue = Form.useWatch("leftoverStemQty", form);
  const leftoverPetalFlowerEquivalentValue = Form.useWatch("leftoverPetalFlowerEquivalent", form);

  const loadData = async () => {
    try {
      setLoading(true);
      const [workLogResult, refResult] = await Promise.all([
        getAllProductionWorkLogs(),
        getWorkLogReferenceData(),
      ]);

      setWorkLogs(workLogResult);
      setReferenceData(refResult);
    } catch (error) {
      console.error(error);
      message.error("Gagal memuat work log produksi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const summary = useMemo(() => {
    return buildCountSummary(workLogs, {
      completed: (item) => item.status === "completed",
      draft: (item) => item.status === "draft",
      inProgress: (item) => item.status === "in_progress",
    });
  }, [workLogs]);

  const filteredData = useMemo(() => {
    return workLogs.filter((item) => {
      const matchSearch = createKeywordMatcher(
        item,
        ["workNumber", "targetName", "stepName", "productionOrderCode"],
        search,
      );

      const matchStatus = matchFieldValue(item, statusFilter, "status");

      return matchSearch && matchStatus;
    });
  }, [workLogs, search, statusFilter]);

  const resetFormState = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      ...DEFAULT_PRODUCTION_WORK_LOG_FORM,
      workDate: dayjs(),
      sourceType: "manual",
      materialUsages: [],
      outputs: [],
      workerIds: [],
      productionOrderId: undefined,
      productionProfileId: undefined,
    });
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.setFieldsValue({
      ...DEFAULT_PRODUCTION_WORK_LOG_FORM,
      workDate: dayjs(),
      sourceType: "manual",
      materialUsages: [],
      outputs: [],
      workerIds: [],
      productionOrderId: undefined,
      productionProfileId: undefined,
    });
    setFormVisible(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...DEFAULT_PRODUCTION_WORK_LOG_FORM,
      ...record,
      workDate: record.workDate
        ? dayjs(record.workDate?.toDate?.() || record.workDate)
        : null,
    });
    setFormVisible(true);
  };

  const handleViewDetail = (record) => {
    setSelectedRecord(record);
    setDetailVisible(true);
  };

  // =====================================================
  // Helper options
  // =====================================================
  const productionOrderOptions = toReferenceOptions(
    referenceData.productionOrders || [],
  );

  const employeeOptions = toReferenceOptions(referenceData.employees || []);

  const stepOptions = toReferenceOptions(referenceData.productionSteps || []);

  const getTargetOptions = (targetType) =>
    getWorkLogTargetOptions(referenceData, targetType);

  const getProductionProfileOptions = (targetId) =>
    (referenceData.productionProfiles || [])
      .filter((item) => item.productId === targetId)
      .map((item) => ({
        value: item.id,
        label: `${item.profileName || '-'}${item.isDefault !== false ? ' (Default)' : ''}`,
      }));

  const getMaterialOptions = (itemType) =>
    getWorkLogMaterialOptions(referenceData, itemType);


  const selectedProductionProfile = useMemo(
    () =>
      (referenceData.productionProfiles || []).find(
        (item) => item.id === productionProfileIdValue,
      ) || null,
    [referenceData.productionProfiles, productionProfileIdValue],
  );

  const selectedStepForMonitoring = useMemo(
    () =>
      (referenceData.productionSteps || []).find(
        (item) => item.id === stepIdValue,
      ) || null,
    [referenceData.productionSteps, stepIdValue],
  );

  const monitoringPreview = useMemo(
    () =>
      calculateProductionMonitoring(
        {
          ...(selectedProductionProfile || {}),
          workBasisType: selectedStepForMonitoring?.workBasisType || '',
          referenceYieldPerBaseQty:
            selectedStepForMonitoring?.workBasisType === 'per_meter'
              ? (selectedStepForMonitoring?.name || '').toLowerCase().includes('daun')
                ? selectedProductionProfile?.leafYieldPerMeter
                : selectedProductionProfile?.petalYieldPerMeter
              : selectedStepForMonitoring?.workBasisType === 'per_rod_40cm'
                ? selectedProductionProfile?.stemYieldPerRod40cm
                : 0,
          flowerEquivalentPerBaseQty:
            selectedStepForMonitoring?.workBasisType === 'per_meter'
              ? (selectedStepForMonitoring?.name || '').toLowerCase().includes('daun')
                ? selectedProductionProfile?.flowerEquivalentPerLeafMeter
                : selectedProductionProfile?.flowerEquivalentPerPetalMeter
              : selectedStepForMonitoring?.workBasisType === 'per_rod_40cm'
                ? selectedProductionProfile?.flowerEquivalentPerRod40cm
                : 0,
          batchLeafQty:
            (selectedProductionProfile?.assemblyLeafPackCount || 0) *
            (selectedProductionProfile?.leafYieldPerMeter || 0),
          batchStemQty: selectedProductionProfile?.assemblyStemQty || 0,
        },
        {
          workBasisType: selectedStepForMonitoring?.workBasisType || '',
          baseInputQty: baseInputQtyValue,
          goodQty: goodQtyValue,
          leftoverLeafQty: leftoverLeafQtyValue,
          leftoverStemQty: leftoverStemQtyValue,
          leftoverPetalFlowerEquivalent: leftoverPetalFlowerEquivalentValue,
        },
      ),
    [
      selectedProductionProfile,
      selectedStepForMonitoring,
      baseInputQtyValue,
      goodQtyValue,
      leftoverLeafQtyValue,
      leftoverStemQtyValue,
      leftoverPetalFlowerEquivalentValue,
    ],
  );

  // =====================================================
  // Apply draft dari BOM
  // =====================================================
  const handleApplyBomDraft = (bomId) => {
    const bom = (referenceData.boms || []).find((item) => item.id === bomId);

    if (!bom) {
      message.error("BOM tidak ditemukan");
      return;
    }

    const draft = buildWorkLogDraftFromBom(bom);

    form.setFieldsValue({
      ...form.getFieldsValue(),
      ...draft,
    });

    message.success("Draft work log berhasil diambil dari BOM");
  };

  // =====================================================
  // Apply draft dari Production Order
  // =====================================================
  const handleApplyProductionOrderDraft = async (orderId) => {
    try {
      const productionOrder = (referenceData.productionOrders || []).find(
        (item) => item.id === orderId,
      );

      if (!productionOrder) {
        message.error("Production order tidak ditemukan");
        return;
      }

      const draft = await buildWorkLogDraftFromProductionOrder(productionOrder);

      form.setFieldsValue({
        ...form.getFieldsValue(),
        ...draft,
        sourceType: "production_order",
      });

      message.success("Draft work log berhasil diambil dari Production Order");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal mengambil draft dari PO");
    }
  };

  // =====================================================
  // Modal material usage
  // =====================================================
  const openMaterialModal = (index = null, record = null) => {
    setEditingMaterialIndex(index);
    materialForm.setFieldsValue(
      record
        ? { ...DEFAULT_WORK_LOG_MATERIAL_USAGE, ...record }
        : DEFAULT_WORK_LOG_MATERIAL_USAGE,
    );
    setMaterialModalVisible(true);
  };

  // =====================================================
  // Modal output
  // =====================================================
  const openOutputModal = (index = null, record = null) => {
    setEditingOutputIndex(index);
    outputForm.setFieldsValue(
      record
        ? { ...DEFAULT_WORK_LOG_OUTPUT, ...record }
        : DEFAULT_WORK_LOG_OUTPUT,
    );
    setOutputModalVisible(true);
  };

  const handleSaveMaterialUsage = async () => {
    try {
      const values = await materialForm.validateFields();
      const options = getMaterialOptions(values.itemType);
      const selected = options.find(
        (item) => item.value === values.itemId,
      )?.raw;

      const line = buildWorkLogMaterialUsageFormLine({
        values,
        selectedItem: selected,
      });

      const current = getFormArrayValue(form, "materialUsages");
      const next = upsertArrayItemByIndex(
        current,
        editingMaterialIndex,
        line,
      );

      form.setFieldValue("materialUsages", next);
      setMaterialModalVisible(false);
      setEditingMaterialIndex(null);
      materialForm.resetFields();
    } catch (error) {
      if (error?.errorFields) return;
      console.error(error);
      message.error("Gagal menyimpan material usage");
    }
  };

  const handleRemoveMaterialUsage = (index) => {
    const current = getFormArrayValue(form, "materialUsages");
    form.setFieldValue(
      "materialUsages",
      removeArrayItemByIndex(current, index),
    );
  };

  const handleSaveOutput = async () => {
    try {
      const values = await outputForm.validateFields();

      const options =
        values.outputType === "semi_finished_material"
          ? (referenceData.semiFinishedMaterials || []).map((item) => ({
              value: item.id,
              raw: item,
            }))
          : (referenceData.products || []).map((item) => ({
              value: item.id,
              raw: item,
            }));

      const selected = options.find(
        (item) => item.value === values.outputIdRef,
      )?.raw;

      const line = buildWorkLogOutputFormLine({
        values,
        selectedOutput: selected,
      });

      const current = getFormArrayValue(form, "outputs");
      const next = upsertArrayItemByIndex(
        current,
        editingOutputIndex,
        line,
      );

      form.setFieldValue("outputs", next);
      setOutputModalVisible(false);
      setEditingOutputIndex(null);
      outputForm.resetFields();
    } catch (error) {
      if (error?.errorFields) return;
      console.error(error);
      message.error("Gagal menyimpan output");
    }
  };

  const handleRemoveOutput = (index) => {
    const current = getFormArrayValue(form, "outputs");
    form.setFieldValue(
      "outputs",
      removeArrayItemByIndex(current, index),
    );
  };

  // =====================================================
  // Submit work log
  // Jika sourceType = production_order dan belum ada editing record,
  // create langsung dari order agar status PO ikut in_production
  // =====================================================
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const selectedTarget = getTargetOptions(values.targetType).find(
        (item) => item.value === values.targetId,
      )?.raw;

      const selectedStep = (referenceData.productionSteps || []).find(
        (item) => item.id === values.stepId,
      );

      const selectedEmployees = (referenceData.employees || []).filter((item) =>
        (values.workerIds || []).includes(item.id),
      );

      const selectedProfile = (referenceData.productionProfiles || []).find(
        (item) => item.id === values.productionProfileId,
      );

      const payload = {
        ...values,
        workDate: values.workDate ? values.workDate.toDate() : null,
        targetCode: selectedTarget?.code || "",
        targetName: selectedTarget?.name || "",
        targetUnit: selectedTarget?.unit || values.targetUnit || "pcs",
        productionProfileName: selectedProfile?.profileName || '',
        productionProfile: {
          ...(selectedProfile || {}),
          workBasisType: selectedStep?.workBasisType || '',
          referenceYieldPerBaseQty:
            selectedStep?.workBasisType === 'per_meter'
              ? (selectedStep?.name || '').toLowerCase().includes('daun')
                ? selectedProfile?.leafYieldPerMeter
                : selectedProfile?.petalYieldPerMeter
              : selectedStep?.workBasisType === 'per_rod_40cm'
                ? selectedProfile?.stemYieldPerRod40cm
                : 0,
          flowerEquivalentPerBaseQty:
            selectedStep?.workBasisType === 'per_meter'
              ? (selectedStep?.name || '').toLowerCase().includes('daun')
                ? selectedProfile?.flowerEquivalentPerLeafMeter
                : selectedProfile?.flowerEquivalentPerPetalMeter
              : selectedStep?.workBasisType === 'per_rod_40cm'
                ? selectedProfile?.flowerEquivalentPerRod40cm
                : 0,
          batchLeafQty:
            (selectedProfile?.assemblyLeafPackCount || 0) *
            (selectedProfile?.leafYieldPerMeter || 0),
          batchStemQty: selectedProfile?.assemblyStemQty || 0,
        },
        stepCode: selectedStep?.code || "",
        stepName: selectedStep?.name || "",
        sequenceNo: values.sequenceNo || 1,
        workerCodes: selectedEmployees.map((item) => item.code || ""),
        workerNames: selectedEmployees.map((item) => item.name || ""),
        workerCount: selectedEmployees.length,
      };

      setSubmitting(true);

      if (editingRecord?.id) {
        await updateProductionWorkLog(editingRecord.id, payload, null);
        message.success("Work log produksi berhasil diperbarui");
      } else if (
        payload.sourceType === "production_order" &&
        payload.productionOrderId
      ) {
        await createProductionWorkLogFromOrder(
          payload.productionOrderId,
          payload,
          null,
        );
        message.success("Work log dari Production Order berhasil dibuat");
      } else {
        await createProductionWorkLog(payload, null);
        message.success("Work log produksi berhasil ditambahkan");
      }

      setFormVisible(false);
      resetFormState();
      await loadData();
    } catch (error) {
      if (error?.errorFields) return;

      if (error?.type === "validation" && error?.errors) {
        const normalFields = [];
        const globalMessages = [];

        Object.entries(error.errors).forEach(([name, errors]) => {
          if (["materialUsages", "outputs"].includes(name)) {
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
      message.error(error?.message || "Gagal menyimpan work log produksi");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkCompleted = async (record) => {
    try {
      await completeProductionWorkLog(record.id, null);
      message.success(
        "Work log selesai. Stok input dikurangi, reserve dilepas, output ditambahkan, dan PO ditutup.",
      );
      await loadData();
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menyelesaikan work log");
    }
  };

  const columns = [
    {
      title: "No. Work Log",
      dataIndex: "workNumber",
      key: "workNumber",
      width: 160,
      render: (value) => (
        <Typography.Text strong>{value || "-"}</Typography.Text>
      ),
    },
    {
      title: "Tanggal",
      dataIndex: "workDate",
      key: "workDate",
      width: 130,
      render: (value) => {
        const date = value?.toDate ? value.toDate() : value;
        return date ? dayjs(date).format("DD/MM/YYYY") : "-";
      },
    },
    {
      title: "Target / Step",
      key: "targetStep",
      width: 280,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.targetName || "-"}</div>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>
            {record.stepName || "-"}
          </div>
          {record.targetVariantLabel ? (
            <div style={{ fontSize: 12, color: "#8c8c8c" }}>
              Varian: {record.targetVariantLabel}
            </div>
          ) : null}
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>
            PO: {record.productionOrderCode || "-"}
          </div>
        </div>
      ),
    },
    {
      title: "Qty",
      key: "qty",
      width: 150,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>
            Plan: {formatNumber(record.plannedQty)}
          </Typography.Text>
          <Typography.Text type="secondary">
            Good: {formatNumber(record.goodQty)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Biaya Aktual",
      dataIndex: "totalCostActual",
      key: "totalCostActual",
      width: 150,
      render: (value) => formatCurrency(value),
    },
    {
      title: "Source",
      dataIndex: "sourceType",
      key: "sourceType",
      width: 140,
      render: (value) => (
        <Tag color={value === "production_order" ? "purple" : "blue"}>
          {WORK_LOG_SOURCE_TYPE_MAP[value] || value || "-"}
        </Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value) => (
        <Tag color="blue">{WORK_LOG_STATUS_MAP[value] || "-"}</Tag>
      ),
    },
    {
      title: "Aksi",
      key: "actions",
      width: 280,
      fixed: "right",
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
            disabled={record.status === "completed"}
          >
            Edit
          </Button>

          {record.status !== "completed" && record.status !== "cancelled" && (
            <Popconfirm
              title="Tandai work log ini completed?"
              onConfirm={() => handleMarkCompleted(record)}
              okText="Ya"
              cancelText="Batal"
            >
              <Button size="small" type="primary">
                Completed
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <ProductionPageHeader
        title="Work Log Produksi"
        description="Realisasi kerja produksi per step"
        onRefresh={loadData}
        onAdd={handleAdd}
        addLabel="Tambah Work Log"
      />

      <ProductionSummaryCards
        items={[
          { key: "total", title: "Total Work Log", value: summary.total },
          { key: "completed", title: "Completed", value: summary.completed },
          { key: "draft", title: "Draft", value: summary.draft },
          { key: "progress", title: "In Progress", value: summary.inProgress },
        ]}
      />

      <ProductionFilterCard>
          <Col xs={24} md={12}>
            <Input
              placeholder="Cari nomor, target, step, PO..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>

          <Col xs={24} md={12}>
            <Select
              style={{ width: "100%" }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "Semua Status" },
                ...PRODUCTION_WORK_LOG_STATUSES,
              ]}
            />
          </Col>
      </ProductionFilterCard>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredData}
          scroll={{ x: 1650 }}
          locale={{
            emptyText: <Empty description="Belum ada data work log produksi" />,
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
          }}
        />
      </Card>

      <Drawer
        title={
          editingRecord?.id
            ? "Edit Work Log Produksi"
            : "Tambah Work Log Produksi"
        }
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
            ...DEFAULT_PRODUCTION_WORK_LOG_FORM,
            workDate: dayjs(),
            sourceType: "manual",
          }}
        >
          <Divider orientation="left">Informasi Dasar</Divider>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="No. Work Log"
                name="workNumber"
                rules={[
                  { required: true, message: "Nomor work log wajib diisi" },
                ]}
              >
                <Input placeholder="Contoh: WL-0001" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Tanggal"
                name="workDate"
                rules={[{ required: true, message: "Tanggal wajib diisi" }]}
              >
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Source Type" name="sourceType">
                <Select options={PRODUCTION_WORK_LOG_SOURCE_TYPES} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const sourceType = getFieldValue("sourceType");

              return (
                <>
                  {sourceType === "production_order" ? (
                    <Card size="small" style={{ marginBottom: 16 }}>
                      <Row gutter={16}>
                        <Col xs={24} md={18}>
                          <Form.Item
                            label="Production Order"
                            name="productionOrderId"
                          >
                            <Select
                              showSearch
                              optionFilterProp="label"
                              options={productionOrderOptions}
                              placeholder="Pilih Production Order..."
                              onChange={(value) => {
                                if (value) {
                                  handleApplyProductionOrderDraft(value);
                                }
                              }}
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={6}>
                          <Form.Item label=" ">
                            <Button
                              block
                              onClick={() => {
                                const orderId =
                                  form.getFieldValue("productionOrderId");
                                if (orderId) {
                                  handleApplyProductionOrderDraft(orderId);
                                }
                              }}
                            >
                              Apply Draft PO
                            </Button>
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  ) : null}

                  {sourceType === "planned" ? (
                    <Card size="small" style={{ marginBottom: 16 }}>
                      <Row gutter={16}>
                        <Col xs={24} md={18}>
                          <Form.Item label="Production BOM" name="bomId">
                            <Select
                              showSearch
                              optionFilterProp="label"
                              options={(referenceData.boms || []).map(
                                (item) => ({
                                  value: item.id,
                                  label: `${item.code || "-"} - ${item.name || "-"}`,
                                }),
                              )}
                              placeholder="Pilih BOM..."
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={6}>
                          <Form.Item label=" ">
                            <Button
                              block
                              onClick={() => {
                                const bomId = form.getFieldValue("bomId");
                                if (bomId) {
                                  handleApplyBomDraft(bomId);
                                }
                              }}
                            >
                              Apply Draft BOM
                            </Button>
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  ) : null}
                </>
              );
            }}
          </Form.Item>

          <Divider orientation="left">Target & Step</Divider>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="Target Type"
                name="targetType"
                rules={[
                  { required: true, message: "Target type wajib dipilih" },
                ]}
              >
                <Select
                  options={[
                    { value: "semi_finished_material", label: "Semi Finished" },
                    { value: "product", label: "Product" },
                  ]}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={16}>
              <Form.Item
                label="Target Item"
                name="targetId"
                rules={[
                  { required: true, message: "Target item wajib dipilih" },
                ]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={getTargetOptions(targetTypeValue)}
                  placeholder="Pilih target item..."
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={24}>
              <Form.Item label="Profil Produksi" name="productionProfileId">
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={getProductionProfileOptions(targetIdValue)}
                  placeholder="Pilih profil produksi untuk target ini..."
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={16}>
              <Form.Item
                label="Production Step"
                name="stepId"
                rules={[{ required: true, message: "Step wajib dipilih" }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={stepOptions}
                  placeholder="Pilih step..."
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Sequence No" name="sequenceNo">
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Qty & Operator</Divider>

          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item
                label="Planned Qty"
                name="plannedQty"
                rules={[{ required: true, message: "Planned qty wajib diisi" }]}
              >
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Qty Input Dasar" name="baseInputQty">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Sisa Daun Aktual" name="leftoverLeafQty">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Sisa Kawat Aktual" name="leftoverStemQty">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Good Qty" name="goodQty">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Reject Qty" name="rejectQty">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Rework Qty" name="reworkQty">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="Worker" name="workerIds">
                <Select
                  mode="multiple"
                  showSearch
                  optionFilterProp="label"
                  options={employeeOptions}
                  placeholder="Pilih operator produksi..."
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Sisa Setara Bunga Kelopak" name="leftoverPetalFlowerEquivalent">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          {selectedProductionProfile ? (
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}><strong>Profil:</strong> {selectedProductionProfile.profileName || '-'}</Col>
                <Col xs={24} md={8}><strong>Teoritis Bunga:</strong> {formatNumber(monitoringPreview.theoreticalFlowerEquivalent || 0)}</Col>
                <Col xs={24} md={8}><strong>Miss %:</strong> {Number(monitoringPreview.missPercent || 0).toFixed(2)}%</Col>
                <Col xs={24} md={8}><strong>Miss Kelopak:</strong> {formatNumber(monitoringPreview.missPetalQty || 0)} pcs</Col>
                <Col xs={24} md={8}><strong>Miss Daun:</strong> {formatNumber(monitoringPreview.missLeafQty || 0)} pcs</Col>
                <Col xs={24} md={8}><strong>Miss Kawat:</strong> {formatNumber(monitoringPreview.missStemQty || 0)} pcs</Col>
              </Row>
            </Card>
          ) : null}

          <EditableLineSection
            title="Material Usages"
            addButtonText="Tambah Material Usage"
            onAdd={() => openMaterialModal()}
            dataSource={form.getFieldValue("materialUsages") || []}
            emptyText="Belum ada material usage"
            columns={[
              {
                title: "Item",
                key: "item",
                render: (_, record) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{record.itemName || "-"}</div>
                    <div style={{ fontSize: 12, color: "#8c8c8c" }}>{record.itemCode || "-"}</div>
                    {record.resolvedVariantLabel ? (
                      <div style={{ fontSize: 12, color: "#8c8c8c" }}>
                        Varian: {record.resolvedVariantLabel}
                      </div>
                    ) : null}
                  </div>
                ),
              },
              {
                title: "Qty",
                key: "qty",
                width: 180,
                render: (_, record) => (
                  <Space direction="vertical" size={0}>
                    <Typography.Text>
                      Plan: {formatNumber(record.plannedQty)}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      Actual: {formatNumber(record.actualQty)}
                    </Typography.Text>
                  </Space>
                ),
              },
              {
                title: "Total Cost",
                dataIndex: "totalCostSnapshot",
                width: 150,
                render: (value) => formatCurrency(value),
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
                      title="Hapus material usage ini?"
                      onConfirm={() => handleRemoveMaterialUsage(index)}
                      okText="Ya"
                      cancelText="Batal"
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />

          <EditableLineSection
            title="Outputs"
            addButtonText="Tambah Output"
            onAdd={() => openOutputModal()}
            dataSource={form.getFieldValue("outputs") || []}
            emptyText="Belum ada output"
            columns={[
              {
                title: "Output",
                key: "output",
                render: (_, record) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{record.outputName || "-"}</div>
                    <div style={{ fontSize: 12, color: "#8c8c8c" }}>{record.outputCode || "-"}</div>
                    {record.outputVariantLabel ? (
                      <div style={{ fontSize: 12, color: "#8c8c8c" }}>
                        Varian: {record.outputVariantLabel}
                      </div>
                    ) : null}
                  </div>
                ),
              },
              {
                title: "Qty",
                key: "qty",
                width: 180,
                render: (_, record) => (
                  <Space direction="vertical" size={0}>
                    <Typography.Text>
                      Good: {formatNumber(record.goodQty)}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      Reject: {formatNumber(record.rejectQty)}
                    </Typography.Text>
                  </Space>
                ),
              },
              {
                title: "Aksi",
                width: 140,
                render: (_, record, index) => (
                  <Space>
                    <Button size="small" onClick={() => openOutputModal(index, record)}>
                      Edit
                    </Button>
                    <Popconfirm
                      title="Hapus output ini?"
                      onConfirm={() => handleRemoveOutput(index)}
                      okText="Ya"
                      cancelText="Batal"
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />

          <Divider orientation="left">Biaya & Catatan</Divider>

          <Row gutter={16}>
            <Col xs={24} md={4}>
              <Form.Item label="Labor Cost" name="laborCostActual">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={4}>
              <Form.Item label="Overhead Cost" name="overheadCostActual">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={4}>
              <Form.Item label="Scrap Qty" name="scrapQty">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Catatan" name="notes">
                <Input.TextArea rows={2} placeholder="Catatan work log..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>

      <Drawer
        title="Detail Work Log Produksi"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={860}
      >
        {!selectedRecord ? (
          <Empty description="Tidak ada data" />
        ) : (
          <>
            <Descriptions
              column={1}
              bordered
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label="No. Work Log">
                {selectedRecord.workNumber || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Tanggal">
                {selectedRecord.workDate
                  ? dayjs(
                      selectedRecord.workDate?.toDate?.() ||
                        selectedRecord.workDate,
                    ).format("DD/MM/YYYY")
                  : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Source">
                {WORK_LOG_SOURCE_TYPE_MAP[selectedRecord.sourceType] ||
                  selectedRecord.sourceType ||
                  "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Production Order">
                {selectedRecord.productionOrderCode || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Target Type">
                {WORK_LOG_TARGET_TYPE_MAP[selectedRecord.targetType] || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Target">
                {selectedRecord.targetName || "-"}
                {selectedRecord.targetVariantLabel ? ` | Varian: ${selectedRecord.targetVariantLabel}` : ""}
              </Descriptions.Item>
              <Descriptions.Item label="Step">
                {selectedRecord.stepName || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Profil Produksi">
                {selectedRecord.productionProfileName || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                {WORK_LOG_STATUS_MAP[selectedRecord.status] || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Total Cost Actual">
                {formatCurrency(selectedRecord.totalCostActual)}
              </Descriptions.Item>
              <Descriptions.Item label="Cost per Good Unit">
                {formatCurrency(selectedRecord.costPerGoodUnit)}
              </Descriptions.Item>
              <Descriptions.Item label="Catatan">
                {selectedRecord.notes || "-"}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">Material Usages</Divider>

            <Table
              rowKey={(record) => record.id}
              pagination={false}
              size="small"
              dataSource={selectedRecord.materialUsages || []}
              locale={{ emptyText: "Belum ada material usage" }}
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
                      {record.resolvedVariantLabel ? (
                        <div style={{ fontSize: 12, color: "#8c8c8c" }}>
                          Varian: {record.resolvedVariantLabel}
                        </div>
                      ) : null}
                    </div>
                  ),
                },
                {
                  title: "Qty",
                  key: "qty",
                  render: (_, record) => (
                    <Space direction="vertical" size={0}>
                      <Typography.Text>
                        Plan: {formatNumber(record.plannedQty)}
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        Actual: {formatNumber(record.actualQty)}
                      </Typography.Text>
                    </Space>
                  ),
                },
                {
                  title: "Total Cost",
                  dataIndex: "totalCostSnapshot",
                  render: (value) => formatCurrency(value),
                },
              ]}
            />

            <Divider orientation="left">Outputs</Divider>

            <Table
              rowKey={(record) => record.id}
              pagination={false}
              size="small"
              dataSource={selectedRecord.outputs || []}
              locale={{ emptyText: "Belum ada output" }}
              columns={[
                {
                  title: "Output",
                  key: "output",
                  render: (_, record) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {record.outputName || "-"}
                      </div>
                      <div style={{ fontSize: 12, color: "#8c8c8c" }}>
                        {record.outputCode || "-"}
                      </div>
                      {record.outputVariantLabel ? (
                        <div style={{ fontSize: 12, color: "#8c8c8c" }}>
                          Varian: {record.outputVariantLabel}
                        </div>
                      ) : null}
                    </div>
                  ),
                },
                {
                  title: "Good",
                  dataIndex: "goodQty",
                  render: (value) => formatNumber(value),
                },
                {
                  title: "Reject",
                  dataIndex: "rejectQty",
                  render: (value) => formatNumber(value),
                },
                {
                  title: "Rework",
                  dataIndex: "reworkQty",
                  render: (value) => formatNumber(value),
                },
              ]}
            />
          </>
        )}
      </Drawer>

      <Modal
        title={
          editingMaterialIndex !== null
            ? "Edit Material Usage"
            : "Tambah Material Usage"
        }
        open={materialModalVisible}
        onCancel={() => {
          setMaterialModalVisible(false);
          setEditingMaterialIndex(null);
          materialForm.resetFields();
        }}
        onOk={handleSaveMaterialUsage}
        okText="Simpan"
        destroyOnClose
      >
        <Form
          form={materialForm}
          layout="vertical"
          initialValues={DEFAULT_WORK_LOG_MATERIAL_USAGE}
        >
          <Form.Item
            label="Item Type"
            name="itemType"
            rules={[{ required: true, message: "Item type wajib dipilih" }]}
          >
            <Select
              options={[
                { value: "raw_material", label: "Raw Material" },
                { value: "semi_finished_material", label: "Semi Finished" },
              ]}
            />
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue, setFieldValue }) => {
              const itemType = getFieldValue("itemType");
              return (
                <Form.Item
                  label="Item"
                  name="itemId"
                  rules={[{ required: true, message: "Item wajib dipilih" }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={getMaterialOptions(itemType)}
                    placeholder="Pilih item..."
                    onChange={() => {
                      setFieldValue("resolvedVariantKey", undefined);
                      setFieldValue("resolvedVariantLabel", "");
                    }}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue, setFieldValue }) => {
              const itemType = getFieldValue("itemType");
              const itemId = getFieldValue("itemId");
              const selectedItem = getMaterialOptions(itemType).find((item) => item.value === itemId)?.raw;
              const hasVariants = inferHasVariants(selectedItem || {});
              const variantOptions = buildVariantOptionsFromItem(selectedItem || {});

              if (!hasVariants) return null;

              return (
                <Form.Item
                  label="Varian Material"
                  name="resolvedVariantKey"
                  rules={[{ required: true, message: "Varian material wajib dipilih" }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={variantOptions}
                    placeholder="Pilih varian material..."
                    onChange={(value) => {
                      const selectedVariant = variantOptions.find((item) => item.value === value);
                      setFieldValue("resolvedVariantLabel", selectedVariant?.label || "");
                    }}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Planned Qty" name="plannedQty">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Actual Qty" name="actualQty">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Unit" name="unit">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Cost / Unit Snapshot" name="costPerUnitSnapshot">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item label="Catatan" name="notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingOutputIndex !== null ? "Edit Output" : "Tambah Output"}
        open={outputModalVisible}
        onCancel={() => {
          setOutputModalVisible(false);
          setEditingOutputIndex(null);
          outputForm.resetFields();
        }}
        onOk={handleSaveOutput}
        okText="Simpan"
        destroyOnClose
      >
        <Form
          form={outputForm}
          layout="vertical"
          initialValues={DEFAULT_WORK_LOG_OUTPUT}
        >
          <Form.Item
            label="Output Type"
            name="outputType"
            rules={[{ required: true, message: "Output type wajib dipilih" }]}
          >
            <Select
              options={[
                { value: "semi_finished_material", label: "Semi Finished" },
                { value: "product", label: "Product" },
              ]}
            />
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue, setFieldValue }) => {
              const outputType = getFieldValue("outputType");

              const options =
                outputType === "semi_finished_material"
                  ? (referenceData.semiFinishedMaterials || []).map((item) => ({
                      value: item.id,
                      label: `${item.code || "-"} - ${item.name || "-"}`,
                      raw: item,
                    }))
                  : (referenceData.products || []).map((item) => ({
                      value: item.id,
                      label: `${item.code || "-"} - ${item.name || "-"}`,
                      raw: item,
                    }));

              return (
                <Form.Item
                  label="Output Item"
                  name="outputIdRef"
                  rules={[
                    { required: true, message: "Output item wajib dipilih" },
                  ]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={options}
                    placeholder="Pilih output item..."
                    onChange={() => {
                      setFieldValue("outputVariantKey", undefined);
                      setFieldValue("outputVariantLabel", "");
                    }}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue, setFieldValue }) => {
              const outputType = getFieldValue("outputType");
              const outputIdRef = getFieldValue("outputIdRef");
              const selectedOutput = (
                outputType === "semi_finished_material"
                  ? (referenceData.semiFinishedMaterials || [])
                  : (referenceData.products || [])
              ).find((item) => item.id === outputIdRef);
              const hasVariants = inferHasVariants(selectedOutput || {});
              const variantOptions = buildVariantOptionsFromItem(selectedOutput || {});

              if (!hasVariants) return null;

              return (
                <Form.Item
                  label="Varian Output"
                  name="outputVariantKey"
                  rules={[{ required: true, message: "Varian output wajib dipilih" }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={variantOptions}
                    placeholder="Pilih varian output..."
                    onChange={(value) => {
                      const selectedVariant = variantOptions.find((item) => item.value === value);
                      setFieldValue("outputVariantLabel", selectedVariant?.label || "");
                    }}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Good Qty" name="goodQty">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Reject Qty" name="rejectQty">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Rework Qty" name="reworkQty">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Cost / Unit" name="costPerUnit">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Unit" name="unit">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Catatan" name="notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProductionWorkLogs;
