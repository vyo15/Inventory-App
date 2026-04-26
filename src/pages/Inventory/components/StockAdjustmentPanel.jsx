import React, { useEffect, useMemo, useRef, useState } from "react";
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
import {
  buildInventoryLogPayload,
  INVENTORY_LOG_COLLECTION,
} from "../../../services/Inventory/inventoryLogService";
import { formatNumberId } from "../../../utils/formatters/numberId";
import {
  buildVariantOptionsFromItem,
  findVariantByKey,
  getItemStockSnapshot,
  inferHasVariants,
  applyStockMutationToItem,
} from "../../../utils/variants/variantStockHelpers";

const { Option } = Select;

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
  const isDiscrete = isWholeNumberUnit(unit);

  // =========================
  // SECTION: Format qty adjustment tanpa trailing .00
  // Fungsi:
  // - menampilkan qty bulat tanpa desimal dan qty pecahan maksimal 2 desimal dengan format Indonesia
  // Alasan:
  // - panel Penyesuaian Stok tidak boleh membingungkan user dengan tampilan 1.00 untuk item pcs/bulat
  // Status:
  // - aktif dipakai pada preview stok, warning validasi, dan tabel riwayat adjustment
  // =========================
  const formatted = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: isDiscrete ? 0 : 2,
  }).format(numericValue);

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
  // - membaca stock_adjustments, raw_materials, dan products secara realtime
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
  const availableItems = selectedItemType === "product" ? finishedProducts : rawMaterials;

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

      return {
        label: selectedVariant.variantLabel,
        currentStock: Number(selectedVariant.currentStock || 0),
        reservedStock: Number(selectedVariant.reservedStock || 0),
        availableStock: Number(selectedVariant.availableStock || 0),
      };
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
      const isRawMaterial = values.itemType === "raw_material";
      const sourceCollectionName = isRawMaterial ? "raw_materials" : "products";
      const sourceItems = isRawMaterial ? rawMaterials : finishedProducts;
      const selectedSourceItem = sourceItems.find((item) => item.id === values.itemId);
      const adjustmentQuantity = Number(values.quantity || 0);
      const finalQuantityChange =
        values.adjustmentType === "out" ? -adjustmentQuantity : adjustmentQuantity;

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

      const itemReference = doc(db, sourceCollectionName, values.itemId);
      const adjustmentReference = doc(collection(db, "stock_adjustments"));
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
          ? {
              currentStock: Number(selectedSourceVariant.currentStock || 0),
              reservedStock: Number(selectedSourceVariant.reservedStock || 0),
              availableStock: Number(
                selectedSourceVariant.availableStock ??
                  Math.max(
                    Number(selectedSourceVariant.currentStock || 0) -
                      Number(selectedSourceVariant.reservedStock || 0),
                    0,
                  ),
              ),
            }
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
          date: Timestamp.fromDate(values.date.toDate()),
          itemType: values.itemType,
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
            referenceId: adjustmentReference.id,
            referenceType: "stock_adjustment",
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

  // =========================
  // SECTION: Kolom riwayat adjustment
  // Fungsi:
  // - menampilkan riwayat stock_adjustments di area Manajemen Stok
  // Hubungan flow:
  // - membantu audit adjustment tanpa membuka halaman/menu terpisah
  // Status:
  // - aktif dipakai untuk UI panel
  // =========================
  const stockAdjustmentColumns = useMemo(() => {
    return [
      {
        title: "Tanggal",
        dataIndex: "date",
        key: "date",
        render: (value) => (value?.toDate ? dayjs(value.toDate()).format("DD-MM-YYYY") : "-"),
      },
      {
        title: "Jenis Item",
        dataIndex: "itemType",
        key: "itemType",
        render: (value) =>
          value === "raw_material" ? <Tag color="gold">Bahan Baku</Tag> : <Tag color="blue">Produk</Tag>,
      },
      {
        title: "Nama Item",
        key: "itemName",
        render: (_, record) => (
          <div>
            <strong>{record.itemName || "-"}</strong>
            {record.variantLabel ? (
              <div style={{ fontSize: 12, color: "#666" }}>Varian: {record.variantLabel}</div>
            ) : null}
          </div>
        ),
      },
      {
        title: "Tipe Penyesuaian",
        dataIndex: "adjustmentType",
        key: "adjustmentType",
        render: (value) =>
          value === "in" ? <Tag color="green">Tambah</Tag> : <Tag color="red">Kurang</Tag>,
      },
      {
        title: "Qty",
        key: "quantity",
        render: (_, record) => formatQuantityId(record.quantity, record.unit),
      },
      {
        title: "Alasan",
        dataIndex: "reason",
        key: "reason",
        render: (value) => value || "-",
      },
      {
        title: "Catatan",
        dataIndex: "note",
        key: "note",
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
        rowKey="id"
        columns={stockAdjustmentColumns}
        dataSource={sortedAdjustmentRecords}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 5 }}
      />

      <Modal
        title="Tambah Penyesuaian Stok"
        open={isModalOpen}
        onCancel={resetAdjustmentFormState}
        onOk={() => form.submit()}
        okText="Simpan"
        confirmLoading={isSubmitting}
        cancelText="Batal"
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmitStockAdjustment}>
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
              extra="Penyesuaian item bervarian wajib masuk ke varian agar total master tetap sinkron."
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

          {selectedStockSnapshot ? (
            <Alert
              showIcon
              type={selectedAdjustmentType === "out" ? "warning" : "info"}
              style={{ marginBottom: 16 }}
              message={`Stok tersedia ${selectedStockSnapshot.label || "item"}`}
              description={`Stok saat ini: ${formatQuantityId(
                selectedStockSnapshot.currentStock,
                quantityUnitLabel,
              )} | Dipesan: ${formatQuantityId(
                selectedStockSnapshot.reservedStock,
                quantityUnitLabel,
              )} | Tersedia: ${formatQuantityId(
                selectedStockSnapshot.availableStock,
                quantityUnitLabel,
              )}`}
            />
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
                ? `Satuan item: ${quantityUnitLabel}. ${
                    quantityUsesWholeNumber
                      ? "Qty dibulatkan tanpa desimal."
                      : "Qty boleh desimal jika memang satuannya pecahan."
                  }${selectedVariant ? ` Varian aktif: ${selectedVariant.variantLabel}.` : ""}`
                : "Pilih item dulu agar format qty mengikuti satuan stok item."
            }
          >
            <InputNumber
              min={quantityUsesWholeNumber ? 1 : 0.01}
              step={quantityUsesWholeNumber ? 1 : 0.01}
              precision={quantityUsesWholeNumber ? 0 : 2}
              style={{ width: "100%" }}
              formatter={(value) => {
                const rawNumber = Number(value || 0);
                if (!Number.isFinite(rawNumber)) return value;
                return quantityUsesWholeNumber
                  ? formatNumberId(rawNumber)
                  : new Intl.NumberFormat("id-ID", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    }).format(rawNumber);
              }}
              parser={(value) => {
                const normalized = String(value || "")
                  .replace(/\./g, "")
                  .replace(",", ".")
                  .replace(/[^\d.-]/g, "");
                return normalized ? Number(normalized) : 0;
              }}
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
            <Input.TextArea rows={3} placeholder="Catatan tambahan" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default StockAdjustmentPanel;
