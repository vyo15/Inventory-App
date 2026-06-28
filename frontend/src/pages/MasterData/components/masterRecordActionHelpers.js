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
  toggleTitle,
  toggleDescription,
}) => {
  const toggleLabel = getMasterRecordToggleLabel(record);

  return {
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
        label: toggleLabel,
        danger: record.isActive !== false,
        confirm: {
          title: toggleTitle || `${toggleLabel} data ini?`,
          description: toggleDescription,
          okText: "Ya",
          cancelText: "Batal",
        },
        onClick: () => onToggle(record),
      },
    ],
  };
};
