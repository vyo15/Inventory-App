// =====================================================
// Page: BOM Produksi
// Rule final:
// - BOM target product = assembly, material boleh semi_finished_material + raw_material consumable
// - BOM target semi_finished_material = material boleh raw / semi_finished_material
// =====================================================

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { buildCountSummary,
  createKeywordMatcher,
  matchActiveStatus,
  matchFieldValue } from '../../utils/produksi/productionPageHelpers';
import { getBomMaterialItemOptions,
  getBomTargetOptions,
  toReferenceOptions } from '../../utils/produksi/productionReferenceHelpers';
import ProductionPageHeader from '../../components/Produksi/shared/ProductionPageHeader';
import PageContentCanvas from '../../components/Layout/Page/PageContentCanvas';
import ProductionSummaryCards from '../../components/Produksi/shared/ProductionSummaryCards';
import ProductionFilterCard from '../../components/Produksi/shared/ProductionFilterCard';
import TableActionMenu from '../../components/Layout/Table/TableActionMenu';
import InfoPopoverButton from "../../components/Layout/Feedback/InfoPopoverButton";
import {
  App as AntdApp,
  Badge,
  Col,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { EditOutlined, EyeOutlined } from "@ant-design/icons";
import {
  BOM_TARGET_TYPE_MAP,
  DEFAULT_BOM_MATERIAL_LINE,
  DEFAULT_BOM_STEP_LINE,
  DEFAULT_PRODUCTION_BOM_FORM,
  PRODUCTION_BOM_TARGET_TYPES,
} from "../../constants/productionBomOptions";
import {
  createProductionBom,
  getActiveBomReferenceData,
  getAllProductionBoms,
  toggleProductionBomActive,
  updateProductionBom,
} from "../../services/Produksi/productionBomsService";
import ProductionBomListView from "./components/ProductionBomListView";
import ProductionBomDetailDrawer from "./components/ProductionBomDetailDrawer";
import ProductionBomFormDrawer from "./components/ProductionBomFormDrawer";
import ProductionBomMaterialModal from "./components/ProductionBomMaterialModal";
import ProductionBomStepModal from "./components/ProductionBomStepModal";
import {
  clampTwoLineStyle,
  compactTagStyle,
  EMPTY_REFERENCE_DATA,
  hydrateBomRecordWithLiveCosts,
} from "./helpers/productionBomsPageHelpers";

// =====================================================
// SECTION: helper format angka Indonesia
// =====================================================
import formatNumber from "../../utils/formatters/numberId";
import formatCurrency from "../../utils/formatters/currencyId";
import { getFormArrayValue, getNextSequenceNumber, removeArrayItemByIndex, upsertArrayItemByIndex } from "../../utils/forms/formArrayHelpers";
import { buildBomMaterialFormLine, buildBomStepFormLine } from "../../utils/produksi/productionLineBuilders";
import { hydrateBomMaterialLineWithLiveCost } from "../../utils/produksi/productionBomCostHelpers";
import { inferHasVariants } from "../../utils/variants/variantStockHelpers";
import { showFormValidationFeedback } from '../../utils/forms/formValidationFeedback';

// =====================================================
// SECTION: helper label item
// =====================================================

// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data historis decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema/alur data utama tetap sama.

const ProductionBoms = () => {
  const { message } = AntdApp.useApp();
  // SECTION: state loading dan data utama
  const [loading, setLoading] = useState(false);
  const [boms, setBoms] = useState([]);
  const [referenceData, setReferenceData] = useState(EMPTY_REFERENCE_DATA);

  // SECTION: state filter
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [targetTypeFilter, setTargetTypeFilter] = useState("all");
  const [listViewMode, setListViewMode] = useState("grouped");

  // SECTION: state form/detail
  const [formVisible, setFormVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editingBom, setEditingBom] = useState(null);
  const [selectedBom, setSelectedBom] = useState(null);
  const [formErrorSummary, setFormErrorSummary] = useState("");

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
  const loadData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      }

      const [bomResult, refResult] = await Promise.allSettled([
        getAllProductionBoms(),
        getActiveBomReferenceData(),
      ]);

      let nextReference = EMPTY_REFERENCE_DATA;
      if (refResult.status === "fulfilled") {
        nextReference = {
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
      } else {
        console.error("Gagal memuat referensi BOM", refResult.reason);
        message.error("Master referensi BOM gagal dimuat");
      }

      setReferenceData(nextReference);

      if (bomResult.status === "fulfilled") {
        const hydratedBoms = (Array.isArray(bomResult.value) ? bomResult.value : []).map((item) =>
          hydrateBomRecordWithLiveCosts(item, nextReference),
        );
        setBoms(hydratedBoms);
      } else {
        console.error("Gagal memuat daftar BOM", bomResult.reason);
        setBoms([]);
        message.error("Daftar BOM gagal dimuat");
      }
    } catch (error) {
      console.error(error);
      message.error("Gagal memuat data BOM produksi");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  /* =====================================================
  SECTION: Production BOM grouped listing — AKTIF
  Fungsi:
  - Mengelompokkan BOM secara read-only berdasarkan Target Type lalu Target Item.

  Dipakai oleh:
  - Halaman ProductionBoms untuk membuat daftar resep lebih mudah dicari tanpa mengubah rule validasi, payload, atau service BOM.

  Alasan perubahan:
  - Saat BOM bertambah banyak, user operasional lebih aman memilih dari konteks target produksi daripada satu tabel panjang.

  Catatan cleanup:
  - Belum ada. Grouping ini hanya tampilan dan tidak menjadi source of truth relasi produksi.

  Risiko:
  - Jangan mengubah targetType/targetId dari grouping ini karena BOM tetap menjadi source of truth PO.
  ===================================================== */
  const groupedFilteredData = useMemo(() => {
    const typeMap = new Map();

    filteredData.forEach((item) => {
      const targetType = item.targetType || "unknown";
      const targetTypeLabel = BOM_TARGET_TYPE_MAP[targetType] || "Target Tidak Dikenal";
      const targetId = String(item.targetId || item.targetName || "__unknown_target").trim() || "__unknown_target";
      const targetName = String(item.targetName || item.targetCode || "Target belum dikenal").trim();
      const targetKey = `${targetType}::${targetId}`;

      if (!typeMap.has(targetType)) {
        typeMap.set(targetType, {
          key: targetType,
          label: targetTypeLabel,
          items: [],
          targetMap: new Map(),
        });
      }

      const typeGroup = typeMap.get(targetType);
      typeGroup.items.push(item);

      if (!typeGroup.targetMap.has(targetKey)) {
        typeGroup.targetMap.set(targetKey, {
          key: targetKey,
          label: targetName,
          items: [],
        });
      }

      typeGroup.targetMap.get(targetKey).items.push(item);
    });

    return Array.from(typeMap.values())
      .map((typeGroup) => {
        const counts = typeGroup.items.reduce(
          (acc, item) => {
            if (item.isActive) acc.active += 1;
            if (!item.isActive) acc.inactive += 1;
            if (item.isDefault) acc.default += 1;
            return acc;
          },
          { active: 0, inactive: 0, default: 0 },
        );

        return {
          ...typeGroup,
          counts,
          targets: Array.from(typeGroup.targetMap.values()).sort((a, b) =>
            a.label.localeCompare(b.label),
          ),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredData]);

  const shouldAutoOpenBomGroups = Boolean(search.trim()) || statusFilter !== "all" || targetTypeFilter !== "all";

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
    setFormErrorSummary("");
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
    setFormErrorSummary("");
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
    const hydratedRecord = hydrateBomRecordWithLiveCosts(record, referenceData);
    setEditingBom(hydratedRecord);
    setFormErrorSummary("");

    form.setFieldsValue({
      ...DEFAULT_PRODUCTION_BOM_FORM,
      ...hydratedRecord,
      targetType: hydratedRecord.targetType || "product",
      materialLines: hydratedRecord.materialLines || [],
      stepLines: hydratedRecord.stepLines || [],
    });

    setFormVisible(true);
  };

  // =====================================================
  // SECTION: buka detail BOM
  // =====================================================
  const handleViewDetail = (record) => {
    setSelectedBom(hydrateBomRecordWithLiveCosts(record, referenceData));
    setDetailVisible(true);
  };

  // =====================================================
  // SECTION: modal material line
  // =====================================================
  const openMaterialModal = (index = null, record = null) => {
    setEditingMaterialIndex(index);

    const targetType = getCurrentTargetType();

    if (record) {
      const hydratedRecord = hydrateBomMaterialLineWithLiveCost({
        line: record,
        referenceData,
      });
      materialForm.setFieldsValue({
        ...DEFAULT_BOM_MATERIAL_LINE,
        ...hydratedRecord,
        itemType:
          hydratedRecord.itemType ||
          (targetType === "product" ? "semi_finished_material" : "raw_material"),
        materialVariantStrategy:
          hydratedRecord.materialHasVariants === true
            ? hydratedRecord.materialVariantStrategy || "inherit"
            : "none",
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
    const currentLines = getFormArrayValue(form, "stepLines");
    if (!record && currentLines.length >= 1) {
      message.warning("Satu BOM hanya boleh memiliki 1 Tahapan Produksi. Edit tahapan yang sudah dipilih atau hapus terlebih dahulu.");
      return;
    }

    setEditingStepIndex(index);

    if (record) {
      stepForm.setFieldsValue({ ...DEFAULT_BOM_STEP_LINE, ...record });
    } else {
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

      const itemType =
        values.itemType ||
        (targetType === "product" ? "semi_finished_material" : "raw_material");

      const options = getMaterialItemOptions(targetType, itemType);
      const selected = options.find(
        (item) => item.value === values.itemId,
      )?.raw;

      const line = buildBomMaterialFormLine({
        values,
        selectedItem: selected,
        itemType,
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
      if (showFormValidationFeedback(error, { form: materialForm })) return;
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

      if (nextLines.length > 1) {
        message.error("Satu BOM hanya boleh memiliki tepat 1 Tahapan Produksi.");
        return;
      }

      form.setFieldValue("stepLines", nextLines);
      setStepModalVisible(false);
      setEditingStepIndex(null);
      stepForm.resetFields();
    } catch (error) {
      if (showFormValidationFeedback(error, { form: stepForm })) return;
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
    setFormErrorSummary("");

    try {
      const values = {
        ...DEFAULT_PRODUCTION_BOM_FORM,
        ...form.getFieldsValue(true),
        materialLines: getFormArrayValue(form, "materialLines"),
        stepLines: getFormArrayValue(form, "stepLines"),
      };

      const fieldErrors = [];

      if (!String(values.name || "").trim()) {
        fieldErrors.push({ name: "name", errors: ["Nama BOM wajib diisi"] });
      }

      if (!String(values.targetType || "").trim()) {
        fieldErrors.push({ name: "targetType", errors: ["Target type wajib dipilih"] });
      }

      if (!String(values.targetId || "").trim()) {
        fieldErrors.push({ name: "targetId", errors: ["Target item wajib dipilih"] });
      }

      if (Number(values.batchOutputQty || 0) <= 0) {
        fieldErrors.push({ name: "batchOutputQty", errors: ["Hasil per produksi harus lebih dari 0"] });
      }

      if (!Array.isArray(values.materialLines) || values.materialLines.length === 0) {
        setFormErrorSummary("Minimal harus ada 1 bahan di Komposisi Bahan.");
      } else if (!Array.isArray(values.stepLines) || values.stepLines.length !== 1 || !values.stepLines[0]?.stepId) {
        setFormErrorSummary("BOM wajib memiliki tepat 1 Tahapan Produksi aktif.");
      }

      if (fieldErrors.length > 0) {
        /*
        =====================================================
        SECTION: Popup validasi drawer BOM custom — AKTIF / GUARDED
        Fungsi:
        - Menampilkan daftar field wajib BOM ketika validasi manual drawer gagal.

        Dipakai oleh:
        - Form BOM Produksi yang masih memakai validasi manual karena line bahan/step berada di drawer custom.

        Alasan perubahan:
        - User perlu tahu field BOM mana yang belum lengkap tanpa membaca error teknis.

        Catatan cleanup:
        - Bisa dipindahkan ke AntD rules penuh jika struktur Form.List BOM sudah final.

        Risiko:
        - Jangan menghapus setFields karena highlight field tetap dibutuhkan di drawer.
        =====================================================
        */
        form.setFields(fieldErrors);
        showFormValidationFeedback({ errorFields: fieldErrors }, { form });
        if (!formErrorSummary) {
          setFormErrorSummary(fieldErrors[0]?.errors?.[0] || "Form belum lengkap.");
        }
        return;
      }

      if (!Array.isArray(values.materialLines) || values.materialLines.length === 0) {
        return;
      }

      if (!Array.isArray(values.stepLines) || values.stepLines.length !== 1 || !values.stepLines[0]?.stepId) {
        message.error("BOM wajib memiliki tepat 1 Tahapan Produksi aktif.");
        return;
      }

      const targetOptions = getTargetOptions(values.targetType);
      const selectedTarget = targetOptions.find(
        (item) => item.value === values.targetId,
      )?.raw;

      const targetName = selectedTarget?.name || "";
      const targetCode = selectedTarget?.code || "";
      const normalizedTargetName = String(targetName || "BOM").trim();
      const payload = {
        ...values,
        code: values.code || "",
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

        const firstGlobalMessage = globalMessages[0] || normalFields[0]?.errors?.[0] || "Validasi BOM gagal.";
        setFormErrorSummary(firstGlobalMessage);
        message.error(firstGlobalMessage);
        return;
      }

      console.error(error);
      setFormErrorSummary(error?.message || "Gagal menyimpan BOM produksi.");
      message.error(error?.message || "Gagal menyimpan BOM produksi");
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
  // SECTION: Main table compact BOM Produksi — AKTIF
  // Fungsi:
  // - Menampilkan ringkasan BOM, target, komposisi, output batch, estimasi, status, dan aksi pada main table.
  //
  // Dipakai oleh:
  // - Halaman ProductionBoms sebagai daftar konfigurasi BOM produksi.
  //
  // Alasan perubahan:
  // - Main table sebelumnya memakai horizontal scroll besar dan fixed-right column; informasi dipadatkan agar action tetap terlihat tanpa scroll besar.
  //
  // Catatan cleanup:
  // - Detail materialLines dan stepLines tetap di drawer detail existing; belum ada cleanup logic data.
  //
  // Risiko:
  // - Mengubah render ini sembarangan dapat membuat target, komposisi, estimasi, atau action BOM sulit diverifikasi oleh user.
  // =====================================================
  const columns = [
    {
      title: "BOM / Target",
      key: "bomTarget",
      width: "34%",
      render: (_, record) => (
        <Space direction="vertical" size={6} style={{ width: "100%" }}>
          <div>
            <Tooltip title={record.name || "-"}>
              <Typography.Text strong style={{ ...clampTwoLineStyle }}>
                {record.name || "-"}
              </Typography.Text>
            </Tooltip>
          </div>

          <Tooltip title={record.description || "Belum ada deskripsi"}>
            <Typography.Text type="secondary" style={clampTwoLineStyle}>
              {record.description || "Belum ada deskripsi"}
            </Typography.Text>
          </Tooltip>

          <Space size={6} wrap>
            <Tag color="blue" style={compactTagStyle}>
              {BOM_TARGET_TYPE_MAP[record.targetType] || "-"}
            </Tag>
            <Tooltip title={record.targetName || "-"}>
              <Typography.Text style={{ ...clampTwoLineStyle, maxWidth: 220 }}>
                {record.targetName || "-"}
              </Typography.Text>
            </Tooltip>
          </Space>
        </Space>
      ),
    },
    {
      title: "Komposisi / Output",
      key: "compositionOutput",
      width: "22%",
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Space size={6} wrap>
            <Tag style={compactTagStyle}>Material: {formatNumber(record.materialLines?.length || 0)}</Tag>
            <Tag style={compactTagStyle}>Step: {formatNumber(record.stepLines?.length || 0)}</Tag>
          </Space>
          <Typography.Text type="secondary">
            Output batch
          </Typography.Text>
          <Typography.Text strong>
            {formatNumber(record.batchOutputQty || 0)} {record.targetUnit || "pcs"}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Estimasi",
      key: "estimate",
      width: "22%",
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text>
            Material: {formatCurrency(record.materialCostEstimate || 0)}
          </Typography.Text>
          <Typography.Text>
            Upah step: {formatCurrency(record.laborCostEstimate || 0)}
          </Typography.Text>
          {Number(record.overheadCostEstimate || 0) > 0 ? (
            <Typography.Text>
              Overhead: {formatCurrency(record.overheadCostEstimate || 0)}
            </Typography.Text>
          ) : null}
          <Typography.Text strong>
            Total: {formatCurrency(record.totalCostEstimate || 0)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 116,
      align: "center",
      className: "app-table-status-column",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          {record.isActive ? (
            <Badge status="success" text="Aktif" />
          ) : (
            <Badge status="default" text="Nonaktif" />
          )}
          {record.isDefault ? (
            <Typography.Text type="secondary" className="ims-cell-meta">
              Default
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: "Aksi",
      key: "actions",
      width: 132,
      className: "app-table-action-column",
      render: (_, record) => (
        <TableActionMenu
          visibleActions={[
            {
              key: "detail",
              label: "Detail",
              icon: <EyeOutlined />,
              onClick: () => handleViewDetail(record),
            },
          ]}
          moreActions={[
            {
              key: "edit",
              label: "Edit",
              icon: <EditOutlined />,
              onClick: () => handleEdit(record),
            },
            {
              key: "toggle",
              label: record.isActive ? "Nonaktifkan" : "Aktifkan",
              danger: record.isActive,
              confirm: {
                title: record.isActive ? "Nonaktifkan BOM ini?" : "Aktifkan BOM ini?",
                okText: "Ya",
                cancelText: "Batal",
              },
              onClick: () => handleToggleActive(record),
            },
          ]}
        />
      ),
    },
  ];

  // IMS NOTE [AKTIF/GUARDED UI] - Mobile card BOM Produksi.
  // Fungsi: membuat daftar BOM dan grouped BOM tetap nyaman dibaca di HP.
  // Guardrail: hanya presentasi; materialLines, stepLines, estimasi biaya, default BOM, dan toggle status tetap memakai handler existing.
  const bomMobileCardConfig = {
    title: (record) => record.name || "-",
    subtitle: (record) => [
      record.targetName || "Target belum tercatat",
      record.description || null,
    ].filter(Boolean),
    tags: (record) => [
      <Tag key="target-type" color="blue" style={compactTagStyle}>
        {BOM_TARGET_TYPE_MAP[record.targetType] || "-"}
      </Tag>,
      record.isActive ? (
        <StatusTag key="status" tone="success" style={compactTagStyle}>Aktif</StatusTag>
      ) : (
        <StatusTag key="status" tone="neutral" style={compactTagStyle}>Nonaktif</StatusTag>
      ),
      record.isDefault ? <Tag key="default" color="purple" style={compactTagStyle}>Default</Tag> : null,
    ].filter(Boolean),
    meta: [
      { label: "Material", value: (record) => formatNumber(record.materialLines?.length || 0) },
      { label: "Step", value: (record) => formatNumber(record.stepLines?.length || 0) },
      {
        label: "Output Batch",
        value: (record) => `${formatNumber(record.batchOutputQty || 0)} ${record.targetUnit || "pcs"}`,
      },
      { label: "Estimasi", value: (record) => formatCurrency(record.totalCostEstimate || 0) },
    ],
    content: (record) => [
      `Material: ${formatCurrency(record.materialCostEstimate || 0)}`,
      `Upah step: ${formatCurrency(record.laborCostEstimate || 0)}`,
      Number(record.overheadCostEstimate || 0) > 0
        ? `Overhead: ${formatCurrency(record.overheadCostEstimate || 0)}`
        : null,
    ].filter(Boolean),
    primaryActions: (record) => [
      {
        key: "detail",
        label: "Detail",
        icon: <EyeOutlined />,
        onClick: () => handleViewDetail(record),
      },
    ],
    moreActions: (record) => [
      {
        key: "edit",
        label: "Edit",
        icon: <EditOutlined />,
        onClick: () => handleEdit(record),
      },
      {
        key: "toggle",
        label: record.isActive ? "Nonaktifkan" : "Aktifkan",
        danger: record.isActive,
        confirm: {
          title: record.isActive ? "Nonaktifkan BOM ini?" : "Aktifkan BOM ini?",
          okText: "Ya",
          cancelText: "Batal",
        },
        onClick: () => handleToggleActive(record),
      },
    ],
  };

  return (
    <div>
      <ProductionPageHeader
        title="BOM Produksi"
        description="Komposisi bahan dan step untuk Production Order"
        onAdd={handleAdd}
        addLabel="Tambah BOM"
      />

      <PageContentCanvas>

      <ProductionSummaryCards
        items={[
          { key: "total", title: "Total BOM", value: summary.total },
          { key: "active", title: "BOM Aktif", value: summary.active },
          { key: "inactive", title: "BOM Nonaktif", value: summary.inactive },
          { key: "default", title: "BOM Default", value: summary.defaultCount },
        ]}
      />

      {/* SECTION: info referensi */}
      <div className="page-content-canvas__utility-row">
        <InfoPopoverButton
          label="Referensi Aktif"
          title="Referensi aktif untuk BOM"
          description="BOM memakai referensi aktif dari Product, Semi Finished, Raw Material, dan Production Step. Data nonaktif disimpan untuk histori."
          items={[
            { label: 'Product', value: `${formatNumber(referenceData.products.length)} aktif` },
            { label: 'Semi Finished', value: `${formatNumber(referenceData.semiFinishedMaterials.length)} aktif` },
            { label: 'Raw Material', value: `${formatNumber(referenceData.rawMaterials.length)} aktif` },
            { label: 'Step', value: `${formatNumber(referenceData.productionSteps.length)} aktif` },
          ]}
        />
      </div>

      {/* SECTION: filter */}
      <ProductionFilterCard>
          <Col xs={24} lg={8}>
            <Input
              placeholder="Cari kode, nama BOM, target..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>

          <Col xs={24} sm={8} lg={5}>
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

          <Col xs={24} sm={8} lg={5}>
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

          <Col xs={24} sm={8} lg={6}>
            <Select
              style={{ width: "100%" }}
              value={listViewMode}
              onChange={setListViewMode}
              options={[
                { value: "grouped", label: "Grouped Target" },
                { value: "global", label: "Semua BOM" },
              ]}
            />
          </Col>
      </ProductionFilterCard>

      {/* SECTION: tabel BOM */}
      <ProductionBomListView
        loading={loading}
        filteredData={filteredData}
        listViewMode={listViewMode}
        columns={columns}
        mobileCardConfig={bomMobileCardConfig}
        groupedFilteredData={groupedFilteredData}
        shouldAutoOpenBomGroups={shouldAutoOpenBomGroups}
      />

      {/* SECTION: drawer form tambah/edit BOM */}
      </PageContentCanvas>

<ProductionBomFormDrawer
        editingBom={editingBom}
        form={form}
        formErrorSummary={formErrorSummary}
        formVisible={formVisible}
        getTargetOptions={getTargetOptions}
        handleRemoveMaterialLine={handleRemoveMaterialLine}
        handleRemoveStepLine={handleRemoveStepLine}
        handleSubmit={handleSubmit}
        openMaterialModal={openMaterialModal}
        openStepModal={openStepModal}
        resetFormState={resetFormState}
        setFormVisible={setFormVisible}
        submitting={submitting}
      />

      {/* SECTION: drawer detail BOM */}
<ProductionBomDetailDrawer
        detailVisible={detailVisible}
        selectedBom={selectedBom}
        setDetailVisible={setDetailVisible}
      />

      {/* SECTION: modal material line */}
<ProductionBomMaterialModal
        editingMaterialIndex={editingMaterialIndex}
        getCurrentTargetType={getCurrentTargetType}
        getMaterialItemOptions={getMaterialItemOptions}
        handleSaveMaterialLine={handleSaveMaterialLine}
        materialForm={materialForm}
        materialModalVisible={materialModalVisible}
        setEditingMaterialIndex={setEditingMaterialIndex}
        setMaterialModalVisible={setMaterialModalVisible}
      />

      {/* SECTION: modal step line */}
<ProductionBomStepModal
        editingStepIndex={editingStepIndex}
        handleSaveStepLine={handleSaveStepLine}
        setEditingStepIndex={setEditingStepIndex}
        setStepModalVisible={setStepModalVisible}
        stepForm={stepForm}
        stepModalVisible={stepModalVisible}
        stepOptions={stepOptions}
      />
    </div>
  );
};

export default ProductionBoms;
