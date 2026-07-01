import {
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Row,
  Space,
  Statistic,
  Typography,
} from "antd";
import EmptyStateBlock from "../../../components/Layout/Feedback/EmptyStateBlock";
import MobileDetailDrawer from "../../../components/Layout/Mobile/MobileDetailDrawer";
import {
  BASIS_TYPE_MAP,
  MONITORING_METRIC_MAP,
  PROCESS_TYPE_MAP,
} from "../../../constants/productionStepOptions";
import formatNumber from "../../../utils/formatters/numberId";

const ProductionStepDetailDrawer = ({
  detailDrawerVisible,
  handleOpenBomDrawer,
  handleOpenEmployeeDrawer,
  selectedStep,
  selectedStepPayrollPreview,
  setDetailDrawerVisible,
}) => (
      <MobileDetailDrawer
        title={`Detail Step Produksi: ${selectedStep?.name || "-"}`}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={760}
      >
        {/*
=====================================================
SECTION: Detail drawer tahapan produksi — AKTIF
Fungsi:
- Menampilkan konfigurasi step, rule payroll, dan relasi karyawan/BOM secara ringkas.

Dipakai oleh:
- Halaman ProductionSteps saat user membuka detail step produksi.

Alasan perubahan:
- Detail step dipisah menjadi metric, ringkasan, rule payroll, relasi, dan catatan agar tidak berupa satu Descriptions panjang.

Catatan cleanup:
- Belum ada; tombol relasi tetap memakai drawer existing.

Risiko:
- Jika payroll basis/rate atau relasi disembunyikan, Payroll Produksi dan BOM bisa salah dikonfigurasi.
=====================================================
*/}
        {!selectedStep ? (
          <EmptyStateBlock compact description="Tidak ada data" />
        ) : (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12}>
                <Card size="small">
                  <Statistic title="Karyawan Terkait" value={formatNumber(selectedStep.employeeCount || 0)} />
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card size="small">
                  <Statistic title="Dipakai di BOM" value={formatNumber(selectedStep.bomCount || 0)} />
                </Card>
              </Col>
            </Row>

            <Card size="small" title="Ringkasan Step">
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Nama Step">{selectedStep.name || "-"}</Descriptions.Item>
                <Descriptions.Item label="Kategori">
                  {PROCESS_TYPE_MAP[selectedStep.processType] || selectedStep.processType || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Cara Kerja">
                  {BASIS_TYPE_MAP[selectedStep.basisType] || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Monitoring Profil">
                  {MONITORING_METRIC_MAP[selectedStep.monitoringMetric || "none"] || "Tidak memakai monitoring profil"}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  {selectedStep.isActive ? <Badge status="success" text="Aktif" /> : <Badge status="default" text="Nonaktif" />}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="Aturan Upah Produksi">
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Mode Bayar">{selectedStepPayrollPreview}</Descriptions.Item>
                <Descriptions.Item label="Dasar Hitung">
                  {selectedStep.payrollMode === "per_batch"
                    ? "Mengikuti jumlah batch produksi"
                    : "Mengikuti hasil baik pada Work Log"}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="Relasi">
              <Space size={12} wrap>
                <Button onClick={() => handleOpenEmployeeDrawer(selectedStep)}>
                  Lihat karyawan ({formatNumber(selectedStep.employeeCount || 0)})
                </Button>
                <Button onClick={() => handleOpenBomDrawer(selectedStep)}>
                  Lihat BOM ({formatNumber(selectedStep.bomCount || 0)})
                </Button>
              </Space>
            </Card>

            {selectedStep.description ? (
              <Card size="small" title="Fungsi / Deskripsi">
                <Typography.Paragraph style={{ marginBottom: 0 }}>
                  {selectedStep.description}
                </Typography.Paragraph>
              </Card>
            ) : null}
          </Space>
        )}
      </MobileDetailDrawer>
);

export default ProductionStepDetailDrawer;
