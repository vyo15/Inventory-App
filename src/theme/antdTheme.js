import { theme } from "antd";

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
  return {
    algorithm: darkTheme ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: "#3b82f6",
      fontFamily: 'Inter, "Segoe UI", sans-serif',
      borderRadius: 14,
      colorBgBase: darkTheme ? "#0b1220" : "#f3f6fb",
      colorBgLayout: darkTheme ? "#0b1220" : "#f3f6fb",
      colorBgContainer: darkTheme ? "#111827" : "#ffffff",
      colorBgElevated: darkTheme ? "#111827" : "#ffffff",
      colorTextBase: darkTheme ? "#e5e7eb" : "#0f172a",
      colorTextSecondary: darkTheme
        ? "rgba(148, 163, 184, 0.92)"
        : "rgba(15, 23, 42, 0.72)",
      colorBorder: darkTheme
        ? "rgba(148, 163, 184, 0.14)"
        : "rgba(15, 23, 42, 0.08)",
      colorBorderSecondary: darkTheme
        ? "rgba(148, 163, 184, 0.10)"
        : "rgba(15, 23, 42, 0.06)",
    },
    components: {
      Layout: {
        bodyBg: "transparent",
        siderBg: darkTheme ? "#0f172a" : "#ffffff",
        headerBg: "transparent",
        triggerBg: darkTheme ? "#0f172a" : "#ffffff",
        triggerColor: darkTheme ? "#e5e7eb" : "#0f172a",
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
        itemSelectedBg: darkTheme
          ? "rgba(59, 130, 246, 0.16)"
          : "rgba(37, 99, 235, 0.14)",
        itemSelectedColor: darkTheme ? "#f8fafc" : "#0f172a",
        itemHoverColor: darkTheme ? "#f8fafc" : "#0f172a",
      },

      Card: {
        borderRadiusLG: 18,
        colorBgContainer: darkTheme ? "#111827" : "#ffffff",
      },

      Button: {
        borderRadius: 12,
        defaultBg: darkTheme ? "#111827" : "#ffffff",
        defaultBorderColor: darkTheme
          ? "rgba(148, 163, 184, 0.14)"
          : "rgba(15, 23, 42, 0.08)",
        defaultColor: darkTheme ? "#e5e7eb" : "#0f172a",
        primaryShadow: "none",
      },

      Input: {
        borderRadius: 12,
      },

      Select: {
        borderRadius: 12,
      },

      Table: {
        headerBorderRadius: 12,
      },

      Drawer: {
        colorBgElevated: darkTheme ? "#111827" : "#ffffff",
      },

      Modal: {
        contentBg: darkTheme ? "#111827" : "#ffffff",
        headerBg: darkTheme ? "#111827" : "#ffffff",
      },

      Form: {
        labelColor: darkTheme ? "#e5e7eb" : "#0f172a",
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
