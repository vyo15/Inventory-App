// =====================================================
// Page: Analisis HPP Produksi
// Tahap 1: membaca work log completed dan payroll produksi
// untuk analisa biaya realisasi per output
// =====================================================

import React, { useEffect, useMemo, useState } from "react";
import { Button, Col, Empty, Input, Select, Table, Typography, message, Tag } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { getCompletedProductionWorkLogs } from "../../services/Produksi/productionWorkLogsService";
import { getAllProductionPayrolls } from "../../services/Produksi/productionPayrollsService";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import FilterBar from "../../components/Layout/Filters/FilterBar";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import formatNumber from "../../utils/formatters/numberId";
import formatCurrency from "../../utils/formatters/currencyId";

// =====================================================
// Formatter final lintas aplikasi
// ACTIVE / FINAL: HPP produksi hanya memakai helper shared untuk display.
// =====================================================

const ProductionHppAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [workLogs, setWorkLogs] = useState([]);
  const [payrolls, setPayrolls] = useState([]);

  const [search, setSearch] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("all");

  const loadData = async () => {
    try {
      setLoading(true);
      const [workLogResult, payrollResult] = await Promise.all([
        getCompletedProductionWorkLogs(),
        getAllProductionPayrolls(),
      ]);

      setWorkLogs(workLogResult);
      setPayrolls(payrollResult);
    } catch (error) {
      console.error(error);
      message.error("Gagal memuat analisis HPP produksi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const rows = useMemo(() => {
    return workLogs.map((workLog) => {
      const relatedPayrolls = payrolls.filter(
        (item) => item.workLogId === workLog.id && item.status !== "cancelled",
      );

      const payrollTotal = relatedPayrolls.reduce(
        (sum, item) => sum + Number(item.finalAmount || 0),
        0,
      );

      const materialCost = Number(workLog.materialCostActual || 0);
      const directLaborCost =
        payrollTotal > 0 ? payrollTotal : Number(workLog.laborCostActual || 0);
      const overheadCost = Number(workLog.overheadCostActual || 0);
      const totalCost = materialCost + directLaborCost + overheadCost;
      const goodQty = Number(workLog.goodQty || 0);
      const hppPerUnit = goodQty > 0 ? totalCost / goodQty : 0;

      return {
        id: workLog.id,
        workNumber: workLog.workNumber || "-",
        targetType: workLog.targetType || "-",
        targetName: workLog.targetName || "-",
        stepName: workLog.stepName || "-",
        goodQty,
        materialCost,
        directLaborCost,
        overheadCost,
        totalCost,
        hppPerUnit,
      };
    });
  }, [workLogs, payrolls]);

  const filteredRows = useMemo(() => {
    return rows.filter((item) => {
      const searchText = search.trim().toLowerCase();

      const matchSearch =
        !searchText ||
        String(item.workNumber || "")
          .toLowerCase()
          .includes(searchText) ||
        String(item.targetName || "")
          .toLowerCase()
          .includes(searchText) ||
        String(item.stepName || "")
          .toLowerCase()
          .includes(searchText);

      const matchTargetType =
        targetTypeFilter === "all" || item.targetType === targetTypeFilter;

      return matchSearch && matchTargetType;
    });
  }, [rows, search, targetTypeFilter]);

  const summary = useMemo(() => {
    const totalLogs = filteredRows.length;
    const totalProductionCost = filteredRows.reduce(
      (sum, item) => sum + Number(item.totalCost || 0),
      0,
    );
    const totalGoodQty = filteredRows.reduce(
      (sum, item) => sum + Number(item.goodQty || 0),
      0,
    );
    const averageHpp =
      totalGoodQty > 0 ? totalProductionCost / totalGoodQty : 0;

    return {
      totalLogs,
      totalProductionCost,
      totalGoodQty,
      averageHpp,
    };
  }, [filteredRows]);

  const summaryItems = useMemo(
    () => [
      { key: "total-logs", title: "Total Work Log", value: formatNumber(summary.totalLogs) },
      {
        key: "total-cost",
        title: "Total Biaya Produksi",
        value: formatCurrency(summary.totalProductionCost),
      },
      { key: "good-qty", title: "Total Good Qty", value: formatNumber(summary.totalGoodQty) },
      { key: "avg-hpp", title: "Rata-rata HPP / Unit", value: formatCurrency(summary.averageHpp) },
    ],
    [summary],
  );

  const columns = [
    {
      title: "No. Work Log",
      dataIndex: "workNumber",
      key: "workNumber",
      width: 160,
      render: (value) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: "Target / Step",
      key: "targetStep",
      width: 260,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.targetName}</div>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>
            {record.stepName}
          </div>
        </div>
      ),
    },
    {
      title: "Good Qty",
      dataIndex: "goodQty",
      key: "goodQty",
      width: 110,
      render: (value) => formatNumber(value),
    },
    {
      title: "Material Cost",
      dataIndex: "materialCost",
      key: "materialCost",
      width: 150,
      render: (value) => formatCurrency(value),
    },
    {
      title: "Direct Labor",
      dataIndex: "directLaborCost",
      key: "directLaborCost",
      width: 150,
      render: (value) => formatCurrency(value),
    },
    {
      title: "Overhead",
      dataIndex: "overheadCost",
      key: "overheadCost",
      width: 140,
      render: (value) => formatCurrency(value),
    },
    {
      title: "Total Cost",
      dataIndex: "totalCost",
      key: "totalCost",
      width: 150,
      render: (value) => formatCurrency(value),
    },
    {
      title: "HPP / Unit",
      dataIndex: "hppPerUnit",
      key: "hppPerUnit",
      width: 150,
      render: (value) => formatCurrency(value),
    },
  ];

  return (
    <>
      <PageHeader
        title="Analisis HPP Produksi"
        subtitle="Analisa biaya realisasi bahan, tenaga kerja, dan overhead per work log completed dengan baseline layout shared yang seragam."
        actions={[
          {
            key: "refresh-hpp-analysis",
            icon: <ReloadOutlined />,
            label: "Refresh",
            onClick: loadData,
          },
        ]}
      />

      <PageSection
        title="Ringkasan HPP"
        subtitle="Ringkasan mengikuti hasil filter target type dan pencarian work log agar audit biaya lebih cepat."
      >
        <SummaryStatGrid items={summaryItems} columns={{ xs: 24, sm: 12, md: 12, lg: 6 }} />
      </PageSection>

      <PageSection
        title="Filter Analisis"
        subtitle="Filter ini membantu membaca kelompok work log tertentu tanpa mengubah contract HPP aktif."
      >
        <FilterBar>
          <Col xs={24} md={12}>
            <Input
              style={{ width: "100%" }}
              placeholder="Cari work log, target, step..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={8}>
            <Select
              style={{ width: "100%" }}
              value={targetTypeFilter}
              onChange={setTargetTypeFilter}
              options={[
                { value: "all", label: "Semua Target Type" },
                {
                  value: "semi_finished_material",
                  label: "Semi Finished Material",
                },
                { value: "product", label: "Product" },
              ]}
            />
          </Col>
        </FilterBar>
      </PageSection>

      <PageSection
        title="Tabel Analisis HPP"
        subtitle="Tabel tetap membaca Work Log completed dan payroll aktif tanpa mengubah contract biaya produksi yang sudah guarded."
        extra={<Tag color="purple">{formatNumber(filteredRows.length)} baris</Tag>}
      >
        {/* =========================
            SECTION: tabel HPP baseline global
            Fungsi:
            - memigrasikan halaman HPP dari card layout manual ke shared page wrapper resmi
            - menjaga tabel analisis tetap seragam tanpa menyentuh logic perhitungan biaya
            Status: aktif / final
        ========================= */}
        <Table
          className="app-data-table"
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredRows}
          scroll={{ x: 1300 }}
          locale={{
            emptyText: <Empty description="Belum ada data analisis HPP" />,
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
          }}
        />
      </PageSection>
    </>
  );
};

export default ProductionHppAnalysis;
