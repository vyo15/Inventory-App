import React from "react";
import { Button, Card, Col, Row, Space, Tag, Typography } from "antd";
import { EyeOutlined, FileSearchOutlined, WarningOutlined } from "@ant-design/icons";
import {
  DEFAULT_RESET_MODULES,
} from "../../../services/Maintenance/resetMaintenanceDataService";
import { showActionInfo } from "../../../utils/feedback/actionResultFeedback";

const { Text } = Typography;

const ResetDangerZonePanel = ({
  loadingAutoDetect,
  onRunAllAudits,
  onSelectBaselineReset,
  loadingPreview,
  onOpenFullTestingResetConfirmation,
  onSelectZeroReset,
  loadingHppCostPreview,
  loadingRunHppCostReset,
  onLoadHppCostPreview,
  onOpenHppCostResetAllConfirmation,
}) => (
  <Card title="Pilih Kebutuhan Testing" size="small" extra={<Tag color="blue">Flow utama</Tag>}>
    <Row gutter={[12, 12]}>
      <Col xs={24} md={12} xl={6}>
        <Card size="small" title="Pakai Data Lama">
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Text type="secondary">Untuk patch baru: cek bug data lama, lalu repair field turunan yang aman.</Text>
            <Button block type="primary" icon={<FileSearchOutlined />} loading={loadingAutoDetect} onClick={onRunAllAudits}>
              Auto Detect Bug
            </Button>
          </Space>
        </Card>
      </Col>
      <Col xs={24} md={12} xl={6}>
        <Card size="small" title="Testing dari Baseline">
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Text type="secondary">Untuk test berulang dari stok awal yang sama tanpa input ulang.</Text>
            <Button
              block
              onClick={() => {
                onSelectBaselineReset([...DEFAULT_RESET_MODULES]);
                showActionInfo({ title: "Mode Reset + Baseline dipilih", content: "Muat preview sebelum eksekusi.", module: "Reset Maintenance", action: "Pilih Baseline Reset" });
              }}
            >
              Pilih Baseline Reset
            </Button>
          </Space>
        </Card>
      </Col>
      <Col xs={24} md={12} xl={6}>
        <Card size="small" title="Mulai dari Nol">
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Text type="secondary">Untuk data development: transaksi, stok, dan modal/HPP testing dibersihkan dalam satu flow.</Text>
            <Button block type="primary" danger icon={<WarningOutlined />} loading={loadingPreview} onClick={onOpenFullTestingResetConfirmation}>
              Reset Semua Testing
            </Button>
            <Button
              block
              onClick={() => {
                onSelectZeroReset([...DEFAULT_RESET_MODULES]);
                showActionInfo({ title: "Mode Reset + Nolkan Stok dipilih", content: "Muat preview sebelum eksekusi.", module: "Reset Maintenance", action: "Pilih Reset Nol Saja" });
              }}
            >
              Pilih Reset Nol Saja
            </Button>
          </Space>
        </Card>
      </Col>
      <Col xs={24} md={12} xl={6}>
        <Card size="small" title="HPP Trial">
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Text type="secondary">Khusus uji modal/HPP. Tidak menghapus transaksi, stok, payroll, atau work log.</Text>
            <Button
              block
              icon={<EyeOutlined />}
              loading={loadingHppCostPreview}
              onClick={() => onLoadHppCostPreview(true, "all_hpp_cost_sources")}
            >
              Preview Semua Modal/HPP
            </Button>
            <Button
              block
              danger
              icon={<WarningOutlined />}
              loading={loadingRunHppCostReset || loadingHppCostPreview}
              onClick={onOpenHppCostResetAllConfirmation}
            >
              Reset Semua Modal/HPP
            </Button>
          </Space>
        </Card>
      </Col>
    </Row>
  </Card>
);

export default ResetDangerZonePanel;
