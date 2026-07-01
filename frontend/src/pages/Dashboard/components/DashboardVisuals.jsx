import { useMemo } from "react";
import { Typography } from "antd";
import EmptyStateBlock from "../../../components/Layout/Feedback/EmptyStateBlock";
import { formatNumberId } from "../../../utils/formatters/numberId";
import {
  formatCurrency,
  getNumericValue,
} from "../helpers/dashboardPageHelpers";

const { Text, Title } = Typography;

const DASHBOARD_CHART_SIZE = Object.freeze({
  width: 760,
  height: 200,
  left: 28,
  right: 20,
  top: 24,
  bottom: 30,
});

const formatCompactCurrency = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.round(getNumericValue(value)));

const buildChartGeometry = (series = []) => {
  const {
    width,
    height,
    left,
    right,
    top,
    bottom,
  } = DASHBOARD_CHART_SIZE;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const amounts = series.map((item) => Math.max(getNumericValue(item.amount), 0));
  const maxAmount = Math.max(...amounts, 0);
  const step = series.length > 1 ? chartWidth / (series.length - 1) : chartWidth;
  const points = series.map((item, index) => {
    const x = left + (step * index);
    const ratio = maxAmount > 0 ? Math.max(getNumericValue(item.amount), 0) / maxAmount : 0;
    const y = top + chartHeight - (ratio * chartHeight);
    return {
      ...item,
      x,
      y,
    };
  });
  const pointString = points.map((item) => `${item.x},${item.y}`).join(" ");
  const areaPointString = points.length > 0
    ? `${left},${height - bottom} ${pointString} ${width - right},${height - bottom}`
    : "";
  const peak = points.reduce(
    (currentPeak, item) =>
      getNumericValue(item.amount) > getNumericValue(currentPeak?.amount) ? item : currentPeak,
    null,
  );

  return {
    areaPointString,
    maxAmount,
    peak,
    pointString,
    points,
  };
};

export const DashboardMiniTrend = ({ series = [], label }) => {
  const maxAbsoluteAmount = Math.max(
    ...series.map((item) => Math.abs(getNumericValue(item.amount))),
    1,
  );

  return (
    <div className="dashboard-hero-trend" aria-label={label}>
      <div className="dashboard-hero-trend-bars" aria-hidden="true">
        {series.map((item) => {
          const amount = getNumericValue(item.amount);
          const isZero = amount === 0;
          const barHeight = isZero
            ? 8
            : Math.max(Math.round((Math.abs(amount) / maxAbsoluteAmount) * 100), 8);

          return (
            <span
              key={item.key}
              className={isZero ? "is-zero" : amount < 0 ? "is-negative" : "is-positive"}
              style={{ height: `${barHeight}%` }}
              title={`${item.label}: ${formatCurrency(amount)}`}
            />
          );
        })}
      </div>
      <Text>{label}</Text>
    </div>
  );
};

export const DashboardSalesChart = ({ series = [] }) => {
  const geometry = useMemo(() => buildChartGeometry(series), [series]);
  const totalAmount = series.reduce(
    (total, item) => total + getNumericValue(item.amount),
    0,
  );
  const hasData = geometry.maxAmount > 0;

  return (
    <div className="dashboard-insight-card dashboard-sales-chart-card">
      <div className="dashboard-insight-heading">
        <div>
          <Title level={4}>Tren Penjualan 30 Hari</Title>
          <Text>Nilai penjualan harian dari transaksi yang sudah tercatat.</Text>
        </div>
        <div className="dashboard-insight-total">
          <strong>{formatCurrency(totalAmount)}</strong>
          <small>total 30 hari</small>
        </div>
      </div>

      {hasData ? (
        <>
          <div className="dashboard-sales-chart-wrap">
            <svg
              viewBox={`0 0 ${DASHBOARD_CHART_SIZE.width} ${DASHBOARD_CHART_SIZE.height}`}
              role="img"
              aria-label="Grafik nilai penjualan harian selama 30 hari terakhir"
              preserveAspectRatio="none"
            >
              <line
                className="dashboard-sales-chart-grid"
                x1={DASHBOARD_CHART_SIZE.left}
                x2={DASHBOARD_CHART_SIZE.width - DASHBOARD_CHART_SIZE.right}
                y1={DASHBOARD_CHART_SIZE.height - DASHBOARD_CHART_SIZE.bottom}
                y2={DASHBOARD_CHART_SIZE.height - DASHBOARD_CHART_SIZE.bottom}
              />
              <line
                className="dashboard-sales-chart-grid is-secondary"
                x1={DASHBOARD_CHART_SIZE.left}
                x2={DASHBOARD_CHART_SIZE.width - DASHBOARD_CHART_SIZE.right}
                y1={DASHBOARD_CHART_SIZE.top + ((DASHBOARD_CHART_SIZE.height - DASHBOARD_CHART_SIZE.top - DASHBOARD_CHART_SIZE.bottom) / 2)}
                y2={DASHBOARD_CHART_SIZE.top + ((DASHBOARD_CHART_SIZE.height - DASHBOARD_CHART_SIZE.top - DASHBOARD_CHART_SIZE.bottom) / 2)}
              />
              <polygon
                className="dashboard-sales-chart-area"
                points={geometry.areaPointString}
              />
              <polyline
                className="dashboard-sales-chart-line"
                points={geometry.pointString}
              />
              {geometry.peak ? (
                <circle
                  className="dashboard-sales-chart-peak"
                  cx={geometry.peak.x}
                  cy={geometry.peak.y}
                  r="5"
                >
                  <title>
                    Puncak {geometry.peak.label}: {formatCurrency(geometry.peak.amount)}
                  </title>
                </circle>
              ) : null}
              {geometry.points.length > 0 ? (
                <circle
                  className="dashboard-sales-chart-latest"
                  cx={geometry.points[geometry.points.length - 1].x}
                  cy={geometry.points[geometry.points.length - 1].y}
                  r="4"
                >
                  <title>
                    Hari terakhir {geometry.points[geometry.points.length - 1].label}: {" "}
                    {formatCurrency(geometry.points[geometry.points.length - 1].amount)}
                  </title>
                </circle>
              ) : null}
            </svg>
          </div>
          <div className="dashboard-chart-legend">
            <span>
              <i className="is-primary" />
              Penjualan harian
            </span>
            <span>
              <i className="is-gold" />
              Puncak {geometry.peak?.label || "-"} · {formatCompactCurrency(geometry.peak?.amount || 0)}
            </span>
          </div>
        </>
      ) : (
        <div className="dashboard-empty-wrap dashboard-empty-chart">
          <EmptyStateBlock compact description="Belum ada penjualan dalam 30 hari terakhir." />
        </div>
      )}
    </div>
  );
};

export const DashboardTopProducts = ({ products = [] }) => (
  <div className="dashboard-insight-card dashboard-top-products-card">
    <div className="dashboard-insight-heading">
      <div>
        <Title level={4}>Produk Terlaris</Title>
        <Text>Bulan berjalan berdasarkan jumlah item penjualan.</Text>
      </div>
    </div>

    {products.length > 0 ? (
      <div className="dashboard-top-products-list">
        {products.map((item) => (
          <div key={item.key} className="dashboard-top-product-row">
            <span className={`dashboard-top-product-rank${item.rank === 1 ? " is-first" : ""}`}>
              {item.rank}
            </span>
            <div>
              <div className="dashboard-top-product-copy">
                <strong>{item.name}</strong>
                <span>{formatNumberId(item.quantity)} {item.unit}</span>
              </div>
              <div className="dashboard-top-product-track" aria-hidden="true">
                <span style={{ width: `${item.sharePercent}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="dashboard-empty-wrap dashboard-empty-chart">
        <EmptyStateBlock compact description="Belum ada item penjualan bulan ini." />
      </div>
    )}
  </div>
);
