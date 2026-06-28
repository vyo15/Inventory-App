import { useState } from "react";
import { Button, Popconfirm, Popover, Space } from "antd";
import { MoreOutlined } from "@ant-design/icons";
import "./TableActionMenu.css";

const normalizeActions = (actions = []) =>
  (Array.isArray(actions) ? actions : []).filter(Boolean);

const TableActionMenu = ({
  visibleActions = [],
  moreActions = [],
  className = "",
  moreAriaLabel = "Aksi lainnya",
}) => {
  const [open, setOpen] = useState(false);
  const resolvedVisibleActions = normalizeActions(visibleActions);
  const resolvedMoreActions = normalizeActions(moreActions);

  const runAction = (action, event) => {
    event?.stopPropagation?.();
    action.onClick?.(event);
    setOpen(false);
  };

  const renderActionButton = (action, placement) => {
    const isOverflow = placement === "overflow";
    const button = (
      <Button
        key={action.key || action.label}
        type={isOverflow ? "text" : action.type || "default"}
        danger={action.danger}
        disabled={action.disabled}
        loading={action.loading}
        icon={action.icon}
        size={isOverflow ? "middle" : "small"}
        className={isOverflow ? "ims-table-action-menu__item" : "ims-table-action-menu__primary"}
        aria-label={action.ariaLabel || action.label}
        onClick={action.confirm ? (event) => event.stopPropagation() : (event) => runAction(action, event)}
      >
        {action.label}
      </Button>
    );

    if (!action.confirm) return button;

    return (
      <Popconfirm
        key={action.key || action.label}
        title={action.confirm.title}
        description={action.confirm.description}
        okText={action.confirm.okText || "Ya"}
        cancelText={action.confirm.cancelText || "Batal"}
        okButtonProps={action.confirm.okButtonProps}
        onConfirm={(event) => runAction(action, event)}
      >
        {button}
      </Popconfirm>
    );
  };

  if (!resolvedVisibleActions.length && !resolvedMoreActions.length) {
    return null;
  }

  const content = resolvedMoreActions.length ? (
    <div className="ims-table-action-menu__panel" onClick={(event) => event.stopPropagation()}>
      {resolvedMoreActions.map((action) => renderActionButton(action, "overflow"))}
    </div>
  ) : null;

  return (
    <Space.Compact
      className={["ims-table-action-menu", className].filter(Boolean).join(" ")}
      onClick={(event) => event.stopPropagation()}
    >
      {resolvedVisibleActions.map((action) => renderActionButton(action, "visible"))}

      {content ? (
        <Popover
          content={content}
          trigger="click"
          placement="bottomRight"
          open={open}
          onOpenChange={setOpen}
          overlayClassName="ims-table-action-menu-popover"
        >
          <Button
            size="small"
            className="ims-table-action-menu__more"
            icon={<MoreOutlined />}
            aria-label={moreAriaLabel}
          />
        </Popover>
      ) : null}
    </Space.Compact>
  );
};

export default TableActionMenu;
