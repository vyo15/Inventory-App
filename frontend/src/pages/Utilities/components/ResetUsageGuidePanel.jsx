import { Tag, Typography } from "antd";

const { Text } = Typography;

const guideItems = [
  {
    key: "backup",
    step: "01",
    title: "Backup",
    tone: "green",
    description: "Pastikan backup terverifikasi tersedia sebelum update, restore, repair, atau purge.",
    note: "Simpan salinan eksternal secara berkala.",
  },
  {
    key: "audit",
    step: "02",
    title: "Audit",
    tone: "blue",
    description: "Jalankan pemeriksaan read-only untuk melihat issue integritas dan data turunan.",
    note: "Audit tidak mengubah database.",
  },
  {
    key: "repair",
    step: "03",
    title: "Perbaikan",
    tone: "orange",
    description: "Perbaikan hanya untuk projection stok missing/stale dan tetap memakai backup otomatis.",
    note: "Jangan mengubah stok master atau ledger langsung.",
  },
  {
    key: "verify",
    step: "04",
    title: "Verifikasi",
    tone: "green",
    description: "Jalankan audit ulang, periksa hasil, lalu pastikan aktivitas tercatat pada Riwayat.",
    note: "Testing transaksi tetap dilakukan di sandbox.",
  },
];

const ResetUsageGuidePanel = () => (
  <section className="reset-maintenance-guide-panel" aria-label="Panduan maintenance aman">
    <div className="reset-maintenance-guide-heading">
      <div>
        <Text strong>Panduan Maintenance Aman</Text>
        <Text type="secondary">Ikuti urutan ini agar perubahan tetap terkontrol dan dapat diaudit.</Text>
      </div>
      <Tag color="blue">Backup → Audit → Perbaikan → Verifikasi</Tag>
    </div>

    <div className="reset-maintenance-guide-grid">
      {guideItems.map((item) => (
        <article key={item.key} className="reset-maintenance-guide-step">
          <div className="reset-maintenance-guide-step-header">
            <span>{item.step}</span>
            <Tag color={item.tone}>{item.title}</Tag>
          </div>
          <Text>{item.description}</Text>
          <Text type="secondary">{item.note}</Text>
        </article>
      ))}
    </div>
  </section>
);

export default ResetUsageGuidePanel;
