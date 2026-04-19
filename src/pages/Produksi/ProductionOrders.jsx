// =====================================================
// Page: Production Orders
// Support:
// - targetType = semi_finished_material
// - targetType = product
// Fungsi:
// - planning produksi
// - shortage check
// - flow aktif: BOM -> PO -> Mulai Produksi -> Work Log -> Complete
// - reserve/release lama dipensiunkan dari UI utama
// =====================================================

import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
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
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import { EyeOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { toReferenceOptions } from "../../utils/produksi/productionReferenceHelpers";
import {
  buildCountSummary,
  createKeywordMatcher,
  matchFieldValue,
} from "../../utils/produksi/productionPageHelpers";
import ProductionFilterCard from "../../components/Produksi/shared/ProductionFilterCard";
import formatNumber from "../../utils/formatters/numberId";
import {
  createProductionOrder,
  generateProductionOrderCode,
  getActiveProductionBomOptions,
  getAllProductionOrders,
  getProductionOrderTargetVariantOptions,
  refreshProductionOrderRequirements,
} from "../../services/Produksi/productionOrdersService";
import { createProductionWorkLogFromOrder } from "../../services/Produksi/productionWorkLogsService";

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
  in_production: { text: "In Production", status: "processing" },
  completed: { text: "Completed", status: "success" },
  released: { text: "Released", status: "warning" },
  cancelled: { text: "Cancelled", status: "default" },
};

const PRIORITY_META_MAP = {
  low: { label: "Low", color: "default" },
  normal: { label: "Normal", color: "blue" },
  high: { label: "High", color: "orange" },
  urgent: { label: "Urgent", color: "red" },
};

// =====================================================
// Helper UI order
// Catatan maintainability:
// - Priority sengaja dipertahankan karena akan dipakai untuk scheduling.
// - Format tanggal dipusatkan di helper agar list dan drawer konsisten.
// =====================================================
const getPriorityMeta = (value) =>
  PRIORITY_META_MAP[value] || {
    label: value ? String(value) : "-",
    color: "default",
  };

const formatDateTimeLabel = (value) => {
  if (!value) return "-";
  const parsed = dayjs(value?.toDate?.() || value);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY HH:mm") : "-";
};

const ProductionOrders = () => {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [bomOptions, setBomOptions] = useState([]);
  const [bomLoading, setBomLoading] = useState(false);
  const [targetVariantOptions, setTargetVariantOptions] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [targetTypeFilter, setTargetTypeFilter] = useState("all");

  const [formVisible, setFormVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);

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

  // =====================================================
  // Muat opsi BOM aktif untuk dropdown PO
  // Catatan maintainability:
  // - Dipanggil ulang saat buka form, ganti target type, fokus dropdown, dan buka dropdown
  // - Tujuannya agar BOM aktif terbaru selalu dipakai oleh menu PO
  // =====================================================
  const loadBomOptions = async (targetType = "product") => {
    try {
      setBomLoading(true);
      const result = await getActiveProductionBomOptions(targetType);
      setBomOptions(toReferenceOptions(result || []));
    } catch (error) {
      console.error(error);
      setBomOptions([]);
      message.error("Gagal memuat BOM aktif");
    } finally {
      setBomLoading(false);
    }
  };

  const loadGeneratedCode = async (targetType = "product") => {
    try {
      setCodeLoading(true);
      const nextCode = await generateProductionOrderCode(targetType);
      form.setFieldValue("code", nextCode || "");
    } catch (error) {
      console.error(error);
      form.setFieldValue("code", "");
    } finally {
      setCodeLoading(false);
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
        form.setFieldsValue({
          targetVariantKey: undefined,
          targetVariantLabel: "",
        });
        return;
      }

      try {
        const result = await getProductionOrderTargetVariantOptions(bomIdValue);
        setTargetVariantOptions(result || []);

        if (!Array.isArray(result) || result.length === 0) {
          form.setFieldsValue({
            targetVariantKey: undefined,
            targetVariantLabel: "",
          });
        }
      } catch (error) {
        console.error(error);
        setTargetVariantOptions([]);
      }
    };

    loadTargetVariants();
  }, [bomIdValue, form]);

  const summary = useMemo(() => {
    return buildCountSummary(orders, {
      shortage: (item) => item.status === "shortage",
      ready: (item) => item.status === "ready",
      inProduction: (item) => item.status === "in_production",
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
      const matchTargetType = matchFieldValue(
        item,
        targetTypeFilter,
        "targetType",
      );

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

    setTargetVariantOptions([]);
    setFormVisible(true);

    await loadBomOptions("product");
    await loadGeneratedCode("product");
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const selectedVariant = targetVariantOptions.find(
        (item) => item.value === values.targetVariantKey,
      );

      setSubmitting(true);

      await createProductionOrder(
        {
          ...values,
          targetVariantLabel: selectedVariant?.label || "",
        },
        null,
      );

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

  // =====================================================
  // Mulai Produksi dari PO
  // Catatan maintainability:
  // - 1 PO = 1 Work Log
  // - Saat start, stok bahan dipotong sesuai requirement PO
  // - Work Log otomatis dibuat dari snapshot BOM/PO
  // =====================================================
  const handleStartProduction = async (record) => {
    try {
      await createProductionWorkLogFromOrder(record.id, {}, null);
      message.success("Produksi dimulai. Work Log dibuat dan stok bahan dipotong.");
      await loadData();
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal memulai produksi");
    }
  };

  // =====================================================
  // Kolom list Production Order
  // Catatan maintainability:
  // - Tabel utama dibuat ringkas agar scheduler cepat baca target, priority, qty, dan status.
  // - Detail stok requirement dipindah ke drawer agar list harian tetap ringan.
  // =====================================================
  const columns = [
    {
      title: "Order",
      key: "order",
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{record.code || "-"}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Dibuat: {formatDateTimeLabel(record.createdAt)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Target",
      key: "target",
      width: 340,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Space wrap size={[8, 4]}>
            <Typography.Text strong>{record.targetName || "-"}</Typography.Text>
            <Tag color={record.targetType === "product" ? "blue" : "purple"}>
              {record.targetType === "product" ? "Product" : "Semi Finished"}
            </Tag>
          </Space>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            BOM: {record.bomCode || "-"} - {record.bomName || "-"}
          </Typography.Text>
          {record.targetVariantLabel ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Varian: {record.targetVariantLabel}
            </Typography.Text>
          ) : null}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Estimasi Output: {formatNumber(record.expectedOutputQty || 0)} {record.targetUnit || "pcs"}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      width: 120,
      render: (value) => {
        const meta = getPriorityMeta(value);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: "Qty Batch",
      dataIndex: "batchCount",
      key: "batchCount",
      width: 110,
      render: (_, record) => formatNumber(record.batchCount ?? record.orderQty),
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
          <Typography.Text type="secondary">
            Shortage: {formatNumber(record.reservationSummary?.shortageLines || 0)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 140,
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
              onClick={() => handleStartProduction(record)}
            >
              Mulai Produksi
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // =====================================================
  // Kolom detail requirement pada drawer PO
  // Catatan maintainability:
  // - Current / Available tetap ditampilkan karena penting untuk keputusan start produksi.
  // - Reserved tidak dihapus, namun ditaruh sebagai info sekunder agar drawer lebih rapi.
  // =====================================================
  const detailRequirementColumns = useMemo(
    () => [
      {
        title: "Material",
        key: "item",
        render: (_, record) => (
          <Space direction="vertical" size={2}>
            <Typography.Text strong>{record.itemName || "-"}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {record.itemCode || "-"}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: "Tipe",
        dataIndex: "itemType",
        width: 130,
        render: (value) => (
          <Tag color={value === "raw_material" ? "orange" : "blue"}>
            {value === "raw_material" ? "Raw Material" : "Semi Finished"}
          </Tag>
        ),
      },
      {
        title: "Varian / Sumber",
        key: "variantSource",
        width: 180,
        render: (_, record) => (
          <Space direction="vertical" size={2}>
            <Tag color={record.stockSourceType === "variant" ? "purple" : "default"}>
              {record.stockSourceType === "variant" ? "Variant" : "Master"}
            </Tag>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {record.resolvedVariantLabel || "Tanpa varian"}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: "Kebutuhan",
        dataIndex: "qtyRequired",
        width: 140,
        render: (value, record) => (
          <Typography.Text strong>
            {formatNumber(value)} {record.unit || ""}
          </Typography.Text>
        ),
      },
      {
        title: "Stok Saat Ini",
        key: "stockSnapshot",
        width: 180,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text strong>
              {formatNumber(record.currentStockSnapshot || 0)} {record.unit || ""}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Tersedia: {formatNumber(record.availableStockSnapshot || 0)}
            </Typography.Text>
            {Number(record.reservedStockSnapshot || 0) > 0 ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Reserved: {formatNumber(record.reservedStockSnapshot || 0)}
              </Typography.Text>
            ) : null}
          </Space>
        ),
      },
      {
        title: "Shortage",
        dataIndex: "shortageQty",
        width: 120,
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
        width: 110,
        render: (value) =>
          value ? <Badge status="success" text="Cukup" /> : <Badge status="error" text="Kurang" />,
      },
    ],
    [],
  );

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
            <Statistic title="In Production" value={summary.inProduction} />
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
                            { value: "in_production", label: "In Production" },
              { value: "completed", label: "Completed" },
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
          setTargetVariantOptions([]);
        }}
        width={680}
        extra={
          <Space>
            <Button
              onClick={() => {
                setFormVisible(false);
                form.resetFields();
                setTargetVariantOptions([]);
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
            <Input
              placeholder="Auto generate"
              disabled
            />
          </Form.Item>

          <Form.Item
            label="Target Type"
            name="targetType"
            rules={[{ required: true, message: "Target type wajib dipilih" }]}
          >
            <Select
              options={PRODUCTION_ORDER_TARGET_TYPES}
              onChange={async (value) => {
                form.setFieldsValue({
                  code: "",
                  bomId: undefined,
                  targetVariantKey: undefined,
                  targetVariantLabel: "",
                });
                setTargetVariantOptions([]);
                await loadBomOptions(value);
                await loadGeneratedCode(value);
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
              loading={bomLoading}
              placeholder="Pilih BOM..."
              onFocus={() => loadBomOptions(targetTypeValue || "product")}
              onDropdownVisibleChange={(open) => {
                if (open) loadBomOptions(targetTypeValue || "product");
              }}
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
              rules={[
                { required: true, message: "Varian target wajib dipilih" },
              ]}
              extra="Pilih varian target agar material inherit membaca stok varian yang benar."
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={targetVariantOptions}
                placeholder="Pilih varian target..."
                onChange={(value) => {
                  const selectedVariant = targetVariantOptions.find(
                    (item) => item.value === value,
                  );
                  form.setFieldValue(
                    "targetVariantLabel",
                    selectedVariant?.label || "",
                  );
                }}
              />
            </Form.Item>
          ) : null}

          <Form.Item
            label="Qty Batch Produksi"
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
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Qty Batch"
                    value={formatNumber(selectedOrder.batchCount ?? selectedOrder.orderQty)}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Estimasi Output"
                    value={formatNumber(selectedOrder.expectedOutputQty || 0)}
                    suffix={selectedOrder.targetUnit || "pcs"}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card size="small">
                  <Typography.Text type="secondary">Priority</Typography.Text>
                  <div style={{ marginTop: 8 }}>
                    <Tag color={getPriorityMeta(selectedOrder.priority).color}>
                      {getPriorityMeta(selectedOrder.priority).label}
                    </Tag>
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card size="small">
                  <Typography.Text type="secondary">Status</Typography.Text>
                  <div style={{ marginTop: 8 }}>
                    <Badge
                      status={(ORDER_STATUS_MAP[selectedOrder.status] || ORDER_STATUS_MAP.draft).status}
                      text={(ORDER_STATUS_MAP[selectedOrder.status] || ORDER_STATUS_MAP.draft).text}
                    />
                  </div>
                </Card>
              </Col>
            </Row>

            {/* =====================================================
                Ringkasan order.
                Blok ini dipakai user operasional untuk membaca target, BOM,
                dan priority tanpa harus memindai tabel requirement. */}
            <Descriptions
              bordered
              size="small"
              column={1}
              title="Ringkasan Order"
            >
              <Descriptions.Item label="Kode">
                {selectedOrder.code || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Target Type">
                {selectedOrder.targetType === "product" ? "Product" : "Semi Finished"}
              </Descriptions.Item>
              <Descriptions.Item label="Target">
                {selectedOrder.targetName || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Varian Target">
                {selectedOrder.targetVariantLabel || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="BOM / Step">
                {selectedOrder.bomCode || "-"} - {selectedOrder.bomName || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Priority">
                <Tag color={getPriorityMeta(selectedOrder.priority).color}>
                  {getPriorityMeta(selectedOrder.priority).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Dibuat Pada">
                {formatDateTimeLabel(selectedOrder.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Mulai Produksi">
                {formatDateTimeLabel(selectedOrder.startedAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Catatan">
                {selectedOrder.notes || "-"}
              </Descriptions.Item>
            </Descriptions>

            {(selectedOrder.reservationSummary?.shortageLines || 0) > 0 ? (
              <Alert
                type="error"
                showIcon
                message={`Ada ${formatNumber(
                  selectedOrder.reservationSummary?.shortageLines,
                )} item yang stoknya masih kurang.`}
                description="Cek baris requirement di bawah untuk tahu material mana yang harus disiapkan lebih dulu."
              />
            ) : (
              <Alert
                type="success"
                showIcon
                message="Semua kebutuhan material cukup dan siap untuk mulai produksi."
                description="PO ini bisa langsung masuk ke antrian produksi tanpa perlu penyesuaian stok tambahan."
              />
            )}

            <Divider orientation="left">Requirement Material</Divider>

            <Table
              rowKey="id"
              pagination={false}
              dataSource={selectedOrder.materialRequirementLines || []}
              columns={detailRequirementColumns}
              scroll={{ x: 980 }}
            />
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default ProductionOrders;
