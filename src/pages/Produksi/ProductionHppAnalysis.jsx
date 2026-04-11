// =====================================================
// Page: Analisis HPP Produksi
// Tahap 1: membaca work log completed dan payroll produksi
// untuk analisa biaya realisasi per output
// =====================================================

import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Col,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Typography,
  message,
} from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { getCompletedProductionWorkLogs } from "../../services/Produksi/productionWorkLogsService";
import { getAllProductionPayrolls } from "../../services/Produksi/productionPayrollsService";

const formatNumber = (value) =>
  new Intl.NumberFormat("id-ID").format(Number(value || 0));

const formatCurrency = (value) =>
  `Rp${new Intl.NumberFormat("id-ID").format(Number(value || 0))}`;

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
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Typography.Title level={3} style={{ margin: 0 }}>
              Analisis HPP Produksi
            </Typography.Title>
            <Typography.Text type="secondary">
              Analisa biaya realisasi bahan, tenaga kerja, dan overhead per work
              log completed
            </Typography.Text>
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={loadData}>
              Refresh
            </Button>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Total Work Log" value={summary.totalLogs} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Biaya Produksi"
              value={summary.totalProductionCost}
              formatter={(value) => formatCurrency(value)}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Good Qty"
              value={summary.totalGoodQty}
              formatter={(value) => formatNumber(value)}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Rata-rata HPP / Unit"
              value={summary.averageHpp}
              formatter={(value) => formatCurrency(value)}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap style={{ width: "100%" }}>
          <Input
            style={{ width: 320 }}
            placeholder="Cari work log, target, step..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
          <Select
            style={{ width: 220 }}
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
        </Space>
      </Card>

      <Card>
        <Table
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
      </Card>
    </div>
  );
};

export default ProductionHppAnalysis;
