import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Table,
  Modal,
  Form,
  Select,
  InputNumber,
  DatePicker,
  Input,
  message,
  Space,
  Switch,
  Tag,
} from "antd";
import { collection, doc, onSnapshot, runTransaction, Timestamp } from "firebase/firestore";
import { PlusOutlined } from "@ant-design/icons";
import { useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import { db } from "../../firebase";
import { formatNumberId } from "../../utils/formatters/numberId";
import { formatCurrencyId as formatCurrencyIdr } from "../../utils/formatters/currencyId";
import {
  doesSupplierProvideMaterial,
  getSupplierDisplayName,
  getSupplierMaterialDetail,
  getSupplierOptionLabel,
  getSupplierPurchaseUnitForMaterial,
  getSupplierConversionValueForMaterial,
  getSupplierStockUnitForMaterial,
  getSupplierProductLinkForMaterial,
  getSupplierReferenceId,
  getSupplierReferencePriceForMaterial,
  listenSupplierCatalog,
} from "../../services/MasterData/suppliersService";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import {
  applyPurchaseToRawMaterial,
  enrichRawMaterialWithVariantTotals,
} from "../../utils/variants/rawMaterialVariantHelpers";
import {
  buildInventoryLogPayload,
  INVENTORY_LOG_COLLECTION,
} from "../../services/Inventory/inventoryLogService";
import {
  applyStockMutationToItem,
  buildVariantOptionsFromItem,
  findVariantByKey,
  inferHasVariants,
} from "../../utils/variants/variantStockHelpers";

const { Option } = Select;

// =========================
// SECTION: Formatter final lintas aplikasi
// =========================
// ACTIVE / FINAL: pembelian memakai helper shared agar qty dan Rupiah tidak
// memakai formatter lokal yang bisa berbeda dari halaman lain.

// =========================
// SECTION: Bantu tentukan status selisih hemat pembelian
// =========================
const getPurchaseSavingMeta = (value) => {
  const amount = Math.round(Number(value || 0));

  if (amount > 0) {
    return {
      status: "hemat",
      label: `Hemat ${formatCurrencyIdr(amount)}`,
      color: "green",
    };
  }

  if (amount < 0) {
    return {
      status: "lebih_mahal",
      label: `Lebih Mahal ${formatCurrencyIdr(Math.abs(amount))}`,
      color: "red",
    };
  }

  return {
    status: "normal",
    label: "Sesuai Referensi",
    color: "default",
  };
};

// =========================
// SECTION: Metadata expense otomatis dari Purchases
// Fungsi blok:
// - membuat payload Cash Out/Expense otomatis yang punya reference jelas ke transaksi purchase;
// - menjaga amount tetap memakai totalActualPurchase agar saving pembelian tetap hanya info efisiensi.
// Hubungan flow Purchases/stok:
// - tidak menyentuh stok dan tidak mengubah rumus pembelian; blok ini hanya dipakai setelah purchase tersimpan.
// Status: aktif dipakai oleh handleSubmitPurchase.
// Legacy/kandidat cleanup:
// - sourceModule tetap "purchases" karena Cash Out, Purchases Report, dan Profit Loss existing membaca schema plural ini.
// =========================
const PURCHASE_EXPENSE_SOURCE_MODULE = "purchases";
const PURCHASE_EXPENSE_SOURCE_TYPE = "auto_generated";

const buildPurchaseExpenseDocumentId = (purchaseId) =>
  `${PURCHASE_EXPENSE_SOURCE_MODULE}__${String(purchaseId || "purchase").replace(/[^a-zA-Z0-9_-]/g, "_")}`;

const buildPurchaseExpensePayload = ({
  date,
  itemId,
  itemName,
  itemType,
  purchaseId,
  purchasePayload,
  resolvedSupplierId,
  savingMeta,
  selectedSupplierName,
  totalActualPurchase,
  totalReferencePurchase,
  purchaseSaving,
  variantKey,
  variantLabel,
  stockSourceType,
}) => {
  const sourceRef = purchasePayload?.purchaseNumber || purchasePayload?.referenceNumber || purchaseId;

  return {
    date: Timestamp.fromDate(date.toDate()),
    type: "Pembelian Bahan/Barang",
    description: `Pembelian ${itemName} dari ${selectedSupplierName}`,
    amount: Math.round(Number(totalActualPurchase || 0)),
    totalReferenceAmount: Math.round(Number(totalReferencePurchase || 0)),
    savingAmount: Math.round(Number(purchaseSaving || 0)),
    savingStatus: savingMeta.status,
    savingLabel: savingMeta.label,
    supplierId: resolvedSupplierId || null,
    supplierName: selectedSupplierName || "",
    relatedItemId: itemId,
    relatedItemName: itemName,
    relatedPurchaseId: purchaseId,
    itemType,
    variantKey,
    variantLabel,
    stockSourceType,
    sourceModule: PURCHASE_EXPENSE_SOURCE_MODULE,
    sourceId: purchaseId,
    sourceRef,
    sourceType: PURCHASE_EXPENSE_SOURCE_TYPE,
    createdByAutomation: true,
    sourceCollection: "purchases",
    createdAt: Timestamp.now(),
  };
};

// =========================
// SECTION: Purchases Page
// =========================
const Purchases = () => {
  const [form] = Form.useForm();
  const [searchParams] = useSearchParams();
  const restockPrefillAppliedRef = useRef(false);
  const restockPrefillMaterialIdRef = useRef("");
  const itemChangeContextRef = useRef("");
  const subtotalManualOverrideRef = useRef(false);
  const supplierSubtotalBaselineRef = useRef({
    itemId: "",
    supplierId: "",
    supplierItemPrice: 0,
    subtotalItems: 0,
  });

  // =========================
  // SECTION: State utama
  // =========================
  const [purchaseRecords, setPurchaseRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // =========================
  // SECTION: Watch fields
  // =========================
  const itemType = Form.useWatch("type", form);
  const itemId = Form.useWatch("itemId", form);
  const quantity = Form.useWatch("quantity", form);
  const conversionValue = Form.useWatch("conversionValue", form);
  const materialVariantId = Form.useWatch("materialVariantId", form);
  const supplierId = Form.useWatch("supplierId", form);
  const purchaseType = Form.useWatch("purchaseType", form);

  const subtotalItems = Form.useWatch("subtotalItems", form);
  const shippingCost = Form.useWatch("shippingCost", form);
  const shippingDiscount = Form.useWatch("shippingDiscount", form);
  const voucherDiscount = Form.useWatch("voucherDiscount", form);
  const serviceFee = Form.useWatch("serviceFee", form);

  const totalStockIn = Form.useWatch("totalStockIn", form);
  const restockReferencePrice = Form.useWatch("restockReferencePrice", form);

  // =========================
  // SECTION: Status pembelian online/offline dari form
  // Fungsi blok:
  // - membaca konteks biaya online agar field ongkir/admin/voucher bisa disembunyikan saat offline.
  // Hubungan flow Purchases:
  // - hanya memengaruhi UI dan biaya transaksi yang user simpan; tidak membuat transaksi otomatis.
  // Status: aktif dipakai; bukan legacy dan bukan auto-sync Supplier.
  // =========================
  const isOfflinePurchase = purchaseType === "offline";

  // =========================
  // SECTION: Item dan varian terpilih
  // ACTIVE / FINAL:
  // - bahan baku tetap memakai helper cost khusus raw material
  // - produk bervarian memakai variant picker yang sama dengan helper stok final
  // =========================
  const selectedProduct = useMemo(() => {
    return products.find((item) => item.id === itemId) || null;
  }, [products, itemId]);

  const selectedProductHasVariants = itemType === "product" && inferHasVariants(selectedProduct || {});

  const productVariantOptions = useMemo(() => {
    if (!selectedProductHasVariants) return [];
    return buildVariantOptionsFromItem(selectedProduct);
  }, [selectedProduct, selectedProductHasVariants]);

  const selectedMaterial = useMemo(() => {
    const found = materials.find((item) => item.id === itemId);
    return found ? enrichRawMaterialWithVariantTotals(found) : null;
  }, [materials, itemId]);

  const selectedMaterialVariant = useMemo(() => {
    if (!(selectedMaterial?.hasVariantOptions || selectedMaterial?.hasVariants) || !materialVariantId) return null;

    return (selectedMaterial.variants || []).find(
      (item) => String(item.variantKey) === String(materialVariantId),
    );
  }, [selectedMaterial, materialVariantId]);

  const materialVariantOptions = useMemo(() => {
    if (!selectedMaterial?.hasVariantOptions && !selectedMaterial?.hasVariants) return [];

    return (selectedMaterial.variants || [])
      .filter((item) => item.isActive !== false)
      .map((item) => ({
        value: item.variantKey,
        label: item.variantName,
      }));
  }, [selectedMaterial]);

  // =========================
  // SECTION: Supplier dan detail katalog supplier terpilih
  // Fungsi blok:
  // - membaca supplier terpilih dan materialDetails yang cocok dengan bahan baku.
  // Hubungan flow Purchases:
  // - data ini hanya dipakai untuk prefill Link Produk dan Harga Supplier Tercatat;
  // - tidak menulis ke raw_materials dan tidak mengembalikan auto-sync Supplier.
  // Status: aktif dipakai oleh form Pembelian.
  // =========================
  const selectedSupplier = useMemo(() => {
    return suppliers.find((supplier) => String(supplier.id) === String(supplierId)) || null;
  }, [suppliers, supplierId]);

  const selectedSupplierMaterialDetail = useMemo(() => {
    if (itemType !== "material" || !itemId || !selectedSupplier) return null;
    return getSupplierMaterialDetail(selectedSupplier, itemId);
  }, [itemId, itemType, selectedSupplier]);

  // =========================
  // SECTION: Snapshot biaya katalog Supplier untuk default Purchases
  // Fungsi blok:
  // - membaca harga barang, ongkir, admin, voucher, dan harga estimasi supplier dari materialDetails yang cocok.
  // Hubungan flow aplikasi:
  // - Supplier hanya sumber default transaksi; nilai ini tidak menulis balik ke Supplier/Raw Material dan tidak membuat purchase otomatis.
  // Status: aktif dipakai untuk prefill form Pembelian; bukan legacy dan bukan auto-sync supplier.
  // =========================
  const selectedSupplierCatalogCost = useMemo(() => {
    const detail = selectedSupplierMaterialDetail || {};
    const purchaseTypeFromSupplier = detail.purchaseType === "offline" ? "offline" : "online";
    const isOfflineSupplier = purchaseTypeFromSupplier === "offline";

    return {
      purchaseType: purchaseTypeFromSupplier,
      supplierItemPrice: Math.round(Number(detail.supplierItemPrice || 0)),
      estimatedShippingCost: isOfflineSupplier ? 0 : Math.round(Number(detail.estimatedShippingCost || 0)),
      serviceFee: isOfflineSupplier ? 0 : Math.round(Number(detail.serviceFee || 0)),
      discount: isOfflineSupplier ? 0 : Math.round(Number(detail.discount || 0)),
      estimatedUnitPrice: Math.round(Number(detail.estimatedUnitPrice || detail.referencePrice || 0)),
    };
  }, [selectedSupplierMaterialDetail]);

  const calculateSupplierSubtotal = (qty, supplierItemPrice) => {
    return Math.round(Math.max(Number(qty || 0), 0) * Math.max(Number(supplierItemPrice || 0), 0));
  };

  // =========================
  // SECTION: Hitung Total Pembanding Supplier berbasis komponen katalog
  // Fungsi blok:
  // - menghitung nilai pembanding dari komponen Supplier: Qty Beli x Harga Barang Supplier
  //   + Ongkir Default + Biaya Layanan Default - Diskon Default.
  // Alasan perubahan:
  // - Harga Supplier Tercatat / Satuan Stok bisa sudah memuat ongkir/admin/diskon untuk 1 paket;
  //   jika langsung dikali Stok Masuk, ongkir/admin bisa terlihat ikut dikali per satuan stok.
  // Hubungan flow aplikasi:
  // - hasil ini hanya dipakai sebagai pembanding dan Selisih Hemat; tidak mengubah stok, kas,
  //   expense, actualUnitCost, Supplier, atau Raw Material.
  // Status: aktif dipakai; fallback lama berbasis harga per satuan stok tetap ada untuk data legacy
  // yang belum punya Harga Barang Supplier di katalog Supplier.
  // =========================
  const calculateSupplierReferenceTotal = ({
    qty,
    supplierItemPrice,
    defaultShippingCost,
    defaultServiceFee,
    defaultDiscount,
    fallbackStockIn,
    fallbackReferencePerStockUnit,
  }) => {
    const safeQty = Math.max(Number(qty || 0), 0);
    const safeSupplierItemPrice = Math.max(Number(supplierItemPrice || 0), 0);

    if (safeSupplierItemPrice > 0) {
      return Math.round(
        safeQty * safeSupplierItemPrice +
          Math.max(Number(defaultShippingCost || 0), 0) +
          Math.max(Number(defaultServiceFee || 0), 0) -
          Math.max(Number(defaultDiscount || 0), 0),
      );
    }

    return Math.round(
      Math.max(Number(fallbackStockIn || 0), 0) *
        Math.max(Number(fallbackReferencePerStockUnit || 0), 0),
    );
  };

  // =========================
  // SECTION: Snapshot katalog Supplier untuk prefill Pembelian
  // Fungsi blok:
  // - mengambil default Satuan Beli, Konversi Supplier, tipe online/offline, dan harga pembanding
  //   dari materialDetails supplier yang cocok dengan bahan baku terpilih.
  // Hubungan flow aplikasi:
  // - Supplier hanya menjadi sumber default; Purchases tetap transaksi aktual dan user tetap harus Simpan sendiri.
  // Status: AKTIF + GUARDED; bukan auto-sync dan tidak menulis balik ke Supplier/Raw Material.
  // =========================
  // =========================
  // SECTION: Supplier difilter ketat berdasarkan bahan baku yang dipilih
  // Fungsi blok:
  // - hanya menampilkan supplier yang memang menyediakan bahan ini di katalog Supplier.
  // Alasan perubahan:
  // - mencegah user salah pilih supplier saat data supplier banyak; fallback semua supplier
  //   tidak dipakai lagi secara default agar flow restock lebih jelas.
  // Status: AKTIF + GUARDED; filtering ini read-only dan tidak mengubah data Supplier/Raw Material.
  // =========================
  const filteredSuppliers = useMemo(() => {
    if (itemType !== "material" || !itemId) {
      return suppliers;
    }

    const matchedSuppliers = suppliers.filter((supplier) =>
      doesSupplierProvideMaterial(supplier, itemId),
    );

    if (supplierId && selectedSupplier && !matchedSuppliers.some((supplier) => String(supplier.id) === String(supplierId))) {
      return [selectedSupplier, ...matchedSuppliers];
    }

    return matchedSuppliers;
  }, [suppliers, itemId, itemType, supplierId, selectedSupplier]);

  // =========================
  // SECTION: Sinkron data utama dari firestore
  // =========================
  useEffect(() => {
    const unsubscribePurchases = onSnapshot(
      collection(db, "purchases"),
      (snapshot) => {
        const nextPurchaseRecords = snapshot.docs.map((documentItem) => ({
          id: documentItem.id,
          ...documentItem.data(),
        }));

        setPurchaseRecords(nextPurchaseRecords);
      },
    );

    const unsubscribeProducts = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        const nextProducts = snapshot.docs.map((documentItem) => ({
          id: documentItem.id,
          ...documentItem.data(),
        }));

        setProducts(nextProducts);
      },
    );

    const unsubscribeMaterials = onSnapshot(
      collection(db, "raw_materials"),
      (snapshot) => {
        const nextMaterials = snapshot.docs.map((documentItem) => ({
          id: documentItem.id,
          ...documentItem.data(),
        }));

        setMaterials(nextMaterials);
      },
    );

    const unsubscribeSuppliers = listenSupplierCatalog((nextSuppliers) => {
      // =========================
      // SECTION: Supplier dibaca dari katalog gabungan agar supplier lama yang
      // masih tersimpan di bahan baku tetap muncul di form pembelian.
      // =========================
      setSuppliers(nextSuppliers);
    });

    return () => {
      unsubscribePurchases();
      unsubscribeProducts();
      unsubscribeMaterials();
      unsubscribeSuppliers();
    };
  }, []);

  // =========================
  // SECTION: Isi field otomatis saat item berubah
  // =========================
  useEffect(() => {
    // =========================
    // SECTION: Guard prefill Restock Assistant
    // Fungsi blok:
    // - item change normal tetap mengosongkan supplier agar user memilih ulang;
    // - khusus pembukaan dari Dashboard Restock Assistant, supplier query dipertahankan sekali.
    // Hubungan flow:
    // - prefill hanya membantu form Purchases; tidak auto-submit, tidak mengubah stok/kas sebelum Simpan.
    // Status: aktif dipakai; bukan legacy dan bukan auto-purchase.
    // =========================
    const shouldKeepPrefilledSupplier =
      restockPrefillMaterialIdRef.current &&
      String(itemId || "") === restockPrefillMaterialIdRef.current;

    // AKTIF + GUARDED: reset konteks item hanya boleh terjadi saat Jenis/Nama Item berubah.
    // ALASAN: Qty Beli, refresh listener products/materials, atau kalkulasi turunan tidak boleh
    // menghapus supplier/link/purchaseType/harga pembanding yang sedang dipilih user.
    // Hubungan flow: tidak mengubah rumus stok, expense otomatis, actualUnitCost, saving,
    // Supplier catalog, Raw Material, Sales, Returns, Production, HPP, Dashboard, atau Reports.
    const nextItemChangeContext = `${String(itemType || "")}::${String(itemId || "")}`;
    const isItemContextChanged = itemChangeContextRef.current !== nextItemChangeContext;
    itemChangeContextRef.current = nextItemChangeContext;

    if (isItemContextChanged) {
      // ACTIVE: perubahan Jenis/Nama Item mengawali konteks purchase baru, sehingga guard manual subtotal di-reset.
      // ALASAN: default harga Supplier berikutnya boleh mengisi ulang Subtotal Barang untuk item baru, tetapi Qty Beli tidak boleh memicu reset ini.
      // STATUS: aktif dipakai; bukan legacy.
      subtotalManualOverrideRef.current = false;
      supplierSubtotalBaselineRef.current = { itemId: "", supplierId: "", supplierItemPrice: 0, subtotalItems: 0 };
    }

    if (isItemContextChanged && !shouldKeepPrefilledSupplier) {
      restockPrefillMaterialIdRef.current = "";
      form.setFieldsValue({
        supplierId: undefined,
        productLink: "",
      });
    }

    if (itemType === "product") {
      const selectedProduct = products.find((item) => item.id === itemId);

      if (selectedProduct) {
        form.setFieldsValue({
          productVariantKey: undefined,
          purchaseUnit: undefined,
          stockUnit: undefined,
          conversionValue: undefined,
          purchaseType: "online",
          totalStockIn: undefined,
          restockReferencePrice: 0,
        });
      } else {
        form.setFieldsValue({
          productVariantKey: undefined,
          purchaseUnit: undefined,
          stockUnit: undefined,
          conversionValue: undefined,
          purchaseType: "online",
          totalStockIn: undefined,
          restockReferencePrice: 0,
        });
      }
    }

    if (itemType === "material") {
      const material = materials.find((item) => item.id === itemId);
      const enrichedMaterial = material
        ? enrichRawMaterialWithVariantTotals(material)
        : null;

      if (enrichedMaterial) {
        form.setFieldsValue({
          materialVariantId: undefined,
          productVariantKey: undefined,
          purchaseUnit: enrichedMaterial.defaultPurchaseUnit || "",
          stockUnit: enrichedMaterial.stockUnit || enrichedMaterial.unit || "",
          purchaseType: "online",
          // ACTIVE: harga pembanding supplier diisi setelah user memilih supplier.
          // ALASAN: referensi restock sekarang datang dari katalog Supplier materialDetails,
          // bukan input manual/master bahan baku di form pembelian.
          restockReferencePrice: 0,
        });
      } else {
        form.setFieldsValue({
          materialVariantId: undefined,
          productVariantKey: undefined,
          purchaseUnit: null,
          stockUnit: null,
          conversionValue: undefined,
          purchaseType: "online",
          totalStockIn: undefined,
          restockReferencePrice: 0,
        });
      }
    }
  }, [itemId, itemType, products, materials, form]);

  useEffect(() => {
    if (itemType !== "material") return;

    // ACTIVE: varian bahan tidak lagi mengambil harga pembanding dari master bahan.
    // ALASAN: Harga Supplier Tercatat harus berasal dari katalog Supplier yang dipilih,
    // sedangkan harga aktual tetap dari subtotal transaksi.
    // Kandidat cleanup: blok ini bisa dihapus jika di masa depan semua reset harga dipusatkan
    // pada effect pemilihan supplier.
    if ((selectedMaterial?.hasVariantOptions || selectedMaterial?.hasVariants) && !selectedMaterialVariant) {
      form.setFieldsValue({ restockReferencePrice: 0 });
    }
  }, [itemType, selectedMaterial, selectedMaterialVariant, form]);

  // =========================
  // SECTION: Auto-fill Link Produk dan Harga Supplier Tercatat
  // Fungsi blok:
  // - saat user memilih supplier untuk bahan baku, form membaca katalog Supplier
  //   yang cocok dengan itemId lalu mengisi Link Produk, Harga Supplier Tercatat,
  //   dan catatan sebagai referensi restock.
  // Hubungan flow Purchases:
  // - ini hanya prefill/read-only reference; stok, kas, expense, saving, dan
  //   actualUnitCost tetap dihitung dari transaksi aktual ketika user klik Simpan.
  // Status: aktif dipakai; bukan auto-sync Supplier ke Raw Material.
  // =========================
  useEffect(() => {
    if (itemType !== "material") return;

    if (!itemId || !supplierId) {
      form.setFieldsValue({
        productLink: "",
        restockReferencePrice: 0,
      });
      return;
    }

    const supplierProductLink = getSupplierProductLinkForMaterial(selectedSupplier || {}, itemId);
    const supplierReferencePrice = getSupplierReferencePriceForMaterial(selectedSupplier || {}, itemId);
    const supplierPurchaseUnit = getSupplierPurchaseUnitForMaterial(selectedSupplier || {}, itemId);
    const supplierConversionValue = getSupplierConversionValueForMaterial(selectedSupplier || {}, itemId);
    const supplierStockUnit = getSupplierStockUnitForMaterial(selectedSupplier || {}, itemId);
    const supplierPurchaseType = selectedSupplierCatalogCost.purchaseType;
    const isSupplierOffline = supplierPurchaseType === "offline";

    // =========================
    // SECTION: Prefill katalog Supplier ke form Purchases
    // Fungsi blok:
    // - mengisi Link Produk, satuan/konversi, tipe online/offline, Harga Supplier Tercatat,
    //   Subtotal Barang, dan biaya online dari materialDetails supplier yang cocok.
    // Hubungan flow:
    // - prefill ini hanya mempercepat input restock; user tetap bisa menyesuaikan
    //   harga aktual dan klik Simpan sendiri. Tidak ada stok/kas/expense yang berubah di sini.
    // Status: aktif dipakai; bukan auto-sync Supplier ke Raw Material dan bukan auto-purchase.
    // =========================
    subtotalManualOverrideRef.current = false;

    const supplierItemPrice = selectedSupplierCatalogCost.supplierItemPrice;
    const nextSubtotal = calculateSupplierSubtotal(form.getFieldValue("quantity"), supplierItemPrice);

    const nextValues = {
      productLink: supplierProductLink || "",
      restockReferencePrice: selectedSupplierCatalogCost.estimatedUnitPrice || supplierReferencePrice || 0,
      purchaseType: supplierPurchaseType,
      subtotalItems: supplierItemPrice > 0 ? nextSubtotal : 0,
    };

    supplierSubtotalBaselineRef.current = {
      itemId: String(itemId || ""),
      supplierId: String(supplierId || ""),
      supplierItemPrice,
      subtotalItems: supplierItemPrice > 0 ? nextSubtotal : 0,
    };

    if (supplierPurchaseUnit) {
      nextValues.purchaseUnit = supplierPurchaseUnit;
    }

    if (supplierConversionValue > 0) {
      nextValues.conversionValue = supplierConversionValue;
    }

    if (supplierStockUnit) {
      nextValues.stockUnit = supplierStockUnit;
    }

    if (isSupplierOffline) {
      nextValues.shippingCost = 0;
      nextValues.shippingDiscount = 0;
      nextValues.voucherDiscount = 0;
      nextValues.serviceFee = 0;
    } else {
      nextValues.shippingCost = selectedSupplierCatalogCost.estimatedShippingCost || 0;
      nextValues.shippingDiscount = 0;
      nextValues.voucherDiscount = selectedSupplierCatalogCost.discount || 0;
      nextValues.serviceFee = selectedSupplierCatalogCost.serviceFee || 0;
    }

    form.setFieldsValue(nextValues);
  }, [form, itemId, itemType, selectedSupplier, selectedSupplierCatalogCost, supplierId]);

  // =========================
  // SECTION: Hitung stok masuk otomatis
  // =========================
  useEffect(() => {
    const qty = Number(quantity || 0);
    const conversion = Number(conversionValue || 0);

    const nextTotalStockIn = itemType === "material" ? qty * conversion : qty;

    form.setFieldsValue({
      totalStockIn: Math.round(nextTotalStockIn || 0),
    });
  }, [quantity, conversionValue, itemType, form]);

  // =========================
  // SECTION: Auto subtotal dari Qty x Harga Barang Supplier
  // Fungsi blok:
  // - menjaga Subtotal Barang mengikuti default katalog Supplier saat Qty Beli berubah.
  // Alasan perubahan:
  // - harga barang supplier sudah tersedia di materialDetails, sehingga user tidak perlu menghitung ulang manual.
  // Batasan aktif:
  // - jika user sudah mengubah Subtotal Barang manual, effect ini tidak menimpa nilai tersebut diam-diam;
  // - tombol reset harga supplier sengaja tidak ditampilkan agar default Supplier tidak terasa seperti mode tambahan.
  // =========================
  useEffect(() => {
    if (itemType !== "material") return;

    const supplierItemPrice = selectedSupplierCatalogCost.supplierItemPrice;
    if (!supplierId || !supplierItemPrice) return;

    const nextSubtotal = calculateSupplierSubtotal(quantity, supplierItemPrice);
    const currentSubtotal = Math.round(Number(form.getFieldValue("subtotalItems") || 0));
    const previousBaseline = supplierSubtotalBaselineRef.current;
    const canAutoApplySubtotal =
      !subtotalManualOverrideRef.current ||
      currentSubtotal === Math.round(Number(previousBaseline.subtotalItems || 0)) ||
      currentSubtotal === 0;

    if (!canAutoApplySubtotal) return;

    supplierSubtotalBaselineRef.current = {
      itemId: String(itemId || ""),
      supplierId: String(supplierId || ""),
      supplierItemPrice,
      subtotalItems: nextSubtotal,
    };

    form.setFieldsValue({ subtotalItems: nextSubtotal });
  }, [form, itemId, itemType, quantity, selectedSupplierCatalogCost.supplierItemPrice, supplierId]);

  // =========================
  // SECTION: Guard biaya online saat Pembelian Offline
  // Fungsi blok:
  // - saat toggle Pembelian Offline aktif, ongkir/admin/voucher/potongan di-reset ke 0
  //   agar nilai online lama tidak diam-diam ikut menghitung Total Aktual.
  // Hubungan flow Purchases:
  // - hanya membersihkan field biaya di form; tidak membuat transaksi otomatis dan tidak
  //   mengubah stok/kas sebelum user klik Simpan.
  // Status: aktif dipakai; bukan legacy.
  // =========================
  useEffect(() => {
    if (purchaseType !== "offline") return;

    form.setFieldsValue({
      shippingCost: 0,
      shippingDiscount: 0,
      voucherDiscount: 0,
      serviceFee: 0,
    });
  }, [form, purchaseType]);

  // =========================
  // SECTION: Hitung Total Aktual Pembelian
  // Fungsi blok:
  // - menghitung total biaya aktual yang benar-benar menjadi dasar expense pembelian.
  // Hubungan flow aplikasi:
  // - Total Aktual tetap berasal dari input transaksi Purchases: Subtotal, Ongkir, Diskon Ongkir,
  //   Voucher/Potongan, dan Biaya Layanan; bukan dari Harga Supplier Tercatat.
  // Status: aktif dipakai oleh ringkasan, payload purchase, actualUnitCost, dan expense otomatis.
  // =========================
  useEffect(() => {
    const subtotal = Number(subtotalItems || 0);
    const shipping = purchaseType === "offline" ? 0 : Number(shippingCost || 0);
    const shippingDiscountAmount = purchaseType === "offline" ? 0 : Number(shippingDiscount || 0);
    const voucherAmount = purchaseType === "offline" ? 0 : Number(voucherDiscount || 0);
    const serviceFeeAmount = purchaseType === "offline" ? 0 : Number(serviceFee || 0);

    const totalActualPurchase =
      subtotal +
      shipping -
      shippingDiscountAmount -
      voucherAmount +
      serviceFeeAmount;

    form.setFieldsValue({
      totalActualPurchase: Math.round(totalActualPurchase || 0),
    });
  }, [
    subtotalItems,
    shippingCost,
    shippingDiscount,
    voucherDiscount,
    serviceFee,
    purchaseType,
    form,
  ]);

  // =========================
  // SECTION: Hitung Modal Aktual / Satuan Stok
  // Fungsi blok:
  // - membagi Total Aktual Pembelian dengan Stok Masuk total untuk menentukan modal aktual per satuan stok.
  // Hubungan flow aplikasi:
  // - nilai ini dipakai untuk payload purchase dan laporan, tetapi tidak mengambil harga supplier sebagai harga aktual.
  // Status: aktif dipakai; guard stockIn > 0 mencegah pembagian nol pada data supplier yang belum punya konversi.
  // =========================
  useEffect(() => {
    const totalActualPurchase = Number(
      form.getFieldValue("totalActualPurchase") || 0,
    );
    const stockIn = Number(form.getFieldValue("totalStockIn") || 0);

    const actualUnitCost =
      stockIn > 0 ? Math.round(totalActualPurchase / stockIn) : 0;

    form.setFieldsValue({
      actualUnitCost,
    });
  }, [
    subtotalItems,
    shippingCost,
    shippingDiscount,
    voucherDiscount,
    serviceFee,
    purchaseType,
    quantity,
    conversionValue,
    itemType,
    form,
  ]);

  // =========================
  // SECTION: Hitung Total Pembanding Supplier dan Selisih Hemat
  // Fungsi blok:
  // - menghitung pembanding Supplier dari komponen katalog Supplier, bukan langsung dari
  //   Stok Masuk x Harga Supplier Tercatat / Satuan Stok.
  // Alasan perubahan:
  // - ongkir/admin/voucher marketplace biasanya berlaku per checkout, sehingga tidak aman
  //   jika selalu dianggap proporsional per satuan stok saat Qty Beli > 1.
  // Hubungan flow aplikasi:
  // - Total Pembanding dan Selisih Hemat hanya informasi efisiensi; tidak mengubah kas,
  //   expense, actualUnitCost, stok, Supplier, atau Raw Material.
  // Status: aktif dipakai; fallback lama berbasis harga per satuan stok hanya untuk data legacy
  // yang belum memiliki supplierItemPrice di katalog Supplier.
  // =========================
  useEffect(() => {
    const referencePerStockUnit = Number(restockReferencePrice || 0);
    const stockIn = Number(totalStockIn || 0);
    const totalActualPurchase = Number(
      form.getFieldValue("totalActualPurchase") || 0,
    );

    const totalReferencePurchase = calculateSupplierReferenceTotal({
      qty: quantity,
      supplierItemPrice: selectedSupplierCatalogCost.supplierItemPrice,
      defaultShippingCost: selectedSupplierCatalogCost.estimatedShippingCost,
      defaultServiceFee: selectedSupplierCatalogCost.serviceFee,
      defaultDiscount: selectedSupplierCatalogCost.discount,
      fallbackStockIn: stockIn,
      fallbackReferencePerStockUnit: referencePerStockUnit,
    });
    const purchaseSaving = totalReferencePurchase - totalActualPurchase;

    form.setFieldsValue({
      totalReferencePurchase: Math.round(totalReferencePurchase || 0),
      purchaseSaving: Math.round(purchaseSaving || 0),
    });
  }, [
    totalStockIn,
    subtotalItems,
    shippingCost,
    shippingDiscount,
    voucherDiscount,
    serviceFee,
    purchaseType,
    quantity,
    restockReferencePrice,
    selectedSupplierCatalogCost.discount,
    selectedSupplierCatalogCost.estimatedShippingCost,
    selectedSupplierCatalogCost.serviceFee,
    selectedSupplierCatalogCost.supplierItemPrice,
    form,
  ]);

  // =========================
  // SECTION: Restock Assistant query prefill
  // Fungsi blok:
  // - membaca query dari Dashboard/Raw Material agar form Purchases terbuka dengan bahan, supplier, dan Link Produk terisi awal;
  // - user tetap wajib input qty/harga aktual dan klik Simpan sendiri.
  // Hubungan flow:
  // - ini hanya navigasi/prefill, bukan transaksi otomatis; stok/kas/expense baru berubah setelah handleSubmitPurchase selesai.
  // Status: aktif dipakai oleh Restock Assistant; kandidat cleanup hanya jika route prefill tidak dipakai lagi.
  // =========================
  useEffect(() => {
    if (restockPrefillAppliedRef.current) return;

    const source = searchParams.get("source");
    const materialId = searchParams.get("materialId");

    if (source !== "dashboard-restock" || !materialId) return;

    const supplierId = searchParams.get("supplierId") || undefined;
    const productLink = searchParams.get("productLink") || "";

    restockPrefillAppliedRef.current = true;
    restockPrefillMaterialIdRef.current = String(materialId);
    subtotalManualOverrideRef.current = false;
    supplierSubtotalBaselineRef.current = { itemId: "", supplierId: "", supplierItemPrice: 0, subtotalItems: 0 };

    form.resetFields();
    form.setFieldsValue({
      type: "material",
      itemId: materialId,
      supplierId,
      productLink,
      materialVariantId: undefined,
      productVariantKey: undefined,
      quantity: 1,
      subtotalItems: 0,
      shippingCost: 0,
      shippingDiscount: 0,
      voucherDiscount: 0,
      serviceFee: 0,
      purchaseType: "online",
      totalActualPurchase: 0,
      actualUnitCost: 0,
      restockReferencePrice: 0,
      totalReferencePurchase: 0,
      purchaseSaving: 0,
    });
    setIsModalOpen(true);
  }, [form, searchParams]);

  // =========================
  // SECTION: Modal Helpers
  // =========================
  const openCreatePurchaseModal = () => {
    // =========================
    // SECTION: Reset prefill saat user membuat pembelian manual
    // Fungsi blok: memastikan tombol Tambah Pembelian biasa tidak membawa state prefill Dashboard sebelumnya.
    // Hubungan flow: pembelian manual tetap bersih; transaksi hanya tersimpan saat user klik Simpan.
    // Status: aktif dipakai oleh tombol Tambah Pembelian; bukan legacy.
    // =========================
    restockPrefillMaterialIdRef.current = "";
    itemChangeContextRef.current = "";
    subtotalManualOverrideRef.current = false;
    supplierSubtotalBaselineRef.current = { itemId: "", supplierId: "", supplierItemPrice: 0, subtotalItems: 0 };
    form.resetFields();
    form.setFieldsValue({
      type: "material",
      materialVariantId: undefined,
      productVariantKey: undefined,
      quantity: 1,
      subtotalItems: 0,
      shippingCost: 0,
      shippingDiscount: 0,
      voucherDiscount: 0,
      serviceFee: 0,
      purchaseType: "online",
      totalActualPurchase: 0,
      actualUnitCost: 0,
      restockReferencePrice: 0,
      totalReferencePurchase: 0,
      purchaseSaving: 0,
      productLink: '',
    });
    setIsModalOpen(true);
  };

  // =========================
  // SECTION: Submit pembelian atomik + sinkron ke stok + sinkron ke pengeluaran
  // Fungsi blok:
  // - memvalidasi seluruh input penting sebelum write pertama;
  // - menyimpan purchase, mutasi stok, inventory log, dan expense dalam 1 Firestore transaction;
  // - memakai reference deterministic untuk expense agar purchase yang sama tidak membuat cash out dobel.
  // Hubungan flow aplikasi:
  // - Supplier tetap hanya katalog/prefill; perubahan stok/kas/laporan baru terjadi setelah user klik Simpan;
  // - rumus Purchases tetap sama: Stok Masuk = Qty Beli x Konversi Supplier dan Total Aktual menjadi dasar expense.
  // Status:
  // - AKTIF + GUARDED untuk data real karena menyentuh purchases, stok, inventory_logs, dan expenses.
  // - LEGACY: tidak ada jalur addDoc purchase lalu update stok terpisah; flow lama diganti transaction agar tidak partial.
  // - CLEANUP CANDIDATE: jika kelak ada service transaksi pembelian khusus, orkestrasi ini bisa dipindah ke service tanpa ubah rule.
  // =========================
  const handleSubmitPurchase = async (values) => {
    try {
      const {
        type,
        itemId,
        materialVariantId,
        productVariantKey,
        quantity,
        date,
        note,
        supplierId,
        productLink,
        purchaseUnit,
        stockUnit,
        conversionValue,
        subtotalItems,
        shippingCost,
        shippingDiscount,
        voucherDiscount,
        serviceFee,
        purchaseType,
        restockReferencePrice,
        totalReferencePurchase,
        purchaseSaving,
      } = values;

      // =========================
      // SECTION: Guard input sebelum write pertama
      // Fungsi blok:
      // - menghentikan submit sebelum Firestore disentuh jika data utama belum valid;
      // - mencegah purchase doc tersimpan tanpa stok/log/expense karena error validasi terlambat.
      // Hubungan flow aplikasi:
      // - menjaga business rule Purchases tanpa mengubah Supplier, Raw Material, Sales, Returns, Production, Payroll, atau Reports.
      // Status:
      // - AKTIF + GUARDED; validasi ini wajib lolos sebelum transaksi atomik berjalan.
      // =========================
      const normalizedType = type === "product" ? "product" : type === "material" ? "material" : "";
      if (!normalizedType) {
        message.error("Jenis item pembelian tidak valid.");
        return;
      }

      if (!itemId) {
        message.error("Pilih item yang akan dibeli terlebih dahulu.");
        return;
      }

      if (!date?.toDate) {
        message.error("Tanggal pembelian wajib diisi.");
        return;
      }

      const normalizedQuantity = Number(quantity || 0);
      if (normalizedQuantity <= 0) {
        message.error("Qty Beli harus lebih dari 0.");
        return;
      }

      const selectedSupplier = suppliers.find(
        (supplier) => String(supplier.id) === String(supplierId),
      );
      const resolvedSupplierId = getSupplierReferenceId(selectedSupplier, supplierId);

      if (!selectedSupplier || !resolvedSupplierId) {
        message.error("Supplier tidak valid. Pilih supplier dari katalog yang tersedia.");
        return;
      }

      const collectionName = normalizedType === "product" ? "products" : "raw_materials";
      const selectedItemFromState =
        normalizedType === "product"
          ? products.find((item) => item.id === itemId)
          : enrichRawMaterialWithVariantTotals(
              materials.find((item) => item.id === itemId) || {},
            );

      if (!selectedItemFromState?.id) {
        message.error("Item pembelian tidak ditemukan. Muat ulang data lalu pilih item kembali.");
        return;
      }

      const normalizedConversionValue = normalizedType === "material" ? Number(conversionValue || 0) : 1;
      const finalQuantity =
        normalizedType === "product"
          ? normalizedQuantity
          : normalizedQuantity * normalizedConversionValue;
      const normalizedFinalQuantity = Math.round(Number(finalQuantity || 0));

      if (normalizedType === "material" && normalizedConversionValue <= 0) {
        message.error("Konversi Supplier belum valid. Lengkapi katalog Supplier atau pilih supplier yang punya konversi.");
        return;
      }

      if (normalizedFinalQuantity <= 0) {
        message.error("Stok Masuk harus lebih dari 0 sebelum pembelian disimpan.");
        return;
      }

      const normalizedPurchaseType = purchaseType === "offline" ? "offline" : "online";
      const normalizedSubtotalItems = Math.round(Number(subtotalItems || 0));
      const normalizedShippingCost = normalizedPurchaseType === "offline" ? 0 : Math.round(Number(shippingCost || 0));
      const normalizedShippingDiscount = normalizedPurchaseType === "offline" ? 0 : Math.round(Number(shippingDiscount || 0));
      const normalizedVoucherDiscount = normalizedPurchaseType === "offline" ? 0 : Math.round(Number(voucherDiscount || 0));
      const normalizedServiceFee = normalizedPurchaseType === "offline" ? 0 : Math.round(Number(serviceFee || 0));
      const normalizedTotalActualPurchase = Math.round(
        normalizedSubtotalItems +
          normalizedShippingCost +
          normalizedServiceFee -
          normalizedShippingDiscount -
          normalizedVoucherDiscount,
      );
      const normalizedActualUnitCost =
        normalizedFinalQuantity > 0
          ? Math.round(normalizedTotalActualPurchase / normalizedFinalQuantity)
          : 0;
      const normalizedRestockReferencePrice = Math.round(Number(restockReferencePrice || 0));
      const normalizedTotalReferencePurchase = Math.round(Number(totalReferencePurchase || 0));
      const normalizedPurchaseSaving = Math.round(Number(purchaseSaving || 0));

      if (normalizedSubtotalItems < 0 || normalizedTotalActualPurchase < 0) {
        message.error("Total Aktual Pembelian tidak valid. Cek subtotal, ongkir, diskon, voucher, dan biaya layanan.");
        return;
      }

      const savingMeta = getPurchaseSavingMeta(normalizedPurchaseSaving);
      const purchaseReference = doc(collection(db, "purchases"));
      const inventoryLogReference = doc(collection(db, INVENTORY_LOG_COLLECTION));
      const expenseReference = doc(db, "expenses", buildPurchaseExpenseDocumentId(purchaseReference.id));
      const itemReference = doc(db, collectionName, itemId);

      // =========================
      // SECTION: Firestore transaction pembelian
      // Fungsi blok:
      // - memastikan purchase doc, stok item, inventory log, dan expense commit bersama;
      // - jika salah satu write gagal, seluruh transaksi dibatalkan oleh Firestore.
      // Hubungan flow aplikasi:
      // - mengurangi risiko stok/kas/laporan berbeda saat Simpan Pembelian gagal di tengah;
      // - tidak mengubah rumus harga, Supplier catalog, Raw Material master, atau laporan.
      // Status:
      // - AKTIF + GUARDED untuk flow Simpan Pembelian.
      // - CLEANUP CANDIDATE: helper transaksi ini bisa diekstrak ke service khusus jika Purchases nanti dipisah lebih lanjut.
      // =========================
      await runTransaction(db, async (transaction) => {
        const itemSnapshot = await transaction.get(itemReference);

        if (!itemSnapshot.exists()) {
          throw new Error("Item stok tidak ditemukan di database.");
        }

        const latestItem =
          normalizedType === "material"
            ? enrichRawMaterialWithVariantTotals({
                id: itemSnapshot.id,
                ...itemSnapshot.data(),
              })
            : {
                id: itemSnapshot.id,
                ...itemSnapshot.data(),
              };

        const latestSelectedVariant =
          normalizedType === "material" && (latestItem?.hasVariantOptions || latestItem?.hasVariants)
            ? (latestItem.variants || []).find(
                (item) => String(item.variantKey) === String(materialVariantId),
              )
            : normalizedType === "product" && inferHasVariants(latestItem || {})
              ? findVariantByKey(latestItem, productVariantKey)
              : null;

        if (normalizedType === "material" && (latestItem?.hasVariantOptions || latestItem?.hasVariants) && !latestSelectedVariant) {
          throw new Error("Pilih varian bahan baku terlebih dahulu agar stok tidak masuk master/default.");
        }

        if (normalizedType === "product" && inferHasVariants(latestItem || {}) && !latestSelectedVariant) {
          throw new Error("Pilih varian produk terlebih dahulu agar stok tidak masuk master/default.");
        }

        const variantLabel =
          normalizedType === "material"
            ? latestSelectedVariant?.variantName || latestSelectedVariant?.name || ""
            : latestSelectedVariant?.variantLabel || latestSelectedVariant?.color || latestSelectedVariant?.name || "";
        const variantKey = latestSelectedVariant?.variantKey || "";
        const variantPayload = {
          variantKey,
          variantLabel,
          stockSourceType: latestSelectedVariant ? "variant" : "master",
        };
        const itemName = latestSelectedVariant
          ? `${latestItem?.name || "Item"} - ${variantLabel}`
          : latestItem?.name || "Item tidak ditemukan";

        const purchasePayload = {
          type: normalizedType,
          itemId,
          itemName,
          ...variantPayload,
          materialVariantId: normalizedType === "material" ? materialVariantId || null : null,
          materialVariantName:
            normalizedType === "material" && latestSelectedVariant
              ? variantLabel
              : "",
          supplierId: resolvedSupplierId || null,
          supplierName: getSupplierDisplayName(selectedSupplier) || "Supplier tidak ditemukan",
          // AKTIF: link produk hanya referensi restock berikutnya.
          // Hubungan flow: tidak dipakai untuk hitung harga, stok, kas, saving, expense, atau laporan.
          productLink: String(productLink || "").trim(),
          purchaseProductLink: String(productLink || "").trim(),
          restockProductLink: String(productLink || "").trim(),
          quantity: normalizedQuantity,
          date: Timestamp.fromDate(date.toDate()),
          note: note || "",
          subtotalItems: normalizedSubtotalItems,
          purchaseType: normalizedPurchaseType,
          shippingCost: normalizedShippingCost,
          shippingDiscount: normalizedShippingDiscount,
          voucherDiscount: normalizedVoucherDiscount,
          serviceFee: normalizedServiceFee,
          totalActualPurchase: normalizedTotalActualPurchase,
          actualUnitCost: normalizedActualUnitCost,
          restockReferencePrice: normalizedRestockReferencePrice,
          totalReferencePurchase: normalizedTotalReferencePurchase,
          purchaseSaving: normalizedPurchaseSaving,
          purchaseSavingStatus: savingMeta.status,
          purchaseSavingLabel: savingMeta.label,
          purchaseTransactionStatus: "committed",
        };

        if (normalizedType === "material") {
          Object.assign(purchasePayload, {
            purchaseUnit: purchaseUnit || "",
            stockUnit: stockUnit || "",
            conversionValue: normalizedConversionValue,
            totalStockIn: normalizedFinalQuantity,
          });
        } else {
          Object.assign(purchasePayload, {
            totalStockIn: normalizedFinalQuantity,
          });
        }

        if (normalizedType === "material") {
          if ((latestItem?.hasVariantOptions || latestItem?.hasVariants) && latestSelectedVariant) {
            // =========================
            // SECTION: Mutasi atomik bahan baku bervarian
            // Fungsi blok: memakai helper Raw Material agar stock/currentStock varian dan averageActualUnitCost tetap konsisten.
            // Hubungan flow: hanya berjalan di dalam transaction setelah purchase reference siap.
            // Status: AKTIF + GUARDED; bukan sync Supplier dan bukan perubahan business rule.
            // =========================
            const nextMaterialPayload = applyPurchaseToRawMaterial(latestItem, {
              qty: normalizedFinalQuantity,
              unitCost: normalizedActualUnitCost,
              variantKey: latestSelectedVariant.variantKey,
              variantName: variantLabel,
              restockReferencePrice: normalizedRestockReferencePrice,
            });

            transaction.update(itemReference, nextMaterialPayload);
          } else {
            // =========================
            // SECTION: Mutasi atomik bahan baku non-varian
            // Fungsi blok: menambah stok master dan menjaga field cost/reference yang sudah dipakai laporan/master data.
            // Hubungan flow: mengikuti logic existing non-varian tanpa mengubah Raw Material dari data Supplier.
            // Status: AKTIF + GUARDED; averageActualUnitCost tetap memakai unit cost transaksi saat ini sesuai flow existing.
            // =========================
            const stockUpdatePayload = applyStockMutationToItem({
              item: latestItem,
              deltaCurrent: normalizedFinalQuantity,
            });

            transaction.update(itemReference, {
              ...stockUpdatePayload,
              averageActualUnitCost: normalizedActualUnitCost,
              restockReferencePrice: normalizedRestockReferencePrice,
            });
          }
        } else {
          // =========================
          // SECTION: Mutasi atomik produk final
          // Fungsi blok: menambah stok produk master/varian sesuai pilihan user.
          // Hubungan flow: produk bervarian wajib memakai variantKey agar stok tidak masuk master/default.
          // Status: AKTIF + GUARDED; tidak menyentuh flow produksi/HPP.
          // =========================
          const stockUpdatePayload = applyStockMutationToItem({
            item: latestItem,
            variantKey: productVariantKey || "",
            deltaCurrent: normalizedFinalQuantity,
          });

          transaction.update(itemReference, stockUpdatePayload);
        }

        transaction.set(purchaseReference, purchasePayload);

        transaction.set(
          inventoryLogReference,
          buildInventoryLogPayload({
            itemId,
            itemName,
            quantityChange: normalizedFinalQuantity,
            type: "purchase_in",
            collectionName,
            extraData: {
              // AKTIF: reference pembelian membuat inventory log mudah dilacak dari Stock Management.
              purchaseId: purchaseReference.id,
              referenceId: purchaseReference.id,
              referenceType: "purchase",
              supplierName: purchasePayload.supplierName || "",
              ...variantPayload,
              materialVariantId: normalizedType === "material" ? materialVariantId || null : null,
              materialVariantName:
                normalizedType === "material" && latestSelectedVariant
                  ? variantLabel
                  : "",
              totalActualPurchase: normalizedTotalActualPurchase,
              actualUnitCost: normalizedActualUnitCost,
              totalReferencePurchase: normalizedTotalReferencePurchase,
              purchaseSaving: normalizedPurchaseSaving,
              purchaseSavingStatus: savingMeta.status,
              note:
                normalizedType === "material"
                  ? `${note || ""} | Pembelian ${formatNumberId(normalizedQuantity)} ${
                      purchaseUnit || ""
                    } = ${formatNumberId(normalizedFinalQuantity)} ${stockUnit || ""}${latestSelectedVariant ? ` | Varian ${variantLabel}` : ""}`
                  : note || "",
            },
          }),
        );

        // =========================
        // SECTION: Expense otomatis atomik pembelian
        // Fungsi blok:
        // - membuat Cash Out/Expense otomatis dalam transaksi yang sama dengan purchase dan stok;
        // - memakai doc id deterministik dari purchaseId agar idempotent untuk source purchase yang sama.
        // Hubungan flow Purchases/stok:
        // - amount tetap total aktual, bukan saving; saving hanya metadata efisiensi.
        // Status:
        // - AKTIF + GUARDED.
        // - LEGACY: relatedPurchaseId dipertahankan untuk kompatibilitas laporan lama.
        // =========================
        const purchaseExpensePayload = buildPurchaseExpensePayload({
          date,
          itemId,
          itemName,
          itemType: normalizedType,
          purchaseId: purchaseReference.id,
          purchasePayload,
          resolvedSupplierId,
          savingMeta,
          selectedSupplierName: purchasePayload.supplierName,
          totalActualPurchase: normalizedTotalActualPurchase,
          totalReferencePurchase: normalizedTotalReferencePurchase,
          purchaseSaving: normalizedPurchaseSaving,
          variantKey,
          variantLabel,
          stockSourceType: variantPayload.stockSourceType,
        });

        transaction.set(expenseReference, purchaseExpensePayload);
      });

      message.success("Pembelian berhasil ditambahkan!");
      form.resetFields();
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menyimpan pembelian. Tidak ada data parsial yang disimpan.");
    }
  };

  // =========================
  // SECTION: Kolom tabel pembelian
  // =========================
  const purchaseTableColumns = [
    {
      title: "Tanggal",
      dataIndex: "date",
      key: "date",
      render: (value) =>
        value?.toDate ? dayjs(value.toDate()).format("DD-MM-YYYY") : "-",
    },
    {
      title: "Jenis",
      dataIndex: "type",
      key: "type",
      render: (type) =>
        type === "product" ? (
          <Tag color="blue">Produk</Tag>
        ) : (
          <Tag color="gold">Bahan Baku</Tag>
        ),
    },
    {
      title: "Nama Item",
      dataIndex: "itemName",
      key: "itemName",
    },
    {
      title: "Varian / Sumber",
      key: "variant",
      render: (_, record) =>
        record.variantLabel || record.variantKey ? (
          <Tag color="purple">{record.variantLabel || record.variantKey}</Tag>
        ) : (
          <Tag>Master</Tag>
        ),
    },
    {
      title: "Supplier",
      dataIndex: "supplierName",
      key: "supplierName",
    },
    {
      title: "Qty Beli",
      key: "quantityDisplay",
      render: (_, record) =>
        record.type === "material"
          ? `${formatNumberId(record.quantity)} ${record.purchaseUnit || ""}`
          : formatNumberId(record.quantity),
    },
    {
      title: "Stok Masuk",
      key: "stockInDisplay",
      render: (_, record) =>
        record.type === "material"
          ? `${formatNumberId(record.totalStockIn || record.quantity)} ${
              record.stockUnit || ""
            }`
          : formatNumberId(record.quantity),
    },
    {
      title: "Total Aktual Pembelian",
      dataIndex: "totalActualPurchase",
      key: "totalActualPurchase",
      render: (value) => formatCurrencyIdr(value),
    },
    {
      title: "Modal Aktual / Satuan",
      dataIndex: "actualUnitCost",
      key: "actualUnitCost",
      render: (value, record) => (
        <span>
          {formatCurrencyIdr(value)}
          {record.stockUnit ? (
            <>
              <br />
              <span style={{ color: "#999", fontSize: 12 }}>
                / {record.stockUnit}
              </span>
            </>
          ) : null}
        </span>
      ),
    },
    {
      title: "Selisih Hemat",
      dataIndex: "purchaseSaving",
      key: "purchaseSaving",
      render: (value) => {
        const savingMeta = getPurchaseSavingMeta(value);
        return <Tag color={savingMeta.color}>{savingMeta.label}</Tag>;
      },
    },
    {
      title: "Catatan",
      dataIndex: "note",
      key: "note",
    },
  ];

  return (
    <>
      <PageHeader
        title="Pembelian"
        subtitle="Catat pembelian bahan baku maupun produk, sinkronkan stok masuk, dan hitung efisiensi pembelian."
        actions={[
          {
            key: "add-purchase",
            type: "primary",
            icon: <PlusOutlined />,
            label: "Tambah Pembelian",
            onClick: openCreatePurchaseModal,
          },
        ]}
      />

      <PageSection
        title="Data Pembelian"
        subtitle="Pembelian akan menambah stok item, mencatat inventory log, dan menghasilkan pengeluaran kas."
      >
        {/* =========================
            SECTION: tabel pembelian baseline global
            Fungsi:
            - menjaga surface tabel pembelian tetap seragam dengan halaman transaksi lain
            - tabel ini tidak punya aksi per baris, jadi cukup memakai class global + scroll aman
            Status: aktif / final
        ========================= */}
        <Table
          className="app-data-table"
          dataSource={purchaseRecords}
          columns={purchaseTableColumns}
          rowKey="id"
          scroll={{ x: 1380 }}
        />
      </PageSection>

      <Modal
        title="Tambah Pembelian"
        open={isModalOpen}
        onOk={form.submit}
        onCancel={() => setIsModalOpen(false)}
        okText="Simpan"
        cancelText="Batal"
        width={760}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmitPurchase}>
          <Form.Item
            name="date"
            label="Tanggal"
            rules={[{ required: true, message: "Tanggal wajib diisi" }]}
          >
            <DatePicker className="ims-filter-control" />
          </Form.Item>

          <Form.Item
            name="type"
            label="Jenis Item"
            initialValue="material"
            rules={[{ required: true, message: "Jenis wajib dipilih" }]}
          >
            <Select placeholder="Pilih jenis item">
              <Option value="product">Produk</Option>
              <Option value="material">Bahan Baku</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="itemId"
            label="Nama Item"
            rules={[{ required: true, message: "Item wajib dipilih" }]}
          >
            <Select
              placeholder="Pilih item"
              showSearch
              optionFilterProp="children"
            >
              {(itemType === "product" ? products : materials).map((item) => (
                <Option key={item.id} value={item.id}>
                  {item.name}
                </Option>
              ))}
            </Select>
          </Form.Item>


          {itemType === "material" && (selectedMaterial?.hasVariantOptions || selectedMaterial?.hasVariants) ? (
            <Form.Item
              name="materialVariantId"
              label={selectedMaterial?.variantLabel || "Varian Bahan"}
              rules={[{ required: true, message: "Varian bahan wajib dipilih" }]}
            >
              <Select placeholder="Pilih varian bahan">
                {materialVariantOptions.map((item) => (
                  <Option key={item.value} value={item.value}>
                    {item.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          ) : null}

          {itemType === "product" && selectedProductHasVariants ? (
            <Form.Item
              name="productVariantKey"
              label={selectedProduct?.variantLabel || "Varian Produk"}
              rules={[{ required: true, message: "Varian produk wajib dipilih" }]}
              extra="Produk ini bervarian. Pembelian wajib masuk ke varian yang dipilih, bukan master/default."
            >
              <Select placeholder="Pilih varian produk">
                {productVariantOptions.map((item) => (
                  <Option key={item.value} value={item.value}>
                    {item.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          ) : null}
          <Form.Item
            name="supplierId"
            label="Nama Supplier"
            rules={[{ required: true, message: "Supplier wajib dipilih" }]}
            extra={
              itemType === "material" && itemId
                ? filteredSuppliers.length
                  ? "Supplier difilter dari katalog Supplier yang menyediakan bahan ini."
                  : "Belum ada supplier yang menyediakan bahan ini. Tambahkan material ini di menu Supplier terlebih dahulu."
                : "Pilih supplier"
            }
          >
            <Select
              placeholder="Pilih supplier"
              showSearch
              optionFilterProp="children"
              notFoundContent={
                itemType === "material" && itemId
                  ? "Belum ada supplier relevan untuk bahan ini"
                  : "Supplier tidak ditemukan"
              }
            >
              {filteredSuppliers.map((item) => (
                <Option key={item.id} value={item.id}>
                  {getSupplierOptionLabel(item)}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* ===============================================================
              Field Link Produk untuk referensi restock berikutnya.
              Fungsi: menyimpan URL produk dari transaksi pembelian terakhir.
              Alasan perubahan: saat supplier dipilih, default link dibaca dari
              materialDetails supplier yang cocok dengan bahan ini agar user tidak
              perlu copy-paste ulang dari menu Supplier.
              Status: aktif dipakai sebagai data referensi; field tetap boleh
              disesuaikan untuk histori purchase ini, tetapi tidak dipakai untuk
              perhitungan harga, stok, kas, saving, expense, atau laporan.
          =============================================================== */}
          <Form.Item
            name="productLink"
            label="Link Produk Restock"
            extra={
              itemType === "material" && supplierId
                ? getSupplierProductLinkForMaterial(selectedSupplier || {}, itemId)
                  ? "Default dari katalog Supplier. Jika link marketplace berubah saat pembelian, boleh disesuaikan untuk histori purchase ini."
                  : "Supplier ini belum punya link produk untuk bahan ini."
                : "Opsional. Dipakai untuk referensi restock berikutnya, bukan untuk perhitungan pembelian."
            }
          >
            <Input placeholder="Link produk marketplace / supplier" />
          </Form.Item>

          {itemType === "material" ? (
            <>
              {/* ===============================================================
                  Baris Qty Beli + Satuan Beli.
                  Fungsi: memisahkan input aktual dan referensi supplier dalam satu baris yang ringkas.
                  Hubungan flow Purchases: Qty Beli tetap diedit user, sedangkan Satuan Beli hanya snapshot read-only dari katalog Supplier.
                  Status: aktif dipakai; bukan kandidat cleanup karena menjaga form Pembelian tidak terasa dobel.
              =============================================================== */}
              <Form.Item name="purchaseUnit" hidden>
                <Input />
              </Form.Item>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                {/* ===============================================================
                    AKTIF / GUARDED UI CLEANUP:
                    - read-only field memakai class shared agar token warna/border konsisten.
                    - perubahan ini presentational only; tidak mengubah value, validasi, atau payload Purchases.
                =============================================================== */}
                <Form.Item
                  name="quantity"
                  label="Qty Beli"
                  rules={[{ required: true, message: "Qty wajib diisi" }]}
                  extra="Jumlah aktual yang dibeli."
                >
                  <InputNumber
                    min={0.01}
                    step={0.01}
                    className="ims-filter-control"
                    formatter={(value) => formatNumberId(value)}
                    parser={(value) => value?.replace(/\./g, "") || ""}
                  />
                </Form.Item>

                <Form.Item
                  label="Satuan Beli"
                  extra="Satuan beli mengikuti katalog Supplier."
                >
                  <Form.Item shouldUpdate noStyle>
                    {({ getFieldValue }) => (
                      <div className="ims-readonly-field ims-readonly-field--compact">
                        {getFieldValue("purchaseUnit") || "-"}
                      </div>
                    )}
                  </Form.Item>
                </Form.Item>
              </div>

              {/* ===============================================================
                  Baris Stok Masuk + Satuan Stok.
                  Fungsi: menonjolkan total stok yang benar-benar akan masuk dari transaksi ini.
                  Hubungan flow Purchases: Stok Masuk tetap dihitung dari Qty Beli x Konversi Supplier,
                  sementara Konversi Supplier disimpan hidden/read-only sebagai sumber hitung katalog restock.
                  Status: aktif dipakai; jika ada reject/selisih barang, koreksi dilakukan lewat Penyesuaian Stok,
                  bukan edit konversi langsung di Purchases.
              =============================================================== */}
              <Form.Item
                name="conversionValue"
                hidden
                rules={[
                  { required: true, message: "Konversi wajib diisi dari katalog Supplier" },
                  {
                    validator: (_, value) =>
                      Number(value || 0) > 0
                        ? Promise.resolve()
                        : Promise.reject(new Error("Konversi Supplier harus lebih dari 0")),
                  },
                ]}
              >
                <InputNumber />
              </Form.Item>
              <Form.Item name="stockUnit" hidden>
                <Input />
              </Form.Item>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                <Form.Item
                  label="Stok Masuk"
                  validateStatus={Number(conversionValue || 0) > 0 ? "" : "warning"}
                  help={
                    Number(conversionValue || 0) > 0
                      ? "Nilai akhir stok yang akan masuk."
                      : "Konversi belum diisi di katalog Supplier."
                  }
                >
                  <Form.Item shouldUpdate noStyle>
                    {({ getFieldValue }) => {
                      // ACTIVE: UI Stok Masuk hanya menampilkan hasil akhir agar form Pembelian tidak ramai.
                      // ALASAN: rumus Qty Beli x Konversi Supplier tetap dipakai di logic, tetapi detail formula tidak perlu ditampilkan ke user.
                      // CLEANUP: bukan kandidat cleanup; blok ini menjaga tampilan ringkas tanpa mengubah perhitungan stok/kas.
                      const stockInValue = Math.round(Number(getFieldValue("totalStockIn") || 0));
                      const unit = getFieldValue("stockUnit") || "satuan stok";

                      return (
                        <div className="ims-readonly-field">
                          <strong style={{ fontSize: 16 }}>
                            {formatNumberId(stockInValue)} {unit}
                          </strong>
                        </div>
                      );
                    }}
                  </Form.Item>
                </Form.Item>

                <Form.Item label="Satuan Stok" extra="Satuan stok mengikuti Raw Material.">
                  <Form.Item shouldUpdate noStyle>
                    {({ getFieldValue }) => (
                      <div className="ims-readonly-field ims-readonly-field--compact">
                        {getFieldValue("stockUnit") || "-"}
                      </div>
                    )}
                  </Form.Item>
                </Form.Item>
              </div>
            </>
          ) : (
            <Form.Item
              name="quantity"
              label="Qty Beli"
              rules={[{ required: true, message: "Qty wajib diisi" }]}
            >
              <InputNumber
                min={0.01}
                step={0.01}
                className="ims-filter-control"
                formatter={(value) => formatNumberId(value)}
                parser={(value) => value?.replace(/\./g, "") || ""}
              />
            </Form.Item>
          )}

          {/* ===============================================================
              Toggle Pembelian Offline.
              Fungsi: menentukan apakah biaya online dipakai di transaksi aktual.
              Alasan perubahan: katalog Supplier sudah punya tipe online/offline, sehingga Purchases perlu mengikuti default tersebut namun tetap bisa disesuaikan user.
              Status: aktif dipakai; tidak membuat transaksi otomatis dan tidak mengubah stok/kas sebelum user klik Simpan.
          =============================================================== */}
          <Form.Item name="purchaseType" hidden>
            <Input />
          </Form.Item>

          <Form.Item
            label="Pembelian Offline"
            extra={
              isOfflinePurchase
                ? "Offline: biaya online tidak dipakai."
                : "Online: ongkir, voucher, dan biaya layanan ikut menghitung total aktual."
            }
          >
            <Switch
              checked={isOfflinePurchase}
              checkedChildren="Offline"
              unCheckedChildren="Online"
              onChange={(checked) => {
                form.setFieldsValue({
                  purchaseType: checked ? "offline" : "online",
                  ...(checked
                    ? {
                        shippingCost: 0,
                        shippingDiscount: 0,
                        voucherDiscount: 0,
                        serviceFee: 0,
                      }
                    : {}),
                });
              }}
            />
          </Form.Item>

          {/* ===============================================================
              Subtotal Barang aktual.
              Fungsi: menyimpan harga aktual barang untuk transaksi purchase yang sedang dibuat.
              Alasan perubahan: default boleh berasal dari Qty x Harga Barang Supplier, tetapi user tetap bisa mengedit jika harga marketplace/toko berubah.
              Status: aktif dipakai; bukan kandidat cleanup karena menjaga Supplier sebagai default, bukan transaksi final.
          =============================================================== */}
          <Form.Item
            name="subtotalItems"
            label="Subtotal Barang"
            rules={[{ required: true, message: "Subtotal barang wajib diisi" }]}
            extra={
              selectedSupplierCatalogCost.supplierItemPrice > 0
                ? "Default dari Supplier. Tetap bisa diedit jika harga aktual berbeda."
                : "Isi harga aktual barang yang dibeli."
            }
          >
            <InputNumber
              min={0}
              className="ims-filter-control"
              addonBefore="Rp"
              formatter={(value) => formatNumberId(value)}
              parser={(value) => value?.replace(/\./g, "") || ""}
              onChange={() => {
                subtotalManualOverrideRef.current = true;
              }}
            />
          </Form.Item>

          {!isOfflinePurchase ? (
            <>
              <Space style={{ display: "flex", width: "100%" }} size={12} wrap>
                <Form.Item
                  name="shippingCost"
                  label="Ongkir"
                  style={{ flex: 1, minWidth: 180 }}
                >
                  <InputNumber
                    min={0}
                    className="ims-filter-control"
                    addonBefore="Rp"
                    formatter={(value) => formatNumberId(value)}
                    parser={(value) => value?.replace(/\./g, "") || ""}
                  />
                </Form.Item>

                <Form.Item
                  name="shippingDiscount"
                  label="Diskon Ongkir"
                  style={{ flex: 1, minWidth: 180 }}
                >
                  <InputNumber
                    min={0}
                    className="ims-filter-control"
                    addonBefore="Rp"
                    formatter={(value) => formatNumberId(value)}
                    parser={(value) => value?.replace(/\./g, "") || ""}
                  />
                </Form.Item>
              </Space>

              <Space style={{ display: "flex", width: "100%" }} size={12} wrap>
                <Form.Item
                  name="voucherDiscount"
                  label="Voucher / Potongan"
                  style={{ flex: 1, minWidth: 180 }}
                >
                  <InputNumber
                    min={0}
                    className="ims-filter-control"
                    addonBefore="Rp"
                    formatter={(value) => formatNumberId(value)}
                    parser={(value) => value?.replace(/\./g, "") || ""}
                  />
                </Form.Item>

                <Form.Item
                  name="serviceFee"
                  label="Biaya Layanan"
                  style={{ flex: 1, minWidth: 180 }}
                >
                  <InputNumber
                    min={0}
                    className="ims-filter-control"
                    addonBefore="Rp"
                    formatter={(value) => formatNumberId(value)}
                    parser={(value) => value?.replace(/\./g, "") || ""}
                  />
                </Form.Item>
              </Space>
            </>
          ) : null}

          {/* ===============================================================
              Ringkasan Perbandingan Supplier.
              Fungsi: menggabungkan stok masuk, harga pembanding Supplier, total aktual, modal aktual, dan selisih hemat dalam satu card ringkas.
              Hubungan flow: semua nilai read-only; stok/kas/expense baru berubah saat handleSubmitPurchase berjalan setelah user klik Simpan.
              Status: aktif dipakai; menggantikan field read-only besar agar form tidak terasa dobel.
          =============================================================== */}
          <Form.Item name="totalStockIn" hidden>
            <InputNumber />
          </Form.Item>
          <Form.Item name="restockReferencePrice" hidden>
            <InputNumber />
          </Form.Item>
          <Form.Item name="totalReferencePurchase" hidden>
            <InputNumber />
          </Form.Item>
          <Form.Item name="totalActualPurchase" hidden>
            <InputNumber />
          </Form.Item>
          <Form.Item name="actualUnitCost" hidden>
            <InputNumber />
          </Form.Item>
          <Form.Item name="purchaseSaving" hidden>
            <InputNumber />
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const stockUnit = getFieldValue("stockUnit") || "satuan stok";
              const stockInValue = Number(getFieldValue("totalStockIn") || 0);
              const supplierPriceValue = Number(getFieldValue("restockReferencePrice") || 0);
              const totalReferenceValue = Number(getFieldValue("totalReferencePurchase") || 0);
              const totalActualValue = Number(getFieldValue("totalActualPurchase") || 0);
              const actualUnitCostValue = Number(getFieldValue("actualUnitCost") || 0);
              const purchaseSavingValue = Number(getFieldValue("purchaseSaving") || 0);
              const savingMeta = getPurchaseSavingMeta(purchaseSavingValue);
              const hasSupplierReference = totalReferenceValue > 0;

              return (
                <div
                  style={{
                    border: "1px solid #f0f0f0",
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 16,
                    background: "var(--surface-card, #fff)",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 10 }}>
                    Ringkasan Perbandingan Supplier
                  </div>
                  {/* AKTIF/GUARDED: lebar ringkasan diseragamkan via class shared; nilai tetap read-only dan tidak ubah flow submit purchase. */}
                  <Space direction="vertical" size={6} className="ims-filter-control">
                    <div>Stok Masuk: <strong>{formatNumberId(stockInValue)} {stockUnit}</strong></div>
                    <div>
                      Harga Supplier Tercatat / Satuan Stok:{" "}
                      <strong>{supplierPriceValue > 0 ? `${formatCurrencyIdr(supplierPriceValue)} / ${stockUnit}` : "Belum ada harga supplier tercatat"}</strong>
                    </div>
                    <div>Total Pembanding Supplier: <strong>{hasSupplierReference ? formatCurrencyIdr(totalReferenceValue) : "-"}</strong></div>
                    <div>Total Aktual Pembelian: <strong>{formatCurrencyIdr(totalActualValue)}</strong></div>
                    <div>Modal Aktual / Satuan Stok: <strong>{formatCurrencyIdr(actualUnitCostValue)} / {stockUnit}</strong></div>
                    <div>Selisih Hemat: <Tag color={savingMeta.color}>{hasSupplierReference ? savingMeta.label : "-"}</Tag></div>
                  </Space>
                </div>
              );
            }}
          </Form.Item>

          <Form.Item name="note" label="Catatan">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default Purchases;
