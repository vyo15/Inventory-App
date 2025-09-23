// src/Components/Dashboard/MonthlyChart.jsx
import React, { useEffect, useRef } from "react";
import { Card } from "antd";

const MonthlyChart = ({ monthlyFinancialData, loading }) => {
  const chartCanvasRef = useRef(null);

  useEffect(() => {
    if (
      chartCanvasRef.current &&
      monthlyFinancialData &&
      monthlyFinancialData.length > 0
    ) {
      const canvas = chartCanvasRef.current;
      const ctx = canvas.getContext("2d");
      const container = canvas.parentElement;

      const resizeCanvas = () => {
        canvas.width = container.offsetWidth;
        canvas.height = 300; // Tinggi tetap
        drawChart();
      };

      const drawChart = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const padding = 50;
        const chartWidth = canvas.width - padding * 2;
        const chartHeight = canvas.height - padding * 2;

        const salesData = monthlyFinancialData.filter(
          (d) => d.type === "Penjualan"
        );
        const expensesData = monthlyFinancialData.filter(
          (d) => d.type === "Pembelian"
        );
        const allValues = monthlyFinancialData.map((d) => d.value);
        const maxValue = Math.max(...allValues, 0) || 1;
        const numMonths = Math.max(salesData.length, expensesData.length);

        const groupWidth = numMonths > 0 ? chartWidth / numMonths : chartWidth;
        const barWidth = numMonths > 0 ? (groupWidth / 2) * 0.8 : 0;
        const barGap = numMonths > 0 ? (groupWidth / 2) * 0.2 : 0;

        // Gambar bar Penjualan
        salesData.forEach((d, i) => {
          const x = padding + i * groupWidth + barGap / 2;
          const barHeight = (d.value / maxValue) * chartHeight;
          ctx.fillStyle = "#1677ff"; // Biru
          ctx.fillRect(
            x,
            chartHeight + padding - barHeight,
            barWidth,
            barHeight
          );
          ctx.fillStyle = "#000000"; // Teks hitam
          ctx.font = "12px Arial";
          ctx.textAlign = "center";
          ctx.fillText(
            `Rp ${Number(d.value).toLocaleString("id-ID")}`,
            x + barWidth / 2,
            chartHeight + padding - barHeight - 5
          );
        });

        // Gambar bar Pengeluaran
        expensesData.forEach((d, i) => {
          const x = padding + i * groupWidth + groupWidth / 2 + barGap / 2;
          const barHeight = (d.value / maxValue) * chartHeight;
          ctx.fillStyle = "#f5222d"; // Merah
          ctx.fillRect(
            x,
            chartHeight + padding - barHeight,
            barWidth,
            barHeight
          );
          ctx.fillStyle = "#000000"; // Teks hitam
          ctx.font = "12px Arial";
          ctx.textAlign = "center";
          ctx.fillText(
            `Rp ${Number(d.value).toLocaleString("id-ID")}`,
            x + barWidth / 2,
            chartHeight + padding - barHeight - 5
          );
        });

        // Gambar label bulan
        const months = salesData.map((d) => d.month);
        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.font = "14px Arial";
        months.forEach((month, i) => {
          const x = padding + i * groupWidth + groupWidth / 2;
          ctx.fillText(month, x, chartHeight + padding + 20);
        });

        // Gambar legenda
        ctx.fillStyle = "#1677ff";
        ctx.fillRect(padding, 10, 10, 10);
        ctx.fillStyle = "#000000";
        ctx.textAlign = "left";
        ctx.fillText("Penjualan", padding + 15, 18);

        ctx.fillStyle = "#f5222d";
        ctx.fillRect(padding + 100, 10, 10, 10);
        ctx.fillStyle = "#000000";
        ctx.textAlign = "left";
        ctx.fillText("Pembelian", padding + 115, 18);
      };

      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);
      return () => window.removeEventListener("resize", resizeCanvas);
    }
  }, [monthlyFinancialData]);

  return (
    <Card
      title="Grafik Penjualan dan Pengeluaran Bulanan"
      className="dashboard-card"
      loading={loading}
    >
      <div style={{ minHeight: 300 }}>
        <canvas ref={chartCanvasRef} />
      </div>
    </Card>
  );
};

export default MonthlyChart;
