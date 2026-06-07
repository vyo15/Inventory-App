import { isValidElement, useEffect, useMemo, useState } from "react";
import { Pagination, Table } from "antd";
import { DataRefreshIndicator, getDataTableEmptyText } from "../Feedback/DataLoadingState";
import MobileActionMenu from "../Mobile/MobileActionMenu";
import MobileStateBlock from "../Mobile/MobileStateBlock";

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

// IMS NOTE [AKTIF] - Mobile Clean v2 defaults.
// Fungsi blok: membuat card mobile lebih ringkas tanpa mengubah dataSource, columns, handler, atau business logic.
// Behavior default: compact card hanya menampilkan title/subtitle/status, quickline, maksimal 2 meta, dan action minimal.
const getMobileCardDensity = (mobileCardConfig = {}) =>
  mobileCardConfig.density || mobileCardConfig.variant || "compact";

const isCompactMobileCard = (mobileCardConfig = {}) => getMobileCardDensity(mobileCardConfig) !== "detailed";

const limitMobileItems = (items, limit) => {
  if (!Number.isFinite(limit)) return items;
  if (limit < 0) return items;
  return items.slice(0, limit);
};

const resolveMobileLimit = (mobileCardConfig = {}, key, fallback) => {
  const value = Number(mobileCardConfig[key]);
  return Number.isFinite(value) ? value : fallback;
};

const normalizeCleanActionItems = (items, mobileCardConfig = {}) => {
  if (!isCompactMobileCard(mobileCardConfig)) return items;
  if (mobileCardConfig.showActionsOnCard === true) {
    return limitMobileItems(items, resolveMobileLimit(mobileCardConfig, "actionLimit", 1));
  }
  if (mobileCardConfig.onCardClick) return [];
  return limitMobileItems(items, resolveMobileLimit(mobileCardConfig, "actionLimit", 1));
};

const normalizeMobileActionList = (actions, record, index) => {
  const resolvedActions = renderMobileField(actions, record, index);
  return normalizeMobileContentList(resolvedActions)
    .map((action, actionIndex) => {
      if (typeof action === "function") {
        return action(record, index);
      }

      if (!action || isValidElement(action)) {
        return action;
      }

      if (typeof action !== "object") {
        return action;
      }

      const originalOnClick = action.onClick;
      return {
        ...action,
        key: action.key || action.label || `mobile-action-${actionIndex}`,
        onClick: originalOnClick
          ? (event) => {
              event?.domEvent?.stopPropagation?.();
              event?.stopPropagation?.();
              originalOnClick(record, index, event);
            }
          : undefined,
      };
    })
    .filter(hasRenderableValue);
};

const renderMobileActions = (mobileCardConfig, record, index) => {
  const structuredPrimaryActions = normalizeMobileActionList(
    mobileCardConfig.primaryActions,
    record,
    index,
  ).filter((action) => !isValidElement(action));
  const structuredMoreActions = normalizeMobileActionList(
    mobileCardConfig.moreActions,
    record,
    index,
  ).filter((action) => !isValidElement(action));

  if (structuredPrimaryActions.length || structuredMoreActions.length) {
    return normalizeCleanActionItems([
      <MobileActionMenu
        key="mobile-action-menu"
        primaryActions={structuredPrimaryActions}
        moreActions={structuredMoreActions}
        maxPrimaryActions={resolveMobileLimit(mobileCardConfig, "primaryActionLimit", 1)}
      />,
    ], mobileCardConfig);
  }

  return normalizeCleanActionItems(
    normalizeMobileContentList(renderMobileField(mobileCardConfig.actions, record, index)),
    mobileCardConfig,
  );
};

const renderMobileEmptyState = (resolvedLocale, loading) => {
  if (loading) {
    return (
      <MobileStateBlock
        type="loading"
        description="Memuat data..."
      />
    );
  }

  return (
    <MobileStateBlock
      type="empty"
      description={resolvedLocale.emptyText || "Belum ada data."}
    />
  );
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
  loading,
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
        {renderMobileEmptyState(resolvedLocale, loading)}
      </div>
    );
  }

  return (
    <div className="ims-mobile-card-list" aria-live="polite">
      {visibleRows.map((record, index) => {
        const absoluteIndex = useMobilePagination ? (mobileCurrentPage - 1) * mobilePageSize + index : index;
        const title = renderMobileField(mobileCardConfig.title, record, absoluteIndex);
        const compactCard = isCompactMobileCard(mobileCardConfig);
        const subtitleItems = limitMobileItems(
          normalizeMobileContentList(renderMobileField(mobileCardConfig.subtitle, record, absoluteIndex)),
          compactCard ? resolveMobileLimit(mobileCardConfig, "subtitleLimit", 2) : -1,
        );
        const subtextItems = limitMobileItems(
          normalizeMobileContentList(renderMobileField(mobileCardConfig.subtext, record, absoluteIndex)),
          compactCard ? resolveMobileLimit(mobileCardConfig, "subtextLimit", 1) : -1,
        );
        const tagItems = limitMobileItems(
          normalizeMobileContentList(renderMobileField(mobileCardConfig.tags, record, absoluteIndex)),
          compactCard ? resolveMobileLimit(mobileCardConfig, "tagLimit", 1) : -1,
        );
        const primaryValue = renderMobileField(mobileCardConfig.primary, record, absoluteIndex);
        const secondaryValue = renderMobileField(mobileCardConfig.secondary, record, absoluteIndex);
        const contentItems = limitMobileItems(
          normalizeMobileContentList(renderMobileField(mobileCardConfig.content, record, absoluteIndex)),
          compactCard ? resolveMobileLimit(mobileCardConfig, "contentLimit", 0) : -1,
        );
        const actionItems = renderMobileActions(mobileCardConfig, record, absoluteIndex);
        const handleCardClick = mobileCardConfig.onCardClick
          ? (event) => {
              if (event.target.closest?.("button, a, input, textarea, select, .ant-dropdown, .ant-popover")) return;
              mobileCardConfig.onCardClick(record, absoluteIndex, event);
            }
          : undefined;
        const metaItems = limitMobileItems(
          (mobileCardConfig.meta || [])
            .map((item) => ({
              ...item,
              value: renderMobileField(item.value ?? item.render, record, absoluteIndex),
            }))
            .filter((item) => hasRenderableValue(item.value)),
          compactCard ? resolveMobileLimit(mobileCardConfig, "metaLimit", 2) : -1,
        );

        return (
          <article
            className={[
              "ims-mobile-card",
              compactCard ? "ims-mobile-card--clean" : "ims-mobile-card--detailed",
              `ims-mobile-card--${getMobileCardDensity(mobileCardConfig)}`,
              handleCardClick ? "ims-mobile-card--clickable" : "",
            ].filter(Boolean).join(" ")}
            key={getRecordKey(rowKey, record, absoluteIndex)}
            onClick={handleCardClick}
          >
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

            {hasRenderableValue(primaryValue) || hasRenderableValue(secondaryValue) ? (
              <div className="ims-mobile-card__quickline">
                {hasRenderableValue(primaryValue) ? <strong>{primaryValue}</strong> : null}
                {hasRenderableValue(secondaryValue) ? <span>{secondaryValue}</span> : null}
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
// Guardrail: komponen ini presentational-only; jangan masukkan query service, mutation, stock, payroll, purchase, reset, atau business rule di sini.
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
        loading,
      })}
    </div>
  );
};

export default DataTableView;
