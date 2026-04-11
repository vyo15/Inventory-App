// src/utils/pricingService.js

// SECTION: import firestore helper
import { collection, doc, Timestamp, writeBatch } from "firebase/firestore";

// SECTION: import koneksi firebase
import { db } from "../../firebase";

// SECTION: helper ubah value ke number aman
const toNumber = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

// SECTION: helper pembulatan ke integer karena project pakai angka tanpa .00
const toInteger = (value) => {
  return Math.round(toNumber(value));
};

// SECTION: helper batasi nilai minimal 0
const clampMinZero = (value) => {
  return Math.max(0, toNumber(value));
};

// SECTION: normalisasi rule agar service aman walau field ada yang kosong
export const normalizePricingRule = (rule = {}) => {
  return {
    id: rule?.id || null,
    name: rule?.name || "",
    targetType: rule?.targetType || "raw_materials",
    isActive: rule?.isActive !== false,

    // base cost source final yang disepakati
    baseCostSource:
      rule?.baseCostSource ||
      (rule?.targetType === "products"
        ? "hppPerUnit"
        : "averageActualUnitCost"),

    marginType: rule?.marginType || "percent",
    marginValue: clampMinZero(rule?.marginValue),

    includeMarketplaceBuffer: !!rule?.includeMarketplaceBuffer,
    marketplaceBufferType: rule?.marketplaceBufferType || "percent",
    marketplaceBufferValue: clampMinZero(rule?.marketplaceBufferValue),

    roundingType: rule?.roundingType || "up",
    roundingUnit: toInteger(rule?.roundingUnit || 100),

    updatedAt: rule?.updatedAt || null,
  };
};

// SECTION: ambil harga aktif item saat ini
export const getCurrentPriceFromItem = (item = {}, targetType = "") => {
  if (targetType === "raw_materials") {
    return toInteger(item?.sellingPrice);
  }

  if (targetType === "products") {
    return toInteger(item?.price);
  }

  return 0;
};

// SECTION: ambil base cost item sesuai target dan source final yang disepakati
export const getBaseCostForItem = (item = {}, rule = {}) => {
  const normalizedRule = normalizePricingRule(rule);

  // SECTION: raw materials pakai averageActualUnitCost sebagai utama
  if (normalizedRule.targetType === "raw_materials") {
    if (normalizedRule.baseCostSource === "averageActualUnitCost") {
      return toInteger(
        item?.averageActualUnitCost || item?.restockReferencePrice || 0,
      );
    }

    if (normalizedRule.baseCostSource === "restockReferencePrice") {
      return toInteger(item?.restockReferencePrice || 0);
    }

    // fallback aman
    return toInteger(
      item?.averageActualUnitCost || item?.restockReferencePrice || 0,
    );
  }

  // SECTION: products pakai hppPerUnit sebagai utama
  if (normalizedRule.targetType === "products") {
    if (normalizedRule.baseCostSource === "hppPerUnit") {
      return toInteger(item?.hppPerUnit || 0);
    }

    // fallback aman
    return toInteger(item?.hppPerUnit || 0);
  }

  return 0;
};

// SECTION: hitung nominal margin
export const calculateMarginAmount = (baseCost = 0, rule = {}) => {
  const normalizedRule = normalizePricingRule(rule);

  if (normalizedRule.marginType === "nominal") {
    return toInteger(normalizedRule.marginValue);
  }

  return toInteger(
    (toNumber(baseCost) * toNumber(normalizedRule.marginValue)) / 100,
  );
};

// SECTION: hitung buffer marketplace
// NOTE:
// - nominal => langsung ditambah
// - percent => target harga akhir harus cukup menutup fee persen
//   rumus: final = baseSellingPrice / (1 - feePercent)
export const calculateMarketplaceBuffer = (baseSellingPrice = 0, rule = {}) => {
  const normalizedRule = normalizePricingRule(rule);

  // SECTION: jika buffer marketplace tidak dipakai
  if (!normalizedRule.includeMarketplaceBuffer) {
    return {
      status: "ready",
      marketplaceBufferAmount: 0,
      finalBeforeRounding: toInteger(baseSellingPrice),
    };
  }

  // SECTION: jika buffer nominal
  if (normalizedRule.marketplaceBufferType === "nominal") {
    const marketplaceBufferAmount = toInteger(
      normalizedRule.marketplaceBufferValue,
    );

    return {
      status: "ready",
      marketplaceBufferAmount,
      finalBeforeRounding: toInteger(
        toNumber(baseSellingPrice) + marketplaceBufferAmount,
      ),
    };
  }

  // SECTION: jika buffer persen
  const percent = toNumber(normalizedRule.marketplaceBufferValue);

  // NOTE:
  // percent 100 atau lebih tidak valid karena membuat pembagi nol/negatif
  if (percent < 0 || percent >= 100) {
    return {
      status: "invalid_marketplace_buffer",
      marketplaceBufferAmount: 0,
      finalBeforeRounding: toInteger(baseSellingPrice),
    };
  }

  const finalBeforeRounding = toNumber(baseSellingPrice) / (1 - percent / 100);

  const marketplaceBufferAmount =
    finalBeforeRounding - toNumber(baseSellingPrice);

  return {
    status: "ready",
    marketplaceBufferAmount: toInteger(marketplaceBufferAmount),
    finalBeforeRounding: toInteger(finalBeforeRounding),
  };
};

// SECTION: pembulatan harga akhir
export const applyRounding = (
  value = 0,
  roundingType = "up",
  roundingUnit = 100,
) => {
  const numericValue = toNumber(value);
  const unit = toInteger(roundingUnit || 100);

  // SECTION: jika unit tidak valid, fallback ke integer biasa
  if (unit <= 0) {
    return toInteger(numericValue);
  }

  // SECTION: pembulatan ke bawah
  if (roundingType === "down") {
    return Math.floor(numericValue / unit) * unit;
  }

  // SECTION: pembulatan terdekat
  if (roundingType === "nearest") {
    return Math.round(numericValue / unit) * unit;
  }

  // SECTION: default pembulatan ke atas
  return Math.ceil(numericValue / unit) * unit;
};

// SECTION: hitung harga final satu item
export const calculateFinalSellingPrice = (item = {}, rule = {}) => {
  const normalizedRule = normalizePricingRule(rule);

  // SECTION: rule tidak aktif
  if (!normalizedRule.isActive) {
    return {
      status: "inactive_rule",
      baseCost: 0,
      marginAmount: 0,
      baseSellingPrice: 0,
      marketplaceBufferAmount: 0,
      finalBeforeRounding: 0,
      finalRoundedPrice: 0,
    };
  }

  // SECTION: ambil base cost
  const baseCost = getBaseCostForItem(item, normalizedRule);

  // SECTION: base cost kosong / tidak valid
  if (baseCost <= 0) {
    return {
      status: "invalid_base_cost",
      baseCost: 0,
      marginAmount: 0,
      baseSellingPrice: 0,
      marketplaceBufferAmount: 0,
      finalBeforeRounding: 0,
      finalRoundedPrice: 0,
    };
  }

  // SECTION: hitung margin
  const marginAmount = calculateMarginAmount(baseCost, normalizedRule);

  // SECTION: harga sebelum buffer marketplace
  const baseSellingPrice = toInteger(
    toNumber(baseCost) + toNumber(marginAmount),
  );

  // SECTION: hitung buffer marketplace
  const marketplaceBufferResult = calculateMarketplaceBuffer(
    baseSellingPrice,
    normalizedRule,
  );

  // SECTION: kalau buffer invalid
  if (marketplaceBufferResult.status === "invalid_marketplace_buffer") {
    return {
      status: "invalid_marketplace_buffer",
      baseCost,
      marginAmount,
      baseSellingPrice,
      marketplaceBufferAmount: 0,
      finalBeforeRounding: baseSellingPrice,
      finalRoundedPrice: applyRounding(
        baseSellingPrice,
        normalizedRule.roundingType,
        normalizedRule.roundingUnit,
      ),
    };
  }

  // SECTION: pembulatan final
  const finalRoundedPrice = applyRounding(
    marketplaceBufferResult.finalBeforeRounding,
    normalizedRule.roundingType,
    normalizedRule.roundingUnit,
  );

  return {
    status: "ready",
    baseCost,
    marginAmount,
    baseSellingPrice,
    marketplaceBufferAmount: toInteger(
      marketplaceBufferResult.marketplaceBufferAmount,
    ),
    finalBeforeRounding: toInteger(marketplaceBufferResult.finalBeforeRounding),
    finalRoundedPrice: toInteger(finalRoundedPrice),
  };
};

// SECTION: bangun 1 baris preview item
export const buildSinglePricingPreview = (item = {}, rule = {}) => {
  const normalizedRule = normalizePricingRule(rule);
  const pricingMode = item?.pricingMode || "rule";
  const currentPrice = getCurrentPriceFromItem(item, normalizedRule.targetType);

  // SECTION: item manual dilewati
  if (pricingMode === "manual") {
    return {
      itemId: item?.id || "",
      itemName: item?.name || "-",
      targetType: normalizedRule.targetType,
      pricingMode,
      currentPrice,
      baseCost: 0,
      marginAmount: 0,
      baseSellingPrice: 0,
      marketplaceBufferAmount: 0,
      finalBeforeRounding: 0,
      roundedPrice: currentPrice,
      status: "skipped_manual",
      willUpdate: false,
    };
  }

  // SECTION: hitung rule
  const result = calculateFinalSellingPrice(item, normalizedRule);

  return {
    itemId: item?.id || "",
    itemName: item?.name || "-",
    targetType: normalizedRule.targetType,
    pricingMode,
    currentPrice,
    baseCost: result.baseCost,
    marginAmount: result.marginAmount,
    baseSellingPrice: result.baseSellingPrice,
    marketplaceBufferAmount: result.marketplaceBufferAmount,
    finalBeforeRounding: result.finalBeforeRounding,
    roundedPrice: result.finalRoundedPrice,
    status: result.status,
    willUpdate:
      result.status === "ready" &&
      toInteger(currentPrice) !== toInteger(result.finalRoundedPrice),
  };
};

// SECTION: bangun preview semua item
export const buildPricingPreview = (items = [], rule = {}) => {
  return (items || []).map((item) => buildSinglePricingPreview(item, rule));
};

// SECTION: bangun ringkasan preview
export const buildPricingPreviewSummary = (previewData = []) => {
  return (previewData || []).reduce(
    (acc, item) => {
      acc.totalItems += 1;

      if (item?.status === "ready") {
        acc.readyCount += 1;
      }

      if (item?.status === "skipped_manual") {
        acc.skippedManualCount += 1;
      }

      if (item?.status === "invalid_base_cost") {
        acc.invalidBaseCostCount += 1;
      }

      if (item?.status === "invalid_marketplace_buffer") {
        acc.invalidMarketplaceBufferCount += 1;
      }

      if (item?.willUpdate) {
        acc.willUpdateCount += 1;
      } else {
        acc.unchangedCount += 1;
      }

      return acc;
    },
    {
      totalItems: 0,
      readyCount: 0,
      skippedManualCount: 0,
      invalidBaseCostCount: 0,
      invalidMarketplaceBufferCount: 0,
      willUpdateCount: 0,
      unchangedCount: 0,
    },
  );
};

// SECTION: buat payload update item sesuai target
export const createPricingUpdatePayload = ({
  targetType = "",
  originalItem = {},
  newPrice = 0,
  rule = {},
}) => {
  const normalizedRule = normalizePricingRule(rule);

  if (targetType === "raw_materials") {
    return {
      sellingPrice: toInteger(newPrice),
      pricingMode: originalItem?.pricingMode || "rule",
      pricingRuleId: normalizedRule.id || null,
      lastPricingUpdatedAt: Timestamp.now(),
    };
  }

  if (targetType === "products") {
    return {
      price: toInteger(newPrice),
      pricingMode: originalItem?.pricingMode || "rule",
      pricingRuleId: normalizedRule.id || null,
      lastPricingUpdatedAt: Timestamp.now(),
    };
  }

  return {};
};

// SECTION: buat payload log pricing sesuai field final yang disepakati
export const createPricingLogPayload = ({
  item = {},
  targetType = "",
  oldPrice = 0,
  newPrice = 0,
  pricingMode = "rule",
  rule = {},
  baseCost = 0,
  changeSource = "pricing_rule_apply",
  notes = "",
}) => {
  const normalizedRule = normalizePricingRule(rule);

  return {
    itemId: item?.id || "",
    itemType: targetType,
    itemName: item?.name || "",
    oldPrice: toInteger(oldPrice),
    newPrice: toInteger(newPrice),

    pricingMode,
    pricingRuleId: normalizedRule.id || null,
    pricingRuleName: normalizedRule.name || "",

    baseCost: toInteger(baseCost),

    marginType: normalizedRule.marginType,
    marginValue: toInteger(normalizedRule.marginValue),

    includeMarketplaceBuffer: !!normalizedRule.includeMarketplaceBuffer,
    marketplaceBufferType: normalizedRule.marketplaceBufferType,
    marketplaceBufferValue: toInteger(normalizedRule.marketplaceBufferValue),

    roundingType: normalizedRule.roundingType,
    roundingUnit: toInteger(normalizedRule.roundingUnit),

    changeSource: changeSource || "pricing_rule_apply",
    notes: notes || "",
    createdAt: Timestamp.now(),
  };
};

// SECTION: apply pricing rule ke semua item target
export const applyPricingRuleToItems = async ({
  items = [],
  rule = {},
  targetType = "",
  changeSource = "pricing_rule_apply",
  notes = "",
}) => {
  const normalizedRule = normalizePricingRule(rule);

  // SECTION: validasi awal
  if (!normalizedRule?.id) {
    throw new Error("Pricing rule tidak valid karena id rule kosong.");
  }

  if (!targetType) {
    throw new Error("Target type pricing belum ditentukan.");
  }

  // SECTION: buat preview dulu supaya hasil apply konsisten
  const previewData = buildPricingPreview(items, normalizedRule);

  // SECTION: batch firestore
  const batch = writeBatch(db);

  // SECTION: summary hasil apply
  let updatedCount = 0;
  let skippedManualCount = 0;
  let invalidBaseCostCount = 0;
  let invalidMarketplaceBufferCount = 0;
  let unchangedCount = 0;

  // SECTION: loop semua item preview
  previewData.forEach((previewItem) => {
    const originalItem = (items || []).find(
      (item) => item?.id === previewItem?.itemId,
    );

    if (!originalItem) {
      return;
    }

    // SECTION: mode manual dilewati
    if (previewItem.status === "skipped_manual") {
      skippedManualCount += 1;
      return;
    }

    // SECTION: base cost invalid dilewati
    if (previewItem.status === "invalid_base_cost") {
      invalidBaseCostCount += 1;
      return;
    }

    // SECTION: buffer invalid dilewati
    if (previewItem.status === "invalid_marketplace_buffer") {
      invalidMarketplaceBufferCount += 1;
      return;
    }

    const oldPrice = toInteger(previewItem.currentPrice);
    const newPrice = toInteger(previewItem.roundedPrice);

    // SECTION: jika harga tidak berubah tidak perlu update
    if (oldPrice === newPrice) {
      unchangedCount += 1;
      return;
    }

    // SECTION: update dokumen item
    const itemRef = doc(db, targetType, previewItem.itemId);
    const itemPayload = createPricingUpdatePayload({
      targetType,
      originalItem,
      newPrice,
      rule: normalizedRule,
    });

    batch.update(itemRef, itemPayload);

    // SECTION: simpan log perubahan harga
    const logRef = doc(collection(db, "pricing_logs"));
    const logPayload = createPricingLogPayload({
      item: originalItem,
      targetType,
      oldPrice,
      newPrice,
      pricingMode: originalItem?.pricingMode || "rule",
      rule: normalizedRule,
      baseCost: previewItem.baseCost,
      changeSource,
      notes,
    });

    batch.set(logRef, logPayload);

    updatedCount += 1;
  });

  // SECTION: commit semua perubahan
  await batch.commit();

  // SECTION: kembalikan preview + summary
  return {
    previewData,
    summary: {
      totalItems: previewData.length,
      updatedCount,
      skippedManualCount,
      invalidBaseCostCount,
      invalidMarketplaceBufferCount,
      unchangedCount,
    },
  };
};
