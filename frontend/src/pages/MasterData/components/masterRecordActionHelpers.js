import { createElement } from "react";
import { EditOutlined, EyeOutlined } from "@ant-design/icons";

export const getMasterRecordToggleLabel = (record = {}) => (
  record.isActive === false ? "Aktifkan" : "Nonaktifkan"
);

export const buildMasterRecordMobileActions = ({
  record = {},
  onDetail,
  onEdit,
  onToggle,
}) => ({
  primaryActions: [
    {
      key: "detail",
      label: "Detail",
      icon: createElement(EyeOutlined),
      onClick: () => onDetail(record),
    },
  ],
  moreActions: [
    {
      key: "edit",
      label: "Edit",
      icon: createElement(EditOutlined),
      onClick: () => onEdit(record),
    },
    {
      key: "toggle",
      label: getMasterRecordToggleLabel(record),
      onClick: () => onToggle(record),
    },
  ],
});
