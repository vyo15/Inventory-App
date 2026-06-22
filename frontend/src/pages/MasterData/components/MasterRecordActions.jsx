import { Button, Popconfirm, Space } from "antd";
import { EditOutlined, EyeOutlined } from "@ant-design/icons";
import { getMasterRecordToggleLabel } from "./masterRecordActionHelpers";

const MasterRecordActions = ({
  record = {},
  onDetail,
  onEdit,
  onToggle,
  toggleDescription,
  toggleTitle,
}) => (
  <Space direction="vertical" size={6} className="ims-action-group ims-action-group--vertical">
    <Button
      className="ims-action-button ims-action-button--block"
      size="small"
      icon={<EyeOutlined />}
      onClick={() => onDetail(record)}
    >
      Detail
    </Button>
    <Button
      className="ims-action-button ims-action-button--block"
      size="small"
      icon={<EditOutlined />}
      onClick={() => onEdit(record)}
    >
      Edit
    </Button>
    <Popconfirm
      title={toggleTitle}
      description={toggleDescription}
      okText="Ya"
      cancelText="Batal"
      onConfirm={() => onToggle(record)}
    >
      <Button className="ims-action-button ims-action-button--block" size="small">
        {getMasterRecordToggleLabel(record)}
      </Button>
    </Popconfirm>
  </Space>
);

export default MasterRecordActions;
