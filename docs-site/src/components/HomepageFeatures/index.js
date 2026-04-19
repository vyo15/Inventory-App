import React from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

// =====================================================
// Homepage feature cards
// Fungsi:
// - merangkum struktur dokumentasi utama dalam format yang cepat dipahami
// - membantu user masuk ke area docs yang paling relevan
// - menjaga copywriting tetap singkat, profesional, dan tidak melelahkan untuk dibaca
// =====================================================
const features = [
  {
    title: 'Overview Project',
    description:
      'Ringkasan tujuan sistem, modul utama, struktur menu, dan gambaran besar arsitektur project aktif.',
    link: '/docs/overview/project-overview',
    linkLabel: 'Buka Overview',
  },
  {
    title: 'Business Flow',
    description:
      'Penjelasan alur stok, pembelian, produksi, work log, hingga hasil produksi masuk ke semi finished atau produk jadi.',
    link: '/docs/business-flow/stock-flow',
    linkLabel: 'Lihat Business Flow',
  },
  {
    title: 'System Logic',
    description:
      'Aturan penting terkait stok, varian, costing, HPP, pricing rules, serta reset data uji.',
    link: '/docs/system-logic/stock-rules',
    linkLabel: 'Lihat System Logic',
  },
  {
    title: 'Menu Documentation',
    description:
      'Panduan per kelompok menu untuk memahami fungsi, field penting, tombol aksi, dan skenario penggunaan.',
    link: '/docs/menus/master-data',
    linkLabel: 'Buka Menu Docs',
  },
  {
    title: 'Maintenance',
    description:
      'Catatan area penting untuk audit, testing, perbaikan logic, dan konsistensi maintainability project.',
    link: '/docs/maintenance/improvements',
    linkLabel: 'Lihat Maintenance',
  },
  {
    title: 'Roadmap',
    description:
      'Arah pengembangan lanjutan seperti payroll ke costing, HPP produk jadi, dan integrasi biaya marketplace.',
    link: '/docs/maintenance/roadmap',
    linkLabel: 'Lihat Roadmap',
  },
];

function FeatureCard({title, description, link, linkLabel}) {
  return (
    <div className={styles.card}>
      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>{title}</h3>
        <p className={styles.cardDescription}>{description}</p>
      </div>

      <div className={styles.cardFooter}>
        <Link className={styles.cardLink} to={link}>
          {linkLabel}
        </Link>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.featuresSection}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>Struktur Dokumentasi</span>
          <h2 className={styles.sectionTitle}>Navigasi dokumentasi yang lebih terstruktur dan mudah dipahami</h2>
          <p className={styles.sectionSubtitle}>
            Dokumentasi disusun berdasarkan overview, business flow, system logic,
            dokumentasi per menu, dan maintenance agar user maupun tim internal
            dapat membaca kebutuhan informasi secara cepat dan konsisten.
          </p>
        </div>

        <div className={styles.grid}>
          {features.map((feature) => (
            <FeatureCard key={feature.link} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
