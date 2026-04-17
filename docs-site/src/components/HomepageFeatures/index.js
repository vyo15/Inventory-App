import React from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

const features = [
  {
    title: 'Overview Project',
    description:
      'Menjelaskan tujuan sistem, cakupan project, struktur dokumentasi, dan gambaran besar IMS Bunga Flanel.',
    link: '/docs/overview/project-overview',
    linkLabel: 'Buka Overview',
  },
  {
    title: 'Business Flow',
    description:
      'Menjelaskan alur pembelian, produksi, penjualan, dan perpindahan stok dari raw material sampai finished goods.',
    link: '/docs/business-flow/stock-flow',
    linkLabel: 'Lihat Business Flow',
  },
  {
    title: 'System Logic',
    description:
      'Membahas aturan stok, costing, HPP, status penjualan, serta rule penting agar antar menu tetap sinkron.',
    link: '/docs/system-logic/costing-hpp',
    linkLabel: 'Lihat System Logic',
  },
  {
    title: 'Menu Documentation',
    description:
      'Dokumentasi per menu untuk memudahkan audit fungsi, memahami data yang dipakai, dan menjaga maintainability.',
    link: '/docs/menus/dashboard',
    linkLabel: 'Buka Menu Docs',
  },
  {
    title: 'Maintenance',
    description:
      'Mencatat improvement, known issues, dan catatan penting agar perubahan project lebih terarah dan terdokumentasi.',
    link: '/docs/maintenance/improvements',
    linkLabel: 'Lihat Maintenance',
  },
  {
    title: 'Roadmap',
    description:
      'Berisi arah pengembangan lanjutan seperti payroll ke HPP, pricing rules, finished goods HPP, dan integrasi fee.',
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
          <h2 className={styles.sectionTitle}>Navigasi dokumentasi yang rapi dan mudah dipahami</h2>
          <p className={styles.sectionSubtitle}>
            Dokumentasi disusun berdasarkan overview, alur bisnis, aturan sistem,
            dokumentasi menu, dan maintenance agar mudah dipakai untuk audit dan pengembangan.
          </p>
        </div>

        <div className={styles.grid}>
          {features.map((feature, idx) => (
            <FeatureCard key={idx} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
