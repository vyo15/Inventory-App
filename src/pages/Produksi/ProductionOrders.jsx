// =====================================================
// Page: Production Orders
// Support:
// - targetType = semi_finished_material
// - targetType = product
// Fungsi:
// - planning produksi
// - shortage check
// - reserve stock
// - generate ke work log (tahap berikutnya disambungkan penuh)
// =====================================================

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import { EyeOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { toReferenceOptions } from '../../utils/produksi/productionReferenceHelpers';
import { buildCountSummary, createKeywordMatcher, matchFieldValue } from '../../utils/produksi/productionPageHelpers';
import ProductionPageHeader from '../../components/Produksi/shared/ProductionPageHeader';
import ProductionSummaryCards from '../../components/Produksi/shared/ProductionSummaryCards';
import ProductionFilterCard from '../../components/Produksi/shared/ProductionFilterCard';
import formatNumber from '../../utils/formatters/numberId';
import {
  createProductionOrder,
  getActiveProductionBomOptions,
  getAllProductionOrders,
  getProductionOrderTargetVariantOptions,
  refreshProductionOrderRequirements,
  releaseProductionOrderReservation,
  reserveProductionOrder,
} from "../../services/Produksi/productionOrdersService";

const PRODUCTION_ORDER_TARGET_TYPES = [
  {
    value: "semi_finished_material",
    label: "Semi Finished",
  },
  {
    value: "product",
    label: "Product",
  },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const ORDER_STATUS_MAP = {
  draft: { text: "Draft", status: "default" },
  shortage: { text: "Shortage", status: "error" },
  ready: { text: "Ready", status: "processing" },
  reserved: { text: "Reserved", status: "success" },
  in_production: { text: "In Production", status: "processing" },
  completed: { text: "Completed", status: "success" },
  released: { text: "Released", status: "warning" },
  cancelled: { text: "Cancelled", status: "default" },
};

const ProductionOrders = () => {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [bomOptions, setBomOptions] = useState([]);
  const [targetVariantOptions, setTargetVariantOptions] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [targetTypeFilter, setTargetTypeFilter] = useState("all");

  const [formVisible, setFormVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState(null);

  const [form] = Form.useForm();

  const targetTypeValue = Form.useWatch("targetType", form);
  const bomIdValue = Form.useWatch("bomId", form);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await getAllProductionOrders();
      setOrders(result);
    } catch (error) {
      console.error(error);
      message.error("Gagal memuat production orders");
    } finally {
      setLoading(false);
    }
  };

  const loadBomOptions = async (targetType = "product") => {
    try {
      const result = await getActiveProductionBomOptions(targetType);

      setBomOptions(toReferenceOptions(result || []));
    } catch (error) {
      console.error(error);
      setBomOptions([]);
      message.error("Gagal memuat BOM aktif");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (targetTypeValue) {
      loadBomOptions(targetTypeValue);
    }
  }, [targetTypeValue]);

  useEffect(() => {
    const loadTargetVariants = async () => {
      if (!bomIdValue) {
        setTargetVariantOptions([]);
        form.setFieldsValue({ targetVariantKey: undefined, targetVariantLabel: "" });
        return;
      }

      try {
        const result = await getProductionOrderTargetVariantOptions(bomIdValue);
        setTargetVariantOptions(result || []);

        if (!Array.isArray(result) || result.length === 0) {
          form.setFieldsValue({ targetVariantKey: undefined, targetVariantLabel: "" });
        }
      } catch (error) {
        console.error(error);
        setTargetVariantOptions([]);
      }
    };

    loadTargetVariants();
  }, [bomIdValue]);

  const summary = useMemo(() => {
    return buildCountSummary(orders, {
      shortage: (item) => item.status === "shortage",
      ready: (item) => item.status === "ready",
      reserved: (item) => item.status === "reserved",
    });
  }, [orders]);

  const filteredData = useMemo(() => {
    return orders.filter((item) => {
      const matchSearch = createKeywordMatcher(
        item,
        ["code", "targetName", "bomName"],
        search,
      );

      const matchStatus = matchFieldValue(item, statusFilter, "status");
      const matchTargetType = matchFieldValue(item, targetTypeFilter, "targetType");

      return matchSearch && matchStatus && matchTargetType;
    });
  }, [orders, search, statusFilter, targetTypeFilter]);

  const handleAdd = async () => {
    form.resetFields();
    form.setFieldsValue({
      code: "",
      targetType: "product",
      bomId: undefined,
      targetVariantKey: undefined,
      targetVariantLabel: "",
      orderQty: 1,
      priority: "normal",
      notes: "",
    });

    setFormVisible(true);
    await loadBomOptions("product");
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const selectedVariant = targetVariantOptions.find((item) => item.value === values.targetVariantKey);

      setSubmitting(true);
      await createProductionOrder({
        ...values,
        targetVariantLabel: selectedVariant?.label || "",
      }, null);
      message.success("Production order berhasil dibuat");

      setFormVisible(false);
      form.resetFields();
      await loadData();
    } catch (error) {
      if (error?.errorFields) return;

      if (error?.type === "validation" && error?.errors) {
        const fields = Object.entries(error.errors).map(([name, errors]) => ({
          name,
          errors: [errors],
        }));
        form.setFields(fields);
        return;
      }

      console.error(error);
      message.error(error?.message || "Gagal membuat production order");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefreshRequirement = async (record) => {
    try {
      await refreshProductionOrderRequirements(record.id, null);
      message.success("Kebutuhan material berhasil diperbarui");
      await loadData();
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal refresh kebutuhan order");
    }
  };

  const handleReserve = async (record) => {
    try {
      await reserveProductionOrder(record.id, null);
      message.success("Stock berhasil di-reserve");
      await loadData();
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal reserve order");
    }
  };

  const handleRelease = async (record) => {
    try {
      await releaseProductionOrderReservation(record.id, null);
      message.success("Reservasi berhasil dilepas");
      await loadData();
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal melepas reservasi");
    }
  };

  const columns = [
    {
      title: "Kode",
      dataIndex: "code",
      key: "code",
      width: 150,
      render: (value) => (
        <Typography.Text strong>{value || "-"}</Typography.Text>
      ),
    },
    {
      title: "Target Type",
      dataIndex: "targetType",
      key: "targetType",
      width: 140,
      render: (value) => (
        <Tag color={value === "product" ? "blue" : "purple"}>
          {value === "product" ? "Product" : "Semi Finished"}
        </Tag>
      ),
    },
    {
      title: "Target",
      key: "target",
      width: 240,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.targetName || "-"}</div>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>
            BOM: {record.bomCode || "-"} - {record.bomName || "-"}
          </div>
          {record.targetVariantLabel ? (
            <div style={{ fontSize: 12, color: "#8c8c8c" }}>
              Varian: {record.targetVariantLabel}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: "Qty",
      dataIndex: "orderQty",
      key: "orderQty",
      width: 100,
      render: (value) => formatNumber(value),
    },
    {
      title: "Requirement",
      key: "requirement",
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>
            Line: {formatNumber(record.reservationSummary?.totalLines || 0)}
          </Typography.Text>
          <Typography.Text>
            Shortage:{" "}
            {formatNumber(record.reservationSummary?.shortageLines || 0)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (value) => {
        const meta = ORDER_STATUS_MAP[value] || ORDER_STATUS_MAP.draft;
        return <Badge status={meta.status} text={meta.text} />;
      },
    },
    {
      title: "Aksi",
      key: "actions",
      width: 320,
      render: (_, record) => (
        <Space wrap>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedOrder(record);
              setDetailVisible(true);
            }}
          >
            Detail
          </Button>

          {(record.status === "shortage" || record.status === "ready") && (
            <Button
              size="small"
              onClick={() => handleRefreshRequirement(record)}
            >
              Refresh Need
            </Button>
          )}

          {record.status === "ready" && (
            <Button
              size="small"
              type="primary"
              onClick={() => handleReserve(record)}
            >
              Reserve
            </Button>
          )}

          {record.status === "reserved" && (
            <Popconfirm
              title="Lepas reservasi order ini?"
              onConfirm={() => handleRelease(record)}
              okText="Ya"
              cancelText="Batal"
            >
              <Button size="small">Release</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Typography.Title level={3} style={{ margin: 0 }}>
              Production Orders
            </Typography.Title>
            <Typography.Text type="secondary">
              Planning produksi untuk semi finished dan product
            </Typography.Text>
          </Col>

          <Col>
            <Space wrap>
              <Button icon={<ReloadOutlined />} onClick={loadData}>
                Refresh
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                Buat Order
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Total Order" value={summary.total} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Shortage" value={summary.shortage} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Ready" value={summary.ready} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Reserved" value={summary.reserved} />
          </Card>
        </Col>
      </Row>

      <ProductionFilterCard>
          <Col xs={24} md={8}>
            <Input
              placeholder="Cari kode, target, BOM..."
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
                ...PRODUCTION_ORDER_TARGET_TYPES,
              ]}
            />
          </Col>

          <Col xs={24} md={8}>
            <Select
              style={{ width: "100%" }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "Semua Status" },
                { value: "shortage", label: "Shortage" },
                { value: "ready", label: "Ready" },
                { value: "reserved", label: "Reserved" },
                { value: "in_production", label: "In Production" },
                { value: "completed", label: "Completed" },
                { value: "released", label: "Released" },
              ]}
            />
          </Col>
      </ProductionFilterCard>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredData}
          scroll={{ x: 1500 }}
          locale={{
            emptyText: <Empty description="Belum ada production order" />,
          }}
        />
      </Card>

      <Drawer
        title="Buat Production Order"
        open={formVisible}
        onClose={() => {
          setFormVisible(false);
          form.resetFields();
        }}
        width={680}
        extra={
          <Space>
            <Button
              onClick={() => {
                setFormVisible(false);
                form.resetFields();
              }}
            >
              Batal
            </Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              Simpan
            </Button>
          </Space>
        }
      >
        <Alert
          style={{ marginBottom: 16 }}
          type="info"
          showIcon
          message="Production Order membaca BOM lalu menghitung kebutuhan material. Jika bahan cukup, status akan menjadi Ready. Jika kurang, status menjadi Shortage."
        />

        <Form form={form} layout="vertical">
          <Form.Item label="Kode Order" name="code">
            <Input placeholder="Kosongkan untuk auto generate" />
          </Form.Item>

          <Form.Item
            label="Target Type"
            name="targetType"
            rules={[{ required: true, message: "Target type wajib dipilih" }]}
          >
            <Select
              options={PRODUCTION_ORDER_TARGET_TYPES}
              onChange={(value) => {
                form.setFieldsValue({
                  bomId: undefined,
                  targetVariantKey: undefined,
                  targetVariantLabel: "",
                });
                loadBomOptions(value);
              }}
            />
          </Form.Item>

          <Form.Item
            label="BOM"
            name="bomId"
            rules={[{ required: true, message: "BOM wajib dipilih" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={bomOptions}
              placeholder="Pilih BOM..."
              onChange={() => {
                form.setFieldsValue({
                  targetVariantKey: undefined,
                  targetVariantLabel: "",
                });
              }}
            />
          </Form.Item>

          {targetVariantOptions.length > 0 ? (
            <Form.Item
              label="Varian Target"
              name="targetVariantKey"
              rules={[{ required: true, message: "Varian target wajib dipilih" }]}
              extra="Pilih varian target agar material inherit membaca stok varian yang benar."
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={targetVariantOptions}
                placeholder="Pilih varian target..."
                onChange={(value) => {
                  const selectedVariant = targetVariantOptions.find((item) => item.value === value);
                  form.setFieldValue("targetVariantLabel", selectedVariant?.label || "");
                }}
              />
            </Form.Item>
          ) : null}

          <Form.Item
            label="Qty Order / Produksi"
            name="orderQty"
            rules={[{ required: true, message: "Qty order wajib diisi" }]}
          >
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item label="Priority" name="priority">
            <Select options={PRIORITY_OPTIONS} />
          </Form.Item>

          <Form.Item label="Catatan" name="notes">
            <Input.TextArea rows={3} placeholder="Catatan order..." />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title="Detail Production Order"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={920}
      >
        {!selectedOrder ? (
          <Empty description="Tidak ada data" />
        ) : (
          <>
            <Descriptions
              bordered
              size="small"
              column={1}
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label="Kode">
                {selectedOrder.code || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Target Type">
                {selectedOrder.targetType === "product"
                  ? "Product"
                  : "Semi Finished"}
              </Descriptions.Item>
              <Descriptions.Item label="Target">
                {selectedOrder.targetName || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Varian Target">
                {selectedOrder.targetVariantLabel || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="BOM">
                {selectedOrder.bomCode || "-"} - {selectedOrder.bomName || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Qty Order">
                {formatNumber(selectedOrder.orderQty)}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                {ORDER_STATUS_MAP[selectedOrder.status]?.text || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Priority">
                {selectedOrder.priority || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Catatan">
                {selectedOrder.notes || "-"}
              </Descriptions.Item>
            </Descriptions>

            {(selectedOrder.reservationSummary?.shortageLines || 0) > 0 ? (
              <Alert
                style={{ marginBottom: 16 }}
                type="error"
                showIcon
                message={`Ada ${formatNumber(
                  selectedOrder.reservationSummary?.shortageLines,
                )} item yang stoknya kurang.`}
              />
            ) : (
              <Alert
                style={{ marginBottom: 16 }}
                type="success"
                showIcon
                message="Semua kebutuhan material cukup."
              />
            )}

            <Divider orientation="left">Requirement Lines</Divider>

            <Table
              rowKey="id"
              pagination={false}
              dataSource={selectedOrder.materialRequirementLines || []}
              columns={[
                {
                  title: "Item",
                  key: "item",
                  render: (_, record) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {record.itemName || "-"}
                      </div>
                      <div style={{ fontSize: 12, color: "#8c8c8c" }}>
                        {record.itemCode || "-"}
                      </div>
                    </div>
                  ),
                },
                {
                  title: "Tipe",
                  dataIndex: "itemType",
                  render: (value) => (
                    <Tag color={value === "raw_material" ? "orange" : "blue"}>
                      {value === "raw_material"
                        ? "Raw Material"
                        : "Semi Finished"}
                    </Tag>
                  ),
                },
                {
                  title: "Sumber Stok",
                  key: "stockSourceType",
                  render: (_, record) => (
                    <Space direction="vertical" size={0}>
                      <Tag color={record.stockSourceType === "variant" ? "purple" : "default"}>
                        {record.stockSourceType === "variant" ? "Variant" : "Master"}
                      </Tag>
                      {record.resolvedVariantLabel ? (
                        <Typography.Text type="secondary">{record.resolvedVariantLabel}</Typography.Text>
                      ) : null}
                    </Space>
                  ),
                },
                {
                  title: "Need",
                  dataIndex: "qtyRequired",
                  render: (value, record) =>
                    `${formatNumber(value)} ${record.unit || ""}`,
                },
                {
                  title: "Current",
                  dataIndex: "currentStockSnapshot",
                  render: (value) => formatNumber(value),
                },
                {
                  title: "Reserved",
                  dataIndex: "reservedStockSnapshot",
                  render: (value) => formatNumber(value),
                },
                {
                  title: "Available",
                  dataIndex: "availableStockSnapshot",
                  render: (value) => formatNumber(value),
                },
                {
                  title: "Shortage",
                  dataIndex: "shortageQty",
                  render: (value) =>
                    Number(value || 0) > 0 ? (
                      <Tag color="red">{formatNumber(value)}</Tag>
                    ) : (
                      <Tag color="green">0</Tag>
                    ),
                },
                {
                  title: "Status",
                  dataIndex: "isSufficient",
                  render: (value) =>
                    value ? (
                      <Badge status="success" text="Cukup" />
                    ) : (
                      <Badge status="error" text="Kurang" />
                    ),
                },
              ]}
            />
          </>
        )}
      </Drawer>
    </div>
  );
};

export default ProductionOrders;
