import { useCallback, useMemo } from "react";
import {
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Row,
  Space,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import {
  WORK_LOG_SOURCE_TYPE_MAP,
  WORK_LOG_STATUS_MAP,
  WORK_LOG_TARGET_TYPE_MAP,
} from "../../../constants/productionWorkLogOptions";
import formatCurrency from "../../../utils/formatters/currencyId";
import formatNumber from "../../../utils/formatters/numberId";
import { resolveWorkLogLaborCostDisplay } from "../../../utils/produksi/productionPayrollRuleHelpers";
import { resolveDisplayReference } from "../../../utils/references/displayReferenceResolver";
import DataTableView from "../../../components/Layout/Table/DataTableView";

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const safeText = (value) => String(value || "").trim();

const formatDisplayDate = (value, format = "DD/MM/YYYY") => {
  const rawValue = value?.toDate ? value.toDate() : value;
  return rawValue ? dayjs(rawValue).format(format) : "-";
};

const getWorkLogStatusTagColor = (status) => {
  switch (status) {
    case "completed":
      return "green";
    case "in_progress":
      return "blue";
    case "cancelled":
      return "red";
    case "draft":
    default:
      return "default";
  }
};

const getWorkLogSourceTagColor = (sourceType) =>
  sourceType === "production_order" ? "purple" : "blue";

const findWorkLogStepMaster = (workLog = {}, productionSteps = []) =>
  (productionSteps || []).find((item) => {
    if (safeText(workLog.stepId) && safeText(item.id) === safeText(workLog.stepId)) return true;
    return safeText(workLog.stepCode) && safeText(item.code) === safeText(workLog.stepCode);
  }) || null;

const getScaledBomOverheadEstimate = ({ workLog = {}, boms = [] } = {}) => {
  const bom = (boms || []).find((item) => safeText(item.id) === safeText(workLog.bomId));
  const overheadPerBatch = safeNumber(bom?.overheadCostEstimate);
  if (overheadPerBatch <= 0) return 0;

  return overheadPerBatch * Math.max(1, safeNumber(workLog.plannedQty, 1));
};

const ProductionWorkLogDetailDrawer = ({
  open,
  onClose,
  selectedRecord,
  productionPayrolls = [],
  referenceData = {},
}) => {
  const workLogUiClassNames = useMemo(
    () => ({
      stack: "ims-cell-stack ims-cell-stack-tight",
      meta: "ims-cell-meta",
      title: "ims-cell-title",
    }),
    [],
  );

  const renderWorkLogCellBlock = useCallback(
    (primary, secondaryLines = []) => (
      <div className={workLogUiClassNames.stack}>
        <div className={workLogUiClassNames.title}>{primary || "-"}</div>
        {secondaryLines.filter(Boolean).map((line, index) => (
          <div key={index} className={workLogUiClassNames.meta}>{line}</div>
        ))}
      </div>
    ),
    [workLogUiClassNames.meta, workLogUiClassNames.stack, workLogUiClassNames.title],
  );

  const getStockSourceTagColor = useCallback(
    (stockSourceType) => (stockSourceType === "variant" ? "purple" : "default"),
    [],
  );

  // =====================================================
  // IMS NOTE [AKTIF/UI-ONLY] - Detail drawer Work Log.
  // Fungsi blok: memusatkan data detail Work Log agar page utama tidak terlalu besar.
  // Hubungan flow: hanya presentasi read-only; create/update/complete Work Log, stok, payroll, dan HPP tetap di service/page lama.
  // =====================================================
  const detailWorkerNames = useMemo(() => {
    if (!selectedRecord || !Array.isArray(selectedRecord.workerNames)) {
      return [];
    }

    return selectedRecord.workerNames.filter(Boolean);
  }, [selectedRecord]);

  const detailRelatedPayrolls = useMemo(() => {
    if (!selectedRecord) return [];

    const workLogId = safeText(selectedRecord.id);
    const workNumber = safeText(selectedRecord.workNumber);

    return productionPayrolls.filter((item) => (
      (workLogId && safeText(item.workLogId) === workLogId) ||
      (workNumber && safeText(item.workNumber) === workNumber)
    ));
  }, [productionPayrolls, selectedRecord]);

  const detailLaborCostDisplay = useMemo(() => {
    if (!selectedRecord) {
      return { amount: 0, label: "-", tagColor: "default", helper: "-" };
    }

    return resolveWorkLogLaborCostDisplay({
      workLog: selectedRecord,
      relatedPayrolls: detailRelatedPayrolls,
      productionStep: findWorkLogStepMaster(selectedRecord, referenceData.productionSteps || []),
    });
  }, [detailRelatedPayrolls, referenceData.productionSteps, selectedRecord]);

  const detailLaborDisplay = detailLaborCostDisplay.amount || detailLaborCostDisplay.displayAmount || 0;

  const detailOverheadCostDisplay = useMemo(() => {
    if (!selectedRecord) {
      return { amount: 0, label: "-", tagColor: "default", helper: "-" };
    }

    const overheadActual = safeNumber(selectedRecord.overheadCostActual);
    if (overheadActual > 0) {
      return {
        amount: overheadActual,
        label: "Dari Resep Produksi",
        tagColor: "blue",
        helper: "Overhead dari resep produksi.",
      };
    }

    const overheadEstimate = getScaledBomOverheadEstimate({
      workLog: selectedRecord,
      boms: referenceData.boms || [],
    });

    if (overheadEstimate > 0) {
      return {
        amount: overheadEstimate,
        label: "Estimasi Resep",
        tagColor: "default",
        helper: "Info arsip; belum disimpan sebagai overhead aktual.",
      };
    }

    return {
      amount: 0,
      label: "Tidak dipakai",
      tagColor: "default",
      helper: "Overhead resep belum diisi.",
    };
  }, [referenceData.boms, selectedRecord]);

  const detailDisplayedTotalCost = selectedRecord
    ? safeNumber(selectedRecord.materialCostActual) +
      safeNumber(detailOverheadCostDisplay.amount) +
      safeNumber(detailLaborDisplay)
    : 0;
  const detailDisplayedCostPerGoodUnit =
    selectedRecord && safeNumber(selectedRecord.goodQty) > 0
      ? detailDisplayedTotalCost / safeNumber(selectedRecord.goodQty)
      : 0;

  const detailMetricCards = useMemo(() => {
    if (!selectedRecord) return [];

    const unitLabel = selectedRecord.targetUnit || "pcs";

    return [
      {
        key: "batch",
        label: "Qty Batch",
        value: formatNumber(selectedRecord.plannedQty || 0),
        helper: "Jumlah batch yang dikerjakan",
      },
      {
        key: "estimate",
        label: "Estimasi Output",
        value: `${formatNumber(selectedRecord.theoreticalOutputQty || 0)} ${unitLabel}`,
        helper: `Tahapan: ${selectedRecord.stepName || "-"}`,
      },
      {
        key: "good",
        label: "Hasil Baik",
        value: `${formatNumber(selectedRecord.goodQty || 0)} ${unitLabel}`,
        helper: "Qty yang masuk stok/output produksi",
      },
      {
        key: "cost",
        label: detailLaborCostDisplay.isFinal ? "Total Biaya Final" : "Estimasi Biaya",
        value: formatCurrency(detailDisplayedTotalCost),
        helper: detailLaborCostDisplay.isFinal
          ? `Cost / good unit ${formatCurrency(detailDisplayedCostPerGoodUnit)}`
          : `${detailLaborCostDisplay.totalStatusLabel || "Preview"}; final menunggu payroll confirmed/paid.`,
      },
    ];
  }, [
    detailDisplayedCostPerGoodUnit,
    detailDisplayedTotalCost,
    detailLaborCostDisplay.isFinal,
    detailLaborCostDisplay.totalStatusLabel,
    selectedRecord,
  ]);

  const detailMaterialColumns = useMemo(
    () => [
      {
        title: "Material",
        key: "item",
        render: (_, record) => (
          renderWorkLogCellBlock(record.itemName || "-", [
            record.resolvedVariantLabel ? `Varian: ${record.resolvedVariantLabel}` : null,
          ])
        ),
      },
      {
        title: "Sumber Stok",
        key: "stockSource",
        width: 160,
        render: (_, record) => (
          <div className={workLogUiClassNames.stack}>
            <Tag className="ims-status-tag" color={getStockSourceTagColor(record.stockSourceType)}>
              {record.stockSourceType === "variant" ? "Variant" : "Master"}
            </Tag>
            {record.stockSourceType === "variant" && record.resolvedVariantLabel ? (
              <Typography.Text type="secondary" className={workLogUiClassNames.meta}>
                {record.resolvedVariantLabel}
              </Typography.Text>
            ) : null}
          </div>
        ),
      },
      {
        title: "Pemakaian",
        key: "qty",
        width: 180,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text>
              Plan: {formatNumber(record.plannedQty)} {record.unit || ""}
            </Typography.Text>
            <Typography.Text type="secondary">
              Actual: {formatNumber(record.actualQty)} {record.unit || ""}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: "Biaya",
        key: "cost",
        width: 180,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text>
              {formatCurrency(record.totalCostSnapshot || 0)}
            </Typography.Text>
            <Typography.Text type="secondary">
              Unit: {formatCurrency(record.costPerUnitSnapshot || 0)}
            </Typography.Text>
          </Space>
        ),
      },
    ],
    [getStockSourceTagColor, renderWorkLogCellBlock, workLogUiClassNames.meta, workLogUiClassNames.stack],
  );

  const detailOutputColumns = useMemo(
    () => [
      {
        title: "Output",
        key: "output",
        render: (_, record) => (
          renderWorkLogCellBlock(record.outputName || "-", [
            record.outputCode || "-",
            WORK_LOG_TARGET_TYPE_MAP[record.outputType] || record.outputType || "-",
            record.outputVariantLabel ? `Varian: ${record.outputVariantLabel}` : null,
          ])
        ),
      },
      {
        title: "Target Stok",
        key: "stockTarget",
        width: 170,
        render: (_, record) => (
          <div className={workLogUiClassNames.stack}>
            <Tag className="ims-status-tag" color={getStockSourceTagColor(record.stockSourceType)}>
              {record.stockSourceType === "variant" ? "Masuk ke Variant" : "Masuk ke Master"}
            </Tag>
            {record.outputVariantLabel ? (
              <Typography.Text type="secondary" className={workLogUiClassNames.meta}>
                {record.outputVariantLabel}
              </Typography.Text>
            ) : null}
          </div>
        ),
      },
      {
        title: "Hasil",
        key: "result",
        width: 180,
        render: (_, record) => (
          <Typography.Text>
            Good: {formatNumber(record.goodQty)} {record.unit || ""}
          </Typography.Text>
        ),
      },
      {
        title: "Mutasi Stok",
        key: "stockAdded",
        width: 150,
        render: (_, record) => (
          <Tag className="ims-status-tag" color={record.stockAdded ? "green" : "default"}>
            {record.stockAdded ? "Sudah masuk stok" : "Belum diposting"}
          </Tag>
        ),
      },
    ],
    [getStockSourceTagColor, renderWorkLogCellBlock, workLogUiClassNames.meta, workLogUiClassNames.stack],
  );

  return (
    <Drawer
      title="Detail Work Log Produksi"
      open={open}
      onClose={onClose}
      width={980}
    >
      {!selectedRecord ? (
        <Empty description="Tidak ada data" />
      ) : (
        <>
          <Space wrap size={[8, 8]} style={{ marginBottom: 16 }}>
            <Tag className="ims-status-tag" color={getWorkLogStatusTagColor(selectedRecord.status)}>
              {WORK_LOG_STATUS_MAP[selectedRecord.status] || "-"}
            </Tag>
            <Tag className="ims-status-tag" color={getWorkLogSourceTagColor(selectedRecord.sourceType)}>
              {WORK_LOG_SOURCE_TYPE_MAP[selectedRecord.sourceType] ||
                selectedRecord.sourceType ||
                "-"}
            </Tag>
            <Tag className="ims-status-tag">{selectedRecord.productionOrderCode || "Tanpa PO"}</Tag>
          </Space>

          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            {detailMetricCards.map((item) => (
              <Col xs={24} sm={12} xl={6} key={item.key}>
                <Card size="small">
                  <Typography.Text type="secondary">
                    {item.label}
                  </Typography.Text>
                  <div className="ims-detail-value" style={{ marginTop: 6 }}>
                    {item.value}
                  </div>
                  <div className="ims-cell-meta" style={{ marginTop: 6 }}>
                    {item.helper}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} xl={14}>
              <Card size="small" title="Ringkasan Work Log">
                <Descriptions bordered size="small" column={1}>
                  <Descriptions.Item label="No. Work Log">
                    {resolveDisplayReference(selectedRecord, { fields: ["workNumber"], fallback: "-" })}
                  </Descriptions.Item>
                  <Descriptions.Item label="Tanggal">
                    {formatDisplayDate(selectedRecord.workDate)}
                  </Descriptions.Item>
                  <Descriptions.Item label="No. Order Produksi">
                    {selectedRecord.productionOrderCode || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Jenis Target">
                    {WORK_LOG_TARGET_TYPE_MAP[selectedRecord.targetType] || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Target">
                    <Space direction="vertical" size={0}>
                      <Typography.Text strong>
                        {selectedRecord.targetName || "-"}
                      </Typography.Text>
                      {selectedRecord.targetVariantLabel ? (
                        <Typography.Text type="secondary">
                          Varian: {selectedRecord.targetVariantLabel}
                        </Typography.Text>
                      ) : null}
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="Tahapan">
                    {selectedRecord.stepName || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Profil Produksi">
                    {selectedRecord.productionProfileName || "-"}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>

            <Col xs={24} xl={10}>
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Card size="small" title="Tim & Catatan">
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    <div>
                      <Typography.Text type="secondary">
                        Operator Produksi
                      </Typography.Text>
                      <div style={{ marginTop: 8 }}>
                        {detailWorkerNames.length > 0 ? (
                          <Space wrap size={[8, 8]}>
                            {detailWorkerNames.map((name) => (
                              <Tag key={name} color="blue">
                                {name}
                              </Tag>
                            ))}
                          </Space>
                        ) : (
                          <Typography.Text type="secondary">
                            Belum ada operator dipilih.
                          </Typography.Text>
                        )}
                      </div>
                    </div>

                    <Divider style={{ margin: 0 }} />

                    <div>
                      <Typography.Text type="secondary">
                        Catatan Eksekusi
                      </Typography.Text>
                      <div style={{ marginTop: 8 }}>
                        <Typography.Paragraph style={{ marginBottom: 0 }}>
                          {selectedRecord.notes || "Belum ada catatan work log."}
                        </Typography.Paragraph>
                      </div>
                    </div>
                  </Space>
                </Card>

                <Card size="small" title="Biaya Produksi">
                  <Row gutter={[12, 12]}>
                    <Col span={12}>
                      <Typography.Text type="secondary">Material</Typography.Text>
                      <div className="ims-cell-title" style={{ marginTop: 4 }}>
                        {formatCurrency(selectedRecord.materialCostActual || 0)}
                      </div>
                    </Col>
                    <Col span={12}>
                      <Typography.Text type="secondary">Tenaga Kerja</Typography.Text>
                      <div className="ims-cell-title" style={{ marginTop: 4 }}>
                        {formatCurrency(detailLaborDisplay)}
                      </div>
                      <Tag
                        className="ims-status-tag"
                        color={detailLaborCostDisplay.tagColor}
                        style={{ marginTop: 4 }}
                      >
                        {detailLaborCostDisplay.label}
                      </Tag>
                      <div className="ims-cell-meta" style={{ marginTop: 4 }}>
                        {detailLaborCostDisplay.helper}
                      </div>
                    </Col>
                    <Col span={12}>
                      <Typography.Text type="secondary">Overhead</Typography.Text>
                      <div className="ims-cell-title" style={{ marginTop: 4 }}>
                        {formatCurrency(detailOverheadCostDisplay.amount)}
                      </div>
                      <Tag
                        className="ims-status-tag"
                        color={detailOverheadCostDisplay.tagColor}
                        style={{ marginTop: 4 }}
                      >
                        {detailOverheadCostDisplay.label}
                      </Tag>
                      <div className="ims-cell-meta" style={{ marginTop: 4 }}>
                        {detailOverheadCostDisplay.helper}
                      </div>
                    </Col>
                  </Row>
                </Card>
              </Space>
            </Col>
          </Row>

          <Card size="small" title="Pemakaian Material" style={{ marginBottom: 16 }}>
            <DataTableView
              className="ims-table"
              rowKey={(record, index) => record.id || `material-${index}`}
              pagination={false}
              size="small"
              showRefreshIndicator={false}
              dataSource={selectedRecord.materialUsages || []}
              locale={{ emptyText: "Belum ada material usage" }}
              columns={detailMaterialColumns}
              mobileCardConfig={{
                title: (record) => record.itemName || "Material",
                subtitle: (record) => record.resolvedVariantLabel ? `Varian: ${record.resolvedVariantLabel}` : null,
                tags: (record) => (
                  <Tag className="ims-status-tag" color={getStockSourceTagColor(record.stockSourceType)}>
                    {record.stockSourceType === "variant" ? "Variant" : "Master"}
                  </Tag>
                ),
                meta: [
                  { label: "Plan", value: (record) => `${formatNumber(record.plannedQty)} ${record.unit || ""}` },
                  { label: "Actual", value: (record) => `${formatNumber(record.actualQty)} ${record.unit || ""}` },
                  { label: "Biaya", value: (record) => formatCurrency(record.totalCostSnapshot || 0) },
                ],
              }}
            />
          </Card>

          <Card size="small" title="Hasil Produksi">
            <DataTableView
              className="ims-table"
              rowKey={(record, index) => record.id || `output-${index}`}
              pagination={false}
              size="small"
              showRefreshIndicator={false}
              dataSource={selectedRecord.outputs || []}
              locale={{ emptyText: "Belum ada output" }}
              columns={detailOutputColumns}
              mobileCardConfig={{
                title: (record) => record.outputName || "Output produksi",
                subtitle: (record) => [
                  record.outputCode || null,
                  WORK_LOG_TARGET_TYPE_MAP[record.outputType] || record.outputType || null,
                  record.outputVariantLabel ? `Varian: ${record.outputVariantLabel}` : null,
                ],
                tags: (record) => (
                  <Tag className="ims-status-tag" color={record.stockAdded ? "green" : "default"}>
                    {record.stockAdded ? "Sudah masuk stok" : "Belum diposting"}
                  </Tag>
                ),
                meta: [
                  { label: "Good", value: (record) => `${formatNumber(record.goodQty)} ${record.unit || ""}` },
                  {
                    label: "Target Stok",
                    value: (record) => record.stockSourceType === "variant" ? "Variant" : "Master",
                  },
                ],
              }}
            />
          </Card>
        </>
      )}
    </Drawer>
  );
};

export default ProductionWorkLogDetailDrawer;
