import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import { EyeOutlined, PlusOutlined } from "@ant-design/icons";
import DataTableView from "../../../components/Layout/Table/DataTableView";
import MobileDetailDrawer from "../../../components/Layout/Mobile/MobileDetailDrawer";
import ResponsiveFormSection from "../../../components/Layout/Mobile/ResponsiveFormSection";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import InfoPopoverButton from "../../../components/Layout/Feedback/InfoPopoverButton";
import dayjs from "dayjs";
import { formatNumberId, parseIntegerIdInput } from "../../../utils/formatters/numberId";
import {
  buildVariantOptionsFromItem,
  getItemStockSnapshot,
  inferHasVariants,
} from "../../../utils/variants/variantStockHelpers";
import { showFormValidationFeedback } from '../../../utils/forms/formValidationFeedback';
import { getRepositoryModeStatus, isSqliteRepositoryModuleEnabled } from '../../../data/repositories/repositoryModeService';
import * as sqliteStockAdjustmentsAdapter from '../../../data/adapters/sqlite/sqliteStockAdjustmentsAdapter';
import { listenProducts } from '../../../services/MasterData/productsService';
import { listenRawMaterials } from '../../../services/MasterData/rawMaterialsService';
import { getActiveSemiFinishedMaterials } from '../../../services/Produksi/semiFinishedMaterialsService';
import { compareRecordsByNameAsc, upsertRecordById } from '../../../utils/state/recordCollectionState';


// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data historis decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema/alur data utama tetap sama.

const { Option } = Select;
const { Text } = Typography;


// =========================
// SECTION: Konfigurasi sumber item Stock Adjustment
// Fungsi blok:
// - menyatukan mapping itemType UI ke target modul database lokal dan label riwayat adjustment.
// Hubungan flow aplikasi:
// - Stock Adjustment resmi sekarang mendukung Bahan Baku, Semi Finished, dan Produk Jadi tanpa mengubah flow produksi/HPP/transaksi lain.
// Alasan logic dipakai:
// - mapping terpusat mencegah item Semi Finished jatuh ke fallback Produk/default saat transaction membuat stock_adjustments dan inventory_logs.
// Status logic: AKTIF / GUARDED untuk submit Stock Adjustment lintas source.
// =========================
const STOCK_ADJUSTMENT_ITEM_TYPE_CONFIG = {
  raw_material: {
    label: "Bahan Baku",
    tagColor: "gold",
    collectionName: "raw_materials",
  },
  semi_finished: {
    label: "Semi Finished",
    tagColor: "purple",
    collectionName: "semi_finished_materials",
  },
  product: {
    label: "Produk Jadi",
    tagColor: "blue",
    collectionName: "products",
  },
};

const resolveStockAdjustmentItemTypeConfig = ({ itemType = "", collectionName = "" } = {}) => {
  if (STOCK_ADJUSTMENT_ITEM_TYPE_CONFIG[itemType]) {
    return STOCK_ADJUSTMENT_ITEM_TYPE_CONFIG[itemType];
  }

  return (
    Object.values(STOCK_ADJUSTMENT_ITEM_TYPE_CONFIG).find(
      (config) => config.collectionName === collectionName,
    ) || {
      label: "Item Lainnya",
      tagColor: "default",
      collectionName: collectionName || "",
    }
  );
};

const buildVariantStockSnapshot = (variant = {}) => {
  const currentStock = Number(variant.currentStock ?? variant.stock ?? 0);
  const reservedStock = Number(variant.reservedStock || 0);
  const availableStock = Number(
    variant.availableStock ?? Math.max(currentStock - reservedStock, 0),
  );

  return {
    label: variant.variantLabel,
    currentStock,
    reservedStock,
    availableStock,
  };
};

// =========================
// SECTION: Helper satuan qty bulat
// Fungsi:
// - menjaga input penyesuaian stok tidak memaksa format desimal untuk item berbasis pcs/bulat
// Hubungan flow:
// - hanya memengaruhi format UI panel adjustment di Manajemen Stok, bukan source of truth mutasi stok
// Status:
// - aktif dipakai oleh StockAdjustmentPanel
// - bukan kandidat cleanup
// =========================
const WHOLE_NUMBER_UNIT_KEYWORDS = [
  "pcs",
  "meter",
  "yard",
  "roll",
  "piece",
  "unit",
  "batang",
  "tangkai",
  "lembar",
  "biji",
  "pack",
  "set",
];

const isWholeNumberUnit = (unit = "") => {
  const normalizedUnit = String(unit || "").trim().toLowerCase();
  if (!normalizedUnit) return false;
  return WHOLE_NUMBER_UNIT_KEYWORDS.some((keyword) => normalizedUnit.includes(keyword));
};

const formatQuantityId = (value, unit = "") => {
  const numericValue = Number(value || 0);

  // =========================
  // IMS NOTE [AKTIF/GUARDED] - Format qty adjustment tanpa desimal
  // Fungsi blok: menampilkan qty adjustment sebagai angka bulat di Manajemen Stok.
  // Hubungan flow: hanya display/input panel; transaction stock dan inventory log tetap di handler existing.
  // Alasan logic: rule IMS tahap ini tidak membuka input decimal baru, termasuk unit lama non-discrete.
  // Behavior: tampilan/input berubah ke no-decimal; data historis pecahan tidak dimigrasi.
  // =========================
  const formatted = formatNumberId(numericValue);

  return `${formatted}${unit ? ` ${unit}` : ""}`.trim();
};

const getAdjustmentCostField = (collectionName = "") => {
  if (collectionName === "raw_materials") return "averageActualUnitCost";
  if (collectionName === "semi_finished_materials") return "averageCostPerUnit";
  if (collectionName === "products") return "hppPerUnit";
  return "";
};

const resolveAdjustmentCurrentUnitCost = ({ item = {}, collectionName = "", variant = null } = {}) => {
  const costField = getAdjustmentCostField(collectionName);
  if (!costField) return 0;

  if (variant && collectionName !== "raw_materials") {
    return Number(variant?.[costField] || 0);
  }

  return Number(item?.[costField] || 0);
};

// =========================
// SECTION: Tampilan ringkas alasan & catatan adjustment
// Fungsi:
// - menggabungkan reason/note hanya di tampilan tabel agar row tidak menampilkan info dobel.
// Hubungan flow aplikasi:
// - hanya memengaruhi tampilan audit; tidak mengubah data stock_adjustments atau inventory_logs.
// Status:
// - AKTIF untuk UI Stock Adjustment Panel.
// - GUARDED karena field reason/note tetap tersimpan terpisah dan catatan lengkap tetap tersedia di tooltip.
// - COMPATIBILITY: tidak ada logic data historis yang dipakai di blok ini.
// - CLEANUP CANDIDATE: tidak perlu dibersihkan selama tabel masih menampilkan catatan bebas.
// =========================
const NOTE_PREVIEW_STYLE = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  whiteSpace: "normal",
  lineHeight: "var(--ims-line-height-title)",
};

const STOCK_ADJUSTMENT_REASON_LABELS = {
  stok_awal: "Stok Awal",
  opname: "Selisih Opname",
  rusak: "Barang Rusak",
  hilang: "Barang Hilang",
  lainnya: "Lainnya",
};

const normalizeCompactText = (value = "") => String(value || "").trim();

const getStockAdjustmentReasonLabel = (reason = "") => {
  const normalizedReason = normalizeCompactText(reason);
  return STOCK_ADJUSTMENT_REASON_LABELS[normalizedReason] || normalizedReason || "-";
};

const renderAdjustmentReasonNote = (_, record = {}) => {
  const rawReason = normalizeCompactText(record.reason);
  const reasonText = getStockAdjustmentReasonLabel(rawReason);
  const noteText = normalizeCompactText(record.note);
  const normalizedNote = noteText.toLowerCase();
  const normalizedReasonText = reasonText.toLowerCase();
  const normalizedRawReason = rawReason.toLowerCase();
  const shouldShowNote = Boolean(
    noteText && normalizedNote !== normalizedReasonText && normalizedNote !== normalizedRawReason,
  );
  const compactText = [reasonText !== "-" ? reasonText : "", shouldShowNote ? noteText : ""]
    .filter(Boolean)
    .join(" • ") || "-";
  const tooltipTitle = shouldShowNote
    ? [`Alasan: ${reasonText}`, `Catatan: ${noteText}`].join("\n")
    : compactText;

  return (
    <Tooltip title={compactText !== "-" ? tooltipTitle : ""}>
      <span style={NOTE_PREVIEW_STYLE}>{compactText}</span>
    </Tooltip>
  );
};

// =========================
// SECTION: Stock Adjustment Panel
// Fungsi:
// - memindahkan form dan riwayat Penyesuaian Stok ke dalam halaman Manajemen Stok
// Hubungan flow:
// - menjadi satu-satunya UI aktif untuk adjustment manual setelah menu / halaman lama dihapus
// - mutasi stok memakai transaksi layanan database lokal dan helper stock mutation agar stock/currentStock/availableStock/variants[] sinkron
// Status:
// - aktif/final untuk adjustment stok manual
// - bukan halaman route mandiri; /stock-adjustment hanya compatibility redirect ke /inventory/stock-management
// =========================
const StockAdjustmentPanel = ({ onAdjustmentSaved }) => {
  // =========================
  // SECTION: State panel adjustment
  // Fungsi:
  // - menyimpan riwayat stock_adjustments, master item, dan status modal form
  // Hubungan flow:
  // - master item hanya dipakai sebagai pilihan form; source of truth mutasi final ada di transaksi layanan database lokal dan helper stok varian aktif
  // - isSubmittingRef menjadi guard teknis agar submit dobel tidak membuat double stock/log sebelum state React sempat update
  // Status:
  // - AKTIF dipakai di halaman Manajemen Stok.
  // - GUARDED karena submit state/ref mencegah double submit.
  // - COMPATIBILITY: tidak ada state data historis yang dipakai untuk mutasi stok.
  // - CLEANUP CANDIDATE jika orkestrasi adjustment dipindah ke service khusus.
  // =========================
  const [stockAdjustmentRecords, setStockAdjustmentRecords] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [semiFinishedMaterials, setSemiFinishedMaterials] = useState([]);
  const [finishedProducts, setFinishedProducts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAdjustmentDetail, setSelectedAdjustmentDetail] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const [form] = Form.useForm();
  const selectedItemType = Form.useWatch("itemType", form);
  const selectedItemId = Form.useWatch("itemId", form);
  const selectedVariantKey = Form.useWatch("variantKey", form);
  const selectedAdjustmentType = Form.useWatch("adjustmentType", form);
  const [isSqliteStockAdjustmentMode, setIsSqliteStockAdjustmentMode] = useState(false);


  // =========================
  // SECTION: Live data subscription
  // Fungsi:
  // - membaca stock_adjustments, raw_materials, semi_finished_materials, dan products secara realtime
  // Hubungan flow:
  // - panel adjustment selalu memakai data master terbaru yang juga dipakai audit Manajemen Stok
  // Status:
  // - aktif dipakai; bukan data historis
  // =========================
  useEffect(() => {
    let disposed = false;
    let unsubscribeAdjustments = () => {};
    let unsubscribeRawMaterials = () => {};
    let unsubscribeSemiFinishedMaterials = () => {};
    let unsubscribeFinishedProducts = () => {};

    const initializeSources = async () => {
      try {
        const modeStatus = await getRepositoryModeStatus();
        const useSqliteAdjustments = modeStatus.isSqliteSidecar === true
          && isSqliteRepositoryModuleEnabled();
        if (disposed) return;
        setIsSqliteStockAdjustmentMode(useSqliteAdjustments);

        if (!useSqliteAdjustments) {
          throw new Error("Penyesuaian stok belum aktif. Cek konfigurasi layanan lokal aplikasi.");
        }

        unsubscribeAdjustments = sqliteStockAdjustmentsAdapter.subscribeStockAdjustments(
          (rows) => !disposed && setStockAdjustmentRecords(rows),
          (error) => console.error(error),
          { limit: 500 },
        );
        unsubscribeRawMaterials = listenRawMaterials(
          (rows) => !disposed && setRawMaterials(rows),
          (error) => console.error(error),
        );
        unsubscribeFinishedProducts = listenProducts(
          (rows) => !disposed && setFinishedProducts(rows),
          (error) => console.error(error),
        );
        getActiveSemiFinishedMaterials()
          .then((rows) => !disposed && setSemiFinishedMaterials(rows))
          .catch((error) => console.error(error));
      } catch (error) {
        console.error(error);
        message.error('Gagal memuat sumber data penyesuaian stok.');
      }
    };

    initializeSources();

    return () => {
      disposed = true;
      unsubscribeAdjustments?.();
      unsubscribeRawMaterials?.();
      unsubscribeSemiFinishedMaterials?.();
      unsubscribeFinishedProducts?.();
    };
  }, []);

  // =========================
  // SECTION: Modal helpers
  // Fungsi:
  // - membuka/menutup modal dan membersihkan field form
  // Hubungan flow:
  // - mencegah variantKey lama terbawa ke item baru ketika user melakukan adjustment berikutnya
  // Status:
  // - aktif dipakai
  // =========================
  const resetAdjustmentFormState = () => {
    form.resetFields();
    setIsModalOpen(false);
    isSubmittingRef.current = false;
    setIsSubmitting(false);
  };

  const openCreateAdjustmentModal = () => {
    form.resetFields();
    setIsModalOpen(true);
  };

  // =========================
  // SECTION: Detail read-only adjustment untuk mobile card
  // Fungsi:
  // - membuka detail penyesuaian stok dari kartu mobile tanpa mengubah submit adjustment.
  // Hubungan flow:
  // - hanya membaca record stock_adjustments yang sudah ada di state panel.
  // Status:
  // - AKTIF sebagai UI audit ringkas; tidak melakukan mutation stok/inventory log.
  // =========================
  const openAdjustmentDetail = (record) => {
    setSelectedAdjustmentDetail(record);
  };

  const closeAdjustmentDetail = () => {
    setSelectedAdjustmentDetail(null);
  };

  // =========================
  // SECTION: Pilihan item dan varian aktif
  // Fungsi:
  // - menentukan list item berdasarkan itemType dan membangun opsi varian dari helper final
  // Hubungan flow:
  // - variantKey yang dipilih dipakai transaction untuk update stok varian dan total master tetap sinkron
  // Status:
  // - aktif dipakai; bukan data historis
  // =========================
  const stockSourceItemsByType = useMemo(
    () => ({
      raw_material: rawMaterials,
      semi_finished: semiFinishedMaterials,
      product: finishedProducts,
    }),
    [finishedProducts, rawMaterials, semiFinishedMaterials],
  );

  /* =====================================================
  SECTION: Pilihan item Stock Adjustment — GUARDED
  Fungsi:
  - Menjaga list item aktif tetap stabil per itemType untuk form adjustment.

  Dipakai oleh:
  - StockAdjustmentPanel di halaman Stock Management.

  Alasan perubahan:
  - Memoize availableItems agar dependency selectedItem tidak berubah pada setiap render saat itemType kosong/tidak dikenal.

  Catatan cleanup:
  - Belum ada.

  Risiko:
  - Jangan ubah mapping itemType/collection di sini karena payload stock_adjustments dan inventory_logs bergantung pada source item yang benar.
  ===================================================== */
  const availableItems = useMemo(
    () => stockSourceItemsByType[selectedItemType] || [],
    [selectedItemType, stockSourceItemsByType],
  );

  const selectedItem = useMemo(
    () => availableItems.find((item) => item.id === selectedItemId) || null,
    [availableItems, selectedItemId],
  );

  const selectedItemHasVariants = inferHasVariants(selectedItem || {});

  const variantOptions = useMemo(
    () => (selectedItemHasVariants ? buildVariantOptionsFromItem(selectedItem) : []),
    [selectedItem, selectedItemHasVariants],
  );

  const selectedVariant = useMemo(
    () =>
      variantOptions.find((variantOption) => variantOption.value === selectedVariantKey)
        ?.raw || null,
    [selectedVariantKey, variantOptions],
  );

  // =========================
  // SECTION: Snapshot stok tersedia untuk form adjustment
  // Fungsi:
  // - menampilkan current/reserved/available stock sebelum submit
  // - menjadi guard UI agar adjustment keluar tidak melebihi stok tersedia
  // Hubungan flow:
  // - service tetap menjadi source of truth final; snapshot UI hanya validasi awal dan info user
  // Status:
  // - aktif/final; menggantikan pola lama yang hanya melihat stock master
  // =========================
  const selectedStockSnapshot = useMemo(() => {
    if (!selectedItem) return null;

    if (selectedItemHasVariants) {
      if (!selectedVariant) return null;

      return buildVariantStockSnapshot(selectedVariant);
    }

    return {
      label: selectedItem.name,
      ...getItemStockSnapshot(selectedItem),
    };
  }, [selectedItem, selectedItemHasVariants, selectedVariant]);

  const quantityUnitLabel = selectedItem?.stockUnit || selectedItem?.unit || selectedItem?.baseUnit || "";
  const quantityUsesWholeNumber = isWholeNumberUnit(quantityUnitLabel);
  const selectedItemTypeConfig = resolveStockAdjustmentItemTypeConfig({
    itemType: selectedItemType,
  });
  const selectedCurrentUnitCost = resolveAdjustmentCurrentUnitCost({
    item: selectedItem || {},
    collectionName: selectedItemTypeConfig.collectionName,
    variant: selectedVariant,
  });
  const needsUnitCostGuard =
    selectedAdjustmentType === "in" && selectedItem && selectedCurrentUnitCost <= 0;

  // =========================
  // SECTION: Submit penyesuaian stok atomik
  // Fungsi:
  // - menyimpan stock_adjustments, mutasi stok master/varian, dan inventory_logs dalam satu transaksi layanan database lokal.
  // Hubungan flow aplikasi:
  // - Stock Management adalah audit log + adjustment resmi; stok tidak boleh berubah tanpa record adjustment dan log audit.
  // Status:
  // - AKTIF sebagai satu-satunya submit adjustment manual di UI.
  // - GUARDED karena transaksi dibatalkan jika item/varian tidak valid atau stok keluar melebihi availableStock.
  // - FLOW LAMA: updateInventoryStock -> addDoc adjustment -> addInventoryLog terpisah tidak dipakai lagi di panel ini.
  // - CLEANUP CANDIDATE: orkestrasi transaction masih di component; boleh dipindah ke service khusus jika nanti ada task refactor inventory.
  // =========================
  const handleSubmitStockAdjustment = async (values) => {
    if (isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const selectedItemTypeConfig = resolveStockAdjustmentItemTypeConfig({
        itemType: values.itemType,
      });
      const sourceCollectionName = selectedItemTypeConfig.collectionName;
      const sourceItems = stockSourceItemsByType[values.itemType] || [];
      const selectedSourceItem = sourceItems.find((item) => item.id === values.itemId);
      const adjustmentQuantity = Number(values.quantity || 0);
      const finalQuantityChange =
        values.adjustmentType === "out" ? -adjustmentQuantity : adjustmentQuantity;

      if (!sourceCollectionName) {
        throw new Error("Jenis item penyesuaian stok tidak valid.");
      }

      if (!selectedSourceItem) {
        throw new Error("Item tidak ditemukan");
      }

      if (!values.date?.toDate) {
        throw new Error("Tanggal penyesuaian wajib diisi dengan benar.");
      }

      if (!Number.isFinite(adjustmentQuantity) || adjustmentQuantity <= 0) {
        throw new Error("Jumlah penyesuaian wajib lebih dari 0.");
      }

      if (inferHasVariants(selectedSourceItem) && !values.variantKey) {
        throw new Error("Pilih varian item agar penyesuaian stok masuk ke stok varian yang benar.");
      }

      if (isSqliteStockAdjustmentMode) {
        const result = await sqliteStockAdjustmentsAdapter.commitStockAdjustment({
          sourceType: values.itemType === "raw_material" ? "raw_material" : values.itemType === "semi_finished" ? "semi_finished" : "product",
          sourceId: values.itemId,
          itemType: values.itemType,
          itemId: values.itemId,
          itemName: selectedSourceItem.name,
          variantKey: values.variantKey || "",
          deltaCurrent: finalQuantityChange,
          quantity: adjustmentQuantity,
          adjustmentType: values.adjustmentType,
          reason: values.reason || "",
          notes: values.note || "",
          note: values.note || "",
          unitCost: Number(values.unitCost || 0),
          transactionDate: values.date.toDate().toISOString(),
        });
        try {
          const refreshedAdjustments = await sqliteStockAdjustmentsAdapter.listStockAdjustments({ limit: 500 });
          setStockAdjustmentRecords(refreshedAdjustments);
        } catch (refreshError) {
          console.error("Penyesuaian tersimpan, tetapi riwayat belum bisa dimuat ulang:", refreshError);
          message.warning("Penyesuaian tersimpan. Riwayat akan diperbarui otomatis.");
        }

        const updatedItem = result?.item || null;
        const updatedSourceType = result?.stockReadModel?.sourceType || "";
        if (updatedSourceType === "raw_material") {
          setRawMaterials((current) => upsertRecordById(current, updatedItem, {
            comparator: compareRecordsByNameAsc,
          }));
        } else if (updatedSourceType === "semi_finished") {
          setSemiFinishedMaterials((current) => upsertRecordById(current, updatedItem, {
            comparator: compareRecordsByNameAsc,
          }));
        } else if (updatedSourceType === "product") {
          setFinishedProducts((current) => upsertRecordById(current, updatedItem, {
            comparator: compareRecordsByNameAsc,
          }));
        }

        message.success("Penyesuaian stok berhasil disimpan");
        resetAdjustmentFormState();
        onAdjustmentSaved?.(result);
        return;
      }

      throw new Error("Mode lama Penyesuaian Stok sudah nonaktif. Gunakan Penyesuaian Stok resmi.");

    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menyimpan penyesuaian stok");
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  /* =====================================================
  SECTION: Kolom riwayat Stock Adjustment compact — AKTIF / GUARDED
  Fungsi:
  - Menampilkan audit adjustment dalam table padat tanpa horizontal scroll wajib.
  - Menggabungkan jenis item, nama item, tipe adjustment, qty, alasan, dan catatan tanpa mengubah record audit.

  Dipakai oleh:
  - Panel Stock Adjustment di halaman Manajemen Stok.

  Alasan perubahan:
  - Riwayat adjustment adalah audit read-only; compact table cukup menampilkan ringkasan, sementara catatan panjang tetap tersedia via tooltip/preview.

  Catatan cleanup:
  - Jika nanti ada drawer audit detail, kolom alasan/catatan bisa dibuat lebih pendek lagi.

  Risiko:
  - Jangan mengubah handleSubmitStockAdjustment, runTransaction, payload stock_adjustments, atau inventory_logs dari section UI ini.
  ===================================================== */
  const stockAdjustmentColumns = useMemo(() => {
    return [
      {
        title: "Tanggal",
        dataIndex: "date",
        key: "date",
        width: "12%",
        render: (value) => (value?.toDate ? dayjs(value.toDate()).format("DD-MM-YYYY") : "-"),
      },
      {
        title: "Item",
        key: "itemSummary",
        width: "28%",
        render: (_, record) => {
          const itemTypeConfig = resolveStockAdjustmentItemTypeConfig({
            itemType: record.itemType,
            collectionName: record.collectionName,
          });

          return (
            <div className="ims-cell-stack ims-cell-stack-tight">
              <div>
                <Tag color={itemTypeConfig.tagColor}>{itemTypeConfig.label}</Tag>
              </div>
              <strong>{record.itemName || "-"}</strong>
              {record.variantLabel ? (
                <span className="ims-cell-meta">Varian: {record.variantLabel}</span>
              ) : null}
            </div>
          );
        },
      },
      {
        title: "Adjustment",
        key: "adjustmentSummary",
        width: "16%",
        render: (_, record) => (
          <div className="ims-cell-stack ims-cell-stack-tight">
            {record.adjustmentType === "in" ? (
              <Tag color="green">Tambah</Tag>
            ) : (
              <Tag color="red">Kurang</Tag>
            )}
            <strong>{formatQuantityId(record.quantity, record.unit)}</strong>
          </div>
        ),
      },
      {
        title: "Alasan & Catatan",
        key: "reasonNote",
        width: "44%",
        render: renderAdjustmentReasonNote,
      },
    ];
  }, []);

  // =========================
  // SECTION: Riwayat adjustment terbaru
  // Fungsi:
  // - menampilkan record terbaru di paling atas setelah submit adjustment
  // Alasan:
  // - createdAt adalah waktu input sebenarnya, sedangkan date adalah tanggal bisnis yang bisa diisi mundur/maju oleh user
  // Hubungan flow:
  // - fallback ke date menjaga data historis yang belum punya createdAt tetap tampil wajar
  // Status:
  // - aktif dipakai; kandidat cleanup hanya bila sorting dipindah ke service layer
  // =========================
  const sortedAdjustmentRecords = useMemo(() => {
    const toMillis = (value) => {
      if (!value) return 0;
      if (typeof value?.toMillis === "function") return value.toMillis();
      if (typeof value?.seconds === "number") return value.seconds * 1000;
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };

    return [...stockAdjustmentRecords].sort((left, right) => {
      const leftPrimary = toMillis(left.createdAt) || toMillis(left.date);
      const rightPrimary = toMillis(right.createdAt) || toMillis(right.date);
      return rightPrimary - leftPrimary;
    });
  }, [stockAdjustmentRecords]);

  const stockAdjustmentMobileCardConfig = {
    title: (record) => record.itemName || '-',
    subtitle: (record) => {
      const itemTypeConfig = resolveStockAdjustmentItemTypeConfig({
        itemType: record.itemType,
        collectionName: record.collectionName,
      });
      return [
        record.date?.toDate ? dayjs(record.date.toDate()).format('DD-MM-YYYY') : '-',
        itemTypeConfig.label,
        record.variantLabel ? `Varian: ${record.variantLabel}` : null,
      ].filter(Boolean);
    },
    tags: (record) => {
      const itemTypeConfig = resolveStockAdjustmentItemTypeConfig({
        itemType: record.itemType,
        collectionName: record.collectionName,
      });
      return [
        <Tag key="item-type" color={itemTypeConfig.tagColor}>{itemTypeConfig.label}</Tag>,
        record.adjustmentType === 'in' ? (
          <Tag key="adjustment-type" color="green">Tambah</Tag>
        ) : (
          <Tag key="adjustment-type" color="red">Kurang</Tag>
        ),
      ];
    },
    meta: [
      { label: 'Qty', value: (record) => formatQuantityId(record.quantity, record.unit) },
      { label: 'Tanggal', value: (record) => (record.date?.toDate ? dayjs(record.date.toDate()).format('DD-MM-YYYY') : '-') },
    ],
    content: (record) => renderAdjustmentReasonNote(null, record),
    actions: (record) => (
      <Button
        className="ims-action-button"
        icon={<EyeOutlined />}
        size="small"
        onClick={() => openAdjustmentDetail(record)}
      >
        Detail
      </Button>
    ),
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {isSqliteStockAdjustmentMode ? (
          <InfoPopoverButton
            label="Aturan Penyesuaian"
            title="Aturan penyesuaian stok"
            description="Penyesuaian stok aktif untuk Produk Jadi, Bahan Baku, dan Semi Finished. Gunakan hanya untuk koreksi stok yang jelas alasannya."
            items={[
              { label: 'Wajib alasan', value: 'Setiap adjustment perlu catatan.' },
              { label: 'Audit', value: 'Perubahan tercatat di histori stok.' },
              { label: 'Bukan retur', value: 'Barang kembali tetap lewat flow return.' },
            ]}
          />
        ) : null}
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateAdjustmentModal}>
          Tambah Penyesuaian
        </Button>
      </div>

      <DataTableView
        // AKTIF / GUARDED UI: class standar menjaga table adjustment solid di light/dark tanpa mengubah submit adjustment atau mutasi stok.
        className="app-data-table"
        rowKey="id"
        columns={stockAdjustmentColumns}
        dataSource={sortedAdjustmentRecords}
        tableLayout="fixed"
        pagination={{ pageSize: 5 }}
        mobileCardConfig={stockAdjustmentMobileCardConfig}
      />

      <MobileDetailDrawer
        title="Detail Penyesuaian Stok"
        open={Boolean(selectedAdjustmentDetail)}
        onClose={closeAdjustmentDetail}
        width="min(100vw, 420px)"
      >
        {selectedAdjustmentDetail ? (() => {
          const itemTypeConfig = resolveStockAdjustmentItemTypeConfig({
            itemType: selectedAdjustmentDetail.itemType,
            collectionName: selectedAdjustmentDetail.collectionName,
          });
          const reasonText = getStockAdjustmentReasonLabel(selectedAdjustmentDetail.reason);

          return (
            <Space direction="vertical" size={14} style={{ width: "100%" }}>
              <div className="ims-cell-stack">
                <Text type="secondary">Tanggal</Text>
                <Text strong>
                  {selectedAdjustmentDetail.date?.toDate
                    ? dayjs(selectedAdjustmentDetail.date.toDate()).format("DD-MM-YYYY")
                    : "-"}
                </Text>
              </div>
              <div className="ims-cell-stack">
                <Text type="secondary">Item</Text>
                <Text strong>{selectedAdjustmentDetail.itemName || "-"}</Text>
                <Space wrap>
                  <Tag color={itemTypeConfig.tagColor}>{itemTypeConfig.label}</Tag>
                  {selectedAdjustmentDetail.variantLabel ? <Tag color="purple">{selectedAdjustmentDetail.variantLabel}</Tag> : null}
                </Space>
              </div>
              <div className="ims-cell-stack">
                <Text type="secondary">Adjustment</Text>
                <Space wrap>
                  {selectedAdjustmentDetail.adjustmentType === "in" ? (
                    <Tag color="green">Tambah</Tag>
                  ) : (
                    <Tag color="red">Kurang</Tag>
                  )}
                  <Text strong>{formatQuantityId(selectedAdjustmentDetail.quantity, selectedAdjustmentDetail.unit)}</Text>
                </Space>
              </div>
              <div className="ims-cell-stack">
                <Text type="secondary">Alasan</Text>
                <Text>{reasonText}</Text>
              </div>
              <div className="ims-cell-stack">
                <Text type="secondary">Catatan</Text>
                <Text>{normalizeCompactText(selectedAdjustmentDetail.note) || "-"}</Text>
              </div>
            </Space>
          );
        })() : null}
      </MobileDetailDrawer>

      {/* =====================================================
          SECTION: Stock Adjustment Form Renderer — GUARDED
          Fungsi:
          - Menampilkan form penyesuaian stok, snapshot stok terpilih, dan warning sebelum submit.

          Dipakai oleh:
          - Halaman Manajemen Stok untuk adjustment manual lintas item.

          Alasan perubahan:
          - Panel dibuat lebih ringkas dan warning dampak stok dibuat tetap terlihat tanpa mengubah submit payload atau validasi.

          Catatan cleanup:
          - Jika nanti ada drawer detail stok khusus, snapshot ini bisa memakai komponen ringkasan yang sama.

          Risiko:
          - Jangan mengubah validasi available stock, variantKey, transaction, stock_adjustments, atau inventory_logs dari form ini.
      ===================================================== */}
      <Modal
        title="Penyesuaian Stok"
        open={isModalOpen}
        onCancel={resetAdjustmentFormState}
        onOk={() => form.submit()}
        okText="Simpan"
        confirmLoading={isSubmitting}
        cancelText="Batal"
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitStockAdjustment}
          onFinishFailed={(errorInfo) => showFormValidationFeedback(errorInfo, { form })}
        >
          <ResponsiveFormSection
            title="Data Penyesuaian Stok"
            subtitle="Cek item, arah penyesuaian, qty, modal, alasan, dan catatan sebelum simpan."
          >
          <ImsNotice
            variant="guard"
            compact
            className="ims-mb-16"
            title="Penyesuaian akan mengubah stok"
            description="Cek item, varian, qty, dan alasan sebelum simpan."
          />

          <Form.Item
            name="date"
            label="Tanggal"
            rules={[{ required: true, message: "Tanggal wajib diisi" }]}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="itemType"
            label="Jenis Item"
            rules={[{ required: true, message: "Jenis item wajib dipilih" }]}
          >
            <Select
              placeholder="Pilih jenis item"
              onChange={() => {
                form.setFieldsValue({ itemId: undefined, variantKey: undefined, unitCost: undefined });
              }}
            >
              <Option value="raw_material">Bahan Baku</Option>
              <Option value="semi_finished">Semi Finished</Option>
              <Option value="product">Produk Jadi</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="itemId"
            label="Pilih Item"
            rules={[{ required: true, message: "Item wajib dipilih" }]}
          >
            <Select
              showSearch
              placeholder="Pilih item"
              optionFilterProp="children"
              onChange={() => {
                form.setFieldsValue({ variantKey: undefined, unitCost: undefined });
              }}
            >
              {availableItems.map((item) => (
                <Option key={item.id} value={item.id}>
                  {item.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {selectedItemHasVariants ? (
            <Form.Item
              name="variantKey"
              label="Varian Item"
              rules={[{ required: true, message: "Varian wajib dipilih untuk item bervarian" }]}
              tooltip="Pilih varian jika item bervarian."
            >
              <Select
                showSearch
                placeholder="Pilih varian"
                optionFilterProp="children"
                onChange={() => {
                  form.setFieldsValue({ unitCost: undefined });
                }}
              >
                {variantOptions.map((variantOption) => (
                  <Option key={variantOption.value} value={variantOption.value}>
                    {variantOption.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          ) : null}

          {/* =====================================================
              SECTION: Snapshot stok terpilih - AKTIF / GUARDED
              Fungsi blok:
              - menampilkan current/reserved/available stock sebagai panel read-only pasif, bukan Alert warning.
              Hubungan flow Stock Adjustment:
              - hanya mengganti tampilan snapshot sebelum submit; validasi availableStock, variantKey, transaction, stock_adjustments, dan inventory_logs tetap memakai logic existing.
              Alasan logic:
              - info stok bukan warning/error, sehingga lebih aman secara UX ditampilkan sebagai panel clean seperti Purchases.
              Status: AKTIF untuk UI Stock Adjustment, GUARDED terhadap mutasi stok dan payload layanan database lokal.
          ===================================================== */}
          {selectedItem ? (
            <div className="ims-readonly-panel">
              <div className="ims-readonly-panel-header">
                <div>
                  <div className="ims-readonly-panel-title">
                    Stok Sebelum Penyesuaian
                  </div>
                  <div className="ims-readonly-panel-description">
                    Cek stok terpilih sebelum submit. Perubahan baru terjadi setelah disimpan.
                  </div>
                </div>
                <Tag color={selectedItemHasVariants ? "purple" : "default"}>
                  {selectedItemHasVariants ? "Varian" : "Master"}
                </Tag>
              </div>

              <div style={{ marginBottom: selectedStockSnapshot ? 10 : 0 }}>
                <span className="ims-cell-title">
                  {selectedItem.name || "Item"}
                </span>
                {selectedStockSnapshot?.label ? (
                  <span style={{ color: "var(--ims-text-secondary)" }}>
                    {` — ${selectedStockSnapshot.label}`}
                  </span>
                ) : null}
              </div>

              {selectedStockSnapshot ? (
                <div className="ims-readonly-stat-grid">
                  <div className="ims-readonly-stat-field">
                    <div className="ims-readonly-stat-label">Stok Saat Ini</div>
                    <div className="ims-readonly-stat-value">
                      {formatQuantityId(selectedStockSnapshot.currentStock, quantityUnitLabel)}
                    </div>
                  </div>
                  <div className="ims-readonly-stat-field">
                    <div className="ims-readonly-stat-label">Stok Dipesan</div>
                    <div className="ims-readonly-stat-value">
                      {formatQuantityId(selectedStockSnapshot.reservedStock, quantityUnitLabel)}
                    </div>
                  </div>
                  <div className="ims-readonly-stat-field">
                    <div className="ims-readonly-stat-label">Stok Tersedia</div>
                    <div className="ims-readonly-stat-value">
                      {formatQuantityId(selectedStockSnapshot.availableStock, quantityUnitLabel)}
                    </div>
                  </div>
                </div>
              ) : null}

              {selectedItemHasVariants ? (
                <div className="ims-readonly-panel-note">
                  Item bervarian wajib masuk ke varian yang dipilih agar stok varian dan total master tetap sinkron.
                </div>
              ) : null}
            </div>
          ) : null}

          <Form.Item
            name="adjustmentType"
            label="Tipe Penyesuaian"
            rules={[{ required: true, message: "Tipe penyesuaian wajib dipilih" }]}
          >
            <Select
              placeholder="Pilih tipe penyesuaian"
              onChange={() => {
                form.setFieldsValue({ unitCost: undefined });
              }}
            >
              <Option value="in">Tambah</Option>
              <Option value="out">Kurang</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="quantity"
            label="Jumlah"
            dependencies={["adjustmentType", "itemId", "variantKey"]}
            rules={[
              { required: true, message: "Jumlah wajib diisi" },
              {
                validator: (_, value) => {
                  const numericValue = Number(value || 0);

                  if (
                    selectedAdjustmentType === "out" &&
                    selectedStockSnapshot &&
                    numericValue > selectedStockSnapshot.availableStock
                  ) {
                    return Promise.reject(
                      new Error(
                        `Jumlah keluar melebihi stok tersedia (${formatQuantityId(
                          selectedStockSnapshot.availableStock,
                          quantityUnitLabel,
                        )}).`,
                      ),
                    );
                  }

                  return Promise.resolve();
                },
              },
            ]}
            extra={
              quantityUnitLabel
                ? `Satuan: ${quantityUnitLabel}. ${quantityUsesWholeNumber ? "Qty tanpa desimal." : "Qty ditampilkan tanpa desimal."}${selectedVariant ? ` Varian: ${selectedVariant.variantLabel}.` : ""}`
                : "Pilih item dulu agar satuan qty jelas."
            }
          >
            <InputNumber
              min={1}
              step={1}
              precision={0}
              style={{ width: "100%" }}
              formatter={(value) => formatNumberId(value)}
              parser={parseIntegerIdInput}
            />
          </Form.Item>

          {selectedAdjustmentType === "in" ? (
            <Form.Item
              name="unitCost"
              label="Modal per Unit"
              rules={[
                {
                  validator: (_, value) => {
                    if (!needsUnitCostGuard) return Promise.resolve();

                    const numericValue = Number(value || 0);
                    if (Number.isFinite(numericValue) && numericValue > 0) {
                      return Promise.resolve();
                    }

                    return Promise.reject(
                      new Error("Modal per unit wajib diisi karena cost/HPP item masih 0."),
                    );
                  },
                },
              ]}
              extra={
                selectedCurrentUnitCost > 0
                  ? "Cost/HPP master sudah ada, field ini opsional dan tidak mengubah cost lama."
                  : "Wajib untuk stok masuk pertama atau data arsip yang cost/HPP-nya masih 0."
              }
            >
              <InputNumber
                min={0}
                step={1}
                precision={0}
                style={{ width: "100%" }}
                formatter={(value) => formatNumberId(value)}
                parser={parseIntegerIdInput}
              />
            </Form.Item>
          ) : null}

          <Form.Item
            name="reason"
            label="Alasan"
            rules={[{ required: true, message: "Alasan wajib diisi" }]}
          >
            <Select placeholder="Pilih alasan">
              <Option value="stok_awal">Stok Awal</Option>
              <Option value="opname">Selisih Opname</Option>
              <Option value="rusak">Barang Rusak</Option>
              <Option value="hilang">Barang Hilang</Option>
              <Option value="lainnya">Lainnya</Option>
            </Select>
          </Form.Item>

          <Form.Item name="note" label="Catatan">
            <Input.TextArea rows={3} placeholder="Opsional" />
          </Form.Item>
          </ResponsiveFormSection>
        </Form>
      </Modal>
    </>
  );
};

export default StockAdjustmentPanel;
