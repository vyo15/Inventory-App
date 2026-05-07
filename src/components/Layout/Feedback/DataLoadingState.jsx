import React from "react";
import "./DataLoadingState.css";

const DEFAULT_MESSAGE = "Memuat data...";
const DEFAULT_EMPTY_TEXT = "Belum ada data.";
const TABLE_COLUMNS = 4;
const TABLE_ROWS = 5;

const buildCells = (count) =>
  Array.from({ length: count }, (_, index) => ({
    key: `cell-${index}`,
    width: `${Math.max(34, 88 - index * 12)}%`,
  }));

const hasDataRows = (dataSource) => Array.isArray(dataSource) && dataSource.length > 0;

/* =====================================================
SECTION: DataLoadingState — AKTIF
Fungsi:
- Menyediakan standar loading lokal untuk data/table/card tanpa memakai logo full-screen.

Dipakai oleh:
- Halaman dashboard, master data, finance, inventory, transaksi, report, produksi, dan system yang membutuhkan loading data lokal.

Alasan perubahan:
- Global/auth/route memakai LogoLoadingScreen, sementara loading data lokal harus satu visual: skeleton initial load atau refresh indicator ringan tanpa AntD spinner overlay.

Catatan cleanup:
- Belum ada.

Risiko:
- Jika helper ini dibuat fetch/mutate data, loading visual bisa bercampur dengan business flow; komponen ini harus tetap presentational-only.
===================================================== */
const DataLoadingState = ({
  variant = "table",
  rows = TABLE_ROWS,
  columns = TABLE_COLUMNS,
  message = DEFAULT_MESSAGE,
  compact = false,
  className = "",
  minHeight,
}) => {
  const normalizedVariant = ["table", "card", "chart", "list", "inline", "refresh"].includes(variant)
    ? variant
    : "table";

  const style = minHeight ? { minHeight } : undefined;
  const rootClassName = [
    "ims-data-loading",
    `ims-data-loading-${normalizedVariant}`,
    compact ? "ims-data-loading-compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const rowCount = Math.max(1, rows);
  const columnCount = Math.max(1, columns);

  const renderTable = () => (
    <div className="ims-data-loading-table-shell" aria-hidden="true">
      {Array.from({ length: rowCount }, (_, rowIndex) => (
        <div className="ims-data-loading-row" key={`row-${rowIndex}`}>
          {buildCells(columnCount).map((cell) => (
            <span
              className="ims-data-loading-cell ims-data-loading-shimmer"
              key={`${rowIndex}-${cell.key}`}
              style={{ width: cell.width }}
            />
          ))}
        </div>
      ))}
    </div>
  );

  const renderList = () => (
    <div className="ims-data-loading-list-shell" aria-hidden="true">
      {Array.from({ length: rowCount }, (_, index) => (
        <span
          className="ims-data-loading-list-line ims-data-loading-shimmer"
          key={`line-${index}`}
          style={{ width: `${Math.max(48, 96 - index * 8)}%` }}
        />
      ))}
    </div>
  );

  const renderChart = () => (
    <div className="ims-data-loading-chart-shell" aria-hidden="true">
      {Array.from({ length: 7 }, (_, index) => (
        <span
          className="ims-data-loading-chart-bar ims-data-loading-shimmer"
          key={`bar-${index}`}
          style={{ height: `${34 + ((index * 17) % 46)}%` }}
        />
      ))}
    </div>
  );

  const renderCard = () => (
    <div className="ims-data-loading-card-shell" aria-hidden="true">
      <span className="ims-data-loading-card-title ims-data-loading-shimmer" />
      <span className="ims-data-loading-card-line ims-data-loading-shimmer" />
      <span className="ims-data-loading-card-line ims-data-loading-card-line-short ims-data-loading-shimmer" />
    </div>
  );

  const renderRefresh = () => (
    <div className="ims-data-loading-refresh-shell" aria-hidden="true">
      <span className="ims-data-loading-refresh-track">
        <span className="ims-data-loading-refresh-bar" />
      </span>
    </div>
  );

  const contentByVariant = {
    table: renderTable,
    list: renderList,
    inline: renderList,
    chart: renderChart,
    card: renderCard,
    refresh: renderRefresh,
  };

  return (
    <div className={rootClassName} role="status" aria-live="polite" aria-busy="true" style={style}>
      {contentByVariant[normalizedVariant]()}
      {message ? <span className="ims-data-loading-message">{message}</span> : null}
    </div>
  );
};

export const getDataTableEmptyText = (loading, emptyText = DEFAULT_EMPTY_TEXT, options = {}) => {
  if (!loading) {
    return emptyText;
  }

  return (
    <DataLoadingState
      variant="table"
      rows={options.rows || TABLE_ROWS}
      columns={options.columns || TABLE_COLUMNS}
      message={options.message || DEFAULT_MESSAGE}
      compact={options.compact ?? true}
      minHeight={options.minHeight || 150}
    />
  );
};

export const DataRefreshIndicator = ({
  loading,
  dataSource,
  message = "Memperbarui data...",
  compact = true,
  className = "",
}) => {
  if (!loading || !hasDataRows(dataSource)) {
    return null;
  }

  return (
    <DataLoadingState
      variant="refresh"
      message={message}
      compact={compact}
      className={["ims-data-loading-table-refresh", className].filter(Boolean).join(" ")}
    />
  );
};

export default DataLoadingState;
