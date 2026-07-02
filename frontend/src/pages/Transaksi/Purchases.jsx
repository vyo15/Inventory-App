import {
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import {
  App as AntdApp,
  Form,
  Upload,
  Typography,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useSearchParams } from "react-router-dom";
import {
  calculateSupplierMaterialRestockMetrics,
  doesSupplierProvideItem,
  getSupplierCatalogOffers,
} from "../../services/MasterData/suppliersService";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageContentCanvas from "../../components/Layout/Page/PageContentCanvas";
import PageSection from "../../components/Layout/Page/PageSection";
import DataTableView from "../../components/Layout/Table/DataTableView";
import { DataRefreshIndicator } from "../../components/Layout/Feedback/DataLoadingState";
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
} from "../../services/Transaksi/purchasesService";
import { parseShopeePurchaseOcrText } from "../../utils/purchases/shopeePurchaseOcrParser";
import { compareRecordsByDateDesc, mergeInventoryMutationResults, upsertRecordById } from "../../utils/state/recordCollectionState";
import {
  buildShopeeOcrDetailRows,
  normalizePurchaseNoteText,
  stripExistingShopeeOcrNote,
} from "../../utils/purchases/purchaseNoteDisplay";
import PurchaseFormModal from "./components/PurchaseFormModal";
import PurchaseDetailDrawer from "./components/PurchaseDetailDrawer";
import PurchaseOcrReceiptModal from "./components/PurchaseOcrReceiptModal";
import { createPurchaseMobileCardConfig, createPurchaseTableColumns } from "./components/PurchaseTableColumns";
import { buildPurchaseStockPreview } from "./components/purchaseStockPreviewHelpers";
import { SHOPEE_OCR_IDLE_STATE } from "./components/purchaseOcrUiConstants";
import {
  buildShopeeOcrPurchaseMeta,
  calculateSupplierSubtotal,
  buildPurchaseFormDefaults,
  buildPurchaseItemSelectionFields,
  buildPurchaseVerificationSignature,
  calculatePurchaseCostSummary,
  shouldApplyPurchaseItemDefaults,
  resolvePurchaseCatalogOfferSelection,
  buildPurchaseCatalogOfferFields,
  canAutoApplySupplierSubtotal,
} from "./helpers/purchasesPageHelpers";
import usePurchaseFormSnapshot from "./hooks/usePurchaseFormSnapshot";
import usePurchaseReferenceData from "./hooks/usePurchaseReferenceData";

const { Text } = Typography;

const Purchases = () => {
  const { message, modal } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [searchParams] = useSearchParams();
  const restockPrefillAppliedRef = useRef(false);
  const restockPrefillMaterialIdRef = useRef("");
  const restockPrefillOfferIdRef = useRef("");
  const itemChangeContextRef = useRef("");
  const itemDefaultsAppliedContextRef = useRef("");
  const subtotalManualOverrideRef = useRef(false);
  const supplierSubtotalBaselineRef = useRef({
    itemId: "",
    supplierId: "",
    supplierItemPrice: 0,
    subtotalItems: 0,
  });
  const priceVerificationSignatureRef = useRef("");

  const [subscriptionRevision, setSubscriptionRevision] = useState(0);
  const {
    data: {
      purchaseRecords,
      products,
      materials,
      suppliers,
      isLoading,
      loadError,
    },
    setters: {
      setPurchaseRecords,
      setProducts,
      setMaterials,
      setSuppliers,
    },
  } = usePurchaseReferenceData({ message, revision: subscriptionRevision });
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

  const {
    itemType,
    itemId,
    quantity,
    conversionValue,
    materialVariantId,
    productVariantKey,
    supplierId,
    catalogOfferId,
    priceVerified,
    purchaseType,
    subtotalItems,
    shippingCost,
    shippingDiscount,
    voucherDiscount,
    serviceFee,
    totalStockIn,
    restockReferencePrice,
  } = usePurchaseFormSnapshot(form);

  const isOfflinePurchase = purchaseType === "offline";

  const selectedProduct = useMemo(() => {
    return products.find((item) => item.id === itemId) || null;
  }, [products, itemId]);

  const selectedProductHasVariants = itemType === "product" && inferHasVariants(selectedProduct || {});

  const productVariantOptions = useMemo(() => {
    if (!selectedProductHasVariants) return [];
    return buildVariantOptionsFromItem(selectedProduct);
  }, [selectedProduct, selectedProductHasVariants]);

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

  const selectedPurchaseStockPreview = useMemo(() => buildPurchaseStockPreview({
    itemId,
    itemType,
    materialVariantId,
    productVariantKey,
    selectedMaterial,
    selectedMaterialVariant,
    selectedProduct,
    selectedProductHasVariants,
    selectedProductVariant,
  }), [
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

  const selectedSupplier = useMemo(() => {
    return suppliers.find((supplier) => String(supplier.id) === String(supplierId)) || null;
  }, [suppliers, supplierId]);

  const selectedCatalogVariantKey = itemType === "product"
    ? productVariantKey || ""
    : materialVariantId || "";
  const selectedCatalogItemType = itemType === "product" ? "product" : "raw_material";

  const selectedSupplierOffers = useMemo(() => {
    if (!selectedSupplier || !itemId) return [];
    return getSupplierCatalogOffers(selectedSupplier, {
      itemType: selectedCatalogItemType,
      itemId,
      variantKey: selectedCatalogVariantKey,
      availableOnly: true,
    });
  }, [itemId, selectedCatalogItemType, selectedCatalogVariantKey, selectedSupplier]);

  const selectedCatalogOffer = useMemo(() => selectedSupplierOffers.find(
    (offer) => String(offer.id || offer.catalogOfferId) === String(catalogOfferId || ""),
  ) || null, [catalogOfferId, selectedSupplierOffers]);

  const selectedSupplierCatalogCost = useMemo(() => {
    const metrics = calculateSupplierMaterialRestockMetrics(selectedCatalogOffer || {});
    return {
      ...metrics,
      purchaseType: selectedCatalogOffer?.purchaseType === "offline" ? "offline" : "online",
    };
  }, [selectedCatalogOffer]);

  const filteredSuppliers = useMemo(() => {
    if (!itemId) return suppliers;

    const matchedSuppliers = suppliers.filter((supplier) => doesSupplierProvideItem(
      supplier,
      selectedCatalogItemType,
      itemId,
      selectedCatalogVariantKey,
    ));

    if (
      supplierId
      && selectedSupplier
      && !matchedSuppliers.some((supplier) => String(supplier.id) === String(supplierId))
    ) {
      return [selectedSupplier, ...matchedSuppliers];
    }

    return matchedSuppliers;
  }, [itemId, selectedCatalogItemType, selectedCatalogVariantKey, selectedSupplier, supplierId, suppliers]);

  // Reset form context only when the selected item changes; quantity refresh must not clear supplier data.
  useEffect(() => {
    const shouldKeepPrefilledSupplier =
      restockPrefillMaterialIdRef.current &&
      String(itemId || "") === restockPrefillMaterialIdRef.current;

    const nextItemChangeContext = `${String(itemType || "")}::${String(itemId || "")}`;
    const isItemContextChanged = itemChangeContextRef.current !== nextItemChangeContext;
    itemChangeContextRef.current = nextItemChangeContext;

    if (isItemContextChanged) {
      itemDefaultsAppliedContextRef.current = "";
      subtotalManualOverrideRef.current = false;
      supplierSubtotalBaselineRef.current = { itemId: "", supplierId: "", supplierItemPrice: 0, subtotalItems: 0 };
    }

    if (isItemContextChanged && !shouldKeepPrefilledSupplier) {
      restockPrefillMaterialIdRef.current = "";
      form.setFieldsValue({
        supplierId: undefined,
        catalogOfferId: undefined,
        productLink: "",
        priceVerified: false,
        priceVerifiedAt: undefined,
        verifiedCatalogPrice: 0,
      });
      priceVerificationSignatureRef.current = "";
    }

    const material = itemType === "material"
      ? materials.find((item) => item.id === itemId)
      : null;
    const enrichedMaterial = material
      ? enrichRawMaterialWithVariantTotals(material)
      : null;

    const shouldApplyItemDefaults = shouldApplyPurchaseItemDefaults({
      appliedContext: itemDefaultsAppliedContextRef.current,
      currentContext: nextItemChangeContext,
      isItemContextChanged,
      itemType,
      material: enrichedMaterial,
    });

    if (shouldApplyItemDefaults) {
      form.setFieldsValue(buildPurchaseItemSelectionFields({
        itemType,
        material: enrichedMaterial,
      }));

      if (itemType === "product" || enrichedMaterial) {
        itemDefaultsAppliedContextRef.current = nextItemChangeContext;
      }
    }
  }, [itemId, itemType, materials, form]);

  useEffect(() => {
    if (itemType !== "material") return;

    if ((selectedMaterial?.hasVariantOptions || selectedMaterial?.hasVariants) && !selectedMaterialVariant) {
      form.setFieldsValue({ restockReferencePrice: 0 });
    }
  }, [itemType, selectedMaterial, selectedMaterialVariant, form]);

  useEffect(() => {
    const selection = resolvePurchaseCatalogOfferSelection({
      currentOfferId: form.getFieldValue("catalogOfferId"),
      offers: selectedSupplierOffers,
      prefilledOfferId: restockPrefillOfferIdRef.current,
    });
    if (selection.consumedPrefill) restockPrefillOfferIdRef.current = "";

    form.setFieldsValue({
      catalogOfferId: selection.nextOfferId,
      priceVerified: false,
      priceVerifiedAt: undefined,
      verifiedCatalogPrice: 0,
    });
    priceVerificationSignatureRef.current = "";
  }, [form, itemId, selectedCatalogVariantKey, selectedSupplierOffers, supplierId]);

  useEffect(() => {
    if (!selectedCatalogOffer) {
      form.setFieldsValue({
        productLink: "",
        restockReferencePrice: 0,
      });
      return;
    }

    const catalogState = buildPurchaseCatalogOfferFields({
      offer: selectedCatalogOffer,
      metrics: calculateSupplierMaterialRestockMetrics(selectedCatalogOffer),
      quantity: form.getFieldValue("quantity"),
      itemType,
      fallbackStockUnit: getPurchaseStockUnit(
        itemType === "product" ? selectedProduct || {} : selectedMaterial || {},
      ),
    });

    subtotalManualOverrideRef.current = false;
    supplierSubtotalBaselineRef.current = {
      itemId: String(itemId || ""),
      supplierId: String(supplierId || ""),
      supplierItemPrice: catalogState.supplierItemPrice,
      subtotalItems: catalogState.subtotalItems,
    };
    priceVerificationSignatureRef.current = "";
    form.setFieldsValue(catalogState.fields);
  }, [
    form,
    itemId,
    itemType,
    selectedCatalogOffer,
    selectedMaterial,
    selectedProduct,
    supplierId,
  ]);

  useEffect(() => {
    const qty = Number(quantity || 0);
    const conversion = Number(conversionValue || 0);

    const nextTotalStockIn = itemType === "material" ? qty * conversion : qty;

    form.setFieldsValue({
      totalStockIn: Math.round(nextTotalStockIn || 0),
    });
  }, [quantity, conversionValue, itemType, form]);

  useEffect(() => {
    const supplierItemPrice = selectedSupplierCatalogCost.supplierItemPrice;
    if (!supplierId || !supplierItemPrice) return;

    const nextSubtotal = calculateSupplierSubtotal(quantity, supplierItemPrice);
    const previousBaseline = supplierSubtotalBaselineRef.current;
    const canAutoApplySubtotal = canAutoApplySupplierSubtotal({
      manualOverride: subtotalManualOverrideRef.current,
      currentSubtotal: form.getFieldValue("subtotalItems"),
      previousBaselineSubtotal: previousBaseline.subtotalItems,
    });

    if (!canAutoApplySubtotal) return;

    supplierSubtotalBaselineRef.current = {
      itemId: String(itemId || ""),
      supplierId: String(supplierId || ""),
      supplierItemPrice,
      subtotalItems: nextSubtotal,
    };

    form.setFieldsValue({ subtotalItems: nextSubtotal });
  }, [form, itemId, itemType, quantity, selectedSupplierCatalogCost.supplierItemPrice, supplierId]);

  useEffect(() => {
    const signature = buildPurchaseVerificationSignature({
      catalogOfferId,
      quantity,
      subtotalItems,
    });
    if (priceVerificationSignatureRef.current && priceVerificationSignatureRef.current !== signature) {
      form.setFieldsValue({
        priceVerified: false,
        priceVerifiedAt: undefined,
        verifiedCatalogPrice: 0,
      });
      priceVerificationSignatureRef.current = "";
    }
  }, [catalogOfferId, form, quantity, subtotalItems]);

  useEffect(() => {
    if (purchaseType !== "offline") return;

    form.setFieldsValue({
      shippingCost: 0,
      shippingDiscount: 0,
      voucherDiscount: 0,
      serviceFee: 0,
    });
  }, [form, purchaseType]);

  // Keep all derived cost fields in one deterministic snapshot.
  useEffect(() => {
    form.setFieldsValue(calculatePurchaseCostSummary({
      subtotalItems,
      shippingCost,
      shippingDiscount,
      voucherDiscount,
      serviceFee,
      purchaseType,
      totalStockIn,
      quantity,
      restockReferencePrice,
      supplierItemPrice: selectedSupplierCatalogCost.supplierItemPrice,
      referenceShippingCost: selectedSupplierCatalogCost.estimatedShippingCost,
      referenceServiceFee: selectedSupplierCatalogCost.serviceFee,
      referenceDiscount: selectedSupplierCatalogCost.discount,
    }));
  }, [
    form,
    purchaseType,
    quantity,
    restockReferencePrice,
    selectedSupplierCatalogCost.discount,
    selectedSupplierCatalogCost.estimatedShippingCost,
    selectedSupplierCatalogCost.serviceFee,
    selectedSupplierCatalogCost.supplierItemPrice,
    serviceFee,
    shippingCost,
    shippingDiscount,
    subtotalItems,
    totalStockIn,
    voucherDiscount,
  ]);

  // Dashboard restock prefill is applied once and never auto-submits.
  useEffect(() => {
    if (restockPrefillAppliedRef.current) return;

    const queryType = searchParams.get("type");
    const materialId = searchParams.get("materialId");
    const itemIdFromQuery = searchParams.get("itemId") || materialId;
    if (!itemIdFromQuery) return;

    const nextType = queryType === "product" ? "product" : "material";
    const supplierIdFromQuery = searchParams.get("supplierId") || undefined;
    const offerIdFromQuery = searchParams.get("offerId") || undefined;
    const productLink = searchParams.get("productLink") || "";

    restockPrefillAppliedRef.current = true;
    itemDefaultsAppliedContextRef.current = "";
    restockPrefillMaterialIdRef.current = String(itemIdFromQuery);
    restockPrefillOfferIdRef.current = String(offerIdFromQuery || "");
    subtotalManualOverrideRef.current = false;
    priceVerificationSignatureRef.current = "";
    setShopeeOcrState(SHOPEE_OCR_IDLE_STATE);
    setShopeeOcrApplyFeedback(null);
    supplierSubtotalBaselineRef.current = { itemId: "", supplierId: "", supplierItemPrice: 0, subtotalItems: 0 };

    form.resetFields();
    form.setFieldsValue(buildPurchaseFormDefaults({
      type: nextType,
      itemId: itemIdFromQuery,
      supplierId: supplierIdFromQuery,
      catalogOfferId: offerIdFromQuery,
      productLink,
      materialVariantId: searchParams.get("variantKey") || undefined,
      productVariantKey: searchParams.get("variantKey") || undefined,
    }));
    setIsModalOpen(true);
  }, [form, searchParams]);

  const openCreatePurchaseModal = () => {
    restockPrefillMaterialIdRef.current = "";
    restockPrefillOfferIdRef.current = "";
    itemChangeContextRef.current = "";
    itemDefaultsAppliedContextRef.current = "";
    subtotalManualOverrideRef.current = false;
    supplierSubtotalBaselineRef.current = { itemId: "", supplierId: "", supplierItemPrice: 0, subtotalItems: 0 };
    priceVerificationSignatureRef.current = "";
    setShopeeOcrState(SHOPEE_OCR_IDLE_STATE);
    setShopeeOcrApplyFeedback(null);
    form.resetFields();
    form.setFieldsValue(buildPurchaseFormDefaults());
    setIsModalOpen(true);
  };

  // OCR remains client-side draft input; stock and expense change only after official submit.
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
      modal.confirm({
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

  const handleVerifyPurchasePrice = () => {
    if (!selectedCatalogOffer) {
      message.warning("Pilih link atau paket katalog Supplier terlebih dahulu.");
      return;
    }

    const qty = Math.round(Number(form.getFieldValue("quantity") || 0));
    const subtotal = Math.round(Number(form.getFieldValue("subtotalItems") || 0));
    const actualPackagePrice = qty > 0 ? Math.round(subtotal / qty) : 0;
    if (qty <= 0 || actualPackagePrice <= 0) {
      message.warning("Isi Qty dan Subtotal Barang aktual sebelum verifikasi harga.");
      return;
    }

    const referencePrice = Math.round(Number(selectedCatalogOffer.supplierItemPrice || 0));
    const signature = `${String(selectedCatalogOffer.id || selectedCatalogOffer.catalogOfferId)}::${qty}::${subtotal}`;
    priceVerificationSignatureRef.current = signature;
    form.setFieldsValue({
      priceVerified: true,
      priceVerifiedAt: new Date().toISOString(),
      verifiedCatalogPrice: actualPackagePrice,
    });

    if (actualPackagePrice === referencePrice) {
      message.success("Harga aktual sudah sesuai dengan katalog Supplier.");
    } else {
      message.success("Harga aktual sudah diverifikasi. Katalog akan diperbarui saat Pembelian disimpan.");
    }
  };

  // Guarded authority: purchase, stock-in, inventory log, and expense are committed atomically by the service/backend.
  const handleSubmitPurchase = async (values) => {
    if (isSubmittingPurchase) return;

    try {
      setIsSubmittingPurchase(true);
      const result = await createPurchaseTransaction({
        values,
        products,
        materials,
        suppliers,
      });

      setPurchaseRecords((current) => upsertRecordById(current, result, {
        comparator: compareRecordsByDateDesc,
      }));
      const mutationResults = Array.isArray(result?.mutationResults) ? result.mutationResults : [];
      setProducts((current) => mergeInventoryMutationResults(current, mutationResults, "product"));
      setMaterials((current) => mergeInventoryMutationResults(current, mutationResults, "raw_material"));
      if (result?.catalogVerification?.catalogOfferId) {
        setSuppliers((current) => current.map((supplier) => {
          if (String(supplier.id) !== String(result.catalogVerification.supplierId)) return supplier;
          return {
            ...supplier,
            catalogOffers: (supplier.catalogOffers || []).map((offer) => (
              String(offer.id || offer.catalogOfferId) === String(result.catalogVerification.catalogOfferId)
                ? {
                    ...offer,
                    supplierItemPrice: result.catalogVerification.verifiedCatalogPrice,
                    lastCheckedAt: result.catalogVerification.priceVerifiedAt,
                    priceUpdatedAt: result.catalogVerification.priceVerificationResult === "price_same"
                      ? offer.priceUpdatedAt
                      : result.catalogVerification.priceVerifiedAt,
                  }
                : offer
            )),
          };
        }));
      }

      message.success("Pembelian berhasil ditambahkan!");
      form.resetFields();
      priceVerificationSignatureRef.current = "";
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

  const handleClosePurchaseModal = () => {
    if (isSubmittingPurchase) {
      return;
    }

    setShopeeOcrState(SHOPEE_OCR_IDLE_STATE);
    setShopeeOcrApplyFeedback(null);
    setIsModalOpen(false);
  };

  const purchaseTableColumns = createPurchaseTableColumns({
    onOpenShopeeOcrDetail: openShopeeOcrDetailModal,
  });

  const purchaseMobileCardConfig = createPurchaseMobileCardConfig({
    onOpenDetail: openPurchaseDetail,
  });

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

      <PageContentCanvas>

      <PageSection
        title="Data Pembelian"
        subtitle="Stok dan biaya mengikuti pembelian."
      >

        <DataRefreshIndicator loading={isLoading} dataSource={purchaseRecords} />
        <DataTableView
          showRefreshIndicator={false}
          className="app-data-table"
          dataSource={purchaseRecords}
          columns={purchaseTableColumns}
          rowKey="id"
          tableLayout="fixed"
          emptyState={{ description: "Belum ada data pembelian." }}
          error={loadError ? new Error(loadError) : null}
          onRetry={() => setSubscriptionRevision((value) => value + 1)}
          mobileCardConfig={purchaseMobileCardConfig}
        />
      </PageSection>

      </PageContentCanvas>

      <PurchaseDetailDrawer
        closePurchaseDetail={closePurchaseDetail}
        selectedPurchaseDetail={selectedPurchaseDetail}
      />

      <PurchaseOcrReceiptModal
        open={shopeeOcrDetailModal.open}
        rows={shopeeOcrDetailModal.rows}
        totalRow={shopeeOcrDetailModal.totalRow}
        rawText={shopeeOcrDetailModal.rawText}
        purchaseMeta={shopeeOcrDetailModal.purchaseMeta}
        onClose={closeShopeeOcrDetailModal}
      />

      <PurchaseFormModal
        formState={{
          form,
          isModalOpen,
          isSubmittingPurchase,
          itemType,
          itemId,
          supplierId,
          priceVerified: priceVerified === true,
          isOfflinePurchase,
          conversionValue,
        }}
        referenceData={{
          products,
          materials,
          materialVariantOptions,
          productVariantOptions,
          filteredSuppliers,
          selectedSupplierOffers,
        }}
        selectionState={{
          selectedMaterial,
          selectedProduct,
          selectedProductHasVariants,
          selectedPurchaseStockPreview,
          selectedCatalogOffer,
          selectedSupplierCatalogCost,
        }}
        ocrState={{ shopeeOcrState, shopeeOcrApplyFeedback }}
        actions={{
          onCancel: handleClosePurchaseModal,
          handleSubmitPurchase,
          onVerifyPrice: handleVerifyPurchasePrice,
          handleShopeeScreenshotUpload,
          applyShopeeOcrDraftToForm,
        }}
        refs={{ subtotalManualOverrideRef }}
      />
    </>
  );
};

export default Purchases;
