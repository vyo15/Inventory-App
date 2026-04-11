import { theme } from "antd";

// =========================
// SECTION: Ant Design Theme Generator
// Menyamakan nuansa light/dark agar lebih rapi dan profesional.
// =========================
export const getAntdTheme = (darkTheme = false) => {
  return {
    algorithm: darkTheme ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: "#2563eb",
      fontFamily: 'Inter, "Segoe UI", sans-serif',
      borderRadius: 14,
      colorBgBase: darkTheme ? "#0f172a" : "#f3f6fb",
      colorTextBase: darkTheme ? "#e6edf3" : "#0f172a",
      colorBorder: darkTheme
        ? "rgba(148, 163, 184, 0.18)"
        : "rgba(15, 23, 42, 0.08)",
    },
    components: {
      Layout: {
        bodyBg: "transparent",
        siderBg: darkTheme ? "#111827" : "#ffffff",
        headerBg: darkTheme ? "#111827" : "#ffffff",
        triggerBg: darkTheme ? "#111827" : "#ffffff",
        triggerColor: darkTheme ? "#e6edf3" : "#0f172a",
      },
      Menu: {
        itemBorderRadius: 14,
        subMenuItemBorderRadius: 14,
        itemHeight: 44,
        iconSize: 17,
        colorItemBgSelected: darkTheme
          ? "rgba(37, 99, 235, 0.26)"
          : "rgba(37, 99, 235, 0.14)",
        colorItemTextSelected: darkTheme ? "#f8fafc" : "#0f172a",
      },
      Card: {
        borderRadiusLG: 18,
      },
      Button: {
        borderRadius: 12,
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
    },
  };
};
