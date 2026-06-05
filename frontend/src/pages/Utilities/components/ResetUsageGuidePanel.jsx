import { Card, Col, Row, Tag } from "antd";

const guideItems = [
  {
    title: "Backup aman",
    steps: [
      "Cek Checklist auto.",
      "Buat backup manual jika belum ada backup hari ini.",
      "Copy backup verified ke flashdisk/harddisk.",
      "Preview Restore hanya saat diperlukan.",
    ],
  },
  {
    title: "Audit & repair",
    steps: [
      "Jalankan Auto Detect Bug.",
      "Review issue yang muncul.",
      "Pakai Repair Aman hanya untuk field turunan.",
      "Audit ulang setelah repair.",
    ],
  },
  {
    title: "Reset testing",
    steps: [
      "Pastikan backup verified tersedia.",
      "Pilih skenario reset testing.",
      "Muat preview dan cek protected data.",
      "Eksekusi hanya dengan keyword yang benar.",
    ],
  },
];

const ResetUsageGuidePanel = () => (
  <Card title="Cara Pakai Maintenance Center" size="small" extra={<Tag color="purple">Panduan ringkas</Tag>}>
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
