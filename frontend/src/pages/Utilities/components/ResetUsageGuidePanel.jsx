import { Card, Col, Row, Tag } from "antd";

const guideItems = [
  {
    title: "Pakai data lama",
    steps: [
      "Auto Detect Bug.",
      "Repair Turunan Aman.",
      "Cek ulang area yang warning.",
      "Test Purchase, Sales, Return, Produksi, Payroll.",
    ],
  },
  {
    title: "Testing berulang",
    steps: [
      "Simpan baseline stok.",
      "Jalankan transaksi test.",
      "Preview Reset + Baseline.",
      "Ketik RESET untuk ulang dari baseline.",
    ],
  },
  {
    title: "Mulai dari nol",
    steps: [
      "Export master.",
      "Pilih Reset + Nolkan Stok.",
      "Preview dan cek protected data.",
      "Input opening stock/purchase baru.",
    ],
  },
];

const ResetUsageGuidePanel = () => (
  <Card title="Cara Pakai Setelah Patch" size="small" extra={<Tag color="purple">Checklist ringkas</Tag>}>
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
