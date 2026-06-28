import { EditOutlined, EyeOutlined } from "@ant-design/icons";
import TableActionMenu from "../../../components/Layout/Table/TableActionMenu";
import { getMasterRecordToggleLabel } from "./masterRecordActionHelpers";

const MasterRecordActions = ({
  record = {},
  onDetail,
  onEdit,
  onToggle,
  toggleDescription,
  toggleTitle,
}) => (
  <TableActionMenu
    visibleActions={[
      {
        key: "detail",
        label: "Detail",
        icon: <EyeOutlined />,
        onClick: () => onDetail(record),
      },
    ]}
    moreActions={[
      {
        key: "edit",
        label: "Edit",
        icon: <EditOutlined />,
        onClick: () => onEdit(record),
      },
      {
        key: "toggle",
        label: getMasterRecordToggleLabel(record),
        danger: record.isActive !== false,
        confirm: {
          title: toggleTitle,
          description: toggleDescription,
          okText: "Ya",
          cancelText: "Batal",
        },
        onClick: () => onToggle(record),
      },
    ]}
  />
);

export default MasterRecordActions;
