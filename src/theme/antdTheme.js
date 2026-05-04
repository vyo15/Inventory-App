import { theme } from "antd";

// =========================
// SECTION: Brand Palette Source - AKTIF / THEME CENTER
// Fungsi blok:
// - menjadi pusat warna React/Ant Design untuk light dan dark mode berbasis blue/yellow/white/navy Flanel Karawang Industries.
// - menjaga semantic palette agar komponen Ant Design tidak membawa warna lama yang berbeda dari CSS variable global.
// Hubungan blok dengan flow aplikasi:
// - dipakai oleh getAntdTheme() lalu diteruskan ke ConfigProvider di AppLayout.
// - tidak menyentuh auth, router, roleAccess, service, transaksi, stok, produksi, payroll, HPP, laporan, atau schema Firestore.
// Alasan logic dipakai:
// - semua token Ant Design diturunkan dari satu object agar perubahan visual tidak menyebar ke modul bisnis.
// - accent yellow dibatasi untuk highlight/warning soft dan tidak dipakai sebagai warna text panjang.
// Status logic:
// - AKTIF sebagai foundation theme Phase 01.
// - GUARDED karena berdampak ke Button, Menu, Card, Table, Modal, Drawer, Input, Select, DatePicker, dan Tag.
// - CLEANUP CANDIDATE: struktur palette dapat disederhanakan setelah alias compatibility CSS selesai diaudit.
// =========================
const IMS_BRAND_THEME = {
  light: {
    primary: "#2C6DB0",
    primaryHover: "#245F9D",
    primaryActive: "#1B4F86",
    primarySoft: "#EAF3FC",
    primarySofter: "rgba(44, 109, 176, 0.08)",
    accentYellow: "#FEC32D",
    accentYellowSoft: "#FFF4CC",
    accentYellowText: "#6F4D00",
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
    tableSelected: "#EAF3FC",
    textPrimary: "#102033",
    textSecondary: "#5B6F84",
    textMuted: "rgba(91, 111, 132, 0.78)",
    border: "#D9E5F2",
    borderSoft: "rgba(44, 109, 176, 0.12)",
    shadow: "0 14px 34px rgba(16, 32, 51, 0.08)",
    sider: "#FFFFFF",
    menuHover: "rgba(44, 109, 176, 0.08)",
    focusRing: "0 0 0 3px rgba(44, 109, 176, 0.16)",
    overlayMask: "rgba(7, 17, 31, 0.32)",
  },
  dark: {
    primary: "#5EA3E6",
    primaryHover: "#7BB7F0",
    primaryActive: "#3D86D1",
    primarySoft: "rgba(94, 163, 230, 0.18)",
    primarySofter: "rgba(94, 163, 230, 0.10)",
    accentYellow: "#FFD56A",
    accentYellowSoft: "rgba(254, 195, 45, 0.16)",
    accentYellowText: "#FFE8A3",
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
    shadow: "0 16px 36px rgba(0, 0, 0, 0.36)",
    sider: "#0A1627",
    menuHover: "rgba(94, 163, 230, 0.10)",
    focusRing: "0 0 0 3px rgba(94, 163, 230, 0.24)",
    overlayMask: "rgba(0, 0, 0, 0.58)",
  },
};

// =========================
// SECTION: Ant Design Theme Generator - AKTIF / GUARDED UI
// Fungsi blok:
// - menghasilkan token global dan component token Ant Design dari palette brand aktif.
// - menyelaraskan light/dark mode Ant Design dengan CSS variable global di src/index.css.
// Hubungan blok dengan flow aplikasi:
// - dipanggil AppLayout melalui ConfigProvider dan hanya mengatur presentasi komponen UI.
// - tidak mengubah flow AppLayout, state theme, localStorage, auth, router, roleAccess, service, atau business rules.
// Alasan logic dipakai:
// - token per komponen menjaga Button, Menu, Card, Table, Modal, Drawer, Input, Select, DatePicker, dan Tag tetap konsisten tanpa patch halaman bisnis.
// - warna primary biru dipakai untuk action/navigation; accent yellow hanya untuk warning/highlight soft.
// Status logic:
// - AKTIF sebagai theme bridge React/Ant Design.
// - GUARDED karena perubahan token dapat memengaruhi seluruh modul yang memakai komponen Ant Design.
// =========================
export const getAntdTheme = (darkTheme = false) => {
  const palette = darkTheme ? IMS_BRAND_THEME.dark : IMS_BRAND_THEME.light;

  return {
    algorithm: darkTheme ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      // THEME TOKEN - AKTIF: primary action/navigation, link, active state, dan focus Ant Design mengikuti blue foundation.
      colorPrimary: palette.primary,
      colorPrimaryHover: palette.primaryHover,
      colorPrimaryActive: palette.primaryActive,
      colorInfo: palette.primary,
      colorInfoBg: palette.primarySoft,
      colorInfoBorder: palette.primary,
      colorLink: palette.primary,
      colorLinkHover: palette.primaryHover,
      colorLinkActive: palette.primaryActive,
      colorWarning: palette.accentYellow,
      colorWarningBg: palette.accentYellowSoft,
      colorWarningBgHover: palette.accentYellowSoft,
      colorWarningBorder: palette.accentYellow,
      colorWarningText: palette.accentYellowText,
      fontFamily: 'Inter, "Segoe UI", sans-serif',
      borderRadius: 14,

      // SURFACE TOKEN - AKTIF: mengontrol background layout, card, modal, drawer, dropdown, dan container Ant Design.
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

      // TEXT / BORDER TOKEN - AKTIF: menjaga kontras table/form/modal di light dan dark mode.
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

      // =========================
      // SECTION: Menu Tokens - AKTIF
      // Fungsi blok:
      // - mengontrol active/hover menu sidebar agar primary navigation memakai blue foundation.
      // Hubungan blok dengan flow aplikasi:
      // - hanya presentasi menu Ant Design; SidebarMenu route item dan role guard tidak berubah.
      // Alasan logic dipakai:
      // - selected state dibuat soft agar modern/minimalis dan tidak terlalu berat di sidebar.
      // Status logic:
      // - AKTIF; GUARDED karena menu dipakai sebagai navigasi utama aplikasi.
      // =========================
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

      // =========================
      // SECTION: Surface Components - AKTIF
      // Fungsi blok:
      // - menyamakan Card, Drawer, Modal, Dropdown, dan Popover dengan surface global.
      // Hubungan blok dengan flow aplikasi:
      // - hanya warna/radius/shadow komponen; content transaksi, produksi, payroll, dan laporan tidak berubah.
      // Alasan logic dipakai:
      // - portal dan card harus tetap solid/readable di light dan dark mode.
      // Status logic:
      // - AKTIF; GUARDED karena banyak modul bisnis memakai komponen ini.
      // =========================
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

      // =========================
      // SECTION: Action Components - AKTIF
      // Fungsi blok:
      // - menjaga Button primary sebagai action biru dan default button tetap netral/readable.
      // Hubungan blok dengan flow aplikasi:
      // - handler submit/save/delete/import/export tidak berubah; hanya style tombol.
      // Alasan logic dipakai:
      // - primaryShadow dihilangkan agar visual lebih clean dan profesional.
      // Status logic:
      // - AKTIF; GUARDED karena Button dipakai di semua modul operasional.
      // =========================
      Button: {
        borderRadius: 12,
        defaultBg: palette.bgElevated,
        defaultBorderColor: palette.border,
        defaultColor: palette.textPrimary,
        defaultHoverBg: palette.bgSoft,
        defaultHoverBorderColor: palette.primary,
        defaultHoverColor: palette.primary,
        primaryShadow: "none",
      },

      // =========================
      // SECTION: Form Control Components - AKTIF
      // Fungsi blok:
      // - menyamakan Input, Select, DatePicker, dan InputNumber dengan token field/focus brand.
      // Hubungan blok dengan flow aplikasi:
      // - tidak mengubah validasi, normalize value, submit, query, atau schema data form.
      // Alasan logic dipakai:
      // - focus ring biru memberi affordance jelas tanpa visual berlebihan.
      // Status logic:
      // - AKTIF; GUARDED karena form dipakai modul master data, transaksi, produksi, payroll, dan laporan.
      // =========================
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

      // =========================
      // SECTION: Data Display Components - AKTIF
      // Fungsi blok:
      // - menjaga Table dan Tag tetap solid, clean, dan proporsional di light/dark mode.
      // Hubungan blok dengan flow aplikasi:
      // - hanya presentasi data; sorting/filtering/pagination/action handler table tidak berubah.
      // Alasan logic dipakai:
      // - header/hover/selected row memakai soft blue agar readable, sedangkan warning soft memakai yellow accent.
      // Status logic:
      // - AKTIF; GUARDED karena Table/Tag muncul di inventory, purchases, sales, returns, produksi, payroll, HPP, dan reports.
      // =========================
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
