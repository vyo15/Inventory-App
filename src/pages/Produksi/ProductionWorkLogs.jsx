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
  generateProductionWorkLogNumber,
  getAllProductionWorkLogs,
  getWorkLogReferenceData,
  updateProductionWorkLog,
} from "../../services/Produksi/productionWorkLogsService";

import formatNumber from "../../utils/formatters/numberId";
import formatCurrency from "../../utils/formatters/currencyId";
import { getFormArrayValue, removeArrayItemByIndex, upsertArrayItemByIndex } from "../../utils/forms/formArrayHelpers";
import { buildWorkLogMaterialUsageFormLine, buildWorkLogOutputFormLine } from "../../utils/produksi/productionLineBuilders";
import { buildVariantOptionsFromItem, inferHasVariants } from "../../utils/variants/variantStockHelpers";
import { isProductionWorkLogCompleted } from "../../utils/produksi/productionFlowGuards";

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
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [completingRecord, setCompletingRecord] = useState(null);

  // SECTION: form instances
  const [form] = Form.useForm();
  const [materialForm] = Form.useForm();
  const [outputForm] = Form.useForm();
  const [completeForm] = Form.useForm();

  // SECTION: watch source
  const sourceTypeValue = Form.useWatch("sourceType", form);
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

      if (Array.isArray(refResult?.metaWarnings) && refResult.metaWarnings.length > 0) {
        message.warning(refResult.metaWarnings[0]);
      }
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


  // =====================================================
  // Handler tambah work log manual
  // Catatan maintainability:
  // - Flow aktif tetap mendorong start dari Production Order.
  // - Namun draft manual/planned tetap dipertahankan agar test checklist
  //   dan kebutuhan operasional lama tidak putus karena patch UI.
  // =====================================================
  const openCreateWorkLogDrawer = async (sourceType = "manual") => {
    resetFormState();
    setFormVisible(true);

    try {
      const generatedWorkNumber = await generateProductionWorkLogNumber();
      form.setFieldsValue({
        ...DEFAULT_PRODUCTION_WORK_LOG_FORM,
        workNumber: generatedWorkNumber,
        workDate: dayjs(),
        sourceType,
        materialUsages: [],
        outputs: [],
        workerIds: [],
        productionOrderId: undefined,
        productionProfileId: undefined,
      });
    } catch (error) {
      console.error(error);
      form.setFieldsValue({
        ...DEFAULT_PRODUCTION_WORK_LOG_FORM,
        workDate: dayjs(),
        sourceType,
        materialUsages: [],
        outputs: [],
        workerIds: [],
        productionOrderId: undefined,
        productionProfileId: undefined,
      });
      message.warning("Nomor work log otomatis gagal dibuat. Silakan isi manual.");
    }
  };

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

  // =====================================================
  // Handler edit work log
  // Catatan:
  // - drawer form masih dipakai untuk mode edit
  // - flow tambah manual saat ini tidak dipakai di UI aktif, jadi handler add
  //   yang sebelumnya tidak terpakai dihapus agar file lebih rapih
  // =====================================================
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

  const isProductionOrderLinkedForm = sourceTypeValue === "production_order";

  const monitoringPreview = useMemo(() => {
    const monitoringBasisType =
      selectedStepForMonitoring?.basisType ||
      selectedStepForMonitoring?.workBasisType ||
      '';

    return calculateProductionMonitoring(
      {
        ...(selectedProductionProfile || {}),
        workBasisType: monitoringBasisType,
        referenceYieldPerBaseQty:
          monitoringBasisType === 'per_meter'
            ? (selectedStepForMonitoring?.name || '').toLowerCase().includes('daun')
              ? selectedProductionProfile?.leafYieldPerMeter
              : selectedProductionProfile?.petalYieldPerMeter
            : monitoringBasisType === 'per_rod_40cm'
              ? selectedProductionProfile?.stemYieldPerRod40cm
              : 0,
        flowerEquivalentPerBaseQty:
          monitoringBasisType === 'per_meter'
            ? (selectedStepForMonitoring?.name || '').toLowerCase().includes('daun')
              ? selectedProductionProfile?.flowerEquivalentPerLeafMeter
              : selectedProductionProfile?.flowerEquivalentPerPetalMeter
            : monitoringBasisType === 'per_rod_40cm'
              ? selectedProductionProfile?.flowerEquivalentPerRod40cm
              : 0,
        batchLeafQty:
          (selectedProductionProfile?.assemblyLeafPackCount || 0) *
          (selectedProductionProfile?.leafYieldPerMeter || 0),
        batchStemQty: selectedProductionProfile?.assemblyStemQty || 0,
      },
      {
        workBasisType: monitoringBasisType,
        baseInputQty: baseInputQtyValue,
        goodQty: goodQtyValue,
        leftoverLeafQty: leftoverLeafQtyValue,
        leftoverStemQty: leftoverStemQtyValue,
        leftoverPetalFlowerEquivalent: leftoverPetalFlowerEquivalentValue,
      },
    );
  },    [
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

      const selectedStepBasisType =
        selectedStep?.basisType || selectedStep?.workBasisType || '';

      const payload = {
        ...values,
        workDate: values.workDate ? values.workDate.toDate() : null,
        targetCode: selectedTarget?.code || "",
        targetName: selectedTarget?.name || "",
        targetUnit: selectedTarget?.unit || values.targetUnit || "pcs",
        productionProfileName: selectedProfile?.profileName || '',
        productionProfile: {
          ...(selectedProfile || {}),
          workBasisType: selectedStepBasisType,
          referenceYieldPerBaseQty:
            selectedStepBasisType === 'per_meter'
              ? (selectedStep?.name || '').toLowerCase().includes('daun')
                ? selectedProfile?.leafYieldPerMeter
                : selectedProfile?.petalYieldPerMeter
              : selectedStepBasisType === 'per_rod_40cm'
                ? selectedProfile?.stemYieldPerRod40cm
                : 0,
          flowerEquivalentPerBaseQty:
            selectedStepBasisType === 'per_meter'
              ? (selectedStep?.name || '').toLowerCase().includes('daun')
                ? selectedProfile?.flowerEquivalentPerLeafMeter
                : selectedProfile?.flowerEquivalentPerPetalMeter
              : selectedStepBasisType === 'per_rod_40cm'
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

        // =====================================================
        // ACTIVE / GUARDED
        // Snapshot payroll rule step dibawa ke Work Log agar flow
        // Work Log completed -> Payroll tidak lagi membaca fallback lama
        // secara diam-diam dari master karyawan.
        // =====================================================
        stepPayrollMode: selectedStep?.payrollMode || "per_qty",
        stepPayrollRate: Number(selectedStep?.payrollRate || 0),
        stepPayrollQtyBase: Number(selectedStep?.payrollQtyBase || 1),
        stepPayrollOutputBasis: selectedStep?.payrollOutputBasis || "good_qty",
        stepPayrollClassification: selectedStep?.payrollClassification || "direct_labor",
        stepPayrollIncludeInHpp:
          typeof selectedStep?.includePayrollInHpp === "boolean"
            ? selectedStep.includePayrollInHpp
            : true,
        stepProcessType: selectedStep?.processType || "raw_to_semi",
        stepPayrollRuleSource: "production_step",

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

  // =====================================================
  // Popup selesai produksi
  // Catatan maintainability:
  // - User isi actual result, reject, rework, operator, dan catatan dari popup ini
  // - Setelah update work log, baru service complete menambah stok output dan menutup PO
  // =====================================================
  const handleOpenComplete = (record) => {
    setCompletingRecord(record);
    completeForm.setFieldsValue({
      goodQty: record.goodQty || 0,
      rejectQty: record.rejectQty || 0,
      reworkQty: record.reworkQty || 0,
      workerIds: Array.isArray(record.workerIds) ? record.workerIds : [],
      notes: record.notes || '',
    });
    setCompleteModalVisible(true);
  };

  const handleMarkCompleted = async () => {
    try {
      const values = await completeForm.validateFields();
      if (!completingRecord?.id) return;

      await updateProductionWorkLog(
        completingRecord.id,
        {
          ...completingRecord,
          goodQty: values.goodQty,
          rejectQty: values.rejectQty,
          reworkQty: values.reworkQty,
          workerIds: values.workerIds || [],
          workerNames: (referenceData.employees || [])
            .filter((item) => (values.workerIds || []).includes(item.id))
            .map((item) => item.name || ''),
          workerCodes: (referenceData.employees || [])
            .filter((item) => (values.workerIds || []).includes(item.id))
            .map((item) => item.code || ''),
          workerCount: Array.isArray(values.workerIds) ? values.workerIds.length : 0,
          notes: values.notes || '',
        },
        null,
      );

      await completeProductionWorkLog(completingRecord.id, null);
      message.success('Work log selesai. Output ditambahkan dan PO ditutup.');
      setCompleteModalVisible(false);
      setCompletingRecord(null);
      completeForm.resetFields();
      await loadData();
    } catch (error) {
      if (error?.errorFields) return;
      console.error(error);
      message.error(error?.message || 'Gagal menyelesaikan work log');
    }
  };


  // =====================================================
  // Helper presentasi daftar & drawer detail
  // Catatan maintainability:
  // - Helper di bawah hanya untuk kebutuhan tampilan / readability UI.
  // - Jangan dipakai untuk mengubah logika transaksi, stok, atau status produksi.
  // - Tujuannya agar tampilan work log tetap rapi, profesional, dan mudah diaudit.
  // =====================================================
  const formatDisplayDate = (value, format = "DD/MM/YYYY") => {
    const rawValue = value?.toDate ? value.toDate() : value;
    return rawValue ? dayjs(rawValue).format(format) : "-";
  };

  const getWorkLogStatusTagColor = (status) => {
    switch (status) {
      case "completed":
        return "green";
      case "in_progress":
        return "blue";
      case "cancelled":
        return "red";
      case "draft":
      default:
        return "default";
    }
  };

  const getWorkLogSourceTagColor = (sourceType) =>
    sourceType === "production_order" ? "purple" : "blue";

  const getStockSourceTagColor = (stockSourceType) =>
    stockSourceType === "variant" ? "purple" : "default";

  // =====================================================
  // Helper presentasi batch 1.
  // Dipakai untuk mengganti blok metadata tabel yang sebelumnya banyak inline
  // style menjadi class shared agar lebih rapi dan mudah di-maintain.
  // =====================================================
  const workLogUiClassNames = {
    stack: "ims-cell-stack ims-cell-stack-tight",
    meta: "ims-cell-meta",
    title: "ims-cell-title",
  };

  const renderWorkLogCellBlock = (primary, secondaryLines = []) => (
    <div className={workLogUiClassNames.stack}>
      <div className={workLogUiClassNames.title}>{primary || "-"}</div>
      {secondaryLines.filter(Boolean).map((line, index) => (
        <div key={index} className={workLogUiClassNames.meta}>{line}</div>
      ))}
    </div>
  );

  // =====================================================
  // Data turunan drawer detail
  // - Semua data di bawah dibentuk dari selectedRecord aktif.
  // - Dengan pola ini, drawer detail lebih mudah dirapikan tanpa mencampur
  //   logika presentasi dengan markup yang terlalu panjang.
  // =====================================================
  const detailMetricCards = useMemo(() => {
    if (!selectedRecord) return [];

    const unitLabel = selectedRecord.targetUnit || "pcs";

    return [
      {
        key: "batch",
        label: "Qty Batch",
        value: formatNumber(selectedRecord.plannedQty || 0),
        helper: "Jumlah batch yang dikerjakan",
      },
      {
        key: "estimate",
        label: "Estimasi Output",
        value: `${formatNumber(selectedRecord.theoreticalOutputQty || 0)} ${unitLabel}`,
        helper: `Step: ${selectedRecord.stepName || "-"}`,
      },
      {
        key: "good",
        label: "Good Output",
        value: `${formatNumber(selectedRecord.goodQty || 0)} ${unitLabel}`,
        helper: `Reject ${formatNumber(selectedRecord.rejectQty || 0)} | Rework ${formatNumber(selectedRecord.reworkQty || 0)}`,
      },
      {
        key: "cost",
        label: "Total Biaya",
        value: formatCurrency(selectedRecord.totalCostActual || 0),
        helper: `Cost / good unit ${formatCurrency(selectedRecord.costPerGoodUnit || 0)}`,
      },
    ];
  }, [selectedRecord]);

  const detailWorkerNames = useMemo(() => {
    if (!selectedRecord || !Array.isArray(selectedRecord.workerNames)) {
      return [];
    }

    return selectedRecord.workerNames.filter(Boolean);
  }, [selectedRecord]);

  const detailMaterialColumns = useMemo(
    () => [
      {
        title: "Material",
        key: "item",
        render: (_, record) => (
          renderWorkLogCellBlock(record.itemName || "-", [
            record.itemCode || "-",
            record.resolvedVariantLabel ? `Varian: ${record.resolvedVariantLabel}` : null,
          ])
        ),
      },
      {
        title: "Sumber Stok",
        key: "stockSource",
        width: 160,
        render: (_, record) => (
          <div className={workLogUiClassNames.stack}>
            <Tag className="ims-status-tag" color={getStockSourceTagColor(record.stockSourceType)}>
              {record.stockSourceType === "variant" ? "Variant" : "Master"}
            </Tag>
            {record.stockSourceType === "variant" && record.resolvedVariantLabel ? (
              <Typography.Text type="secondary" className={workLogUiClassNames.meta}>
                {record.resolvedVariantLabel}
              </Typography.Text>
            ) : null}
          </div>
        ),
      },
      {
        title: "Pemakaian",
        key: "qty",
        width: 180,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text>
              Plan: {formatNumber(record.plannedQty)} {record.unit || ""}
            </Typography.Text>
            <Typography.Text type="secondary">
              Actual: {formatNumber(record.actualQty)} {record.unit || ""}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: "Biaya",
        key: "cost",
        width: 180,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text>
              {formatCurrency(record.totalCostSnapshot || 0)}
            </Typography.Text>
            <Typography.Text type="secondary">
              Unit: {formatCurrency(record.unitCostSnapshot || 0)}
            </Typography.Text>
          </Space>
        ),
      },
    ],
    [],
  );

  const detailOutputColumns = useMemo(
    () => [
      {
        title: "Output",
        key: "output",
        render: (_, record) => (
          renderWorkLogCellBlock(record.outputName || "-", [
            record.outputCode || "-",
            WORK_LOG_TARGET_TYPE_MAP[record.outputType] || record.outputType || "-",
            record.outputVariantLabel ? `Varian: ${record.outputVariantLabel}` : null,
          ])
        ),
      },
      {
        title: "Target Stok",
        key: "stockTarget",
        width: 170,
        render: (_, record) => (
          <div className={workLogUiClassNames.stack}>
            <Tag className="ims-status-tag" color={getStockSourceTagColor(record.stockSourceType)}>
              {record.stockSourceType === "variant" ? "Masuk ke Variant" : "Masuk ke Master"}
            </Tag>
            {record.outputVariantLabel ? (
              <Typography.Text type="secondary" className={workLogUiClassNames.meta}>
                {record.outputVariantLabel}
              </Typography.Text>
            ) : null}
          </div>
        ),
      },
      {
        title: "Hasil",
        key: "result",
        width: 180,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text>
              Good: {formatNumber(record.goodQty)} {record.unit || ""}
            </Typography.Text>
            <Typography.Text type="secondary">
              Reject: {formatNumber(record.rejectQty)} {record.unit || ""}
            </Typography.Text>
            <Typography.Text type="secondary">
              Rework: {formatNumber(record.reworkQty)} {record.unit || ""}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: "Mutasi Stok",
        key: "stockAdded",
        width: 150,
        render: (_, record) => (
          <Tag className="ims-status-tag" color={record.stockAdded ? "green" : "default"}>
            {record.stockAdded ? "Sudah masuk stok" : "Belum diposting"}
          </Tag>
        ),
      },
    ],
    [],
  );

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
      render: (value) => formatDisplayDate(value),
    },
    {
      title: "Target / Step",
      key: "targetStep",
      width: 280,
      render: (_, record) => (
        renderWorkLogCellBlock(record.targetName || "-", [
          record.stepName || "-",
          record.targetVariantLabel ? `Varian: ${record.targetVariantLabel}` : null,
          `PO: ${record.productionOrderCode || "-"}`,
        ])
      ),
    },
    {
      title: "Qty",
      key: "qty",
      width: 150,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>Batch: {formatNumber(record.plannedQty)}</Typography.Text>
          <Typography.Text type="secondary">Estimasi: {formatNumber(record.theoreticalOutputQty || 0)}</Typography.Text>
          <Typography.Text type="secondary">Good: {formatNumber(record.goodQty)}</Typography.Text>
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
        <Tag className="ims-status-tag" color={getWorkLogSourceTagColor(value)}>
          {WORK_LOG_SOURCE_TYPE_MAP[value] || value || "-"}
        </Tag>
      ),
    },
    {
      // =====================================================
      // SECTION: status sticky
      // Fungsi:
      // - Work Log adalah detail-capable page dan tabelnya lebar, jadi status ikut di-sticky sebelum aksi
      // - ini menjaga status proses tetap terlihat saat user fokus ke aksi detail / edit / complete
      // =====================================================
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      fixed: "right",
      className: "app-table-status-column app-table-fixed-secondary",
      render: (value) => (
        <Tag className="ims-status-tag" color={getWorkLogStatusTagColor(value)}>
          {WORK_LOG_STATUS_MAP[value] || "-"}
        </Tag>
      ),
    },
    {
      // =====================================================
      // SECTION: aksi sticky
      // Fungsi:
      // - Work Log termasuk detail-capable page, jadi Detail wajib ada sebagai pola resmi tabel utama
      // - kolom aksi tetap fixed right agar user tidak perlu scroll horizontal dulu untuk menjalankan aksi utama
      // =====================================================
      title: "Aksi",
      key: "actions",
      width: 280,
      fixed: "right",
      className: "app-table-action-column",
      render: (_, record) => (
        <Space wrap className="ims-action-group">
          <Button
            className="ims-action-button"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            Detail
          </Button>

          <Button
            className="ims-action-button"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            disabled={isProductionWorkLogCompleted(record) || record.status === "cancelled"}
          >
            Edit
          </Button>

          {!isProductionWorkLogCompleted(record) && record.status !== "cancelled" && (
            <Button
              className="ims-action-button"
              size="small"
              type="primary"
              onClick={() => handleOpenComplete(record)}
            >
              Selesaikan
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="ims-page">
      <ProductionPageHeader
        title="Work Log Produksi"
        description="Realisasi kerja produksi dari Production Order (1 PO = 1 Work Log)"
        onRefresh={loadData}
        onAdd={() => openCreateWorkLogDrawer("manual")}
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
              className="ims-filter-control"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "Semua Status" },
                ...PRODUCTION_WORK_LOG_STATUSES,
              ]}
            />
          </Col>
      </ProductionFilterCard>

      <Card className="ims-section-card">
        <Table
          className="ims-table"
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
          {/* =====================================================
              ACTIVE / FINAL - hidden contract fields PO variant.
              Field ini sengaja ikut didaftarkan ke Form agar nilai dari
              Apply Draft PO tetap ikut submit walau tidak diedit manual.
              Source of truth tetap PO; service akan mengunci ulang. */}
          <Form.Item name="bomCode" hidden><Input type="hidden" /></Form.Item>
          <Form.Item name="bomName" hidden><Input type="hidden" /></Form.Item>
          <Form.Item name="productionOrderCode" hidden><Input type="hidden" /></Form.Item>
          <Form.Item name="productionOrderStatusSnapshot" hidden><Input type="hidden" /></Form.Item>
          <Form.Item name="targetCode" hidden><Input type="hidden" /></Form.Item>
          <Form.Item name="targetName" hidden><Input type="hidden" /></Form.Item>
          <Form.Item name="targetUnit" hidden><Input type="hidden" /></Form.Item>
          <Form.Item name="targetVariantKey" hidden><Input type="hidden" /></Form.Item>
          <Form.Item name="targetVariantLabel" hidden><Input type="hidden" /></Form.Item>

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
                  disabled={isProductionOrderLinkedForm}
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
                  disabled={isProductionOrderLinkedForm}
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

          {isProductionOrderLinkedForm ? (
            <Alert
              style={{ marginBottom: 16 }}
              type="info"
              showIcon
              message="Output mengikuti Varian Target dari Production Order"
              description={`Source of truth varian: ${form.getFieldValue("targetVariantLabel") || "Tanpa varian / master"}. Untuk flow PO, target dan output dikunci agar tidak kembali ke master/default.`}
            />
          ) : null}

          <Divider orientation="left">Qty & Operator</Divider>

          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item
                label="Qty Batch"
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
            onAdd={() => {
              if (isProductionOrderLinkedForm) {
                message.warning("Material usage PO dikunci dari requirement Production Order agar varian tidak berubah.");
                return;
              }
              openMaterialModal();
            }}
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
                // Nested editor material usage tetap non-sticky karena berada di dalam modal form dan tidak punya bug horizontal scroll aktif.
                title: "Aksi",
                width: 140,
                className: "app-table-action-column",
                render: (_, record, index) => (
                  isProductionOrderLinkedForm ? (
                    <Tag className="ims-status-tag" color="purple">Dikunci PO</Tag>
                  ) : (
                    <Space className="ims-action-group">
                      <Button className="ims-action-button" size="small" onClick={() => openMaterialModal(index, record)}>
                        Edit
                      </Button>
                      <Popconfirm
                        title="Hapus material usage ini?"
                        onConfirm={() => handleRemoveMaterialUsage(index)}
                        okText="Ya"
                        cancelText="Batal"
                      >
                        <Button className="ims-action-button" size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  )
                ),
              },
            ]}
          />

          <EditableLineSection
            title="Outputs"
            addButtonText="Tambah Output"
            onAdd={() => {
              if (isProductionOrderLinkedForm) {
                message.warning("Output PO mengikuti target variant dari Production Order dan tidak boleh diganti manual.");
                return;
              }
              openOutputModal();
            }}
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
                // Nested editor output tetap non-sticky karena area ini compact dan aksi sudah langsung terlihat tanpa scroll tambahan.
                title: "Aksi",
                width: 140,
                className: "app-table-action-column",
                render: (_, record, index) => (
                  isProductionOrderLinkedForm ? (
                    <Tag className="ims-status-tag" color="purple">Dikunci PO</Tag>
                  ) : (
                    <Space className="ims-action-group">
                      <Button className="ims-action-button" size="small" onClick={() => openOutputModal(index, record)}>
                        Edit
                      </Button>
                      <Popconfirm
                        title="Hapus output ini?"
                        onConfirm={() => handleRemoveOutput(index)}
                        okText="Ya"
                        cancelText="Batal"
                      >
                        <Button className="ims-action-button" size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  )
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
        width={980}
      >
        {!selectedRecord ? (
          <Empty description="Tidak ada data" />
        ) : (
          <>
            {/* ------------------------------------------------------------- */}
            {/* SECTION: ringkasan cepat untuk audit work log                 */}
            {/* Tujuan: user langsung tahu konteks kerja, status, dan hasil.  */}
            {/* ------------------------------------------------------------- */}
            <Space wrap size={[8, 8]} style={{ marginBottom: 16 }}>
              <Tag className="ims-status-tag" color={getWorkLogStatusTagColor(selectedRecord.status)}>
                {WORK_LOG_STATUS_MAP[selectedRecord.status] || "-"}
              </Tag>
              <Tag className="ims-status-tag" color={getWorkLogSourceTagColor(selectedRecord.sourceType)}>
                {WORK_LOG_SOURCE_TYPE_MAP[selectedRecord.sourceType] ||
                  selectedRecord.sourceType ||
                  "-"}
              </Tag>
              <Tag className="ims-status-tag">{selectedRecord.productionOrderCode || "Tanpa PO"}</Tag>
            </Space>

            {/* ------------------------------------------------------------- */}
            {/* SECTION: kartu ringkasan angka utama                          */}
            {/* Catatan maintainability:                                      */}
            {/* - kartu ini hanya presentasi cepat untuk user operasional     */}
            {/* - sumber data tetap berasal dari selectedRecord aktif         */}
            {/* ------------------------------------------------------------- */}
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              {detailMetricCards.map((item) => (
                <Col xs={24} sm={12} xl={6} key={item.key}>
                  <Card size="small">
                    <Typography.Text type="secondary">
                      {item.label}
                    </Typography.Text>
                    <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>
                      {item.value}
                    </div>
                    <div style={{ fontSize: 12, color: "#8c8c8c", marginTop: 6 }}>
                      {item.helper}
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>

            {/* ------------------------------------------------------------- */}
            {/* SECTION: informasi work log dan konteks produksi              */}
            {/* Dibagi 2 card agar lebih mudah dibaca daripada satu tabel     */}
            {/* deskripsi yang terlalu panjang dan padat.                     */}
            {/* ------------------------------------------------------------- */}
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col xs={24} xl={14}>
                <Card size="small" title="Ringkasan Work Log">
                  <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label="No. Work Log">
                      {selectedRecord.workNumber || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Tanggal">
                      {formatDisplayDate(selectedRecord.workDate)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Production Order">
                      {selectedRecord.productionOrderCode || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Target Type">
                      {WORK_LOG_TARGET_TYPE_MAP[selectedRecord.targetType] || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Target">
                      <Space direction="vertical" size={0}>
                        <Typography.Text strong>
                          {selectedRecord.targetName || "-"}
                        </Typography.Text>
                        {selectedRecord.targetVariantLabel ? (
                          <Typography.Text type="secondary">
                            Varian: {selectedRecord.targetVariantLabel}
                          </Typography.Text>
                        ) : null}
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Step">
                      {selectedRecord.stepName || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Profil Produksi">
                      {selectedRecord.productionProfileName || "-"}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>

              <Col xs={24} xl={10}>
                <Space direction="vertical" size={16} style={{ width: "100%" }}>
                  <Card size="small" title="Tim & Catatan">
                    <Space direction="vertical" size={12} style={{ width: "100%" }}>
                      <div>
                        <Typography.Text type="secondary">
                          Operator Produksi
                        </Typography.Text>
                        <div style={{ marginTop: 8 }}>
                          {detailWorkerNames.length > 0 ? (
                            <Space wrap size={[8, 8]}>
                              {detailWorkerNames.map((name) => (
                                <Tag key={name} color="blue">
                                  {name}
                                </Tag>
                              ))}
                            </Space>
                          ) : (
                            <Typography.Text type="secondary">
                              Belum ada operator dipilih.
                            </Typography.Text>
                          )}
                        </div>
                      </div>

                      <Divider style={{ margin: 0 }} />

                      <div>
                        <Typography.Text type="secondary">
                          Catatan Eksekusi
                        </Typography.Text>
                        <div style={{ marginTop: 8 }}>
                          <Typography.Paragraph style={{ marginBottom: 0 }}>
                            {selectedRecord.notes || "Belum ada catatan work log."}
                          </Typography.Paragraph>
                        </div>
                      </div>
                    </Space>
                  </Card>

                  <Card size="small" title="Biaya Aktual">
                    <Row gutter={[12, 12]}>
                      <Col span={12}>
                        <Typography.Text type="secondary">
                          Material
                        </Typography.Text>
                        <div style={{ fontWeight: 600, marginTop: 4 }}>
                          {formatCurrency(selectedRecord.materialCostActual || 0)}
                        </div>
                      </Col>
                      <Col span={12}>
                        <Typography.Text type="secondary">
                          Labor
                        </Typography.Text>
                        <div style={{ fontWeight: 600, marginTop: 4 }}>
                          {formatCurrency(selectedRecord.laborCostActual || 0)}
                        </div>
                      </Col>
                      <Col span={12}>
                        <Typography.Text type="secondary">
                          Overhead
                        </Typography.Text>
                        <div style={{ fontWeight: 600, marginTop: 4 }}>
                          {formatCurrency(selectedRecord.overheadCostActual || 0)}
                        </div>
                      </Col>
                      <Col span={12}>
                        <Typography.Text type="secondary">
                          Scrap Qty
                        </Typography.Text>
                        <div style={{ fontWeight: 600, marginTop: 4 }}>
                          {formatNumber(selectedRecord.scrapQty || 0)}
                        </div>
                      </Col>
                    </Row>
                  </Card>
                </Space>
              </Col>
            </Row>

            {/* ------------------------------------------------------------- */}
            {/* SECTION: tabel pemakaian material                              */}
            {/* Fokus ke item, sumber stok, qty pakai, dan biaya snapshot.    */}
            {/* ------------------------------------------------------------- */}
            <Card size="small" title="Pemakaian Material" style={{ marginBottom: 16 }}>
              <Table
                className="ims-table"
                rowKey={(record, index) => record.id || `material-${index}`}
                pagination={false}
                size="small"
                dataSource={selectedRecord.materialUsages || []}
                locale={{ emptyText: "Belum ada material usage" }}
                columns={detailMaterialColumns}
              />
            </Card>

            {/* ------------------------------------------------------------- */}
            {/* SECTION: tabel hasil produksi                                  */}
            {/* Tujuan: user mudah audit output, variant target, dan status   */}
            {/* posting stok setelah work log selesai.                        */}
            {/* ------------------------------------------------------------- */}
            <Card size="small" title="Hasil Produksi">
              <Table
                className="ims-table"
                rowKey={(record, index) => record.id || `output-${index}`}
                pagination={false}
                size="small"
                dataSource={selectedRecord.outputs || []}
                locale={{ emptyText: "Belum ada output" }}
                columns={detailOutputColumns}
              />
            </Card>
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
              <Form.Item label="Qty Batch" name="plannedQty">
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

      <Modal
        title="Selesaikan Work Log Produksi"
        open={completeModalVisible}
        onCancel={() => {
          setCompleteModalVisible(false);
          setCompletingRecord(null);
          completeForm.resetFields();
        }}
        onOk={handleMarkCompleted}
        okText="Selesaikan"
        destroyOnClose
      >
        <Form form={completeForm} layout="vertical">
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item
                label="Good Qty"
                name="goodQty"
                rules={[{ required: true, message: "Good qty wajib diisi" }]}
              >
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

          <Form.Item label="Operator Produksi" name="workerIds">
            <Select
              mode="multiple"
              optionFilterProp="label"
              options={employeeOptions}
              placeholder="Pilih operator yang mengerjakan work log ini..."
            />
          </Form.Item>

          <Form.Item label="Catatan Penyelesaian" name="notes">
            <Input.TextArea
              rows={3}
              placeholder="Catatan hasil produksi, miss, atau kendala proses..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProductionWorkLogs;
