import React, { Suspense, lazy, useMemo } from "react";
import { Empty, Spin } from "antd";
import { formatNumberId } from "../../utils/formatters/numberId";

const ColumnChart = lazy(() =>
  import("@ant-design/charts").then((module) => ({ default: module.Column })),
);

const SalesChart = ({ data }) => {
  const hasSalesData = Array.isArray(data) && data.some((item) => item.sales > 0);

  const chartConfig = useMemo(
    () => ({
      data,
      xField: "month",
      yField: "sales",
      label: false,
      columnStyle: {
        radius: [8, 8, 0, 0],
      },
      xAxis: {
        label: {
          autoHide: true,
          autoRotate: false,
        },
      },
      yAxis: {
        label: {
          formatter: (value) => formatNumberId(Number(value || 0)),
        },
      },
      meta: {
        sales: {
          alias: "Penjualan",
          formatter: (value) => `Rp ${formatNumberId(value)}`,
        },
      },
      tooltip: {
        formatter: (datum) => ({
          name: "Penjualan",
          value: `Rp ${formatNumberId(datum.sales || 0)}`,
        }),
      },
    }),
    [data],
  );

  if (!hasSalesData) {
    return <Empty description="Belum ada data penjualan untuk ditampilkan." />;
  }

  return (
    <Suspense
      fallback={
        <div className="dashboard-empty-wrap">
          <Spin size="large" />
        </div>
      }
    >
      <ColumnChart {...chartConfig} />
    </Suspense>
  );
};

export default SalesChart;
