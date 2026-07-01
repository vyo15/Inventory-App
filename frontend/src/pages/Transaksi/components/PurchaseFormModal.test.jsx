import { describe, expect, it, vi } from "vitest";
import PurchaseFormModal from "./PurchaseFormModal";

const createProps = ({ priceVerified = false } = {}) => {
  const onCancel = vi.fn();
  const form = { submit: vi.fn() };

  return {
    onCancel,
    props: {
      formState: {
        form,
        isModalOpen: true,
        isSubmittingPurchase: false,
        itemType: "material",
        itemId: undefined,
        supplierId: undefined,
        priceVerified,
        isOfflinePurchase: false,
        conversionValue: 1,
      },
      referenceData: {
        products: [],
        materials: [],
        materialVariantOptions: [],
        productVariantOptions: [],
        filteredSuppliers: [],
        selectedSupplierOffers: [],
      },
      selectionState: {
        selectedMaterial: null,
        selectedProduct: null,
        selectedProductHasVariants: false,
        selectedPurchaseStockPreview: null,
        selectedCatalogOffer: null,
        selectedSupplierCatalogCost: 0,
      },
      ocrState: {
        shopeeOcrState: {},
        shopeeOcrApplyFeedback: null,
      },
      actions: {
        onCancel,
        handleSubmitPurchase: vi.fn(),
        onVerifyPrice: vi.fn(),
        handleShopeeScreenshotUpload: vi.fn(),
        applyShopeeOcrDraftToForm: vi.fn(),
      },
      refs: { subtotalManualOverrideRef: { current: false } },
    },
  };
};

describe("PurchaseFormModal", () => {
  it("mengunci submit sampai harga pembelian diverifikasi", () => {
    const locked = PurchaseFormModal(createProps().props);
    const unlocked = PurchaseFormModal(createProps({ priceVerified: true }).props);

    expect(locked.props.okButtonProps.disabled).toBe(true);
    expect(unlocked.props.okButtonProps.disabled).toBe(false);
  });

  it("meneruskan aksi tutup resmi dari parent", () => {
    const { props, onCancel } = createProps();
    const modal = PurchaseFormModal(props);

    modal.props.onCancel();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
