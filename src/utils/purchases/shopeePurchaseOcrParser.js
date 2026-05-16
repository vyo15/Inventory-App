const SHOPEE_MARKER_PATTERNS = [
  /shopee/i,
  /subtotal\s+(?:produk|barang)/i,
  /subtotal\s+pengiriman/i,
  /voucher\s+shopee/i,
  /biaya\s+(?:layanan|penanganan)/i,
  /total\s+(?:pesanan|pembayaran)/i,
];

const normalizeOcrText = (text = '') =>
  String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[|]/g, ' ')
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/\u00a0/g, ' ');

const normalizeOcrLine = (line = '') =>
  String(line || '')
    .replace(/\s+/g, ' ')
    .trim();

const getOcrLines = (text = '') =>
  normalizeOcrText(text)
    .split('\n')
    .map(normalizeOcrLine)
    .filter(Boolean);

const parseMoneyValue = (value = '') => {
  const normalized = String(value || '')
    .replace(/[Oo]/g, '0')
    .replace(/[Il]/g, '1');
  const match = normalized.match(/-?\s*(?:Rp|RP|rp)?\s*([0-9][0-9.\s,]*)/);

  if (!match) return null;

  const numberText = match[1].replace(/[^0-9]/g, '');
  const parsed = Number(numberText || 0);
  return Number.isFinite(parsed) ? parsed : null;
};

const findMoneyNearLabel = (lines = [], labelPattern) => {
  const labelIndex = lines.findIndex((line) => labelPattern.test(line));
  if (labelIndex < 0) return null;

  const candidateLines = lines.slice(labelIndex, Math.min(labelIndex + 4, lines.length));
  for (const candidateLine of candidateLines) {
    const moneyMatches = candidateLine.match(/-?\s*(?:Rp|RP|rp)\s*[0-9][0-9.\s,]*/g) || [];
    if (moneyMatches.length) {
      const parsed = parseMoneyValue(moneyMatches[moneyMatches.length - 1]);
      if (parsed !== null) return parsed;
    }
  }

  return null;
};

// Voucher Shopee harus diambil dari baris ringkasan pembayaran.
// Jangan memakai label umum "Voucher" karena bagian Garansi Tiba juga berisi teks voucher.
const findShopeeVoucherDiscount = (lines = []) =>
  findMoneyNearLabel(lines, /voucher\s+(?:shopee\s+)?digunakan/i) ||
  findMoneyNearLabel(lines, /voucher\s*\/\s*potongan/i) ||
  findMoneyNearLabel(lines, /voucher\s+(?:toko|penjual|produk)/i) ||
  0;

const findFirstLine = (lines = [], pattern) => lines.find((line) => pattern.test(line)) || '';

const extractTrackingNumber = (text = '') => {
  const match = normalizeOcrText(text).match(/\b(?:SPX|JX|JNE|JNT|JT|SICEPAT|ID)[A-Z0-9]{8,}\b/i);
  return match ? match[0].toUpperCase() : '';
};

const extractEstimateText = (lines = []) => {
  const estimateLine = findFirstLine(lines, /estimasi\s+tiba/i);
  if (!estimateLine) return '';

  return estimateLine.replace(/.*estimasi\s+tiba\s*:?\s*/i, '').trim();
};

const extractStoreName = (lines = []) => {
  const ignoredPattern = /(rincian|pesanan|estimasi|garansi|info|pengiriman|alamat|subtotal|voucher|biaya|total|bantuan|lacak|selengkapnya|diproses|standard)/i;
  const storeCandidate = lines.find((line) => {
    if (ignoredPattern.test(line)) return false;
    if (/^rp\s*[0-9]/i.test(line)) return false;
    if (/\bx\s*\d+\b/i.test(line)) return false;
    return /[a-z0-9]+[_-][a-z0-9]+/i.test(line) || /^star\s+/i.test(line);
  });

  if (!storeCandidate) return '';

  return storeCandidate
    .replace(/^star\s*/i, '')
    .replace(/[>›].*$/, '')
    .trim();
};

const getProductSearchWindow = (lines = []) => {
  const subtotalLineIndex = lines.findIndex((line) => /subtotal\s+(?:produk|barang)/i.test(line));
  return subtotalLineIndex > 0 ? lines.slice(0, subtotalLineIndex) : lines;
};

const extractQuantityMarkers = (lines = []) => {
  // Guard multi-item: hanya baca area item sebelum subtotal agar qty dari ongkir/resi tidak ikut terhitung.
  const hardIgnoredPattern = /(estimasi|garansi|info\s+pengiriman|alamat|subtotal\s+(?:produk|barang)|subtotal\s+pengiriman|subtotal\s+diskon|diskon\s+pengiriman|voucher|biaya\s+(?:layanan|penanganan)|total\s+(?:pesanan|pembayaran)|resi|standard|spxid)/i;
  return getProductSearchWindow(lines)
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line && !hardIgnoredPattern.test(line))
    .map(({ line, index }) => {
      const qtyMatch = line.match(/(?:^|\s|[^A-Za-z0-9])(?:x|×)\s*(\d{1,4})(?=$|\s|[^A-Za-z0-9]|rp)/i);
      if (!qtyMatch) return null;

      const parsed = Number(qtyMatch[1]);
      if (!Number.isFinite(parsed) || parsed <= 0) return null;

      return { quantity: parsed, line, index };
    })
    .filter(Boolean);
};

const extractQuantity = (lines = []) => {
  const firstMarker = extractQuantityMarkers(lines)[0];
  return firstMarker?.quantity || null;
};

const extractUnitPriceBeforeSubtotal = (lines = []) => {
  const searchWindow = getProductSearchWindow(lines);
  const ignoredPattern = /(estimasi|garansi|info\s+pengiriman|alamat|subtotal|pengiriman|voucher|biaya|total|standard|spxid|lacak|bantuan|pesanan\s+selesai)/i;

  for (const line of [...searchWindow].reverse()) {
    if (!line || ignoredPattern.test(line)) continue;

    const moneyMatches = line.match(/(?:Rp|RP|rp)\s*[0-9][0-9.\s,]*/g) || [];
    if (!moneyMatches.length) continue;

    const parsed = parseMoneyValue(moneyMatches[moneyMatches.length - 1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return null;
};

const deriveQuantityFromSubtotalAndUnitPrice = ({ subtotalItems = 0, unitPrice = 0 } = {}) => {
  const safeSubtotal = Number(subtotalItems || 0);
  const safeUnitPrice = Number(unitPrice || 0);

  if (!Number.isFinite(safeSubtotal) || !Number.isFinite(safeUnitPrice)) return null;
  if (safeSubtotal <= 0 || safeUnitPrice <= 0) return null;

  const rawQuantity = safeSubtotal / safeUnitPrice;
  const roundedQuantity = Math.round(rawQuantity);

  if (roundedQuantity <= 0 || roundedQuantity > 999) return null;

  // Toleransi kecil untuk OCR tanda ribuan yang kadang kurang bersih.
  // Contoh screenshot: harga satuan Rp40.000, subtotal Rp120.000 => qty 3.
  const expectedSubtotal = roundedQuantity * safeUnitPrice;
  const tolerance = Math.max(1000, Math.round(safeSubtotal * 0.01));

  return Math.abs(expectedSubtotal - safeSubtotal) <= tolerance ? roundedQuantity : null;
};

const extractVariantName = (lines = []) => {
  const qtyLineIndex = lines.findIndex((line) => /\bx\s*\d+\b/i.test(line));
  if (qtyLineIndex <= 0) return '';

  const candidate = lines[qtyLineIndex - 1];
  if (!candidate || /rp\s*[0-9]/i.test(candidate) || /subtotal|voucher|biaya|total/i.test(candidate)) return '';

  return candidate.trim();
};

const extractProductName = (lines = []) => {
  const qtyLineIndex = lines.findIndex((line) => /\bx\s*\d+\b/i.test(line));
  const searchWindow = qtyLineIndex > 0 ? lines.slice(Math.max(qtyLineIndex - 5, 0), qtyLineIndex + 1) : lines;
  const ignoredPattern = /(subtotal|voucher|biaya|total|estimasi|garansi|pengiriman|alamat|standard|lacak|bantuan|star)/i;

  const candidate = [...searchWindow]
    .reverse()
    .find((line) => {
      if (!line || ignoredPattern.test(line)) return false;
      if (/^rp\s*[0-9]/i.test(line)) return false;
      if (/\bx\s*\d+\b/i.test(line)) return false;
      return line.length >= 8;
    });

  return candidate || '';
};

const detectShopeeMultiItemRisk = (lines = []) => {
  const reasons = [];
  const quantityMarkers = extractQuantityMarkers(lines);
  const normalizedText = lines.join('\n');

  const explicitProductCountLine = lines.find((line) =>
    /(?:subtotal\s+(?:produk|barang)|total\s+produk|barang)\s*\(?\s*(\d{1,3})\s*(?:produk|barang|item)?\s*\)?/i.test(line),
  );
  const explicitProductCount = explicitProductCountLine?.match(/(\d{1,3})/)?.[1];

  if (Number(explicitProductCount || 0) > 1) {
    reasons.push(`Ringkasan Shopee menunjukkan ${explicitProductCount} produk/barang.`);
  }

  if (quantityMarkers.length > 1) {
    reasons.push(`Terdeteksi ${quantityMarkers.length} baris Qty produk sebelum subtotal.`);
  }

  if (/\+\s*\d+\s*(?:produk|barang|item)\s*(?:lainnya|lain)/i.test(normalizedText)) {
    reasons.push('Ada indikasi item lain pada screenshot Shopee.');
  }

  return {
    isMultiItemLikely: reasons.length > 0,
    multiItemReasons: reasons,
    detectedProductLineCount: quantityMarkers.length,
  };
};

const formatNoteMoney = (value = 0) => `Rp${Number(value || 0).toLocaleString('id-ID')}`;

const buildShopeeOcrNote = (draft = {}) => {
  const noteParts = ['OCR Shopee'];

  if (draft.subtotalItems > 0) noteParts.push(`- Subtotal barang: ${formatNoteMoney(draft.subtotalItems)}`);
  if (draft.shippingCost > 0) noteParts.push(`- Ongkir pengiriman: ${formatNoteMoney(draft.shippingCost)}`);
  if (draft.shippingDiscount > 0) noteParts.push(`- Diskon ongkir: -${formatNoteMoney(draft.shippingDiscount)}`);
  if (draft.voucherDiscount > 0) noteParts.push(`- Voucher / potongan: -${formatNoteMoney(draft.voucherDiscount)}`);
  if (draft.serviceFee > 0) noteParts.push(`- Biaya layanan marketplace: ${formatNoteMoney(draft.serviceFee)}`);
  if (draft.quantity > 0) noteParts.push(`- Qty beli: ${draft.quantity}`);
  if (draft.totalOrder > 0) noteParts.push(`- Total pesanan: ${formatNoteMoney(draft.totalOrder)}`);

  return noteParts.join('\n');
};

const buildReviewMeta = ({ hasUsefulValues, isLikelyShopee, totalOrder, totalMatches, totalDifference, multiItemRisk }) => {
  if (multiItemRisk.isMultiItemLikely) {
    return {
      reviewSeverity: 'error',
      reviewStatusLabel: 'Tidak disarankan otomatis',
      reviewMessage: 'Screenshot terlihat berisi lebih dari 1 item. Input manual atau pecah pembelian per item agar modal, stok, expense, dan HPP tidak tercampur.',
      reviewReasons: multiItemRisk.multiItemReasons,
      autoApplyBlocked: true,
      needsManualReview: true,
    };
  }

  if (!hasUsefulValues) {
    return {
      reviewSeverity: 'warning',
      reviewStatusLabel: 'Perlu dicek manual',
      reviewMessage: 'Angka utama belum terbaca jelas. Isi manual atau coba screenshot yang lebih tajam.',
      reviewReasons: ['Tidak ada angka Qty atau biaya yang cukup aman untuk diterapkan.'],
      autoApplyBlocked: false,
      needsManualReview: true,
    };
  }

  if (!isLikelyShopee) {
    return {
      reviewSeverity: 'warning',
      reviewStatusLabel: 'Perlu dicek manual',
      reviewMessage: 'Format screenshot belum terlihat seperti rincian pesanan Shopee. Cek ulang sebelum diterapkan.',
      reviewReasons: ['Marker Shopee atau label ringkasan pesanan belum kuat terdeteksi.'],
      autoApplyBlocked: false,
      needsManualReview: true,
    };
  }

  if (totalOrder <= 0) {
    return {
      reviewSeverity: 'warning',
      reviewStatusLabel: 'Perlu dicek manual',
      reviewMessage: 'Total pesanan belum terbaca. Cek ulang biaya sebelum diterapkan ke form.',
      reviewReasons: ['Total pesanan dipakai sebagai pembanding akhir OCR.'],
      autoApplyBlocked: false,
      needsManualReview: true,
    };
  }

  if (!totalMatches) {
    return {
      reviewSeverity: 'warning',
      reviewStatusLabel: 'Perlu dicek manual',
      reviewMessage: `Total OCR belum cocok dengan hasil hitung sistem. Selisih terbaca ${formatNoteMoney(Math.abs(totalDifference))}.`,
      reviewReasons: ['Periksa ulang subtotal, ongkir, diskon, voucher, biaya layanan, dan total sebelum diterapkan.'],
      autoApplyBlocked: false,
      needsManualReview: true,
    };
  }

  return {
    reviewSeverity: 'success',
    reviewStatusLabel: 'Aman diterapkan',
    reviewMessage: 'Screenshot terdeteksi sebagai 1 transaksi Shopee dan total biaya cocok.',
    reviewReasons: [],
    autoApplyBlocked: false,
    needsManualReview: false,
  };
};

export const parseShopeePurchaseOcrText = (rawText = '') => {
  const normalizedText = normalizeOcrText(rawText);
  const lines = getOcrLines(normalizedText);

  const subtotalItems = findMoneyNearLabel(lines, /subtotal\s+(?:produk|barang)/i) || 0;
  const shippingCost = findMoneyNearLabel(lines, /subtotal\s+pengiriman/i) || 0;
  const shippingDiscount =
    findMoneyNearLabel(lines, /subtotal\s+diskon\s+pengiriman/i) ||
    findMoneyNearLabel(lines, /diskon\s+pengiriman/i) ||
    findMoneyNearLabel(lines, /gratis\s+ongkir/i) ||
    0;
  const voucherDiscount = findShopeeVoucherDiscount(lines);
  const serviceFee = findMoneyNearLabel(lines, /biaya\s+(?:layanan|penanganan)/i) || 0;
  const totalOrder = findMoneyNearLabel(lines, /total\s+(?:pesanan|pembayaran)/i) || 0;
  const calculatedTotal = Math.round(subtotalItems + shippingCost - shippingDiscount - voucherDiscount + serviceFee);
  const totalDifference = Math.round(calculatedTotal - totalOrder);
  const totalMatches = totalOrder > 0 ? Math.abs(totalDifference) <= 1000 : false;
  const explicitQuantity = extractQuantity(lines);
  const unitPrice = extractUnitPriceBeforeSubtotal(lines);
  const derivedQuantity = deriveQuantityFromSubtotalAndUnitPrice({ subtotalItems, unitPrice });
  const multiItemRisk = detectShopeeMultiItemRisk(lines);
  const isLikelyShopee = SHOPEE_MARKER_PATTERNS.some((pattern) => pattern.test(normalizedText));

  const draft = {
    quantity: explicitQuantity || derivedQuantity,
    subtotalItems,
    shippingCost,
    shippingDiscount,
    voucherDiscount,
    serviceFee,
    totalOrder,
    calculatedTotal,
    totalDifference,
    totalMatches,
    storeName: extractStoreName(lines),
    productName: extractProductName(lines),
    variantName: extractVariantName(lines),
    trackingNumber: extractTrackingNumber(normalizedText),
    estimatedArrival: extractEstimateText(lines),
    isLikelyShopee,
    ...multiItemRisk,
  };

  const hasUsefulValues = Boolean(
    draft.quantity ||
      draft.subtotalItems ||
      draft.shippingCost ||
      draft.shippingDiscount ||
      draft.voucherDiscount ||
      draft.serviceFee ||
      draft.totalOrder,
  );

  const reviewMeta = buildReviewMeta({
    hasUsefulValues,
    isLikelyShopee,
    totalOrder,
    totalMatches,
    totalDifference,
    multiItemRisk,
  });

  return {
    ...draft,
    ...reviewMeta,
    note: buildShopeeOcrNote(draft),
    hasUsefulValues,
  };
};
