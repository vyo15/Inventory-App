import { Modal, Space, Typography } from "antd";
import { USER_STATUS } from "../../../utils/auth/roleAccess";

const { Text } = Typography;

const UserStatusChangeModal = ({
  open,
  request,
  loading,
  onCancel,
  onConfirm,
}) => {
  const isDeactivation = request?.nextStatus === USER_STATUS.INACTIVE;

  return (
    <Modal
      title={isDeactivation ? "Nonaktifkan user?" : "Aktifkan user?"}
      open={open}
      onCancel={onCancel}
      onOk={onConfirm}
      confirmLoading={loading}
      okText={isDeactivation ? "Nonaktifkan" : "Aktifkan"}
      okButtonProps={{ danger: isDeactivation }}
      cancelText="Batal"
      destroyOnHidden
    >
      <Space direction="vertical" size={8}>
        <Text>
          Profile: <Text strong>{request?.userRecord?.displayName || "User"}</Text>{" "}
          (<Text code>@{request?.userRecord?.username || "-"}</Text>)
        </Text>
        <Text>
          {isDeactivation
            ? "User tidak bisa login sampai diaktifkan lagi."
            : "User bisa login kembali."}
        </Text>
      </Space>
    </Modal>
  );
};

export default UserStatusChangeModal;
