import React, { useEffect, useMemo, useState } from "react";
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
  message,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { addDoc, collection, onSnapshot, Timestamp } from "firebase/firestore";
import dayjs from "dayjs";
import { db } from "../../../firebase";
import { addInventoryLog, updateInventoryStock } from "../../../services/Inventory/inventoryService";
import { formatNumberId } from "../../../utils/formatters/numberId";
import {
  buildVariantOptionsFromItem,
  findVariantByKey,
  getItemStockSnapshot,
  inferHasVariants,
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

  const formatted = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: isDiscrete ? 0 : 2,
  }).format(numericValue);

  return `${formatted}${unit ? ` ${unit}` : ""}`.trim();
};

// =========================
// SECTION: Stock Adjustment Panel
// Fungsi:
// - memindahkan form dan riwayat Penyesuaian Stok ke dalam halaman Manajemen Stok
// Hubungan flow:
// - menjadi satu-satunya UI aktif untuk adjustment manual setelah menu / halaman lama dihapus
// - mutasi stok tetap lewat updateInventoryStock agar stock/currentStock/availableStock/variants[] sinkron
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
  // - master item hanya dipakai sebagai pilihan form; source of truth mutasi tetap inventoryService
  // Status:
  // - aktif dipakai di halaman Manajemen Stok
  // =========================
  const [stockAdjustmentRecords, setStockAdjustmentRecords] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [finishedProducts, setFinishedProducts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  // - variantKey yang dipilih dikirim ke updateInventoryStock supaya stok varian dan total master tetap sinkron
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
  // SECTION: Submit penyesuaian stok
  // Fungsi:
  // - menyimpan stock_adjustments
  // - melakukan mutasi stok lewat updateInventoryStock
  // - membuat inventory_logs standar agar langsung tampil di tabel Manajemen Stok
  // Hubungan flow:
  // - ini satu-satunya logic submit adjustment aktif; file route lama StockAdjustment.jsx sudah dihapus
  // Status:
  // - aktif/final untuk adjustment manual
  // - guarded terhadap stok negatif melalui preventNegative pada adjustment keluar
  // =========================
  const handleSubmitStockAdjustment = async (values) => {
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const isRawMaterial = values.itemType === "raw_material";
      const sourceCollectionName = isRawMaterial ? "raw_materials" : "products";
      const sourceItems = isRawMaterial ? rawMaterials : finishedProducts;

      const selectedSourceItem = sourceItems.find((item) => item.id === values.itemId);

      if (!selectedSourceItem) {
        message.error("Item tidak ditemukan");
        setIsSubmitting(false);
        return;
      }

      if (inferHasVariants(selectedSourceItem) && !values.variantKey) {
        message.error("Pilih varian item agar penyesuaian stok masuk ke stok varian yang benar.");
        setIsSubmitting(false);
        return;
      }

      const adjustmentQuantity = Number(values.quantity || 0);
      const finalQuantityChange =
        values.adjustmentType === "out" ? -adjustmentQuantity : adjustmentQuantity;

      const selectedSourceVariant = values.variantKey
        ? findVariantByKey(selectedSourceItem, values.variantKey)
        : null;
      const sourceStockSnapshot = selectedSourceVariant
        ? {
            currentStock: Number(selectedSourceVariant.currentStock || 0),
            reservedStock: Number(selectedSourceVariant.reservedStock || 0),
            availableStock: Number(selectedSourceVariant.availableStock || 0),
          }
        : getItemStockSnapshot(selectedSourceItem);

      if (values.adjustmentType === "out" && adjustmentQuantity > sourceStockSnapshot.availableStock) {
        message.error(
          `Jumlah keluar melebihi stok tersedia. Tersedia: ${formatQuantityId(
            sourceStockSnapshot.availableStock,
            selectedSourceItem.stockUnit || selectedSourceItem.unit || "",
          )}`,
        );
        setIsSubmitting(false);
        return;
      }

      // =========================
      // SECTION: Mutasi stok final via service inventory
      // Fungsi:
      // - update stock, currentStock, reservedStock, availableStock, dan variants[] dalam satu payload final
      // Hubungan flow:
      // - menjaga adjustment manual memakai source of truth stok yang sama dengan transaksi umum
      // Status:
      // - aktif/final; logic updateDoc langsung ke stock tidak dipakai lagi
      // =========================
      const stockMutationResult = await updateInventoryStock({
        itemId: values.itemId,
        collectionName: sourceCollectionName,
        quantityChange: finalQuantityChange,
        variantKey: values.variantKey || "",
        preventNegative: values.adjustmentType === "out",
      });

      const variantPayload = {
        variantKey: stockMutationResult.variantKey,
        variantLabel: stockMutationResult.variantLabel,
        stockSourceType: stockMutationResult.stockSourceType,
      };

      // =========================
      // SECTION: Simpan record stock_adjustments
      // Fungsi:
      // - menyimpan jejak bisnis adjustment sebagai catatan operasional terpisah dari inventory_logs
      // Hubungan flow:
      // - adjustmentId dari dokumen ini dipakai sebagai referenceId inventory_logs
      // Status:
      // - aktif/final sesuai business rule adjustment wajib mencatat stock_adjustments
      // =========================
      const adjustmentDocument = await addDoc(collection(db, "stock_adjustments"), {
        date: Timestamp.fromDate(values.date.toDate()),
        itemType: values.itemType,
        collectionName: sourceCollectionName,
        itemId: values.itemId,
        itemName: selectedSourceItem.name,
        adjustmentType: values.adjustmentType,
        quantity: adjustmentQuantity,
        finalQuantity: finalQuantityChange,
        finalQuantityChange,
        reason: values.reason || "",
        note: values.note || "",
        unit: selectedSourceItem.stockUnit || selectedSourceItem.unit || "",
        currentStockBefore: stockMutationResult.currentStockBefore,
        currentStockAfter: stockMutationResult.currentStockAfter,
        reservedStockBefore: stockMutationResult.reservedStockBefore,
        reservedStockAfter: stockMutationResult.reservedStockAfter,
        availableStockBefore: stockMutationResult.availableStockBefore,
        availableStockAfter: stockMutationResult.availableStockAfter,
        variantId: stockMutationResult.variantKey,
        ...variantPayload,
        createdAt: Timestamp.now(),
      });

      // =========================
      // SECTION: Simpan inventory log
      // Fungsi:
      // - membuat audit trail lintas modul dengan referenceId/referenceType standar
      // Hubungan flow:
      // - setelah log dibuat, StockManagement refresh agar tabel riwayat langsung menampilkan adjustment terbaru
      // Status:
      // - aktif/final untuk log adjustment
      // =========================
      await addInventoryLog(
        values.itemId,
        selectedSourceItem.name,
        finalQuantityChange,
        "stock_adjustment",
        sourceCollectionName,
        {
          adjustmentId: adjustmentDocument.id,
          referenceId: adjustmentDocument.id,
          referenceType: "stock_adjustment",
          reason: values.reason || "",
          note: values.note || "",
          currentStockBefore: stockMutationResult.currentStockBefore,
          currentStockAfter: stockMutationResult.currentStockAfter,
          previousStock: stockMutationResult.currentStockBefore,
          newStock: stockMutationResult.currentStockAfter,
          reservedStockBefore: stockMutationResult.reservedStockBefore,
          reservedStockAfter: stockMutationResult.reservedStockAfter,
          availableStockBefore: stockMutationResult.availableStockBefore,
          availableStockAfter: stockMutationResult.availableStockAfter,
          variantId: stockMutationResult.variantKey,
          ...variantPayload,
        },
      );

      message.success("Penyesuaian stok berhasil disimpan");
      resetAdjustmentFormState();
      onAdjustmentSaved?.();
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menyimpan penyesuaian stok");
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
        render: (value) => value || "-",
      },
    ];
  }, []);

  // =========================
  // SECTION: Riwayat adjustment terbaru
  // Fungsi:
  // - menampilkan record terbaru di paling atas
  // Hubungan flow:
  // - fallback sorting date/createdAt menjaga data lama tetap tampil wajar
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
      const leftPrimary = Math.max(toMillis(left.date), toMillis(left.createdAt));
      const rightPrimary = Math.max(toMillis(right.date), toMillis(right.createdAt));
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
              description={`Current: ${formatQuantityId(
                selectedStockSnapshot.currentStock,
                quantityUnitLabel,
              )} | Reserved: ${formatQuantityId(
                selectedStockSnapshot.reservedStock,
                quantityUnitLabel,
              )} | Available: ${formatQuantityId(
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
