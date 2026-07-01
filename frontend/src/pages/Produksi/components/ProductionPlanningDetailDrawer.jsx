import {
  Badge,
  Button,
  Card,
  Descriptions,
  Progress,
  Space,
  Tag,
  Typography,
} from "antd";
import { LinkOutlined } from "@ant-design/icons";
import EmptyStateBlock from "../../../components/Layout/Feedback/EmptyStateBlock";
import MobileDetailDrawer from "../../../components/Layout/Mobile/MobileDetailDrawer";
import { formatPercentId, formatQuantityId } from "../../../utils/formatters/numberId";
import { resolveDisplayReference } from "../../../utils/references/displayReferenceResolver";

const { Text } = Typography;

const ProductionPlanningDetailDrawer = ({
  canCreatePoFromPlan,
  detailVisible,
  formatDateDisplay,
  getStatusMeta,
  handleOpenPoDrawer,
  selectedPlan,
  setDetailVisible,
}) => (
      <MobileDetailDrawer
        title="Detail Production Planning"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={820}
        extra={
          selectedPlan && canCreatePoFromPlan(selectedPlan) ? (
            <Button type="primary" icon={<LinkOutlined />} onClick={() => handleOpenPoDrawer(selectedPlan)}>
              Buat PO
            </Button>
          ) : null
        }
      >
        {!selectedPlan ? (
          <EmptyStateBlock compact description="Tidak ada data planning" />
        ) : (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Kode">{resolveDisplayReference(selectedPlan, { fields: ["planCode", "code"], fallback: "-" })}</Descriptions.Item>
              <Descriptions.Item label="Judul">{selectedPlan.title || "-"}</Descriptions.Item>
              <Descriptions.Item label="Periode">
                {formatDateDisplay(selectedPlan.periodStartDate)} - {formatDateDisplay(selectedPlan.periodEndDate)}
              </Descriptions.Item>
              <Descriptions.Item label="Deadline">{formatDateDisplay(selectedPlan.dueDate)}</Descriptions.Item>
              <Descriptions.Item label="Target">
                {selectedPlan.targetItemName || "-"}
                {selectedPlan.targetVariantLabel ? ` · ${selectedPlan.targetVariantLabel}` : ""}
              </Descriptions.Item>
              <Descriptions.Item label="Progress">
                {formatQuantityId(selectedPlan.actualCompletedQty)} / {formatQuantityId(selectedPlan.targetQty)} {selectedPlan.targetUnit || "pcs"} ({formatPercentId(selectedPlan.progressPercent)})
              </Descriptions.Item>
              <Descriptions.Item label="Sisa Target">
                {formatQuantityId(selectedPlan.remainingQty)} {selectedPlan.targetUnit || "pcs"}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Badge status={getStatusMeta(selectedPlan.status).badge} text={getStatusMeta(selectedPlan.status).label} />
              </Descriptions.Item>
              <Descriptions.Item label="Production Order Terkait">
                {(selectedPlan.linkedProductionOrderCodes || []).length > 0 ? (
                  <Space wrap>
                    {(selectedPlan.linkedProductionOrderCodes || []).map((code) => (
                      <Tag key={code} color="blue">{code}</Tag>
                    ))}
                  </Space>
                ) : (
                  <Text type="secondary">Belum ada PO terkait.</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Catatan">{selectedPlan.notes || "-"}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="Progress Target">
              <Progress percent={Math.min(Number(selectedPlan.progressPercent || 0), 100)} />
              <Text type="secondary">
                Progress hanya dihitung dari Work Log completed milik PO yang terhubung dengan planning ini.
              </Text>
            </Card>
          </Space>
        )}
      </MobileDetailDrawer>
);

export default ProductionPlanningDetailDrawer;
