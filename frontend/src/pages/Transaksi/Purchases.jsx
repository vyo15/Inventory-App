import React, { useEffect, useRef, useState, useMemo } from "react";
import { Button, Form, message, Modal, Space, Tag, Upload, Typography } from "antd";
import { EyeOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useSearchParams } from "react-router-dom";
import {
  doesSupplierProvideMaterial,
  getSupplierMaterialDetail,
  getSupplierPurchaseUnitForMaterial,
  getSupplierConversionValueForMaterial,
  getSupplierStockUnitForMaterial,
  getSupplierProductLinkForMaterial,
  getSupplierReferencePriceForMaterial,
  listenSupplierCatalog,
} from "../../services/MasterData/suppliersService";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import DataTableView from "../../components/Layout/Table/DataTableView";
import MobileDetailDrawer from "../../components/Layout/Mobile/MobileDetailDrawer";
import { DataRefreshIndicator, getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import { formatCurrencyId } from "../../utils/formatters/currencyId";
import { formatNumberId } from "../../utils/formatters/numberId";
import {
  enrichRawMaterialWithVariantTotals,
} from "../../utils/variants/rawMaterialVariantHelpers";
import {
  buildVariantOptionsFromItem,
  findVariantByKey,
  inferHasVariants,
} from "../../utils/variants/variantStockHelpers";
import {
  createPurchaseTransaction,
  getPurchaseStockUnit,
  listenPurchaseProducts,
  listenPurchaseRawMaterials,
  listenPurchaseRecords,
} from "../../services/Transaksi/purchasesService";
import { parseShopeePurchaseOcrText } from "../../utils/purchases/shopeePurchaseOcrParser";
import {
  buildShopeeOcrDetailRows,
  normalizePurchaseNoteText,
  stripExistingShopeeOcrNote,
} from "../../utils/purchases/purchaseNoteDisplay";
import PurchaseFormModal from "./components/PurchaseFormModal";
import PurchaseOcrReceiptModal from "./components/PurchaseOcrReceiptModal";
import { createPurchaseTableColumns } from "./components/PurchaseTableColumns";
import { buildPurchaseStockPreviewSnapshot } from "./components/purchaseStockPreviewHelpers";
import { SHOPEE_OCR_IDLE_STATE } from "./components/purchaseOcrUiConstants";
import {
  buildShopeeOcrPurchaseMeta,
  calculateSupplierReferenceTotal,
  calculateSupplierSubtotal,
} from "./helpers/purchasesPageHelpers";

const { Text } = Typography;

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
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmittingPurchase, setIsSubmittingPurchase] = useState(false);
  const [shopeeOcrState, setShopeeOcrState] = useState(SHOPEE_OCR_IDLE_STATE);
  const [shopeeOcrApplyFeedback, setShopeeOcrApplyFeedback] = useState(null);
  const [shopeeOcrDetailModal, setShopeeOcrDetailModal] = useState({
    open: false,
    rows: [],
    totalRow: null,
    rawText: "",
    purchaseMeta: {},
  });
  const [selectedPurchaseDetail, setSelectedPurchaseDetail] = useState(null);

  // =========================
  // SECTION: Watch fields
  // =========================
  const itemType = Form.useWatch("type", form);
  const itemId = Form.useWatch("itemId", form);
  const quantity = Form.useWatch("quantity", form);
  const conversionValue = Form.useWatch("conversionValue", form);
  const materialVariantId = Form.useWatch("materialVariantId", form);
  const productVariantKey = Form.useWatch("productVariantKey", form);
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
  // Status: aktif dipakai; bukan data historis dan bukan auto-sync Supplier.
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

  // =========================
  // SECTION: Varian produk terpilih untuk preview stok
  // Fungsi blok:
  // - membaca productVariantKey secara reactive agar card stok produk bervarian berubah real-time.
  // Hubungan flow Purchases:
  // - memakai field name existing yang sudah dipakai submit; tidak mengubah validasi atau payload pembelian.
  // Alasan logic:
  // - produk bervarian harus menampilkan stok varian yang dipilih, bukan total master.
  // Status: AKTIF untuk modal pembelian; CLEANUP CANDIDATE sebelumnya karena productVariantKey belum reactive di UI preview.
  // =========================
  const selectedProductVariant = useMemo(() => {
    if (!selectedProductHasVariants || !productVariantKey) return null;
    return findVariantByKey(selectedProduct || {}, productVariantKey);
  }, [productVariantKey, selectedProduct, selectedProductHasVariants]);

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
  // SECTION: Preview stok aktual sebelum restock
  // Fungsi blok:
  // - menentukan sumber stok read-only yang akan tampil di modal pembelian setelah item/varian dipilih;
  // - non-varian memakai stok master, sedangkan item bervarian wajib memakai stok varian terpilih.
  // Hubungan flow Purchases:
  // - preview ini muncul sebelum supplier/qty/biaya agar user memahami posisi stok sebelum klik Simpan;
  // - tidak mengubah totalStockIn, totalActualPurchase, actualUnitCost, purchaseSaving, save flow, atau services.
  // Alasan logic:
  // - item bervarian tidak boleh menampilkan total master sebagai angka utama karena mutasi pembelian masuk ke varian.
  // Status: AKTIF untuk UI modal pembelian, GUARDED agar tidak menjadi sumber mutasi stok, COMPATIBILITY untuk fallback field stock.
  // =========================
  const selectedPurchaseStockPreview = useMemo(() => {
    if (!itemType || !itemId) return null;

    const buildReadyPreview = ({ itemName, sourceLabel, sourceType, stockSource, stockUnit }) => ({
      status: "ready",
      itemName,
      sourceLabel,
      sourceType,
      stockUnit: stockUnit || getPurchaseStockUnit(stockSource),
      ...buildPurchaseStockPreviewSnapshot(stockSource),
    });

    const buildNeedsVariantPreview = ({ itemName, variantLabel }) => ({
      status: "needs_variant",
      itemName,
      variantLabel: variantLabel || "Varian",
      message: "Pilih varian untuk melihat stok varian.",
    });

    if (itemType === "material") {
      if (!selectedMaterial) return null;

      const materialHasVariants = selectedMaterial?.hasVariantOptions || selectedMaterial?.hasVariants;
      if (materialHasVariants) {
        if (!materialVariantId || !selectedMaterialVariant) {
          return buildNeedsVariantPreview({
            itemName: selectedMaterial.name,
            variantLabel: selectedMaterial.variantLabel || "Varian Bahan",
          });
        }

        return buildReadyPreview({
          itemName: selectedMaterial.name,
          sourceLabel:
            selectedMaterialVariant.variantName ||
            selectedMaterialVariant.variantLabel ||
            selectedMaterialVariant.name ||
            selectedMaterialVariant.variantKey ||
            "Varian terpilih",
          sourceType: "variant",
          stockSource: selectedMaterialVariant,
          stockUnit: getPurchaseStockUnit(selectedMaterial),
        });
      }

      return buildReadyPreview({
        itemName: selectedMaterial.name,
        sourceLabel: "Master / non-varian",
        sourceType: "master",
        stockSource: selectedMaterial,
        stockUnit: getPurchaseStockUnit(selectedMaterial),
      });
    }

    if (itemType === "product") {
      if (!selectedProduct) return null;

      if (selectedProductHasVariants) {
        if (!productVariantKey || !selectedProductVariant) {
          return buildNeedsVariantPreview({
            itemName: selectedProduct.name,
            variantLabel: selectedProduct.variantLabel || "Varian Produk",
          });
        }

        return buildReadyPreview({
          itemName: selectedProduct.name,
          sourceLabel:
            selectedProductVariant.variantLabel ||
            selectedProductVariant.label ||
            selectedProductVariant.name ||
            selectedProductVariant.color ||
            selectedProductVariant.variantKey ||
            "Varian terpilih",
          sourceType: "variant",
          stockSource: selectedProductVariant,
          stockUnit: getPurchaseStockUnit(selectedProduct),
        });
      }

      return buildReadyPreview({
        itemName: selectedProduct.name,
        sourceLabel: "Master / non-varian",
        sourceType: "master",
        stockSource: selectedProduct,
        stockUnit: getPurchaseStockUnit(selectedProduct),
      });
    }

    return null;
  }, [
    itemId,
    itemType,
    materialVariantId,
    productVariantKey,
    selectedMaterial,
    selectedMaterialVariant,
    selectedProduct,
    selectedProductHasVariants,
    selectedProductVariant,
  ]);

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
  // - membaca harga barang, ongkir, admin, voucher/koin, dan harga estimasi supplier dari materialDetails yang cocok.
  // Hubungan flow aplikasi:
  // - Supplier hanya sumber default transaksi; nilai ini tidak menulis balik ke Supplier/Raw Material dan tidak membuat purchase otomatis.
  // Status: aktif dipakai untuk prefill form Pembelian; bukan data historis dan bukan auto-sync supplier.
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
  // SECTION: Sinkron data utama pembelian
  // AKTIF + GUARDED:
  // - data read-only dipusatkan di purchasesService agar page tetap fokus ke UI/form;
  // - tidak mengubah create purchase transaction, stock in, average cost, expense, OCR, atau inventory log.
  // =========================
  useEffect(() => {
    const unsubscribePurchases = listenPurchaseRecords(
      (nextPurchaseRecords) => {
        setPurchaseRecords(nextPurchaseRecords);
        setLoadError("");
        setIsLoading(false);
      },
      (error) => {
        console.error("Gagal memuat data pembelian:", error);
        setPurchaseRecords([]);
        setLoadError("Gagal memuat data pembelian.");
        setIsLoading(false);
        message.error("Gagal memuat data pembelian.");
      },
    );

    const unsubscribeProducts = listenPurchaseProducts(
      (nextProducts) => {
        setProducts(nextProducts);
      },
      (error) => {
        console.error("Gagal memuat produk untuk pembelian:", error);
        message.error("Gagal memuat produk untuk pembelian.");
      },
    );

    const unsubscribeMaterials = listenPurchaseRawMaterials(
      (nextMaterials) => {
        setMaterials(nextMaterials);
      },
      (error) => {
        console.error("Gagal memuat bahan baku untuk pembelian:", error);
        message.error("Gagal memuat bahan baku untuk pembelian.");
      },
    );

    const unsubscribeSuppliers = listenSupplierCatalog(
      (nextSuppliers) => {
        // =========================
        // SECTION: Supplier dibaca dari katalog gabungan agar supplier lama yang
        // masih tersimpan di bahan baku tetap muncul di form pembelian.
        // =========================
        setSuppliers(nextSuppliers);
      },
      (error) => {
        console.error("Gagal memuat supplier untuk pembelian:", error);
        message.error("Gagal memuat supplier untuk pembelian.");
      },
    );

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
    // Status: aktif dipakai; bukan data historis dan bukan auto-purchase.
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
      // STATUS: aktif dipakai; bukan data historis.
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
  // - saat toggle Pembelian Offline aktif, ongkir/admin/voucher/koin/potongan di-reset ke 0
  //   agar nilai online lama tidak diam-diam ikut menghitung Total Aktual.
  // Hubungan flow Purchases:
  // - hanya membersihkan field biaya di form; tidak membuat transaksi otomatis dan tidak
  //   mengubah stok/kas sebelum user klik Simpan.
  // Status: aktif dipakai; bukan data historis.
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
  //   Voucher/Koin/Potongan, dan Biaya Layanan; bukan dari Harga Supplier Tercatat.
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
  // SECTION: Hitung Total Pembanding Supplier dan Selisih
  // Fungsi blok:
  // - menghitung pembanding Supplier dari komponen katalog Supplier, bukan langsung dari
  //   Stok Masuk x Harga Supplier Tercatat / Satuan Stok.
  // Alasan perubahan:
  // - ongkir/admin/voucher marketplace biasanya berlaku per checkout, sehingga tidak aman
  //   jika selalu dianggap proporsional per satuan stok saat Qty Beli > 1.
  // Hubungan flow aplikasi:
  // - Total Pembanding dan Selisih hanya informasi efisiensi; tidak mengubah kas,
  //   expense, actualUnitCost, stok, Supplier, atau Raw Material.
  // Status: aktif dipakai; fallback lama berbasis harga per satuan stok hanya untuk data historis
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
    setShopeeOcrState(SHOPEE_OCR_IDLE_STATE);
    setShopeeOcrApplyFeedback(null);
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
    // Status: aktif dipakai oleh tombol Tambah Pembelian; bukan data historis.
    // =========================
    restockPrefillMaterialIdRef.current = "";
    itemChangeContextRef.current = "";
    subtotalManualOverrideRef.current = false;
    supplierSubtotalBaselineRef.current = { itemId: "", supplierId: "", supplierItemPrice: 0, subtotalItems: 0 };
    setShopeeOcrState(SHOPEE_OCR_IDLE_STATE);
    setShopeeOcrApplyFeedback(null);
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
  // SECTION: OCR Screenshot Shopee untuk draft pembelian
  // Fungsi blok:
  // - membaca screenshot Shopee di browser sebagai draft;
  // - hanya mengisi field Qty Beli dan biaya setelah user klik Terapkan Qty & Biaya ke Form;
  // - tidak menyimpan gambar, tidak menyimpan OCR mentah, dan tidak auto-submit pembelian.
  // Hubungan flow Purchases:
  // - stok, expense, inventory log, dan laporan tetap hanya berubah setelah handleSubmitPurchase berhasil.
  // Status: AKTIF + GUARDED; OCR client-side dipakai agar tidak memerlukan API key.
  // =========================
  const handleShopeeScreenshotUpload = async (file) => {
    if (!file?.type?.startsWith("image/")) {
      message.error("Upload file gambar screenshot Shopee, bukan dokumen lain.");
      return Upload.LIST_IGNORE;
    }

    const maxFileSizeMb = 8;
    if (file.size > maxFileSizeMb * 1024 * 1024) {
      message.error(`Ukuran screenshot maksimal ${maxFileSizeMb} MB.`);
      return Upload.LIST_IGNORE;
    }

    setShopeeOcrApplyFeedback(null);
    setShopeeOcrState({
      status: "reading",
      progress: 5,
      fileName: file.name || "screenshot-shopee",
      parsed: null,
      error: "",
    });

    let worker;
    try {
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker(["ind", "eng"], 1, {
        logger: (payload) => {
          if (typeof payload?.progress !== "number") return;

          setShopeeOcrState((current) => ({
            ...current,
            progress: Math.min(99, Math.max(current.progress || 0, Math.round(payload.progress * 100))),
          }));
        },
      });

      const result = await worker.recognize(file);
      const parsed = parseShopeePurchaseOcrText(result?.data?.text || "");

      setShopeeOcrState({
        status: parsed.hasUsefulValues ? "ready" : "needs_review",
        progress: 100,
        fileName: file.name || "screenshot-shopee",
        parsed,
        error: parsed.hasUsefulValues ? "" : parsed.reviewMessage || "Screenshot terbaca, tapi angka utama belum terdeteksi. Isi manual atau coba screenshot yang lebih jelas.",
      });

      if (parsed.autoApplyBlocked) {
        message.warning("Screenshot terdeteksi berisi lebih dari 1 item. Input manual atau pecah transaksi per item.");
      } else if (parsed.needsManualReview) {
        message.warning(parsed.reviewMessage || "Screenshot Shopee perlu dicek manual sebelum diterapkan.");
      } else if (parsed.hasUsefulValues) {
        message.success("Screenshot Shopee berhasil dibaca. Cek preview lalu terapkan qty & biaya ke form.");
      }
    } catch (error) {
      console.error(error);
      setShopeeOcrState({
        status: "error",
        progress: 0,
        fileName: file.name || "screenshot-shopee",
        parsed: null,
        error: "Gagal membaca screenshot. Pastikan gambar jelas atau isi field pembelian secara manual.",
      });
      message.error("Gagal membaca screenshot Shopee.");
    } finally {
      if (worker) {
        await worker.terminate();
      }
    }

    return Upload.LIST_IGNORE;
  };

  const openShopeeOcrDetailModal = (purchaseRecord = {}) => {
    const note = typeof purchaseRecord === "string" ? purchaseRecord : purchaseRecord?.note || "";
    const detail = buildShopeeOcrDetailRows(note);

    setShopeeOcrDetailModal({
      open: true,
      rows: detail.rows,
      totalRow: detail.totalRow,
      rawText: detail.rawText,
      purchaseMeta:
        typeof purchaseRecord === "string"
          ? {}
          : buildShopeeOcrPurchaseMeta(purchaseRecord),
    });
  };

  const closeShopeeOcrDetailModal = () => {
    setShopeeOcrDetailModal({
      open: false,
      rows: [],
      totalRow: null,
      rawText: "",
      purchaseMeta: {},
    });
  };

  // =========================
  // SECTION: Detail read-only transaksi Purchases
  // Fungsi:
  // - membuka drawer detail dari mobile card pembelian tanpa mengubah purchase, stok masuk, expense, atau OCR parser.
  // Hubungan flow:
  // - detail memakai record purchase yang sudah ada di state tabel; tidak melakukan write/fetch tambahan.
  // Status:
  // - AKTIF sebagai UI mobile detail.
  // - GUARDED karena drawer ini tidak menjadi jalur edit/hapus pembelian.
  // =========================
  const openPurchaseDetail = (record) => {
    setSelectedPurchaseDetail(record);
  };

  const closePurchaseDetail = () => {
    setSelectedPurchaseDetail(null);
  };


  const applyShopeeOcrParsedToForm = (parsed) => {
    const currentNote = stripExistingShopeeOcrNote(form.getFieldValue("note"));
    const ocrNote = parsed.note || "OCR Shopee";
    const parsedQuantity = Math.max(Number(parsed.quantity || 0), 0);
    const nextValues = {
      purchaseType: "online",
      subtotalItems: Math.max(Number(parsed.subtotalItems || 0), 0),
      shippingCost: Math.max(Number(parsed.shippingCost || 0), 0),
      shippingDiscount: Math.max(Number(parsed.shippingDiscount || 0), 0),
      voucherDiscount: Math.max(Number(parsed.voucherDiscount || 0), 0),
      serviceFee: Math.max(Number(parsed.serviceFee || 0), 0),
      note: normalizePurchaseNoteText([currentNote, ocrNote].filter(Boolean).join("\n\n")),
    };

    if (parsedQuantity > 0) {
      nextValues.quantity = parsedQuantity;
    }

    subtotalManualOverrideRef.current = true;
    form.setFieldsValue(nextValues);
    setShopeeOcrApplyFeedback({
      appliedAt: Date.now(),
      description: parsedQuantity > 0
        ? "Qty, subtotal, ongkir, diskon, voucher/koin, dan biaya layanan sudah masuk ke form. Cek ulang sebelum Simpan."
        : "Subtotal, ongkir, diskon, voucher/koin, dan biaya layanan sudah masuk ke form. Qty belum terbaca, isi manual sebelum Simpan.",
    });
    message.success("Qty & biaya dari screenshot Shopee diterapkan ke form. Cek ulang sebelum Simpan.");
  };

  const applyShopeeOcrDraftToForm = () => {
    const parsed = shopeeOcrState.parsed;
    if (!parsed?.hasUsefulValues) {
      message.warning("Belum ada hasil OCR yang bisa diterapkan.");
      return;
    }

    if (parsed.autoApplyBlocked) {
      message.error("OCR terdeteksi multi-item. Input manual atau pecah pembelian per item agar stok dan modal tetap akurat.");
      return;
    }

    if (parsed.needsManualReview) {
      Modal.confirm({
        title: "OCR perlu dicek manual",
        content: parsed.reviewMessage || "Hasil OCR belum sepenuhnya cocok. Tetap terapkan ke form setelah kamu cek manual?",
        okText: "Terapkan Setelah Dicek",
        cancelText: "Batal",
        onOk: () => applyShopeeOcrParsedToForm(parsed),
      });
      return;
    }

    applyShopeeOcrParsedToForm(parsed);
  };

  // =========================
  // SECTION: Submit pembelian atomik + sinkron ke stok + sinkron ke pengeluaran
  // Fungsi blok:
  // - memvalidasi seluruh input penting sebelum write pertama;
  // - menyimpan purchase, mutasi stok, inventory log, dan expense dalam 1 transaksi layanan database;
  // - memakai reference deterministic untuk expense agar purchase yang sama tidak membuat cash out dobel.
  // Hubungan flow aplikasi:
  // - Supplier tetap hanya katalog/prefill; perubahan stok/kas/laporan baru terjadi setelah user klik Simpan;
  // - rumus Purchases tetap sama: Stok Masuk = Qty Beli x Konversi Supplier dan Total Aktual menjadi dasar expense.
  // Status:
  // - AKTIF + GUARDED untuk data real karena menyentuh purchases, stok, inventory_logs, dan expenses.
  // - FLOW LAMA: tidak ada jalur addDoc purchase lalu update stok terpisah; flow lama diganti transaction agar tidak partial.
  // - AKTIF: orchestration write sudah berada di purchasesService; page hanya mengirim input form dan data lookup UI.
  // =========================
  const handleSubmitPurchase = async (values) => {
    if (isSubmittingPurchase) return;

    try {
      setIsSubmittingPurchase(true);
      await createPurchaseTransaction({
        values,
        products,
        materials,
        suppliers,
      });

      message.success("Pembelian berhasil ditambahkan!");
      form.resetFields();
      setShopeeOcrState(SHOPEE_OCR_IDLE_STATE);
      setShopeeOcrApplyFeedback(null);
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menyimpan pembelian. Tidak ada data parsial yang disimpan.");
    } finally {
      setIsSubmittingPurchase(false);
    }
  };

  // =========================
  // SECTION: Tutup modal pembelian
  // =========================
  const handleClosePurchaseModal = () => {
    if (isSubmittingPurchase) {
      return;
    }

    setShopeeOcrState(SHOPEE_OCR_IDLE_STATE);
    setShopeeOcrApplyFeedback(null);
    setIsModalOpen(false);
  };

  // =========================
  // SECTION: Kolom tabel pembelian
  // =========================
  const purchaseTableColumns = createPurchaseTableColumns({
    onOpenShopeeOcrDetail: openShopeeOcrDetailModal,
  });

  const purchaseMobileCardConfig = {
    title: (record) => record.purchaseNumber || record.code || record.referenceNumber || 'Kode otomatis',
    subtitle: (record) => [
      record.date?.toDate ? dayjs(record.date.toDate()).format('DD-MM-YYYY') : '-',
      record.supplierName || 'Supplier tidak tercatat',
    ],
    tags: (record) => [
      <Tag key="purchase-type" color={record.purchaseType === 'offline' ? 'default' : 'blue'}>
        {record.purchaseType === 'offline' ? 'Offline' : 'Online'}
      </Tag>,
      <Tag key="item-type" color={record.type === 'product' ? 'blue' : 'gold'}>
        {record.type === 'product' ? 'Produk' : 'Bahan Baku'}
      </Tag>,
    ],
    meta: [
      { label: 'Total', value: (record) => formatCurrencyId(record.totalActualPurchase || 0) },
      { label: 'Modal', value: (record) => `${formatCurrencyId(record.actualUnitCost || 0)}${record.stockUnit ? ` / ${record.stockUnit}` : ''}` },
      { label: 'Stok Masuk', value: (record) => {
        const stockIn = record.type === 'material' ? (record.totalStockIn || record.quantity) : record.quantity;
        return `${formatNumberId(stockIn || 0)}${record.stockUnit ? ` ${record.stockUnit}` : ''}`;
      } },
    ],
    content: (record) => (
      <div className="ims-cell-stack ims-cell-stack-tight">
        <span className="ims-cell-title">{record.itemName || '-'}</span>
        <span className="ims-cell-meta">
          {record.variantLabel || record.variantKey ? `Varian: ${record.variantLabel || record.variantKey}` : 'Master'}
        </span>
      </div>
    ),
    actions: (record) => (
      <Button
        className="ims-action-button"
        icon={<EyeOutlined />}
        size="small"
        onClick={() => openPurchaseDetail(record)}
      >
        Lihat Detail
      </Button>
    ),
  };

  /* =====================================================
     SECTION: Purchases Render Panel — GUARDED
     Fungsi:
     - Menata tabel dan form pembelian agar supplier, item, varian, stok masuk, modal aktual, dan total biaya mudah dibaca.

     Dipakai oleh:
     - Halaman Purchases.

     Alasan perubahan:
     - Batch 3 merapikan tampilan pembelian tanpa mengubah stock-in, expense, conversion, actual unit cost, atau payload submit.

     Catatan cleanup:
     - Drawer audit pembelian bisa dibuat terpisah jika rincian biaya semakin panjang.

     Risiko:
     - Jangan mengubah formula, service call, item mapping, supplier mapping, cash out linkage, atau inventory log dari section ini.
     ===================================================== */
  return (
    <>
      <PageHeader
        title="Pembelian"
        subtitle="Pembelian dan stok masuk."
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
        subtitle="Stok dan biaya mengikuti pembelian."
      >
        {/* =========================
            SECTION: tabel pembelian baseline global
            Fungsi:
            - menjaga surface tabel pembelian tetap seragam dengan halaman transaksi lain
            - tabel ini tidak punya aksi per baris, jadi cukup memakai class global dengan kolom ringkas
            Status: aktif / final
        ========================= */}
        <DataRefreshIndicator loading={isLoading} dataSource={purchaseRecords} />
        <DataTableView
          showRefreshIndicator={false}
          className="app-data-table"
          dataSource={purchaseRecords}
          columns={purchaseTableColumns}
          rowKey="id"
          tableLayout="fixed"
          locale={{ emptyText: getDataTableEmptyText(isLoading, loadError || "Belum ada data pembelian.") }}
          mobileCardConfig={purchaseMobileCardConfig}
        />
      </PageSection>

      <MobileDetailDrawer
        title="Detail Pembelian"
        open={Boolean(selectedPurchaseDetail)}
        onClose={closePurchaseDetail}
        width="min(100vw, 440px)"
      >
        {selectedPurchaseDetail ? (() => {
          const dateText = selectedPurchaseDetail.date?.toDate
            ? dayjs(selectedPurchaseDetail.date.toDate()).format("DD-MM-YYYY")
            : "-";
          const stockIn = selectedPurchaseDetail.type === "material"
            ? selectedPurchaseDetail.totalStockIn || selectedPurchaseDetail.quantity
            : selectedPurchaseDetail.quantity;

          return (
            <Space direction="vertical" size={14} style={{ width: "100%" }}>
              <div className="ims-cell-stack">
                <Text type="secondary">Kode / Tanggal</Text>
                <Text strong>{selectedPurchaseDetail.purchaseNumber || selectedPurchaseDetail.code || selectedPurchaseDetail.referenceNumber || "Kode otomatis"}</Text>
                <Text>{dateText}</Text>
              </div>
              <div className="ims-cell-stack">
                <Text type="secondary">Supplier</Text>
                <Text strong>{selectedPurchaseDetail.supplierName || "Supplier tidak tercatat"}</Text>
              </div>
              <Space wrap>
                <Tag color={selectedPurchaseDetail.purchaseType === "offline" ? "default" : "blue"}>
                  {selectedPurchaseDetail.purchaseType === "offline" ? "Offline" : "Online"}
                </Tag>
                <Tag color={selectedPurchaseDetail.type === "product" ? "blue" : "gold"}>
                  {selectedPurchaseDetail.type === "product" ? "Produk" : "Bahan Baku"}
                </Tag>
                {selectedPurchaseDetail.variantLabel || selectedPurchaseDetail.variantKey ? (
                  <Tag color="purple">{selectedPurchaseDetail.variantLabel || selectedPurchaseDetail.variantKey}</Tag>
                ) : (
                  <Tag>Master</Tag>
                )}
              </Space>
              <div className="ims-cell-stack">
                <Text type="secondary">Item</Text>
                <Text strong>{selectedPurchaseDetail.itemName || "-"}</Text>
              </div>
              <div className="ims-cell-stack">
                <Text type="secondary">Qty / Stok Masuk</Text>
                <Text>Qty beli: {formatNumberId(selectedPurchaseDetail.quantity || 0)}{selectedPurchaseDetail.purchaseUnit ? ` ${selectedPurchaseDetail.purchaseUnit}` : ""}</Text>
                <Text strong>Stok masuk: {formatNumberId(stockIn || 0)}{selectedPurchaseDetail.stockUnit ? ` ${selectedPurchaseDetail.stockUnit}` : ""}</Text>
              </div>
              <div className="ims-cell-stack">
                <Text type="secondary">Biaya</Text>
                <Text strong>Total: {formatCurrencyId(selectedPurchaseDetail.totalActualPurchase || 0)}</Text>
                <Text>Modal: {formatCurrencyId(selectedPurchaseDetail.actualUnitCost || 0)}{selectedPurchaseDetail.stockUnit ? ` / ${selectedPurchaseDetail.stockUnit}` : ""}</Text>
              </div>
              <div className="ims-cell-stack">
                <Text type="secondary">Catatan</Text>
                <Text style={{ whiteSpace: "pre-line" }}>{selectedPurchaseDetail.note || "-"}</Text>
              </div>
            </Space>
          );
        })() : null}
      </MobileDetailDrawer>

      <PurchaseOcrReceiptModal
        open={shopeeOcrDetailModal.open}
        rows={shopeeOcrDetailModal.rows}
        totalRow={shopeeOcrDetailModal.totalRow}
        rawText={shopeeOcrDetailModal.rawText}
        purchaseMeta={shopeeOcrDetailModal.purchaseMeta}
        onClose={closeShopeeOcrDetailModal}
      />

      <PurchaseFormModal
        form={form}
        isModalOpen={isModalOpen}
        isSubmittingPurchase={isSubmittingPurchase}
        onCancel={handleClosePurchaseModal}
        handleSubmitPurchase={handleSubmitPurchase}
        itemType={itemType}
        products={products}
        materials={materials}
        selectedMaterial={selectedMaterial}
        materialVariantOptions={materialVariantOptions}
        selectedProduct={selectedProduct}
        selectedProductHasVariants={selectedProductHasVariants}
        productVariantOptions={productVariantOptions}
        selectedPurchaseStockPreview={selectedPurchaseStockPreview}
        filteredSuppliers={filteredSuppliers}
        itemId={itemId}
        supplierId={supplierId}
        selectedSupplier={selectedSupplier}
        shopeeOcrState={shopeeOcrState}
        shopeeOcrApplyFeedback={shopeeOcrApplyFeedback}
        handleShopeeScreenshotUpload={handleShopeeScreenshotUpload}
        applyShopeeOcrDraftToForm={applyShopeeOcrDraftToForm}
        isOfflinePurchase={isOfflinePurchase}
        conversionValue={conversionValue}
        selectedSupplierCatalogCost={selectedSupplierCatalogCost}
        subtotalManualOverrideRef={subtotalManualOverrideRef}
      />
    </>
  );
};

export default Purchases;
