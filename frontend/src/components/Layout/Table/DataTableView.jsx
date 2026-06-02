import { useEffect, useMemo, useState } from "react";
import { Pagination, Table } from "antd";
import { DataRefreshIndicator, getDataTableEmptyText } from "../Feedback/DataLoadingState";

const combineClassNames = (...classNames) => classNames.filter(Boolean).join(" ");

const getValueByPath = (record = {}, path = "") => {
  if (!path) return undefined;

  return String(path)
    .split(".")
    .reduce((value, key) => (value == null ? undefined : value[key]), record);
};

const renderMobileField = (field, record, index) => {
  if (typeof field === "function") {
    return field(record, index);
  }

  if (typeof field === "string") {
    return getValueByPath(record, field);
  }

  return field;
};

const hasRenderableValue = (value) => {
  if (value === null || value === undefined || value === false) return false;
  if (Array.isArray(value)) return value.some(hasRenderableValue);
  if (typeof value === "string") return value.trim() !== "";
  return true;
};

const normalizeMobileContentList = (content) => {
  if (!hasRenderableValue(content)) return [];
  return Array.isArray(content) ? content.filter(hasRenderableValue) : [content];
};

const getRecordKey = (rowKey, record, index) => {
  if (typeof rowKey === "function") return rowKey(record, index);
  if (typeof rowKey === "string" && record?.[rowKey] !== undefined) return record[rowKey];
  return record?.id ?? record?.key ?? index;
};

const renderMobileCards = ({
  dataSource,
  mobileCardConfig,
  rowKey,
  pagination,
  resolvedLocale,
  mobileCurrentPage,
  mobilePageSize,
  onMobilePageChange,
}) => {
  if (!mobileCardConfig) return null;

  const resolvedDataSource = Array.isArray(dataSource) ? dataSource : [];
  const useMobilePagination = pagination !== false && resolvedDataSource.length > mobilePageSize;
  const visibleRows = useMobilePagination
    ? resolvedDataSource.slice((mobileCurrentPage - 1) * mobilePageSize, mobileCurrentPage * mobilePageSize)
    : resolvedDataSource;

  if (!resolvedDataSource.length) {
    return (
      <div className="ims-mobile-card-list" aria-live="polite">
        <div className="ims-mobile-card-empty">{resolvedLocale.emptyText}</div>
      </div>
    );
  }

  return (
    <div className="ims-mobile-card-list" aria-live="polite">
      {visibleRows.map((record, index) => {
        const absoluteIndex = useMobilePagination ? (mobileCurrentPage - 1) * mobilePageSize + index : index;
        const title = renderMobileField(mobileCardConfig.title, record, absoluteIndex);
        const subtitleItems = normalizeMobileContentList(
          renderMobileField(mobileCardConfig.subtitle, record, absoluteIndex),
        );
        const subtextItems = normalizeMobileContentList(
          renderMobileField(mobileCardConfig.subtext, record, absoluteIndex),
        );
        const tagItems = normalizeMobileContentList(
          renderMobileField(mobileCardConfig.tags, record, absoluteIndex),
        );
        const contentItems = normalizeMobileContentList(
          renderMobileField(mobileCardConfig.content, record, absoluteIndex),
        );
        const actionItems = normalizeMobileContentList(
          renderMobileField(mobileCardConfig.actions, record, absoluteIndex),
        );
        const metaItems = (mobileCardConfig.meta || [])
          .map((item) => ({
            ...item,
            value: renderMobileField(item.value ?? item.render, record, absoluteIndex),
          }))
          .filter((item) => hasRenderableValue(item.value));

        return (
          <article className="ims-mobile-card" key={getRecordKey(rowKey, record, absoluteIndex)}>
            <div className="ims-mobile-card__header">
              <div className="ims-mobile-card__identity">
                {hasRenderableValue(title) ? <div className="ims-mobile-card__title">{title}</div> : null}
                {subtitleItems.length ? (
                  <div className="ims-mobile-card__subtitle">
                    {subtitleItems.map((item, itemIndex) => (
                      <span key={itemIndex}>{item}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              {tagItems.length ? (
                <div className="ims-mobile-card__tags">
                  {tagItems.map((item, itemIndex) => (
                    <span key={itemIndex}>{item}</span>
                  ))}
                </div>
              ) : null}
            </div>

            {subtextItems.length ? (
              <div className="ims-mobile-card__subtext">
                {subtextItems.map((item, itemIndex) => (
                  <span key={itemIndex}>{item}</span>
                ))}
              </div>
            ) : null}

            {metaItems.length ? (
              <div className="ims-mobile-card__meta-grid">
                {metaItems.map((item, itemIndex) => (
                  <div className="ims-mobile-card__meta-item" key={item.key || item.label || itemIndex}>
                    {item.label ? <span className="ims-mobile-card__meta-label">{item.label}</span> : null}
                    <span className="ims-mobile-card__meta-value">{item.value}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {contentItems.length ? (
              <div className="ims-mobile-card__content">
                {contentItems.map((item, itemIndex) => (
                  <div className="ims-mobile-card__content-item" key={itemIndex}>{item}</div>
                ))}
              </div>
            ) : null}

            {actionItems.length ? (
              <div className="ims-mobile-card__actions">
                {actionItems.map((item, itemIndex) => (
                  <span key={itemIndex}>{item}</span>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}

      {useMobilePagination ? (
        <Pagination
          className="ims-mobile-card-pagination"
          current={mobileCurrentPage}
          pageSize={mobilePageSize}
          total={resolvedDataSource.length}
          size="small"
          showSizeChanger={false}
          onChange={onMobilePageChange}
        />
      ) : null}
    </div>
  );
};

// IMS NOTE [AKTIF] - Shared wrapper tabel data operasional.
// Fungsi blok: menyatukan pola DataRefreshIndicator + empty state tabel tanpa mengubah dataSource, columns, pagination, atau handler page.
// Guardrail: komponen ini presentational-only; jangan masukkan query Firestore, mutation, stock, payroll, purchase, reset, atau business rule di sini.
const DataTableView = ({
  loading = false,
  dataSource = [],
  emptyText,
  locale,
  showRefreshIndicator = true,
  mobileCardConfig,
  className,
  rowKey,
  pagination,
  ...tableProps
}) => {
  const resolvedLocale = {
    ...locale,
    emptyText: locale?.emptyText ?? getDataTableEmptyText(loading, emptyText),
  };
  const resolvedPagination = pagination === false ? false : pagination;
  const mobilePageSize = Number(resolvedPagination?.pageSize || resolvedPagination?.defaultPageSize || 10);
  const controlledMobilePage = Number(resolvedPagination?.current || 0);
  const [internalMobilePage, setInternalMobilePage] = useState(
    Number(resolvedPagination?.defaultCurrent || resolvedPagination?.current || 1),
  );
  const mobileCurrentPage = controlledMobilePage || internalMobilePage;
  const tableClassName = combineClassNames(className);
  const wrapperClassName = combineClassNames(
    "ims-data-table-view",
    mobileCardConfig ? "ims-data-table-view--mobile-card" : "",
  );

  const dataCount = Array.isArray(dataSource) ? dataSource.length : 0;
  const maxMobilePage = useMemo(
    () => Math.max(1, Math.ceil(dataCount / mobilePageSize)),
    [dataCount, mobilePageSize],
  );

  useEffect(() => {
    if (!controlledMobilePage && internalMobilePage > maxMobilePage) {
      setInternalMobilePage(maxMobilePage);
    }
  }, [controlledMobilePage, internalMobilePage, maxMobilePage]);

  const handleMobilePageChange = (page, pageSize) => {
    if (!controlledMobilePage) {
      setInternalMobilePage(page);
    }
    resolvedPagination?.onChange?.(page, pageSize);
  };

  return (
    <div className={wrapperClassName}>
      {showRefreshIndicator ? (
        <DataRefreshIndicator loading={loading} dataSource={dataSource} />
      ) : null}
      <Table
        {...tableProps}
        className={tableClassName}
        rowKey={rowKey}
        dataSource={dataSource}
        pagination={resolvedPagination}
        locale={resolvedLocale}
      />
      {renderMobileCards({
        dataSource,
        mobileCardConfig,
        rowKey,
        pagination: resolvedPagination,
        resolvedLocale,
        mobileCurrentPage,
        mobilePageSize,
        onMobilePageChange: handleMobilePageChange,
      })}
    </div>
  );
};

export default DataTableView;
