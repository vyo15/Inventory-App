const SHOPEE_MARKER_PATTERNS = [
  /shopee/i,
  /subtotal\s+produk/i,
  /subtotal\s+pengiriman/i,
  /voucher\s+shopee/i,
  /biaya\s+layanan/i,
  /total\s+pesanan/i,
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

const extractQuantity = (lines = []) => {
  // Shopee biasanya menampilkan qty produk sebagai `x3` di baris produk yang sama
  // dengan harga satuan. Karena itu baris yang mengandung `Rp...` tetap harus
  // boleh dicek, selama bukan baris ringkasan biaya/pengiriman.
  const hardIgnoredPattern = /(estimasi|garansi|info\s+pengiriman|alamat|subtotal\s+produk|subtotal\s+pengiriman|subtotal\s+diskon|voucher|biaya\s+layanan|total\s+pesanan|resi|standard|spxid)/i;
  const subtotalLineIndex = lines.findIndex((line) => /subtotal\s+produk/i.test(line));
  const searchWindow = subtotalLineIndex > 0 ? lines.slice(0, subtotalLineIndex) : lines;

  for (const line of searchWindow) {
    if (!line || hardIgnoredPattern.test(line)) continue;

    const qtyMatch = line.match(/(?:^|\s|[^A-Za-z0-9])(?:x|×)\s*(\d{1,4})(?=$|\s|[^A-Za-z0-9]|rp)/i);
    if (!qtyMatch) continue;

    const parsed = Number(qtyMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return null;
};

const extractUnitPriceBeforeSubtotal = (lines = []) => {
  const subtotalLineIndex = lines.findIndex((line) => /subtotal\s+produk/i.test(line));
  const searchWindow = subtotalLineIndex > 0 ? lines.slice(0, subtotalLineIndex) : lines;
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

export const parseShopeePurchaseOcrText = (rawText = '') => {
  const normalizedText = normalizeOcrText(rawText);
  const lines = getOcrLines(normalizedText);

  const subtotalItems = findMoneyNearLabel(lines, /subtotal\s+produk/i) || 0;
  const shippingCost = findMoneyNearLabel(lines, /subtotal\s+pengiriman/i) || 0;
  const shippingDiscount = findMoneyNearLabel(lines, /subtotal\s+diskon\s+pengiriman/i) || 0;
  const voucherDiscount = findShopeeVoucherDiscount(lines);
  const serviceFee = findMoneyNearLabel(lines, /biaya\s+layanan/i) || 0;
  const totalOrder = findMoneyNearLabel(lines, /total\s+pesanan/i) || 0;
  const calculatedTotal = Math.round(subtotalItems + shippingCost - shippingDiscount - voucherDiscount + serviceFee);
  const totalMatches = totalOrder > 0 ? Math.abs(calculatedTotal - totalOrder) <= 1000 : false;
  const explicitQuantity = extractQuantity(lines);
  const unitPrice = extractUnitPriceBeforeSubtotal(lines);
  const derivedQuantity = deriveQuantityFromSubtotalAndUnitPrice({ subtotalItems, unitPrice });

  const draft = {
    quantity: explicitQuantity || derivedQuantity,
    subtotalItems,
    shippingCost,
    shippingDiscount,
    voucherDiscount,
    serviceFee,
    totalOrder,
    calculatedTotal,
    totalMatches,
    storeName: extractStoreName(lines),
    productName: extractProductName(lines),
    variantName: extractVariantName(lines),
    trackingNumber: extractTrackingNumber(normalizedText),
    estimatedArrival: extractEstimateText(lines),
    isLikelyShopee: SHOPEE_MARKER_PATTERNS.some((pattern) => pattern.test(normalizedText)),
  };

  return {
    ...draft,
    note: buildShopeeOcrNote(draft),
    hasUsefulValues: Boolean(
      draft.quantity ||
        draft.subtotalItems ||
        draft.shippingCost ||
        draft.shippingDiscount ||
        draft.voucherDiscount ||
        draft.serviceFee ||
        draft.totalOrder,
    ),
  };
};
