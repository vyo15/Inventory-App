import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Table,
  Tag,
  Tooltip,
  message,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { collection, doc, onSnapshot, runTransaction, Timestamp } from "firebase/firestore";
import dayjs from "dayjs";
import { db } from "../../../firebase";
import { generateDailySequenceCode } from "../../../utils/references/businessCodeGenerator";
import {
  buildInventoryLogPayload,
  INVENTORY_LOG_COLLECTION,
} from "../../../services/Inventory/inventoryLogService";
import { formatNumberId, parseIntegerIdInput } from "../../../utils/formatters/numberId";
import {
  buildVariantOptionsFromItem,
  findVariantByKey,
  getItemStockSnapshot,
  inferHasVariants,
  applyStockMutationToItem,
} from "../../../utils/variants/variantStockHelpers";
import { showFormValidationFeedback } from '../../../utils/forms/formValidationFeedback';


// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data lama decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema Firestore tetap sama.

const { Option } = Select;


// =========================
// SECTION: Konfigurasi sumber item Stock Adjustment
// Fungsi blok:
// - menyatukan mapping itemType UI ke collection Firestore dan label riwayat adjustment.
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
// - bukan legacy dan bukan kandidat cleanup
// =========================
const WHOLE_NUMBER_UNIT_KEYWORDS = [
  "pcs",
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
  // Behavior: tampilan/input berubah ke no-decimal; data lama pecahan tidak dimigrasi.
  // =========================
  const formatted = formatNumberId(numericValue);

  return `${formatted}${unit ? ` ${unit}` : ""}`.trim();
};

// =========================
// SECTION: Tampilan ringkas catatan adjustment
// Fungsi:
// - membatasi catatan di tabel adjustment agar row tidak terlalu tinggi.
// Hubungan flow aplikasi:
// - hanya memengaruhi tampilan audit; tidak mengubah data stock_adjustments atau inventory_logs.
// Status:
// - AKTIF untuk UI Stock Adjustment Panel.
// - GUARDED karena catatan lengkap tetap tersedia di tooltip.
// - LEGACY: tidak ada logic legacy yang dipakai di blok ini.
// - CLEANUP CANDIDATE: tidak perlu dibersihkan selama tabel masih menampilkan catatan bebas.
// =========================
const NOTE_PREVIEW_STYLE = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  whiteSpace: "normal",
  lineHeight: 1.35,
};

const renderCompactNote = (value) => {
  const noteText = String(value || "-").trim() || "-";

  return (
    <Tooltip title={noteText !== "-" ? noteText : ""}>
      <span style={NOTE_PREVIEW_STYLE}>{noteText}</span>
    </Tooltip>
  );
};

// =========================
// SECTION: Stock Adjustment Panel
// Fungsi:
// - memindahkan form dan riwayat Penyesuaian Stok ke dalam halaman Manajemen Stok
// Hubungan flow:
// - menjadi satu-satunya UI aktif untuk adjustment manual setelah menu / halaman lama dihapus
// - mutasi stok sekarang memakai Firestore transaction dan applyStockMutationToItem agar stock/currentStock/availableStock/variants[] sinkron
// Status:
// - aktif/final untuk adjustment stok manual
// - bukan halaman route mandiri; route lama /stock-adjustment hanya redirect ke /stock-management
// =========================
const StockAdjustmentPanel = ({ onAdjustmentSaved }) => {
  // =========================
  // SECTION: State panel adjustment
  // Fungsi:
  // - menyimpan riwayat stock_adjustments, master item, dan status modal form
  // Hubungan flow:
  // - master item hanya dipakai sebagai pilihan form; source of truth mutasi final ada di Firestore transaction dan helper stok varian aktif
  // - isSubmittingRef menjadi guard teknis agar submit dobel tidak membuat double stock/log sebelum state React sempat update
  // Status:
  // - AKTIF dipakai di halaman Manajemen Stok.
  // - GUARDED karena submit state/ref mencegah double submit.
  // - LEGACY: tidak ada state legacy yang dipakai untuk mutasi stok.
  // - CLEANUP CANDIDATE jika orkestrasi adjustment dipindah ke service khusus.
  // =========================
  const [stockAdjustmentRecords, setStockAdjustmentRecords] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [semiFinishedMaterials, setSemiFinishedMaterials] = useState([]);
  const [finishedProducts, setFinishedProducts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const [form] = Form.useForm();
  const selectedItemType = Form.useWatch("itemType", form);
  const selectedItemId = Form.useWatch("itemId", form);
  const selectedVariantKey = Form.useWatch("variantKey", form);
  const selectedAdjustmentType = Form.useWatch("adjustmentType", form);

  // =========================
  // SECTION: Live data subscription
  // Fungsi:
  // - membaca stock_adjustments, raw_materials, semi_finished_materials, dan products secara realtime
  // Hubungan flow:
  // - panel adjustment selalu memakai data master terbaru yang juga dipakai audit Manajemen Stok
  // Status:
  // - aktif dipakai; bukan legacy
  // =========================
  useEffect(() => {
    const unsubscribeAdjustments = onSnapshot(
      collection(db, "stock_adjustments"),
      (snapshot) => {
        const nextAdjustmentRecords = snapshot.docs.map((documentItem) => ({
          id: documentItem.id,
          ...documentItem.data(),
        }));

        setStockAdjustmentRecords(nextAdjustmentRecords);
      },
    );

    const unsubscribeRawMaterials = onSnapshot(
      collection(db, "raw_materials"),
      (snapshot) => {
        const nextRawMaterials = snapshot.docs.map((documentItem) => ({
          id: documentItem.id,
          ...documentItem.data(),
        }));

        setRawMaterials(nextRawMaterials);
      },
    );

    const unsubscribeSemiFinishedMaterials = onSnapshot(
      collection(db, "semi_finished_materials"),
      (snapshot) => {
        const nextSemiFinishedMaterials = snapshot.docs.map((documentItem) => ({
          id: documentItem.id,
          ...documentItem.data(),
        }));

        setSemiFinishedMaterials(nextSemiFinishedMaterials);
      },
    );

    const unsubscribeFinishedProducts = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        const nextFinishedProducts = snapshot.docs.map((documentItem) => ({
          id: documentItem.id,
          ...documentItem.data(),
        }));

        setFinishedProducts(nextFinishedProducts);
      },
    );

    return () => {
      unsubscribeAdjustments();
      unsubscribeRawMaterials();
      unsubscribeSemiFinishedMaterials();
      unsubscribeFinishedProducts();
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
  // SECTION: Pilihan item dan varian aktif
  // Fungsi:
  // - menentukan list item berdasarkan itemType dan membangun opsi varian dari helper final
  // Hubungan flow:
  // - variantKey yang dipilih dipakai transaction untuk update stok varian dan total master tetap sinkron
  // Status:
  // - aktif dipakai; bukan legacy
  // =========================
  const stockSourceItemsByType = useMemo(
    () => ({
      raw_material: rawMaterials,
      semi_finished: semiFinishedMaterials,
      product: finishedProducts,
    }),
    [finishedProducts, rawMaterials, semiFinishedMaterials],
  );

  const availableItems = stockSourceItemsByType[selectedItemType] || [];

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

  const quantityUnitLabel = selectedItem?.stockUnit || selectedItem?.unit || "";
  const quantityUsesWholeNumber = isWholeNumberUnit(quantityUnitLabel);

  // =========================
  // SECTION: Submit penyesuaian stok atomik
  // Fungsi:
  // - menyimpan stock_adjustments, mutasi stok master/varian, dan inventory_logs dalam satu Firestore transaction.
  // Hubungan flow aplikasi:
  // - Stock Management adalah audit log + adjustment resmi; stok tidak boleh berubah tanpa record adjustment dan log audit.
  // Status:
  // - AKTIF sebagai satu-satunya submit adjustment manual di UI.
  // - GUARDED karena transaksi dibatalkan jika item/varian tidak valid atau stok keluar melebihi availableStock.
  // - LEGACY: flow lama updateInventoryStock -> addDoc adjustment -> addInventoryLog terpisah tidak dipakai lagi di panel ini.
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

      const adjustmentNumber = await generateDailySequenceCode({
        db,
        collectionName: "stock_adjustments",
        fieldNames: ["adjustmentNumber", "code", "referenceNumber", "sourceRef"],
        prefix: "STK-ADJ",
        date: values.date.toDate(),
      });
      /* =====================================================
      SECTION: Stock Adjustment reference number — GUARDED
      Fungsi:
      - Membuat adjustmentNumber STK-ADJ-DDMMYYYY-001 dan memakai nomor itu sebagai document ID baru.

      Dipakai oleh:
      - handleSubmitStockAdjustment sebelum transaction mutasi stok.

      Alasan perubahan:
      - Stock adjustment baru perlu reference user-facing, bukan Firestore random ID.

      Catatan cleanup:
      - Data adjustment lama tanpa nomor tetap compatibility.

      Risiko:
      - Jangan mengubah applyStockMutationToItem, prevent negative, reserved/available stock, atau transaction flow dari section ini.
      ===================================================== */
      const itemReference = doc(db, sourceCollectionName, values.itemId);
      const adjustmentReference = doc(db, "stock_adjustments", adjustmentNumber);
      const inventoryLogReference = doc(collection(db, INVENTORY_LOG_COLLECTION));
      const adjustmentTimestamp = Timestamp.now();

      await runTransaction(db, async (transaction) => {
        const itemSnapshot = await transaction.get(itemReference);

        if (!itemSnapshot.exists()) {
          throw new Error("Item stok tidak ditemukan saat menyimpan penyesuaian.");
        }

        const latestSourceItem = {
          id: itemSnapshot.id,
          ...itemSnapshot.data(),
        };

        const latestHasVariants = inferHasVariants(latestSourceItem);
        const selectedSourceVariant = values.variantKey
          ? findVariantByKey(latestSourceItem, values.variantKey)
          : null;

        if (latestHasVariants && !selectedSourceVariant) {
          throw new Error(
            `Varian item ${latestSourceItem.name || values.itemId} tidak ditemukan. Proses dihentikan agar stok tidak masuk ke master/default.`,
          );
        }

        const sourceStockSnapshot = selectedSourceVariant
          ? buildVariantStockSnapshot(selectedSourceVariant)
          : getItemStockSnapshot(latestSourceItem);

        if (values.adjustmentType === "out" && adjustmentQuantity > sourceStockSnapshot.availableStock) {
          throw new Error(
            `Jumlah keluar melebihi stok tersedia. Tersedia: ${formatQuantityId(
              sourceStockSnapshot.availableStock,
              latestSourceItem.stockUnit || latestSourceItem.unit || "",
            )}`,
          );
        }

        const stockUpdatePayload = applyStockMutationToItem({
          item: latestSourceItem,
          variantKey: selectedSourceVariant?.variantKey || "",
          deltaCurrent: finalQuantityChange,
        });
        const currentStockAfter = sourceStockSnapshot.currentStock + finalQuantityChange;
        const availableStockAfter = Math.max(
          currentStockAfter - sourceStockSnapshot.reservedStock,
          0,
        );
        const variantPayload = {
          variantId: selectedSourceVariant?.variantKey || "",
          variantKey: selectedSourceVariant?.variantKey || "",
          variantLabel: selectedSourceVariant?.variantLabel || "",
          stockSourceType: selectedSourceVariant ? "variant" : "master",
        };
        const adjustmentPayload = {
          adjustmentNumber,
          code: adjustmentNumber,
          referenceNumber: adjustmentNumber,
          sourceRef: adjustmentNumber,
          date: Timestamp.fromDate(values.date.toDate()),
          itemType: values.itemType,
          itemTypeLabel: selectedItemTypeConfig.label,
          collectionName: sourceCollectionName,
          itemId: values.itemId,
          itemName: latestSourceItem.name,
          adjustmentType: values.adjustmentType,
          quantity: adjustmentQuantity,
          finalQuantity: finalQuantityChange,
          finalQuantityChange,
          reason: values.reason || "",
          note: values.note || "",
          unit: latestSourceItem.stockUnit || latestSourceItem.unit || "",
          currentStockBefore: sourceStockSnapshot.currentStock,
          currentStockAfter,
          reservedStockBefore: sourceStockSnapshot.reservedStock,
          reservedStockAfter: sourceStockSnapshot.reservedStock,
          availableStockBefore: sourceStockSnapshot.availableStock,
          availableStockAfter,
          ...variantPayload,
          createdAt: adjustmentTimestamp,
        };
        const inventoryLogPayload = buildInventoryLogPayload({
          itemId: values.itemId,
          itemName: latestSourceItem.name,
          quantityChange: finalQuantityChange,
          type: "stock_adjustment",
          collectionName: sourceCollectionName,
          timestamp: adjustmentTimestamp,
          extraData: {
            adjustmentId: adjustmentReference.id,
            adjustmentNumber,
            referenceId: adjustmentReference.id,
            referenceNumber: adjustmentNumber,
            referenceCode: adjustmentNumber,
            sourceRef: adjustmentNumber,
            referenceType: "stock_adjustment",
            itemType: values.itemType,
            itemTypeLabel: selectedItemTypeConfig.label,
            collectionName: sourceCollectionName,
            reason: values.reason || "",
            note: values.note || "",
            currentStockBefore: sourceStockSnapshot.currentStock,
            currentStockAfter,
            previousStock: sourceStockSnapshot.currentStock,
            newStock: currentStockAfter,
            reservedStockBefore: sourceStockSnapshot.reservedStock,
            reservedStockAfter: sourceStockSnapshot.reservedStock,
            availableStockBefore: sourceStockSnapshot.availableStock,
            availableStockAfter,
            ...variantPayload,
          },
        });

        transaction.update(itemReference, stockUpdatePayload);
        transaction.set(adjustmentReference, adjustmentPayload);
        transaction.set(inventoryLogReference, inventoryLogPayload);
      });

      message.success("Penyesuaian stok berhasil disimpan");
      resetAdjustmentFormState();
      onAdjustmentSaved?.();
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
        title: "Alasan",
        dataIndex: "reason",
        key: "reason",
        width: "22%",
        render: renderCompactNote,
      },
      {
        title: "Catatan",
        dataIndex: "note",
        key: "note",
        width: "22%",
        render: renderCompactNote,
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
  // - fallback ke date menjaga data lama yang belum punya createdAt tetap tampil wajar
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

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateAdjustmentModal}>
          Tambah Penyesuaian
        </Button>
      </div>

      <Table
        // AKTIF / GUARDED UI: class standar menjaga table adjustment solid di light/dark tanpa mengubah submit adjustment atau mutasi stok.
        className="app-data-table"
        rowKey="id"
        columns={stockAdjustmentColumns}
        dataSource={sortedAdjustmentRecords}
        tableLayout="fixed"
        pagination={{ pageSize: 5 }}
      />

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
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Penyesuaian akan mengubah stok"
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
                form.setFieldsValue({ itemId: undefined, variantKey: undefined });
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
                form.setFieldsValue({ variantKey: undefined });
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
              extra="Pilih varian jika item bervarian."
            >
              <Select showSearch placeholder="Pilih varian" optionFilterProp="children">
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
              Status: AKTIF untuk UI Stock Adjustment, GUARDED terhadap mutasi stok dan payload Firestore.
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
                <span style={{ fontWeight: 600 }}>
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
            <Select placeholder="Pilih tipe penyesuaian">
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
        </Form>
      </Modal>
    </>
  );
};

export default StockAdjustmentPanel;
