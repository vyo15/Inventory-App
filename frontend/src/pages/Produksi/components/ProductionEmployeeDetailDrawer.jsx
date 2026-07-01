import {
  Card,
  Col,
  Collapse,
  Descriptions,
  Empty,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import EmptyStateBlock from "../../../components/Layout/Feedback/EmptyStateBlock";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import MobileDetailDrawer from "../../../components/Layout/Mobile/MobileDetailDrawer";
import {
  EMPLOYEE_GENDER_MAP,
  EMPLOYEE_PAYROLL_MODE_MAP,
  EMPLOYEE_PAYROLL_OUTPUT_BASIS_MAP,
  EMPLOYEE_ROLE_MAP,
  EMPLOYEE_TYPE_MAP,
  formatEmployeePayrollPreview,
} from "../../../constants/productionEmployeeOptions";
import formatCurrency from "../../../utils/formatters/currencyId";
import formatNumber from "../../../utils/formatters/numberId";
import {
  formatEmployeeShortDate,
  hasAdditionalEmployeeInfo,
  hasArchivedPayrollInfo,
  renderEmployeeCompactInfo,
} from "../helpers/productionEmployeesPageHelpers";

const ProductionEmployeeDetailDrawer = ({
  detailVisible,
  selectedEmployee,
  selectedEmployeeActivitySummary,
  selectedEmployeeSummary,
  setDetailVisible,
}) => (
      <MobileDetailDrawer
        title="Detail Karyawan Produksi"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={760}
      >
        {!selectedEmployee ? (
          <EmptyStateBlock compact description="Tidak ada data" />
        ) : (
          <>
            {/* =====================================================
                ACTIVE / READ-ONLY COMPACT DETAIL
                Fungsi blok:
                - merapikan drawer Detail Karyawan Produksi menjadi ringkasan operasional;
                - hanya menampilkan info utama, assignment, ringkasan aktivitas, histori singkat,
                  info tambahan, dan arsip payroll dalam Collapse.
                Alasan blok ini dipakai:
                - detail lama terlalu panjang karena help text per field, tabel besar, dan payroll
                  arsip payroll tampil terbuka seperti fitur utama.
                Status:
                - aktif dipakai untuk UI detail; tidak menulis data dan bukan refactor flow bisnis.
            ===================================================== */}
            <ImsNotice
              variant="info"
              compact
              className="ims-mb-16"
              title="Operator untuk Work Log dan payroll."
            />

            <Card size="small" title="Ringkasan Karyawan" style={{ marginBottom: 16 }}>
              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}>
                  {renderEmployeeCompactInfo("Nama", selectedEmployee.name)}
                </Col>
                <Col xs={12} md={6}>
                  <Space direction="vertical" size={0}>
                    <Typography.Text type="secondary" className="ims-cell-meta">
                      Status
                    </Typography.Text>
                    <Tag color={selectedEmployee.isActive ? "green" : "default"}>
                      {selectedEmployee.isActive ? "Aktif" : "Nonaktif"}
                    </Tag>
                  </Space>
                </Col>
                <Col xs={12} md={6}>
                  {renderEmployeeCompactInfo(
                    "Jenis Kerja",
                    EMPLOYEE_TYPE_MAP[selectedEmployee.employmentType],
                  )}
                </Col>
                <Col xs={12} md={6}>
                  {renderEmployeeCompactInfo("Role", EMPLOYEE_ROLE_MAP[selectedEmployee.role])}
                </Col>
                {selectedEmployee.phone ? (
                  <Col xs={12} md={6}>
                    {renderEmployeeCompactInfo("No. HP", selectedEmployee.phone)}
                  </Col>
                ) : null}
              </Row>
            </Card>

            {/* =====================================================
                ACTIVE / ASSIGNMENT COMPACT
                Fungsi blok:
                - menampilkan assignment tahapan sebagai tag kecil;
                - tidak mengubah assignedStepIds/Names/Codes agar relasi Work Log tetap aman.
                Alasan blok ini dipakai:
                - assignment adalah info penting produksi, tetapi detail lama terlalu ramai dengan help text.
                Status:
                - aktif dipakai; bukan data historis.
            ===================================================== */}
            <Card size="small" title="Assignment Produksi" style={{ marginBottom: 16 }}>
              {Array.isArray(selectedEmployee.assignedStepNames) &&
              selectedEmployee.assignedStepNames.length > 0 ? (
                <Space size={[4, 4]} wrap>
                  {selectedEmployee.assignedStepNames.map((item) => (
                    <Tag key={item}>{item}</Tag>
                  ))}
                </Space>
              ) : (
                <EmptyStateBlock compact
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Belum ada tahapan assignment."
                />
              )}
            </Card>

            {/* =====================================================
                ACTIVE / READ-ONLY ACTIVITY SUMMARY
                Fungsi blok:
                - menampilkan ringkasan Work Log dan Payroll secara compact;
                - data dibaca dari transaksi final, tanpa kalkulasi ulang payroll.
                Alasan blok ini dipakai:
                - user butuh ringkasan cepat, bukan tabel panjang di drawer detail.
                Status:
                - aktif dipakai; bukan data historis.
            ===================================================== */}
            <Card size="small" title="Ringkasan Work Log & Payroll" style={{ marginBottom: 16 }}>
              <Row gutter={[12, 12]}>
                <Col xs={12} md={6}>
                  <Statistic
                    title="Total Work Log"
                    value={selectedEmployeeActivitySummary.totalWorkLogs}
                  />
                </Col>
                <Col xs={12} md={6}>
                  <Statistic
                    title="Payroll Pending / Draft"
                    value={selectedEmployeeActivitySummary.payrollPending}
                  />
                </Col>
                <Col xs={12} md={6}>
                  <Statistic
                    title="Paid"
                    value={selectedEmployeeActivitySummary.totalPaid}
                  />
                </Col>
                <Col xs={12} md={6}>
                  <Statistic
                    title="Total Paid"
                    value={formatCurrency(selectedEmployeeActivitySummary.totalPaidAmount)}
                  />
                </Col>
              </Row>

              {selectedEmployeeSummary?.totalPayrollLines ? null : (
                <Typography.Text type="secondary" style={{ display: "block", marginTop: 12 }}>
                  Belum ada payroll untuk operator ini.
                </Typography.Text>
              )}
            </Card>

            {/* =====================================================
                ACTIVE / COMPACT HISTORY
                Fungsi blok:
                - menampilkan maksimal 3 Work Log dan 3 Payroll terakhir;
                - mengganti tabel detail lama agar drawer tidak horizontal scroll.
                Alasan blok ini dipakai:
                - histori lengkap tetap ada di menu Work Log Produksi dan Payroll Produksi.
                Status:
                - aktif dipakai; bukan data historis.
            ===================================================== */}
            <Card size="small" title="Histori Singkat" style={{ marginBottom: 16 }}>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Typography.Text strong>Work Log Terakhir</Typography.Text>
                  <Space direction="vertical" size={8} style={{ width: "100%", marginTop: 8 }}>
                    {selectedEmployeeActivitySummary.recentWorkLogs.length > 0 ? (
                      selectedEmployeeActivitySummary.recentWorkLogs.map((item) => (
                        <Card key={item.id} size="small" bodyStyle={{ padding: 10 }}>
                          <Space direction="vertical" size={2} style={{ width: "100%" }}>
                            <Typography.Text strong>{item.workNumber || "-"}</Typography.Text>
                            <Typography.Text type="secondary">
                              {item.stepName || "-"} · {formatEmployeeShortDate(item.completedAt || item.workDate)}
                            </Typography.Text>
                            <Space size={[4, 4]} wrap>
                              <Tag>{item.status || "-"}</Tag>
                              <Tag>Good Qty: {formatNumber(item.goodQty || 0)}</Tag>
                            </Space>
                          </Space>
                        </Card>
                      ))
                    ) : (
                      <EmptyStateBlock compact
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Belum ada Work Log untuk operator ini."
                      />
                    )}
                  </Space>
                </Col>

                <Col xs={24} md={12}>
                  <Typography.Text strong>Payroll Terakhir</Typography.Text>
                  <Space direction="vertical" size={8} style={{ width: "100%", marginTop: 8 }}>
                    {selectedEmployeeActivitySummary.recentPayrolls.length > 0 ? (
                      selectedEmployeeActivitySummary.recentPayrolls.map((item) => (
                        <Card key={item.id} size="small" bodyStyle={{ padding: 10 }}>
                          <Space direction="vertical" size={2} style={{ width: "100%" }}>
                            <Typography.Text strong>{item.payrollNumber || "-"}</Typography.Text>
                            <Typography.Text type="secondary">
                              {item.stepName || "-"} · {formatEmployeeShortDate(item.payrollDate)}
                            </Typography.Text>
                            <Space size={[4, 4]} wrap>
                              <Tag>{item.status || "-"}</Tag>
                              <Tag>{formatCurrency(item.finalAmount || 0)}</Tag>
                            </Space>
                          </Space>
                        </Card>
                      ))
                    ) : (
                      <EmptyStateBlock compact
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Belum ada line payroll untuk operator ini."
                      />
                    )}
                  </Space>
                </Col>
              </Row>

              <Typography.Text type="secondary" style={{ display: "block", marginTop: 12 }}>
                Untuk histori lengkap, buka menu Work Log Produksi atau Payroll Produksi.
              </Typography.Text>
            </Card>

            {hasAdditionalEmployeeInfo(selectedEmployee) ? (
              <Collapse size="small" style={{ marginBottom: 16 }}>
                <Collapse.Panel header="Info Tambahan" key="additional-info">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Gender">
                      {EMPLOYEE_GENDER_MAP[selectedEmployee.gender] || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="No. HP">
                      {selectedEmployee.phone || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Alamat">
                      <Typography.Paragraph
                        ellipsis={{ rows: 2, expandable: true, symbol: "Lihat lengkap" }}
                        style={{ marginBottom: 0 }}
                      >
                        {selectedEmployee.address || "-"}
                      </Typography.Paragraph>
                    </Descriptions.Item>
                    <Descriptions.Item label="Skill Tags">
                      {Array.isArray(selectedEmployee.skillTags) &&
                      selectedEmployee.skillTags.length > 0 ? (
                        <Space size={[4, 4]} wrap>
                          {selectedEmployee.skillTags.map((item) => (
                            <Tag key={item}>{item}</Tag>
                          ))}
                        </Space>
                      ) : (
                        "-"
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Catatan Internal">
                      <Typography.Paragraph
                        ellipsis={{ rows: 2, expandable: true, symbol: "Lihat lengkap" }}
                        style={{ marginBottom: 0 }}
                      >
                        {selectedEmployee.notes || "-"}
                      </Typography.Paragraph>
                    </Descriptions.Item>
                  </Descriptions>
                </Collapse.Panel>
              </Collapse>
            ) : null}

            {hasArchivedPayrollInfo(selectedEmployee) ? (
              <Collapse size="small">
                <Collapse.Panel header="Arsip Payroll" key="archived-payroll">
                  {/* =====================================================
                      ARSIP PAYROLL ONLY
                      Fungsi blok:
                      - tetap menyediakan audit field payroll arsip tanpa menjadikannya fitur utama;
                      - tidak menghapus field lama dari database.
                      Alasan blok ini dipakai:
                      - source payroll baru mengikuti Tahapan Produksi dan Work Log completed.
                      Status:
                      - arsip payroll/compatibility; kandidat cleanup hanya setelah keputusan migrasi data historis.
                  ===================================================== */}
                  <ImsNotice
                    variant="guard"
                    compact
                    className="ims-mb-16"
                    title="Arsip payroll untuk audit."
                    description="Payroll baru mengikuti Tahapan Produksi dan Work Log completed."
                  />
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Gunakan Tarif Custom">
                      {selectedEmployee.useCustomPayrollRate ? "Ya" : "Tidak"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Mode Payroll Custom">
                      {EMPLOYEE_PAYROLL_MODE_MAP[selectedEmployee.customPayrollMode] || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Tarif Custom">
                      {selectedEmployee.useCustomPayrollRate
                        ? formatCurrency(selectedEmployee.customPayrollRate)
                        : "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Basis Qty Custom">
                      {selectedEmployee.useCustomPayrollRate
                        ? formatNumber(selectedEmployee.customPayrollQtyBase)
                        : "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Basis Output Payroll">
                      {EMPLOYEE_PAYROLL_OUTPUT_BASIS_MAP[
                        selectedEmployee.customPayrollOutputBasis
                      ] || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Preview / Status Arsip">
                      {formatEmployeePayrollPreview(selectedEmployee)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Catatan Payroll Arsip">
                      {selectedEmployee.payrollNotes || "-"}
                    </Descriptions.Item>
                  </Descriptions>
                </Collapse.Panel>
              </Collapse>
            ) : null}
          </>
        )}
      </MobileDetailDrawer>
);

export default ProductionEmployeeDetailDrawer;
