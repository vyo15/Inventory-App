import React from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

import styles from './index.module.css';

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
                  Pusat dokumentasi untuk memahami alur bisnis, logic sistem,
                  struktur menu, aturan stok, costing, produksi, dan roadmap
                  pengembangan project IMS Bunga Flanel.
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
                    <span className={styles.metaLabel}>Fokus</span>
                    <strong>Business Flow &amp; System Logic</strong>
                  </div>
                  <div className={styles.metaCard}>
                    <span className={styles.metaLabel}>Tujuan</span>
                    <strong>Rapi, jelas, mudah maintain</strong>
                  </div>
                  <div className={styles.metaCard}>
                    <span className={styles.metaLabel}>Cakupan</span>
                    <strong>Docs menu, rules, roadmap</strong>
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
                        <li>Business Flow</li>
                        <li>System Logic</li>
                        <li>Menu Documentation</li>
                        <li>Maintenance &amp; Roadmap</li>
                      </ul>
                    </div>

                    <div className={styles.panelDivider}></div>

                    <div className={styles.panelSection}>
                      <p className={styles.panelLabel}>Tujuan Dokumentasi</p>
                      <p className={styles.panelText}>
                        Membantu audit logic, sinkronisasi antar menu,
                        memperjelas alur sistem, dan mempermudah maintenance
                        jangka panjang.
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
