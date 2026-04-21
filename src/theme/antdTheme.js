import { theme } from "antd";

// =========================
// SECTION: Shared Surface Tokens
// Fungsi:
// - menjadi pusat warna dasar yang dipakai lintas token Ant Design
// - dipisah agar light dan dark mode mudah dirawat dari satu titik
// Catatan:
// - helper ini masih dipakai aktif oleh getAntdTheme
// =========================
const getThemeSurfaces = (darkTheme = false) => {
  return darkTheme
    ? {
        layout: "#0b1220",
        shell: "#0f172a",
        card: "#111827",
        field: "#0f172a",
        border: "rgba(148, 163, 184, 0.14)",
        borderSoft: "rgba(148, 163, 184, 0.10)",
        text: "#e5e7eb",
        textSecondary: "rgba(148, 163, 184, 0.92)",
        subtleFill: "rgba(255, 255, 255, 0.04)",
        hoverFill: "rgba(255, 255, 255, 0.06)",
        activeFill: "rgba(59, 130, 246, 0.16)",
      }
    : {
        layout: "#f3f6fb",
        shell: "#ffffff",
        card: "#ffffff",
        field: "#ffffff",
        border: "rgba(15, 23, 42, 0.08)",
        borderSoft: "rgba(15, 23, 42, 0.06)",
        text: "#0f172a",
        textSecondary: "rgba(15, 23, 42, 0.72)",
        subtleFill: "#f8fafc",
        hoverFill: "#eef3f8",
        activeFill: "rgba(37, 99, 235, 0.14)",
      };
};

// =========================
// SECTION: Ant Design Theme Generator
// Fungsi:
// - menjadi pusat token global light/dark mode
// - menjaga drawer, modal, table, input, dan button punya bahasa visual yang konsisten
// - dark mode dibuat netral dan tenang agar cocok untuk ERP / IMS yang dipakai lama
// Catatan:
// - fungsi ini masih dipakai langsung oleh ConfigProvider di AppLayout
// - semua token di sini berdampak global ke komponen antd yang tidak dioverride manual
// =========================
export const getAntdTheme = (darkTheme = false) => {
  const surface = getThemeSurfaces(darkTheme);

  return {
    algorithm: darkTheme ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: "#3b82f6",
      fontFamily: 'Inter, "Segoe UI", sans-serif',
      borderRadius: 14,
      colorBgBase: surface.layout,
      colorBgLayout: surface.layout,
      colorBgContainer: surface.card,
      colorBgElevated: surface.card,
      colorTextBase: surface.text,
      colorText: surface.text,
      colorTextSecondary: surface.textSecondary,
      colorBorder: surface.border,
      colorBorderSecondary: surface.borderSoft,
      colorFillSecondary: surface.subtleFill,
      colorFillTertiary: surface.hoverFill,
      boxShadowSecondary: darkTheme
        ? "0 14px 30px rgba(2, 6, 23, 0.34)"
        : "0 12px 24px rgba(15, 23, 42, 0.08)",
    },
    components: {
      Layout: {
        bodyBg: "transparent",
        siderBg: surface.shell,
        headerBg: "transparent",
        triggerBg: surface.shell,
        triggerColor: surface.text,
      },

      // =========================
      // SECTION: Menu
      // Catatan:
      // - token deprecated lama sengaja tidak dipakai lagi
      // - diganti ke token baru agar console lebih bersih
      // =========================
      Menu: {
        itemBorderRadius: 14,
        subMenuItemBorderRadius: 12,
        itemHeight: 44,
        iconSize: 17,
        itemSelectedBg: surface.activeFill,
        itemSelectedColor: darkTheme ? "#f8fafc" : surface.text,
        itemHoverColor: darkTheme ? "#f8fafc" : surface.text,
      },

      Card: {
        borderRadiusLG: 18,
        colorBgContainer: surface.card,
      },

      Button: {
        borderRadius: 12,
        defaultBg: surface.card,
        defaultBorderColor: surface.border,
        defaultColor: surface.text,
        primaryShadow: "none",
      },

      Input: {
        borderRadius: 12,
        activeBg: surface.field,
        hoverBg: surface.field,
      },

      InputNumber: {
        borderRadius: 12,
      },

      Select: {
        borderRadius: 12,
        optionSelectedBg: surface.activeFill,
        optionActiveBg: darkTheme ? "rgba(255, 255, 255, 0.06)" : "#eef3f8",
      },

      Table: {
        headerBorderRadius: 12,
        headerBg: darkTheme ? "rgba(255, 255, 255, 0.04)" : "#f8fafc",
        headerColor: darkTheme ? "#f8fafc" : surface.text,
        rowHoverBg: darkTheme ? "rgba(255, 255, 255, 0.03)" : "#f8fafc",
        borderColor: surface.borderSoft,
      },

      Drawer: {
        colorBgElevated: surface.card,
      },

      Modal: {
        contentBg: surface.card,
        headerBg: surface.card,
      },

      Form: {
        labelColor: surface.text,
      },

      // =========================
      // SECTION: Tag Tokens
      // Fungsi:
      // - memperbaiki label/tag default agar tetap menyatu dengan dark mode
      // - terutama untuk tag default ant design, bukan chip stok custom
      // =========================
      Tag: {
        defaultBg: darkTheme ? "rgba(255, 255, 255, 0.04)" : "#ffffff",
        defaultColor: darkTheme ? "#dbe4ee" : "#334155",
      },
    },
  };
};
