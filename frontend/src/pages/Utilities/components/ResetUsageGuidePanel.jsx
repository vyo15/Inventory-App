import { Card, Col, Row, Tag } from "antd";

const guideItems = [
  {
    title: "1. Backup",
    steps: [
      "Pastikan backup verified terbaru tersedia.",
      "Buat backup manual sebelum update atau repair.",
      "Copy backup terbaru ke media eksternal secara berkala.",
    ],
  },
  {
    title: "2. Audit",
    steps: [
      "Jalankan Audit & Health untuk pemeriksaan read-only.",
      "Review issue integritas, stok, backup, dan finance.",
      "Jangan memperbaiki stok master atau ledger langsung dari UI.",
    ],
  },
  {
    title: "3. Repair & Verifikasi",
    steps: [
      "Repair hanya untuk data turunan stok missing/stale.",
      "Cleanup orphan wajib memakai keyword dan backup otomatis.",
      "Jalankan audit ulang lalu cek Riwayat Maintenance.",
    ],
  },
];

const ResetUsageGuidePanel = () => (
  <Card title="Alur Maintenance Aman" size="small" extra={<Tag color="blue">Backup → Audit → Repair</Tag>}>
    <Row gutter={[12, 12]}>
      {guideItems.map((item) => (
        <Col key={item.title} xs={24} md={8}>
          <Card size="small" title={item.title}>
            <ol style={{ paddingLeft: 18, marginBottom: 0 }}>
              {item.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </Card>
        </Col>
      ))}
    </Row>
  </Card>
);

export default ResetUsageGuidePanel;
