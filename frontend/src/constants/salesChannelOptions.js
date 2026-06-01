// IMS NOTE [AKTIF] - Single source of truth channel penjualan.
// Fungsi file: menyatukan opsi Sales, ringkasan channel, dan marketplace report agar label/urutan tidak dobel di page.
// Hubungan flow: hanya helper read/display; schema salesChannel, stok keluar, income timing, dan report source tidak berubah.
// Catatan: `Belum Dikategorikan` hanya fallback audit untuk data lama/unknown, bukan opsi input user baru.

export const SALES_CHANNEL_UNCATEGORIZED_KEY = "__uncategorized__";
export const SALES_CHANNEL_UNCATEGORIZED_LABEL = "Belum Dikategorikan";

export const SALES_CHANNEL_OPTIONS = [
  { value: "Offline", label: "Offline", groupLabel: "Toko" },
  { value: "Shopee", label: "Shopee", groupLabel: "Marketplace", marketplace: true },
  { value: "Tokopedia", label: "Tokopedia", groupLabel: "Marketplace", marketplace: true },
  { value: "TikTok Shop", label: "TikTok Shop", groupLabel: "Marketplace", marketplace: true },
  { value: "Lazada", label: "Lazada", groupLabel: "Marketplace", marketplace: true },
  { value: "WhatsApp", label: "WhatsApp", groupLabel: "Chat" },
  { value: "Instagram", label: "Instagram", groupLabel: "Sosial" },
];

export const SALES_CHANNEL_VALUES = SALES_CHANNEL_OPTIONS.map((channel) => channel.value);

export const MARKETPLACE_SALES_CHANNEL_VALUES = SALES_CHANNEL_OPTIONS
  .filter((channel) => channel.marketplace)
  .map((channel) => channel.value);

export const MARKETPLACE_SALES_CHANNEL_SET = new Set(MARKETPLACE_SALES_CHANNEL_VALUES);

export const SALES_CHANNEL_SUMMARY_DEFINITIONS = [
  ...SALES_CHANNEL_OPTIONS,
  {
    value: SALES_CHANNEL_UNCATEGORIZED_KEY,
    label: SALES_CHANNEL_UNCATEGORIZED_LABEL,
    groupLabel: "Perlu dicek",
  },
];

const SALES_CHANNEL_SUMMARY_SORT_ORDER = SALES_CHANNEL_SUMMARY_DEFINITIONS.map((channel) => channel.value);

const salesChannelDefinitionMap = new Map(
  SALES_CHANNEL_SUMMARY_DEFINITIONS.map((channel) => [channel.value, channel]),
);

export const normalizeSalesChannel = (channel) => {
  const value = String(channel || "").trim();
  return SALES_CHANNEL_VALUES.includes(value) ? value : SALES_CHANNEL_UNCATEGORIZED_KEY;
};

export const getSalesChannelLabel = (channel) =>
  salesChannelDefinitionMap.get(normalizeSalesChannel(channel))?.label || SALES_CHANNEL_UNCATEGORIZED_LABEL;

export const getSalesChannelGroupLabel = (channel) =>
  salesChannelDefinitionMap.get(normalizeSalesChannel(channel))?.groupLabel || "Perlu dicek";

export const isMarketplaceSalesChannel = (channel) => MARKETPLACE_SALES_CHANNEL_SET.has(channel);

export const buildSalesChannelSummary = (records = []) => {
  const initialSummary = new Map(
    SALES_CHANNEL_SUMMARY_DEFINITIONS.map((channel) => [
      channel.value,
      {
        key: channel.value,
        channel: channel.label,
        groupLabel: channel.groupLabel || "Perlu dicek",
        transactionCount: 0,
        totalAmount: 0,
        completedAmount: 0,
        pendingAmount: 0,
        completedCount: 0,
        pendingCount: 0,
        transactions: [],
      },
    ]),
  );

  records.forEach((sale) => {
    const channelKey = normalizeSalesChannel(sale.salesChannel);
    const summary = initialSummary.get(channelKey);
    const amount = Number(sale.total || 0);
    const status = sale.status || "";
    const isCompleted = status === "Selesai";
    const isPending = ["Diproses", "Dikirim"].includes(status);

    summary.transactionCount += 1;
    summary.totalAmount += amount;
    summary.transactions.push(sale);

    if (isCompleted) {
      summary.completedAmount += amount;
      summary.completedCount += 1;
    }

    if (isPending) {
      summary.pendingAmount += amount;
      summary.pendingCount += 1;
    }
  });

  return Array.from(initialSummary.values())
    .filter((summary) => Number(summary.transactionCount || 0) > 0)
    .sort((a, b) => {
      if (b.totalAmount !== a.totalAmount) return b.totalAmount - a.totalAmount;
      return SALES_CHANNEL_SUMMARY_SORT_ORDER.indexOf(a.key) - SALES_CHANNEL_SUMMARY_SORT_ORDER.indexOf(b.key);
    });
};
