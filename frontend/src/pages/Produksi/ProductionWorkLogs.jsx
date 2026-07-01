// =====================================================
// Page: Work Log Produksi
// Revisi:
// - bisa ambil data/template dari BOM
// - bisa ambil data/template dari Production Order
// - Produksi lebih fokus ke eksekusi, bukan planning dari nol
// =====================================================

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { buildCountSummary,
  createKeywordMatcher,
  matchFieldValue } from '../../utils/produksi/productionPageHelpers';
import { getWorkLogMaterialOptions,
  getWorkLogTargetOptions,
  toReferenceOptions } from '../../utils/produksi/productionReferenceHelpers';
import ProductionPageHeader from '../../components/Produksi/shared/ProductionPageHeader';
import PageContentCanvas from '../../components/Layout/Page/PageContentCanvas';
import SummaryStatGrid from '../../components/Layout/Display/SummaryStatGrid';
import ProductionFilterCard from '../../components/Produksi/shared/ProductionFilterCard';
import ProductionWorkLogDetailDrawer from './components/ProductionWorkLogDetailDrawer';
import ProductionWorkLogFormDrawer from "./components/ProductionWorkLogFormDrawer";
import {
  App as AntdApp,
  Card,
  Col,
  Form,
  Input,
  Select,
} from "antd";
import dayjs from "dayjs";
import {
  DEFAULT_PRODUCTION_WORK_LOG_FORM,
  DEFAULT_WORK_LOG_MATERIAL_USAGE,
  DEFAULT_WORK_LOG_OUTPUT,
  PRODUCTION_WORK_LOG_STATUSES,
  calculateProductionMonitoring,
} from "../../constants/productionWorkLogOptions";
import {
  buildWorkLogDraftFromBom,
  buildWorkLogDraftFromProductionOrder,
  completeProductionWorkLog,
  createProductionWorkLogFromOrder,
  getAllProductionWorkLogs,
  getWorkLogReferenceData,
  updateProductionWorkLog,
} from "../../services/Produksi/productionWorkLogsService";
import { getAllProductionPayrolls } from "../../services/Produksi/productionPayrollsService";
import DataTableView from "../../components/Layout/Table/DataTableView";
import formatNumber from "../../utils/formatters/numberId";
import { getFormArrayValue, removeArrayItemByIndex, upsertArrayItemByIndex } from "../../utils/forms/formArrayHelpers";
import { buildWorkLogMaterialUsageFormLine, buildWorkLogOutputFormLine } from "../../utils/produksi/productionLineBuilders";
import {
  buildProductionStepPayrollSnapshot,
} from "../../utils/produksi/productionPayrollRuleHelpers";
import { buildDisplayReferenceSearchText } from "../../utils/references/displayReferenceResolver";
import useAuth from "../../hooks/useAuth";
import WorkLogMaterialUsageModal from "./components/WorkLogMaterialUsageModal";
import WorkLogOutputModal from "./components/WorkLogOutputModal";
import WorkLogCompleteModal from "./components/WorkLogCompleteModal";
import {
  createProductionWorkLogColumns,
  createProductionWorkLogMobileCardConfig,
  isEditableProductionWorkLog,
  renderCompleteWorkLogEstimateInfo,
} from './helpers/productionWorkLogsPageHelpers';

// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data historis decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema/alur data utama tetap sama.

const buildMonitoringProfileSnapshot = (step = {}, profile = null) => {
  const source = profile || {};
  const metric = step?.monitoringMetric || "none";
  const basisType = step?.basisType || "";
  const isPetal = metric === "petal";
  const isLeaf = metric === "leaf";
  const isStem = metric === "stem";

  return {
    ...source,
    basisType,
    monitoringMetric: metric,
    referenceYieldPerBaseQty: basisType === "per_meter"
      ? isLeaf
        ? source.leafYieldPerMeter
        : isPetal
          ? source.petalYieldPerMeter
          : 0
      : basisType === "per_rod_40cm" && isStem
        ? source.stemYieldPerRod40cm
        : 0,
    flowerEquivalentPerBaseQty: basisType === "per_meter"
      ? isLeaf
        ? source.flowerEquivalentPerLeafMeter
        : isPetal
          ? source.flowerEquivalentPerPetalMeter
          : 0
      : basisType === "per_rod_40cm" && isStem
        ? source.flowerEquivalentPerRod40cm
        : 0,
    batchLeafQty: (source.assemblyLeafPackCount || 0) * (source.leafYieldPerMeter || 0),
    batchStemQty: source.assemblyStemQty || 0,
  };
};

const getProductionPayrollsForWorkLogDisplaySafely = async () => {
  try {
    return await getAllProductionPayrolls();
  } catch (error) {
    console.error("Gagal memuat payroll untuk display detail Work Log", error);
    return [];
  }
};

const ProductionWorkLogs = () => {
  const { message } = AntdApp.useApp();
  const { profile, authUser } = useAuth();

  // =====================================================
  // IMS NOTE [AKTIF/GUARDED] - Actor audit Work Log.
  // Fungsi blok: mengirim user login ke service update/complete/payroll agar audit tidak jatuh ke "system".
  // Hubungan flow: hanya metadata createdBy/updatedBy/autoGeneratedBy; posting stok, payroll idempotency, HPP, dan lifecycle PO tidak diubah.
  // Alasan logic: Work Log completed sudah menyimpan operator produksi, tetapi actor aplikasi tetap perlu tercatat dari Auth session.
  // =====================================================
  const currentUser = useMemo(() => ({
    email: profile?.email || authUser?.email || "",
    displayName: profile?.displayName || profile?.name || authUser?.displayName || "",
    uid: profile?.authUid || profile?.uid || profile?.id || authUser?.uid || "",
  }), [authUser, profile]);

  // SECTION: state utama
  const [loading, setLoading] = useState(false);
  const [workLogs, setWorkLogs] = useState([]);
  const [productionPayrolls, setProductionPayrolls] = useState([]);
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
  const targetTypeValue = Form.useWatch("targetType", form);
  const targetIdValue = Form.useWatch("targetId", form);
  const stepIdValue = Form.useWatch("stepId", form);
  const productionProfileIdValue = Form.useWatch("productionProfileId", form);
  const goodQtyValue = Form.useWatch("goodQty", form);
  const baseInputQtyValue = Form.useWatch("baseInputQty", form);
  const leftoverLeafQtyValue = Form.useWatch("leftoverLeafQty", form);
  const leftoverStemQtyValue = Form.useWatch("leftoverStemQty", form);
  const leftoverPetalFlowerEquivalentValue = Form.useWatch("leftoverPetalFlowerEquivalent", form);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [workLogResult, refResult, payrollResult] = await Promise.all([
        getAllProductionWorkLogs(),
        getWorkLogReferenceData(),
        getProductionPayrollsForWorkLogDisplaySafely(),
      ]);

      setWorkLogs(workLogResult);
      setProductionPayrolls(Array.isArray(payrollResult) ? payrollResult : []);
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
  }, [message]);

  useEffect(() => {
    loadData();
  }, [loadData]);


  const summary = useMemo(() => {
    return buildCountSummary(workLogs, {
      completed: (item) => item.status === "completed",
      inProgress: (item) => item.status === "in_progress",
    });
  }, [workLogs]);

  // =====================================================
  // AKTIF UI-ONLY - Summary Work Log PO-first.
  // Fungsi blok:
  // - menampilkan KPI utama Work Log dengan pola SummaryStatGrid yang lebih compact dan konsisten;
  // - tidak menampilkan Cancelled sebagai KPI utama karena cancel bukan action aktif di halaman Work Log.
  // Hubungan flow:
  // - hanya presentasi data count; tidak mengubah status, service, stok, payroll, HPP, atau lifecycle PO.
  // =====================================================
  const summaryItems = useMemo(() => [
    {
      key: "total",
      title: "Total Work Log",
      value: formatNumber(summary.total || 0),
      subtitle: "Realisasi produksi yang tercatat",
      columns: { xs: 24, md: 8 },
    },
    {
      key: "progress",
      title: "Sedang Produksi",
      value: formatNumber(summary.inProgress || 0),
      subtitle: "Belum selesai / belum posting output",
      columns: { xs: 24, md: 8 },
    },
    {
      key: "completed",
      title: "Selesai",
      value: formatNumber(summary.completed || 0),
      subtitle: "Output sudah diproses ke flow selesai",
      columns: { xs: 24, md: 8 },
    },
  ], [summary.completed, summary.inProgress, summary.total]);

  const filteredData = useMemo(() => {
    return workLogs.filter((item) => {
      const matchSearch = createKeywordMatcher(
        {
          ...item,
          displayReference: buildDisplayReferenceSearchText(item, { fields: ["workNumber", "productionOrderCode"] }),
        },
        ["workNumber", "productionOrderCode", "displayReference", "targetName", "stepName"],
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
      sourceType: "production_order",
      status: "in_progress",
      materialUsages: [],
      outputs: [],
      workerIds: [],
      productionOrderId: undefined,
      productionProfileId: undefined,
    });
  };

  const closeFormDrawer = () => {
    setFormVisible(false);
    resetFormState();
  };

  // =====================================================
  // Handler edit work log
  // Catatan:
  // - drawer form masih dipakai untuk mode edit data Work Log existing
  // - Work Log baru dibuat dari action Mulai Produksi di Production Order, bukan tombol tambah manual di halaman ini
  // =====================================================
  const handleEdit = (record) => {
    if (!isEditableProductionWorkLog(record)) {
      message.warning("Work Log yang sudah completed tidak bisa diedit dari UI utama.");
      return;
    }

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

  const completionEmployeeState = useMemo(() => {
    const employees = referenceData.employees || [];
    const stepId = completingRecord?.stepId || "";
    const assigned = stepId
      ? employees.filter((item) => Array.isArray(item.assignedStepIds) && item.assignedStepIds.includes(stepId))
      : [];
    const resolved = assigned.length > 0 ? assigned : employees;
    return {
      options: toReferenceOptions(resolved),
      assignmentApplied: assigned.length > 0,
    };
  }, [completingRecord?.stepId, referenceData.employees]);

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
        buildMonitoringProfileSnapshot(
          selectedStepForMonitoring || {},
          selectedProductionProfile,
        ),
        {
          basisType: selectedStepForMonitoring?.basisType || '',
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

  /* =====================================================
  SECTION: Apply BOM Template To Work Log — COMPATIBILITY/GUARDED
  Fungsi:
  - Mengisi form Work Log dari BOM sebagai template eksekusi, bukan membuat status Draft baru.

  Dipakai oleh:
  - Tombol Ambil Data BOM di drawer Work Log.

  Alasan perubahan:
  - Nama helper service lama tetap kompatibel (`buildWorkLogDraftFromBom`), tetapi UI aktif tidak lagi memakai konsep Draft Work Log.

  Catatan cleanup:
  - Nama helper service bisa dirapikan pada refactor non-fungsional terpisah.

  Risiko:
  - Jika status form ikut dikembalikan ke Draft, flow produksi bisa melewati start/in_progress yang dipakai PO dan stok.
  ===================================================== */
  const handleApplyBomTemplate = (bomId) => {
    const bom = (referenceData.boms || []).find((item) => item.id === bomId);

    if (!bom) {
      message.error("BOM tidak ditemukan");
      return;
    }

    const templateValues = buildWorkLogDraftFromBom(bom);

    form.setFieldsValue({
      ...form.getFieldsValue(),
      ...templateValues,
      status: "in_progress",
    });

    message.success("Data BOM berhasil dimasukkan ke Work Log");
  };

  /* =====================================================
  SECTION: Apply Production Order Template To Work Log — COMPATIBILITY/GUARDED
  Fungsi:
  - Mengisi form Work Log dari Production Order sebagai template eksekusi, bukan membuat status Draft baru.

  Dipakai oleh:
  - Tombol Ambil Data PO dan perubahan pilihan Production Order di drawer Work Log.

  Alasan perubahan:
  - Helper service `buildWorkLogDraftFromProductionOrder` tetap dipertahankan demi kompatibilitas, tetapi label dan status UI aktif tidak lagi Draft.

  Catatan cleanup:
  - Nama helper service bisa dirapikan pada batch refactor setelah flow produksi stabil.

  Risiko:
  - Jika data PO diterapkan dengan status Draft, Work Log baru bisa tidak sesuai lifecycle eksekusi dan status PO.
  ===================================================== */
  const handleApplyProductionOrderTemplate = async (orderId) => {
    try {
      const productionOrder = (referenceData.productionOrders || []).find(
        (item) => item.id === orderId,
      );

      if (!productionOrder) {
        message.error("Production order tidak ditemukan");
        return;
      }

      const templateValues = await buildWorkLogDraftFromProductionOrder(productionOrder);

      form.setFieldsValue({
        ...form.getFieldsValue(),
        ...templateValues,
        sourceType: "production_order",
        status: "in_progress",
      });

      message.success("Data Order Produksi berhasil dimasukkan ke Work Log");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal mengambil data PO");
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
        values: {
          ...values,
          rejectQty: 0,
          reworkQty: 0,
        },
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

      const selectedStepPayrollSnapshot = selectedStep
        ? buildProductionStepPayrollSnapshot(selectedStep)
        : null;

      const payload = {
        ...values,
        workDate: values.workDate ? values.workDate.toDate() : null,
        targetCode: selectedTarget?.code || "",
        targetName: selectedTarget?.name || "",
        targetUnit: selectedTarget?.unit || values.targetUnit || "pcs",
        productionProfileName: selectedProfile?.profileName || '',
        productionProfile: buildMonitoringProfileSnapshot(selectedStep || {}, selectedProfile),
        stepCode: selectedStep?.code || "",
        stepName: selectedStep?.name || "",
        sequenceNo: values.sequenceNo || 1,
        ...(selectedStepPayrollSnapshot
          ? {
              stepPayrollMode: selectedStepPayrollSnapshot.payrollMode,
              stepPayrollRate: selectedStepPayrollSnapshot.payrollRate,
              stepPayrollQtyBase: selectedStepPayrollSnapshot.payrollQtyBase,
              stepPayrollOutputBasis: selectedStepPayrollSnapshot.payrollOutputBasis,
              stepPayrollClassification: selectedStepPayrollSnapshot.payrollClassification,
              stepPayrollIncludeInHpp: selectedStepPayrollSnapshot.includePayrollInHpp,
              stepPayrollRuleSource: "production_step",
            }
          : {}),
        workerCodes: selectedEmployees.map((item) => item.code || ""),
        workerNames: selectedEmployees.map((item) => item.name || ""),
        workerCount: selectedEmployees.length,
      };

      setSubmitting(true);

      if (editingRecord?.id) {
        await updateProductionWorkLog(editingRecord.id, payload, currentUser);
        message.success("Work log produksi berhasil diperbarui");
      } else if (
        payload.sourceType === "production_order" &&
        payload.productionOrderId
      ) {
        await createProductionWorkLogFromOrder(
          payload.productionOrderId,
          payload,
          currentUser,
        );
        message.success("Work log dari Order Produksi berhasil dibuat");
      } else {
        message.error("Work Log baru harus dimulai dari Order Produksi melalui tombol Mulai Produksi.");
        return;
      }

      closeFormDrawer();
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
  // - User isi Good Qty, operator, dan catatan dari popup ini; field hasil selain good hanya compatibility arsip.
  // - Setelah update work log, baru service complete menambah stok output dan menutup PO
  // =====================================================
  const handleOpenComplete = (record) => {
    setCompletingRecord(record);
    completeForm.setFieldsValue({
      goodQty: record.goodQty || 0,
      workerIds: Array.isArray(record.workerIds) ? record.workerIds.slice(0, 1) : [],
      notes: record.notes || '',
    });
    setCompleteModalVisible(true);
  };

  const handleMarkCompleted = async () => {
    try {
      const values = await completeForm.validateFields();
      if (!completingRecord?.id) return;

      const selectedWorkers = (referenceData.employees || [])
        .filter((item) => (values.workerIds || []).includes(item.id));

      const completionResult = await completeProductionWorkLog(
        completingRecord.id,
        {
          goodQty: values.goodQty,
          rejectQty: 0,
          reworkQty: 0,
          scrapQty: 0,
          workerIds: values.workerIds || [],
          workerNames: selectedWorkers.map((item) => item.name || ''),
          workerCodes: selectedWorkers.map((item) => item.code || ''),
          workerCount: selectedWorkers.length,
          notes: values.notes || '',
        },
        currentUser,
      );
      const createdPayrollCount = Number(completionResult?.payroll?.createdCount || 0);
      const skippedPayrollCount = Number(completionResult?.payroll?.skippedCount || 0);

      if (createdPayrollCount > 0) {
        message.success(`Work log selesai dan ${createdPayrollCount} line payroll dibuat secara atomic.`);
      } else if (skippedPayrollCount > 0) {
        message.info('Work log selesai. Payroll sudah tersedia dan tidak dibuat dobel.');
      } else {
        message.success('Work log selesai. Output, HPP, dan status PO sudah diperbarui.');
      }
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


  const workLogActions = {
    onComplete: handleOpenComplete,
    onEdit: handleEdit,
    onViewDetail: handleViewDetail,
  };
  const columns = createProductionWorkLogColumns(workLogActions);
  const productionWorkLogMobileCardConfig = createProductionWorkLogMobileCardConfig(workLogActions);

  return (
    <div className="ims-page">
      <ProductionPageHeader
        title="Work Log Produksi"
        description="Realisasi kerja produksi dari order produksi. Work Log baru dibuat lewat tombol Mulai Produksi di menu Order Produksi."
      />

      <PageContentCanvas>

      <SummaryStatGrid
        items={summaryItems}
        className="ims-summary-row"
        gutter={[16, 16]}
      />

      <ProductionFilterCard>
          <Col xs={24} md={12}>
            <Input
              placeholder="Cari nomor, target, tahapan, PO..."
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
        {/* Aktif dipakai: scroll x besar dihapus agar aksi Work Log terlihat pada desktop/laptop normal. */}
        <DataTableView
          loading={loading}
          className="ims-table"
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          emptyText="Belum ada data work log produksi"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
          }}
          mobileCardConfig={productionWorkLogMobileCardConfig}
        />
      </Card>

      </PageContentCanvas>

<ProductionWorkLogFormDrawer
        formState={{ editingRecord, form, formVisible, submitting }}
        referenceData={{
          employeeOptions,
          productionOrderOptions,
          referenceData,
          stepOptions,
        }}
        selectionState={{
          monitoringPreview,
          selectedProductionProfile,
          targetIdValue,
          targetTypeValue,
        }}
        actions={{
          closeFormDrawer,
          getProductionProfileOptions,
          getTargetOptions,
          handleApplyBomTemplate,
          handleApplyProductionOrderTemplate,
          handleRemoveMaterialUsage,
          handleRemoveOutput,
          handleSubmit,
          openMaterialModal,
          openOutputModal,
        }}
      />

      <ProductionWorkLogDetailDrawer
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        selectedRecord={selectedRecord}
        productionPayrolls={productionPayrolls}
        referenceData={referenceData}
      />

      <WorkLogMaterialUsageModal
        open={materialModalVisible}
        editingIndex={editingMaterialIndex}
        form={materialForm}
        materialOptionsResolver={getMaterialOptions}
        onCancel={() => {
          setMaterialModalVisible(false);
          setEditingMaterialIndex(null);
          materialForm.resetFields();
        }}
        onOk={handleSaveMaterialUsage}
      />

      <WorkLogOutputModal
        open={outputModalVisible}
        editingIndex={editingOutputIndex}
        form={outputForm}
        referenceData={referenceData}
        onCancel={() => {
          setOutputModalVisible(false);
          setEditingOutputIndex(null);
          outputForm.resetFields();
        }}
        onOk={handleSaveOutput}
      />

      <WorkLogCompleteModal
        open={completeModalVisible}
        form={completeForm}
        employeeOptions={completionEmployeeState.options}
        assignmentApplied={completionEmployeeState.assignmentApplied}
        estimateInfo={renderCompleteWorkLogEstimateInfo(completingRecord)}
        onCancel={() => {
          setCompleteModalVisible(false);
          setCompletingRecord(null);
          completeForm.resetFields();
        }}
        onOk={handleMarkCompleted}
      />

    </div>
  );
};

export default ProductionWorkLogs;
