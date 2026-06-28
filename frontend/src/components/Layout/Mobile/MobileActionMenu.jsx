import { App, Button, Dropdown, Space } from "antd";
import { MoreOutlined } from "@ant-design/icons";
import "./MobileActionMenu.css";

// =====================================================
// SECTION: MobileActionMenu — AKTIF / UI-ONLY
// Fungsi:
// - menjaga card mobile tetap ringkas dengan maksimal dua aksi utama terlihat.
// - aksi tambahan/destructive masuk menu titik tiga.
// - metadata confirm opsional menjaga guard destructive tetap aktif di mobile.
// Guardrail:
// - presentational-only; jangan masukkan mutation stok, sales, purchase, finance,
//   production, reset, restore, atau business rule langsung di komponen ini.
// =====================================================
const MobileActionMenu = ({
  primaryActions = [],
  moreActions = [],
  className = "",
  maxPrimaryActions = 1,
}) => {
  const { modal } = App.useApp();
  const visiblePrimaryActions = (Array.isArray(primaryActions) ? primaryActions : [])
    .filter(Boolean)
    .slice(0, Math.max(1, Number(maxPrimaryActions) || 1));
  const dropdownActions = (Array.isArray(moreActions) ? moreActions : []).filter(Boolean);
  const menuItems = dropdownActions.map((item, index) => ({
    key: item.key || `mobile-action-${index}`,
    label: item.label,
    icon: item.icon,
    danger: item.danger,
    disabled: item.disabled,
    onClick: (info) => {
      info?.domEvent?.stopPropagation?.();

      if (!item.confirm) {
        item.onClick?.(info);
        return;
      }

      modal.confirm({
        title: item.confirm.title,
        content: item.confirm.description,
        okText: item.confirm.okText || "Ya",
        cancelText: item.confirm.cancelText || "Batal",
        okButtonProps: item.confirm.okButtonProps,
        onOk: () => item.onClick?.(info),
      });
    },
  }));

  if (!visiblePrimaryActions.length && !menuItems.length) {
    return null;
  }

  return (
    <Space.Compact block className={["ims-mobile-action-menu", className].filter(Boolean).join(" ")}>
      {visiblePrimaryActions.map((action, index) => (
        <Button
          key={action.key || `mobile-primary-action-${index}`}
          type={action.type || "default"}
          danger={action.danger}
          disabled={action.disabled}
          loading={action.loading}
          icon={action.icon}
          onClick={action.onClick}
          className="ims-mobile-action-menu__button"
        >
          {action.label}
        </Button>
      ))}

      {menuItems.length ? (
        <Dropdown menu={{ items: menuItems }} trigger={["click"]} placement="bottomRight">
          <Button
            aria-label="Aksi lainnya"
            icon={<MoreOutlined />}
            className="ims-mobile-action-menu__more"
          />
        </Dropdown>
      ) : null}
    </Space.Compact>
  );
};

export default MobileActionMenu;
