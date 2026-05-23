import { formatCurrencyId as formatCurrencyIdr } from "../../../utils/formatters/currencyId";

// IMS NOTE [AKTIF/GUARDED] - Konstanta UI OCR Shopee Purchases
// Fungsi blok: menyatukan state awal, warna review, dan format uang OCR agar Purchases.jsx tidak membawa detail UI draft OCR.
// Hubungan flow: UI-only; parser OCR, payload pembelian, stok, expense, inventory log, dan service transaksi tidak diubah.
export const SHOPEE_OCR_IDLE_STATE = Object.freeze({
  status: "idle",
  progress: 0,
  fileName: "",
  parsed: null,
  error: "",
});

export const SHOPEE_OCR_REVIEW_ALERT_TYPE = Object.freeze({
  success: "success",
  warning: "warning",
  error: "error",
});

export const SHOPEE_OCR_REVIEW_TAG_COLOR = Object.freeze({
  success: "green",
  warning: "orange",
  error: "red",
});

export const formatShopeeOcrMoney = (value = 0) => formatCurrencyIdr(Number(value || 0));
