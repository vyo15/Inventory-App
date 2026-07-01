import {
  Avatar,
  Button,
  Form,
  Input,
  Select,
  Upload,
} from "antd";
import {
  CameraOutlined,
  DeleteOutlined,
  LockOutlined,
} from "@ant-design/icons";
import PageFormModal from "../../../components/Layout/Forms/PageFormModal";
import {
  USER_STATUS,
  USER_STATUS_LABELS,
} from "../../../utils/auth/roleAccess";

const UserProfileFormModal = ({
  open,
  form,
  isCreate,
  isEditingSelf,
  isSaving,
  isProcessingAvatar,
  avatarDraft,
  modalInitials,
  assignableRoleOptions,
  passwordPolicyHint,
  avatarMimeTypes,
  normalizeUsername,
  validateUsernamePattern,
  validateUniqueUsername,
  validatePassword,
  onCancel,
  onFinish,
  onAvatarUpload,
  onRemoveAvatar,
}) => (
  <PageFormModal
    title={isCreate
      ? "Tambah Akun"
      : isEditingSelf
        ? "Edit Profil Saya"
        : "Edit Akun Lokal"}
    open={open}
    onCancel={onCancel}
    okText="Simpan"
    cancelText="Batal"
    form={form}
    onFinish={onFinish}
    confirmLoading={isSaving || isProcessingAvatar}
    modalProps={{ destroyOnHidden: true, width: 620 }}
    formProps={{ requiredMark: false }}
  >
    <div className="ims-user-photo-field">
      <Avatar
        className="ims-user-photo-preview"
        size={88}
        src={avatarDraft || undefined}
        alt="Preview foto profil"
      >
        {modalInitials}
      </Avatar>
      <div className="ims-user-photo-copy">
        <h4>Foto Profil</h4>
        <p>
          Foto opsional. JPG, PNG, atau WebP maksimal 2 MB akan dipotong 1:1 dan diperkecil otomatis.
        </p>
        <div className="ims-user-photo-actions">
          <Upload
            accept={avatarMimeTypes.join(",")}
            beforeUpload={onAvatarUpload}
            showUploadList={false}
            disabled={isProcessingAvatar || isSaving}
          >
            <Button icon={<CameraOutlined />} loading={isProcessingAvatar}>
              {avatarDraft ? "Ganti Foto" : "Pilih Foto"}
            </Button>
          </Upload>
          <Button
            danger
            icon={<DeleteOutlined />}
            disabled={!avatarDraft || isProcessingAvatar || isSaving}
            onClick={onRemoveAvatar}
          >
            Hapus Foto
          </Button>
        </div>
      </div>
    </div>

    <Form.Item
      label="Username"
      name="username"
      normalize={normalizeUsername}
      rules={[
        { required: true, message: "Username wajib diisi." },
        { validator: validateUsernamePattern },
        { validator: validateUniqueUsername },
      ]}
    >
      <Input disabled={!isCreate} placeholder="contoh: user-gudang" />
    </Form.Item>

    <Form.Item
      label="Nama Tampilan"
      name="displayName"
      rules={[{ required: true, message: "Nama tampilan wajib diisi." }]}
    >
      <Input placeholder="contoh: Admin Toko" />
    </Form.Item>

    <Form.Item
      label={isCreate ? "Password" : "Password Baru"}
      name="password"
      rules={isCreate
        ? [
            { required: true, message: "Password akun wajib diisi." },
            { validator: validatePassword },
          ]
        : [{ validator: (_, value) => (value ? validatePassword(_, value) : Promise.resolve()) }]}
    >
      <Input.Password
        autoComplete="new-password"
        prefix={<LockOutlined />}
        placeholder={isCreate ? passwordPolicyHint : "Isi jika ingin ganti password"}
      />
    </Form.Item>

    <Form.Item
      label="Konfirmasi Password"
      name="confirmPassword"
      dependencies={["password"]}
      rules={[
        ({ getFieldValue }) => ({
          validator(_, value) {
            const password = getFieldValue("password");
            if (!password && !isCreate) return Promise.resolve();
            if (!value && isCreate) {
              return Promise.reject(new Error("Konfirmasi password wajib diisi."));
            }
            if (password && value !== password) {
              return Promise.reject(new Error("Konfirmasi password belum sama."));
            }
            return Promise.resolve();
          },
        }),
      ]}
    >
      <Input.Password
        autoComplete="new-password"
        prefix={<LockOutlined />}
        placeholder="Ulangi password"
      />
    </Form.Item>

    <Form.Item
      label="Role"
      name="role"
      rules={[{ required: true, message: "Role wajib dipilih." }]}
      extra={isEditingSelf ? "Role akun sendiri dikunci untuk menjaga akses administrator." : undefined}
    >
      <Select
        disabled={isEditingSelf}
        options={assignableRoleOptions}
        placeholder="Pilih Administrator atau User"
      />
    </Form.Item>

    <Form.Item
      label="Status"
      name="status"
      rules={[{ required: true, message: "Status wajib dipilih." }]}
      extra={isEditingSelf ? "Status akun yang sedang digunakan tidak dapat diubah." : undefined}
    >
      <Select
        disabled={isEditingSelf}
        options={[
          { label: USER_STATUS_LABELS[USER_STATUS.ACTIVE], value: USER_STATUS.ACTIVE },
          { label: USER_STATUS_LABELS[USER_STATUS.INACTIVE], value: USER_STATUS.INACTIVE },
        ]}
      />
    </Form.Item>
  </PageFormModal>
);

export default UserProfileFormModal;
