import React from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

import styles from './index.module.css';

// =====================================================
// Homepage dokumentasi
// Fungsi:
// - menjadi pintu masuk utama dokumentasi project
// - menjelaskan posisi dokumentasi secara singkat dan profesional
// - mengarahkan user ke area docs yang paling penting tanpa membuat halaman terasa ramai
// =====================================================
export default function Home() {
  return (
    <Layout
      title="Beranda"
      description="Dokumentasi sistem, alur bisnis, dan logic project IMS Bunga Flanel">
      <main className={styles.homePage}>
        <section className={styles.heroSection}>
          <div className="container">
            <div className={styles.heroGrid}>
              <div className={styles.heroContent}>
                <span className={styles.badge}>Dokumentasi Internal Project</span>

                <h1 className={styles.heroTitle}>
                  IMS Bunga Flanel
                  <span className={styles.heroTitleAccent}> Documentation</span>
                </h1>

                <p className={styles.heroSubtitle}>
                  Pusat dokumentasi untuk memahami arsitektur sistem, alur stok,
                  produksi, varian, pricing rules, payroll produksi, laporan, dan
                  aturan maintenance pada project IMS Bunga Flanel.
                </p>

                <div className={styles.heroActions}>
                  <Link className="button button--primary button--lg" to="/docs/intro">
                    Buka Dokumentasi
                  </Link>

                  <Link className="button button--secondary button--lg" to="/docs/overview/project-overview">
                    Lihat Overview
                  </Link>
                </div>

                <div className={styles.heroMeta}>
                  <div className={styles.metaCard}>
                    <span className={styles.metaLabel}>Arsitektur</span>
                    <strong>BOM → PO → Work Log → Payroll → HPP</strong>
                  </div>
                  <div className={styles.metaCard}>
                    <span className={styles.metaLabel}>Fokus</span>
                    <strong>Standar operasional, alur sistem, dan referensi maintenance</strong>
                  </div>
                  <div className={styles.metaCard}>
                    <span className={styles.metaLabel}>Cakupan</span>
                    <strong>Menu utama, business flow, system logic, dan panduan penggunaan</strong>
                  </div>
                </div>
              </div>

              <div className={styles.heroPanel}>
                <div className={styles.panelCard}>
                  <div className={styles.panelHeader}>
                    <span className={styles.panelDot}></span>
                    <span className={styles.panelDot}></span>
                    <span className={styles.panelDot}></span>
                  </div>

                  <div className={styles.panelBody}>
                    <div className={styles.panelSection}>
                      <p className={styles.panelLabel}>Dokumentasi Utama</p>
                      <ul className={styles.panelList}>
                        <li>Overview Project</li>
                        <li>Alur Stok dan Produksi</li>
                        <li>System Logic dan Variant Rules</li>
                        <li>Dokumentasi per Menu</li>
                        <li>Maintenance dan Roadmap</li>
                      </ul>
                    </div>

                    <div className={styles.panelDivider}></div>

                    <div className={styles.panelSection}>
                      <p className={styles.panelLabel}>Tujuan Dokumentasi</p>
                      <p className={styles.panelText}>
                        Menjadi acuan kerja untuk memahami fungsi setiap menu,
                        menjaga konsistensi alur sistem, mempercepat proses audit
                        dan testing, serta membantu pengembangan lanjutan tetap
                        mengikuti logic project yang sudah disepakati.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <HomepageFeatures />
      </main>
    </Layout>
  );
}
