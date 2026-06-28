import "./PageContentCanvas.css";

// =========================
// SECTION: Shared Unified Page Content Canvas
// Fungsi:
// - menyatukan ringkasan, filter, tabel, chart, dan pagination di dalam satu canvas isi halaman
// - mempertahankan PageHeader, AppHeader, sidebar, route, role guard, dan business flow existing
// Catatan:
// - komponen ini presentational-only; children tetap dirender tanpa perubahan state, handler, atau payload
// - modal/drawer boleh tetap menjadi child karena Ant Design merender overlay melalui portal
// =========================
const PageContentCanvas = ({ children, className = "", density = "default" }) => (
  <div
    className={[
      "page-content-canvas",
      `page-content-canvas--${density}`,
      className,
    ]
      .filter(Boolean)
      .join(" ")}
  >
    {children}
  </div>
);

export default PageContentCanvas;
