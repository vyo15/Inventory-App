import { Button, Card, Col, Modal, Row, Statistic } from "antd";
import { CheckOutlined } from "@ant-design/icons";
import DataTableView from "../../../components/Layout/Table/DataTableView";
import { getDataTableEmptyText } from "../../../components/Layout/Feedback/DataLoadingState";

const PricingRulePreviewModal = ({
  applyLoading,
  closePreviewModal,
  handleApplyRule,
  previewColumns,
  previewData,
  previewLoading,
  previewMobileCardConfig,
  previewRule,
  previewSummary,
  previewVisible,
}) => (
      <Modal
        title={`Detail Pricing Rule${
          previewRule?.name ? ` - ${previewRule.name}` : ""
        }`}
        open={previewVisible}
        onCancel={closePreviewModal}
        footer={[
          <Button key="close" onClick={closePreviewModal}>
            Tutup
          </Button>,
          <Button
            key="apply"
            type="primary"
            icon={<CheckOutlined />}
            loading={applyLoading}
            onClick={handleApplyRule}
          >
            Terapkan Rule
          </Button>,
        ]}
        width={1280}
        destroyOnClose
      >
        {/* SECTION: ringkasan preview */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={4}>
            <Card>
              <Statistic title="Total Item" value={previewSummary.totalItems} />
            </Card>
          </Col>

          <Col xs={24} md={4}>
            <Card>
              <Statistic title="Ready" value={previewSummary.readyCount} />
            </Card>
          </Col>

          <Col xs={24} md={4}>
            <Card>
              <Statistic
                title="Akan Berubah"
                value={previewSummary.willUpdateCount}
              />
            </Card>
          </Col>

          <Col xs={24} md={4}>
            <Card>
              <Statistic
                title="Manual"
                value={previewSummary.skippedManualCount}
              />
            </Card>
          </Col>

          <Col xs={24} md={4}>
            <Card>
              <Statistic
                title="Biaya Dasar Invalid"
                value={previewSummary.invalidBaseCostCount}
              />
            </Card>
          </Col>

          <Col xs={24} md={4}>
            <Card>
              <Statistic
                title="Buffer Invalid"
                value={previewSummary.invalidMarketplaceBufferCount}
              />
            </Card>
          </Col>
        </Row>

        {/* SECTION: tabel preview */}
        <DataTableView
          loading={previewLoading}
          showRefreshIndicator
          className="app-data-table"
          rowKey="itemId"
          dataSource={previewData}
          columns={previewColumns}
          pagination={{ pageSize: 10 }}
          tableLayout="fixed"
          mobileCardConfig={previewMobileCardConfig}
          locale={{ emptyText: getDataTableEmptyText(previewLoading) }}
        />
      </Modal>
);

export default PricingRulePreviewModal;
