import { theme } from "antd";

// =========================
// SECTION: Brand Palette Source - AKTIF DIPAKAI / THEME CENTER
// Fungsi:
// - menjadi pusat warna React/Ant Design untuk light dan dark mode.
// - palet ini menyelaraskan aplikasi utama dengan arah visual login floral/pastel.
// Hubungan flow aplikasi:
// - dipakai oleh getAntdTheme() dan ConfigProvider di AppLayout.
// - tidak menyentuh auth, route guard, stok, kas, produksi, payroll, HPP, atau laporan.
// Aman diubah:
// - boleh tuning warna di object ini jika ingin mengganti mood desain.
// - ubah hati-hati karena berdampak global ke Button, Menu, Card, Table, Modal, Drawer, Input, Select, dan Form.
// =========================
const IMS_BRAND_THEME = {
  light: {
    primary: "#b8687c",
    primaryHover: "#a85a70",
    primarySoft: "rgba(184, 104, 124, 0.14)",
    sage: "#7f9f72",
    bgBase: "#f9f1e7",
    bgLayout: "#f7eadf",
    bgContainer: "#fffaf5",
    bgElevated: "#fffdf9",
    bgSoft: "#f8efe6",
    bgField: "#fffdf9",
    bgFieldHover: "#fff8f1",
    bgFieldDisabled: "#f2e5d9",
    tableHeader: "#f5e7dd",
    tableHover: "#fff3ed",
    tableSelected: "#f7e0e5",
    textPrimary: "#3f312c",
    textSecondary: "rgba(63, 49, 44, 0.68)",
    border: "rgba(132, 91, 78, 0.16)",
    borderSoft: "rgba(132, 91, 78, 0.10)",
    shadow: "0 14px 34px rgba(96, 61, 52, 0.08)",
    sider: "#fff7ef",
    focusRing: "0 0 0 3px rgba(184, 104, 124, 0.14)",
    overlayMask: "rgba(74, 45, 48, 0.24)",
  },
  dark: {
    primary: "#d88a9c",
    primaryHover: "#e59aad",
    primarySoft: "rgba(216, 138, 156, 0.18)",
    sage: "#a7c296",
    bgBase: "#171112",
    bgLayout: "#1d1518",
    bgContainer: "#241a1d",
    bgElevated: "#2a2024",
    bgSoft: "#31252a",
    bgField: "#2d2126",
    bgFieldHover: "#37282e",
    bgFieldDisabled: "#261b1f",
    tableHeader: "#32262b",
    tableHover: "#3a2b31",
    tableSelected: "#4a313a",
    textPrimary: "#fff5ef",
    textSecondary: "rgba(255, 239, 230, 0.72)",
    border: "rgba(236, 184, 184, 0.16)",
    borderSoft: "rgba(236, 184, 184, 0.10)",
    shadow: "0 16px 36px rgba(0, 0, 0, 0.32)",
    sider: "#21171a",
    focusRing: "0 0 0 3px rgba(216, 138, 156, 0.18)",
    overlayMask: "rgba(9, 5, 7, 0.56)",
  },
};

// =========================
// SECTION: Ant Design Theme Generator - AKTIF DIPAKAI / GUARDED UI
// Fungsi:
// - menjadi pusat token global light/dark mode untuk Ant Design.
// - menyelaraskan komponen default Ant Design dengan token floral warm IMS.
// Hubungan flow aplikasi:
// - dipanggil AppLayout melalui ConfigProvider.
// - hanya mengubah tampilan komponen UI, bukan business rules atau service data.
// Legacy / kandidat cleanup:
// - token biru lama sudah diganti ke dusty rose/sage agar konsisten dengan login baru.
// =========================
export const getAntdTheme = (darkTheme = false) => {
  const palette = darkTheme ? IMS_BRAND_THEME.dark : IMS_BRAND_THEME.light;

  return {
    algorithm: darkTheme ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      // THEME TOKEN - AKTIF DIPAKAI: primary brand color untuk Button, link, active state, dan highlight Ant Design.
      colorPrimary: palette.primary,
      colorPrimaryHover: palette.primaryHover,
      colorInfo: palette.sage,
      fontFamily: 'Inter, "Segoe UI", sans-serif',
      borderRadius: 14,

      // SURFACE TOKEN - AKTIF DIPAKAI: mengontrol background layout, card, modal, drawer, dropdown, dan container Ant Design.
      colorBgBase: palette.bgBase,
      colorBgLayout: palette.bgLayout,
      colorBgContainer: palette.bgContainer,
      colorBgElevated: palette.bgElevated,
      colorBgMask: palette.overlayMask,
      colorBgContainerDisabled: palette.bgFieldDisabled,
      colorFillAlter: palette.bgSoft,

      // TEXT / BORDER TOKEN - AKTIF DIPAKAI: jaga kontras table/form/modal di light dan dark mode.
      colorTextBase: palette.textPrimary,
      colorTextSecondary: palette.textSecondary,
      colorBorder: palette.border,
      colorBorderSecondary: palette.borderSoft,
      colorSplit: palette.borderSoft,

      controlHeight: 42,
      controlHeightSM: 32,
      boxShadowSecondary: palette.shadow,
    },
    components: {
      Layout: {
        bodyBg: "transparent",
        siderBg: palette.sider,
        headerBg: "transparent",
        triggerBg: palette.sider,
        triggerColor: palette.textPrimary,
      },

      // =========================
      // SECTION: Menu Tokens - AKTIF DIPAKAI
      // Fungsi:
      // - mengontrol active/hover menu sidebar agar memakai aksen floral, bukan biru lama.
      // Efek:
      // - berdampak ke menu utama dan submenu Ant Design.
      // =========================
      Menu: {
        itemBorderRadius: 14,
        subMenuItemBorderRadius: 12,
        itemHeight: 44,
        iconSize: 17,
        itemSelectedBg: palette.primarySoft,
        itemSelectedColor: palette.textPrimary,
        itemHoverColor: palette.textPrimary,
        itemHoverBg: darkTheme ? "rgba(255, 245, 239, 0.06)" : "rgba(184, 104, 124, 0.08)",
      },

      // THEME TOKEN - AKTIF DIPAKAI: Card mengikuti surface warm agar halaman data tidak belang dengan background app.
      Card: {
        borderRadiusLG: 18,
        colorBgContainer: palette.bgContainer,
        colorBorderSecondary: palette.borderSoft,
      },

      // THEME TOKEN - AKTIF DIPAKAI: Button primary memakai dusty rose; default button tetap solid dan readable.
      Button: {
        borderRadius: 12,
        defaultBg: palette.bgElevated,
        defaultBorderColor: palette.border,
        defaultColor: palette.textPrimary,
        primaryShadow: "none",
      },

      // THEME TOKEN - AKTIF DIPAKAI: Form control radius disamakan dengan desain card/table.
      Input: {
        borderRadius: 12,
        activeBg: palette.bgField,
        hoverBg: palette.bgFieldHover,
        colorBgContainer: palette.bgField,
        activeBorderColor: palette.primary,
        hoverBorderColor: palette.primary,
        activeShadow: palette.focusRing,
      },

      Select: {
        borderRadius: 12,
        selectorBg: palette.bgField,
        optionSelectedBg: palette.tableSelected,
        optionActiveBg: palette.bgSoft,
        activeBorderColor: palette.primary,
        hoverBorderColor: palette.primary,
        activeOutlineColor: palette.primarySoft,
      },

      DatePicker: {
        borderRadius: 12,
        activeBg: palette.bgField,
        hoverBg: palette.bgFieldHover,
        activeBorderColor: palette.primary,
        hoverBorderColor: palette.primary,
        activeShadow: palette.focusRing,
      },

      InputNumber: {
        borderRadius: 12,
        activeBg: palette.bgField,
        hoverBg: palette.bgFieldHover,
        activeBorderColor: palette.primary,
        hoverBorderColor: palette.primary,
        activeShadow: palette.focusRing,
      },

      // TABLE TOKEN - AKTIF DIPAKAI: table tetap serius/readable dengan header warm dan hover subtle.
      Table: {
        headerBorderRadius: 16,
        headerBg: palette.tableHeader,
        headerColor: palette.textPrimary,
        rowHoverBg: palette.tableHover,
        rowSelectedBg: palette.tableSelected,
        rowSelectedHoverBg: palette.tableSelected,
        borderColor: palette.border,
        headerSplitColor: palette.borderSoft,
        stickyScrollBarBg: palette.primarySoft,
      },

      // DARK/LIGHT SURFACE TOKEN - AKTIF DIPAKAI: Drawer/Modal memakai surface elevated agar portal tidak belang.
      Drawer: {
        colorBgElevated: palette.bgElevated,
        colorBgContainer: palette.bgElevated,
        footerBg: palette.bgElevated,
      },

      Modal: {
        contentBg: palette.bgElevated,
        headerBg: palette.bgElevated,
        footerBg: palette.bgElevated,
      },

      Dropdown: {
        colorBgElevated: palette.bgElevated,
      },

      Popover: {
        colorBgElevated: palette.bgElevated,
      },

      Form: {
        labelColor: palette.textPrimary,
      },

      // TAG TOKEN - AKTIF DIPAKAI: tag default menyatu dengan surface warm, terutama di table/list.
      Tag: {
        defaultBg: palette.bgSoft,
        defaultColor: palette.textPrimary,
      },
    },
  };
};
