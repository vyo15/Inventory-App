import { describe, expect, it } from "vitest";
import {
  buildPurchaseFormDefaults,
  buildPurchaseItemSelectionFields,
  buildPurchaseVerificationSignature,
  calculatePurchaseCostSummary,
  shouldApplyPurchaseItemDefaults,
  resolvePurchaseCatalogOfferSelection,
  buildPurchaseCatalogOfferFields,
  canAutoApplySupplierSubtotal,
} from "./purchasesPageHelpers";

describe("purchasesPageHelpers", () => {
  it("membangun reset item produk tanpa dua branch identik", () => {
    expect(buildPurchaseItemSelectionFields({ itemType: "product" })).toEqual({
      productVariantKey: undefined,
      purchaseUnit: undefined,
      stockUnit: undefined,
      conversionValue: undefined,
      purchaseType: "online",
      totalStockIn: undefined,
      restockReferencePrice: 0,
    });
  });

  it("mempertahankan unit canonical bahan saat item ditemukan", () => {
    expect(buildPurchaseItemSelectionFields({
      itemType: "material",
      material: { defaultPurchaseUnit: "roll", stockUnit: "meter" },
    })).toMatchObject({
      purchaseUnit: "roll",
      stockUnit: "meter",
      purchaseType: "online",
      restockReferencePrice: 0,
    });
  });

  it("menghitung total aktual, modal, pembanding, dan selisih dalam satu snapshot", () => {
    expect(calculatePurchaseCostSummary({
      subtotalItems: 100_000,
      shippingCost: 10_000,
      shippingDiscount: 2_000,
      voucherDiscount: 3_000,
      serviceFee: 1_000,
      purchaseType: "online",
      totalStockIn: 20,
      quantity: 2,
      supplierItemPrice: 50_000,
      referenceShippingCost: 12_000,
      referenceServiceFee: 2_000,
      referenceDiscount: 1_000,
    })).toEqual({
      totalActualPurchase: 106_000,
      actualUnitCost: 5_300,
      totalReferencePurchase: 113_000,
      purchaseSaving: 7_000,
    });
  });

  it("mengabaikan biaya online untuk pembelian offline", () => {
    expect(calculatePurchaseCostSummary({
      subtotalItems: 80_000,
      shippingCost: 20_000,
      shippingDiscount: 1_000,
      voucherDiscount: 2_000,
      serviceFee: 3_000,
      purchaseType: "offline",
      totalStockIn: 8,
      quantity: 1,
      supplierItemPrice: 80_000,
    })).toMatchObject({
      totalActualPurchase: 80_000,
      actualUnitCost: 10_000,
      totalReferencePurchase: 80_000,
      purchaseSaving: 0,
    });
  });

  it("membuat signature verifikasi stabil dan defaults terisolasi", () => {
    expect(buildPurchaseVerificationSignature({
      catalogOfferId: "offer-1",
      quantity: 2.4,
      subtotalItems: 100_000.4,
    })).toBe("offer-1::2::100000");
    expect(buildPurchaseFormDefaults({ supplierId: "supplier-1" })).toMatchObject({
      type: "material",
      quantity: 1,
      supplierId: "supplier-1",
      priceVerified: false,
    });
  });
  it("menerapkan default item sekali per konteks dan menunggu material selesai dimuat", () => {
    expect(shouldApplyPurchaseItemDefaults({
      appliedContext: "",
      currentContext: "product::PRD-001",
      isItemContextChanged: true,
      itemType: "product",
    })).toBe(true);

    expect(shouldApplyPurchaseItemDefaults({
      appliedContext: "",
      currentContext: "material::RAW-001",
      isItemContextChanged: false,
      itemType: "material",
      material: { id: "RAW-001" },
    })).toBe(true);

    expect(shouldApplyPurchaseItemDefaults({
      appliedContext: "material::RAW-001",
      currentContext: "material::RAW-001",
      isItemContextChanged: false,
      itemType: "material",
      material: { id: "RAW-001" },
    })).toBe(false);
  });

  it("memilih offer aktif, prefill, atau satu-satunya offer secara deterministik", () => {
    const offers = [
      { id: "offer-1" },
      { catalogOfferId: "offer-2" },
    ];

    expect(resolvePurchaseCatalogOfferSelection({
      currentOfferId: "offer-2",
      offers,
      prefilledOfferId: "offer-1",
    })).toEqual({ nextOfferId: "offer-2", consumedPrefill: true });

    expect(resolvePurchaseCatalogOfferSelection({
      currentOfferId: "missing",
      offers,
      prefilledOfferId: "offer-1",
    })).toEqual({ nextOfferId: "offer-1", consumedPrefill: true });

    expect(resolvePurchaseCatalogOfferSelection({
      offers: [{ id: "only" }],
    })).toEqual({ nextOfferId: "only", consumedPrefill: false });
  });

  it("membangun snapshot offer tanpa mengubah authority commit", () => {
    expect(buildPurchaseCatalogOfferFields({
      offer: {
        purchaseType: "online",
        productLink: "https://example.test/item",
        purchaseUnit: "roll",
        stockUnit: "meter",
        conversionValue: 5,
      },
      metrics: {
        supplierItemPrice: 20_000,
        estimatedUnitPrice: 4_500,
        estimatedShippingCost: 10_000,
        serviceFee: 1_000,
        discount: 2_000,
      },
      quantity: 2,
      itemType: "material",
      fallbackStockUnit: "pcs",
    })).toEqual({
      supplierItemPrice: 20_000,
      subtotalItems: 40_000,
      fields: {
        productLink: "https://example.test/item",
        purchaseUnit: "roll",
        stockUnit: "meter",
        conversionValue: 5,
        restockReferencePrice: 4_500,
        purchaseType: "online",
        subtotalItems: 40_000,
        shippingCost: 10_000,
        shippingDiscount: 0,
        voucherDiscount: 2_000,
        serviceFee: 1_000,
        priceVerified: false,
        priceVerifiedAt: undefined,
        verifiedCatalogPrice: 0,
      },
    });
  });

  it("menjaga subtotal manual kecuali baseline lama atau nol", () => {
    expect(canAutoApplySupplierSubtotal({
      manualOverride: false,
      currentSubtotal: 50_000,
      previousBaselineSubtotal: 40_000,
    })).toBe(true);
    expect(canAutoApplySupplierSubtotal({
      manualOverride: true,
      currentSubtotal: 40_000,
      previousBaselineSubtotal: 40_000,
    })).toBe(true);
    expect(canAutoApplySupplierSubtotal({
      manualOverride: true,
      currentSubtotal: 55_000,
      previousBaselineSubtotal: 40_000,
    })).toBe(false);
  });

});
