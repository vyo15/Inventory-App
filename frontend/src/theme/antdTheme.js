import { theme } from "antd";

// =====================================================
// SECTION: AntD Brand/Semantic Palette Split — AKTIF / GUARDED
// Fungsi:
// - menjadi pusat warna React/Ant Design untuk light dan dark mode.
// - memisahkan blue/navy primary, gold brand accent, dan semantic warning.
//
// Dipakai oleh:
// - getAntdTheme() yang diteruskan ke ConfigProvider di AppLayout.
//
// Alasan perubahan:
// - theme baru harus selaras dengan logo biru-kuning tanpa membuat gold menjadi warna dominan atau menggantikan warning semantic.
// - Ant Design token perlu sinkron dengan CSS variable global agar button, menu, table, modal, drawer, input, dan select tetap readable.
//
// Catatan cleanup:
// - belum ada; page-specific hardcoded color tetap perlu audit bertahap tanpa menyentuh logic bisnis.
//
// Risiko:
// - perubahan token ini berdampak global ke seluruh komponen Ant Design; salah kontras dapat membuat status bisnis, form, table, atau modal sulit dibaca.
// =====================================================
const IMS_BRAND_THEME = {
  light: {
    primary: "#245F9D",
    primaryHover: "#1F548C",
    primaryActive: "#173F6B",
    primarySoft: "#E9F2FB",
    primarySofter: "rgba(36, 95, 157, 0.08)",
    textOnPrimary: "#FFFFFF",
    brandGold: "#C9951A",
    brandGoldSoft: "#FFF7E3",
    brandGoldText: "#6F4D00",
    warning: "#D97706",
    warningSoft: "#FFF7ED",
    warningText: "#92400E",
    bgBase: "#F6F9FC",
    bgLayout: "#EEF5FB",
    bgContainer: "#FFFFFF",
    bgElevated: "#FFFFFF",
    bgSoft: "#F8FBFE",
    bgField: "#FFFFFF",
    bgFieldHover: "#F8FBFE",
    bgFieldDisabled: "#EEF5FB",
    tableHeader: "#F8FBFE",
    tableHover: "#F8FBFE",
    tableSelected: "#E9F2FB",
    textPrimary: "#102033",
    textSecondary: "#5B6F84",
    textMuted: "rgba(91, 111, 132, 0.78)",
    border: "#D9E5F2",
    borderSoft: "rgba(36, 95, 157, 0.12)",
    shadow: "0 12px 28px rgba(16, 32, 51, 0.07)",
    sider: "#FFFFFF",
    menuHover: "rgba(36, 95, 157, 0.08)",
    focusRing: "0 0 0 3px rgba(36, 95, 157, 0.16)",
    overlayMask: "rgba(7, 17, 31, 0.32)",
  },
  dark: {
    primary: "#5EA3E6",
    primaryHover: "#7BB7F0",
    primaryActive: "#3D86D1",
    primarySoft: "rgba(94, 163, 230, 0.18)",
    primarySofter: "rgba(94, 163, 230, 0.10)",
    textOnPrimary: "#07111F",
    brandGold: "#F1C75B",
    brandGoldSoft: "rgba(241, 199, 91, 0.14)",
    brandGoldText: "#FFE8A3",
    warning: "#F59E0B",
    warningSoft: "rgba(245, 158, 11, 0.15)",
    warningText: "#FCD34D",
    bgBase: "#07111F",
    bgLayout: "#0A1627",
    bgContainer: "#101E33",
    bgElevated: "#1B304D",
    bgSoft: "#172A45",
    bgField: "#101E33",
    bgFieldHover: "#172A45",
    bgFieldDisabled: "#0A1627",
    tableHeader: "#172A45",
    tableHover: "#1B304D",
    tableSelected: "rgba(94, 163, 230, 0.18)",
    textPrimary: "#EAF2FB",
    textSecondary: "rgba(234, 242, 251, 0.72)",
    textMuted: "rgba(234, 242, 251, 0.56)",
    border: "rgba(147, 184, 223, 0.18)",
    borderSoft: "rgba(147, 184, 223, 0.12)",
    shadow: "0 14px 30px rgba(0, 0, 0, 0.32)",
    sider: "#0A1627",
    menuHover: "rgba(94, 163, 230, 0.10)",
    focusRing: "0 0 0 3px rgba(94, 163, 230, 0.24)",
    overlayMask: "rgba(0, 0, 0, 0.58)",
  },
};

const IMS_FONT_FAMILY_BASE = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const IMS_FONT_SIZE = { meta: 12, body: 14, large: 16 };
const IMS_LINE_HEIGHT = { body: 1.45 };
const IMS_FONT_WEIGHT = { strong: 700 };

// =====================================================
// SECTION: Ant Design Theme Generator — AKTIF / GUARDED UI
// Fungsi:
// - menghasilkan token global dan component token Ant Design dari palette brand aktif.
// - menjaga primary action tetap blue/navy dan warning tetap semantic amber/orange.
//
// Dipakai oleh:
// - AppLayout melalui ConfigProvider.
//
// Alasan perubahan:
// - token per komponen menjaga Button, Menu, Card, Table, Modal, Drawer, Input, Select, DatePicker, dan Tag tetap konsisten tanpa patch page bisnis.
// - gold brand tidak dipakai sebagai primary CTA atau warning mentah.
//
// Catatan cleanup:
// - belum ada.
//
// Risiko:
// - perubahan berlebih dapat mengubah affordance action penting di seluruh modul operasional.
// =====================================================
export const getAntdTheme = (darkTheme = false) => {
  const palette = darkTheme ? IMS_BRAND_THEME.dark : IMS_BRAND_THEME.light;

  return {
    algorithm: darkTheme ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: palette.primary,
      colorPrimaryHover: palette.primaryHover,
      colorPrimaryActive: palette.primaryActive,
      colorInfo: palette.primary,
      colorInfoBg: palette.primarySoft,
      colorInfoBorder: palette.primary,
      colorLink: palette.primary,
      colorLinkHover: palette.primaryHover,
      colorLinkActive: palette.primaryActive,
      colorWarning: palette.warning,
      colorWarningBg: palette.warningSoft,
      colorWarningBgHover: palette.warningSoft,
      colorWarningBorder: palette.warning,
      colorWarningText: palette.warningText,
      fontFamily: IMS_FONT_FAMILY_BASE,
      fontSize: IMS_FONT_SIZE.body,
      fontSizeSM: IMS_FONT_SIZE.meta,
      fontSizeLG: IMS_FONT_SIZE.large,
      fontWeightStrong: IMS_FONT_WEIGHT.strong,
      lineHeight: IMS_LINE_HEIGHT.body,
      borderRadius: 14,

      colorBgBase: palette.bgBase,
      colorBgLayout: palette.bgLayout,
      colorBgContainer: palette.bgContainer,
      colorBgElevated: palette.bgElevated,
      colorBgMask: palette.overlayMask,
      colorBgContainerDisabled: palette.bgFieldDisabled,
      colorFill: palette.primarySofter,
      colorFillSecondary: palette.primarySoft,
      colorFillTertiary: palette.bgSoft,
      colorFillQuaternary: palette.bgSoft,
      colorFillAlter: palette.bgSoft,

      colorTextBase: palette.textPrimary,
      colorText: palette.textPrimary,
      colorTextSecondary: palette.textSecondary,
      colorTextTertiary: palette.textMuted,
      colorTextQuaternary: palette.textMuted,
      colorBorder: palette.border,
      colorBorderSecondary: palette.borderSoft,
      colorSplit: palette.borderSoft,

      controlHeight: 42,
      controlHeightSM: 32,
      controlOutline: palette.primarySoft,
      controlItemBgActive: palette.primarySoft,
      controlItemBgHover: palette.bgSoft,
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

      Menu: {
        itemBorderRadius: 14,
        subMenuItemBorderRadius: 12,
        itemHeight: 44,
        iconSize: 17,
        itemBg: "transparent",
        itemColor: palette.textSecondary,
        itemSelectedBg: palette.primarySoft,
        itemSelectedColor: palette.primary,
        itemHoverColor: palette.primary,
        itemHoverBg: palette.menuHover,
        subMenuItemBg: "transparent",
        darkItemBg: "transparent",
        darkItemColor: palette.textSecondary,
        darkItemSelectedBg: palette.primarySoft,
        darkItemSelectedColor: palette.textPrimary,
        darkItemHoverBg: palette.menuHover,
        darkItemHoverColor: palette.textPrimary,
      },

      Card: {
        borderRadiusLG: 18,
        colorBgContainer: palette.bgContainer,
        colorBorderSecondary: palette.borderSoft,
      },

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

      Button: {
        borderRadius: 12,
        defaultBg: palette.bgElevated,
        defaultBorderColor: palette.border,
        defaultColor: palette.textPrimary,
        defaultHoverBg: palette.bgSoft,
        defaultHoverBorderColor: palette.primary,
        defaultHoverColor: palette.primary,
        primaryColor: palette.textOnPrimary,
        primaryShadow: "none",
      },

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

      Tag: {
        defaultBg: palette.bgSoft,
        defaultColor: palette.textPrimary,
      },

      Form: {
        labelColor: palette.textPrimary,
      },
    },
  };
};
