import React from "react";
import { Col, Row, Typography } from "antd";
import SummaryStatCard from "./SummaryStatCard";

const { Text, Title } = Typography;

const TONE_BY_ACCENT = {
  primary: "primary",
  success: "success",
  warning: "warning",
  danger: "danger",
  error: "danger",
  default: "neutral",
  neutral: "neutral",
  info: "primary",
};

const FINANCE_MAIN_KEYWORDS = [
  "net",
  "saldo",
  "selisih",
  "laba",
  "profit",
  "hpp",
  "nominal",
  "amount",
  "nilai",
  "total biaya",
];

const FINANCE_LABEL_REPLACEMENTS = [
  [/total\s+uang\s+masuk/i, "Penerimaan"],
  [/total\s+uang\s+keluar/i, "Pengeluaran"],
  [/total\s+pemasukan/i, "Penerimaan"],
  [/total\s+pengeluaran/i, "Pengeluaran"],
  [/jumlah\s+transaksi/i, "Transaksi"],
  [/selisih\s+bersih/i, "Bersih"],
  [/^total\s+/i, ""],
  [/\s+periode$/i, ""],
  [/\s+semua transaksi$/i, ""],
];

const normalizeTone = (accent) => TONE_BY_ACCENT[accent] || "neutral";

const formatDisplayValue = (value, suffix) => {
  if (suffix === undefined || suffix === null || suffix === "") return value;
  return `${value} ${suffix}`;
};

const compactFinanceLabel = (title = "") => {
  const cleaned = FINANCE_LABEL_REPLACEMENTS.reduce(
    (label, [pattern, replacement]) => label.replace(pattern, replacement),
    String(title).trim(),
  )
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned || title;
};

const normalizeItems = (items) =>
  items.map((item, index) => ({
    ...item,
    key: item.key || item.title || `summary-${index}`,
    title: item.title || item.label || "Ringkasan",
    displayValue: formatDisplayValue(item.value ?? 0, item.suffix),
    tone: normalizeTone(item.accent),
    shortTitle: item.shortTitle || compactFinanceLabel(item.title || item.label || "Ringkasan"),
  }));

const pickPrimaryItem = (items, highlightKey) => {
  if (!items.length) return null;

  if (highlightKey) {
    const selected = items.find((item) => item.key === highlightKey);
    if (selected) return selected;
  }

  return items[0];
};

const pickFinancePrimaryItem = (items, highlightKey) => {
  if (!items.length) return null;

  if (highlightKey) {
    const selected = items.find((item) => item.key === highlightKey);
    if (selected) return selected;
  }

  return (
    items.find((item) => {
      const searchable = `${item.key || ""} ${item.title || ""}`.toLowerCase();
      return FINANCE_MAIN_KEYWORDS.some((keyword) => searchable.includes(keyword));
    }) || items[0]
  );
};

const renderLegacyCards = (normalizedItems, columns, gutter, className) => (
  <Row gutter={gutter} className={className}>
    {normalizedItems.map((item) => (
      <Col key={item.key} {...(item.columns || columns)}>
        <SummaryStatCard
          title={item.title}
          value={item.displayValue}
          subtitle={item.subtitle}
          accent={item.accent || "default"}
          className={item.className || ""}
          extra={item.extra || null}
        />
      </Col>
    ))}
  </Row>
);

const renderExecutiveDock = (normalizedItems, highlightKey, className) => {
  const primaryItem = pickPrimaryItem(normalizedItems, highlightKey);
  const metricItems = normalizedItems.filter((item) => item.key !== primaryItem.key);

  return (
    <div className={`summary-stat-grid summary-stat-grid--executive ${className}`.trim()}>
      <SummaryStatCard
        title={primaryItem.title}
        value={primaryItem.displayValue}
        subtitle={primaryItem.subtitle}
        accent={primaryItem.accent || "default"}
        extra={primaryItem.extra || null}
        className="summary-stat-card--featured"
      />

      {metricItems.length ? (
        <div className="summary-stat-grid-metrics">
          {metricItems.map((item) => (
            <SummaryStatCard
              key={item.key}
              title={item.shortTitle}
              value={item.displayValue}
              subtitle={item.subtitle}
              accent={item.accent || "default"}
              extra={item.extra || null}
              className={item.className || ""}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

const renderFinanceDock = (normalizedItems, highlightKey, className) => {
  const primaryItem = pickFinancePrimaryItem(normalizedItems, highlightKey);
  const metricItems = normalizedItems.filter((item) => item.key !== primaryItem.key);

  return (
    <div
      className={`summary-stat-grid summary-stat-grid--finance ${className}`.trim()}
      data-accent={primaryItem.accent || "default"}
    >
      <div className="summary-finance-main" data-tone={primaryItem.tone}>
        <div className="summary-finance-main-header">
          <div>
            <Text className="summary-finance-kicker">Ringkasan Utama</Text>
            <Text className="summary-finance-period">Sesuai filter aktif</Text>
          </div>
          <span className="summary-finance-status">Update</span>
        </div>

        <div className="summary-finance-main-body">
          <div>
            <Text className="summary-finance-label">{primaryItem.shortTitle}</Text>
            <Title level={2} className="summary-finance-value">
              {primaryItem.displayValue}
            </Title>
            {primaryItem.subtitle ? (
              <Text className="summary-finance-helper">{primaryItem.subtitle}</Text>
            ) : null}
          </div>
        </div>
      </div>

      <div className="summary-finance-side">
        {metricItems.length ? (
          <div className="summary-finance-metrics">
            {metricItems.map((item) => (
              <SummaryStatCard
                key={item.key}
                title={item.shortTitle}
                value={item.displayValue}
                subtitle={item.subtitle}
                accent={item.accent || "default"}
                extra={item.extra || null}
                className="summary-stat-card--finance-mini"
              />
            ))}
          </div>
        ) : null}

      </div>
    </div>
  );
};

// =========================
// SECTION: Shared Summary Stat Grid
// Fungsi:
// - membungkus summary lintas halaman dengan varian Executive Dock / Finance Dock / legacy cards
// - menjaga KPI tetap compact, modern, dan konsisten tanpa mengubah perhitungan pemanggil
// Catatan:
// - columns/gutter tetap dipertahankan untuk kompatibilitas saat variant="cards"
// - item.value diasumsikan sudah siap tampil dari halaman pemanggil
// =========================
const SummaryStatGrid = ({
  items = [],
  columns = { xs: 24, sm: 12, md: 12, lg: 6 },
  gutter = [16, 16],
  className = "",
  variant = "executive",
  highlightKey = null,
}) => {
  if (!Array.isArray(items) || items.length === 0) return null;

  const normalizedItems = normalizeItems(items);

  if (variant === "cards") {
    return renderLegacyCards(normalizedItems, columns, gutter, className);
  }

  if (variant === "finance") {
    return renderFinanceDock(normalizedItems, highlightKey, className);
  }

  return renderExecutiveDock(normalizedItems, highlightKey, className);
};

export default SummaryStatGrid;
