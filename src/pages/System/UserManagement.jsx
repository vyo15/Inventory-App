import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import {
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import useAuth from "../../hooks/useAuth";
import {
  ROLE_LABELS,
  ROLES,
  USER_STATUS,
  USER_STATUS_LABELS,
  getAssignableRolesForActor,
  canManageUserProfile,
} from "../../utils/auth/roleAccess";
import {
  createSystemUserWithAuth,
  listSystemUsers,
  updateSystemUserProfile,
  updateSystemUserStatus,
} from "../../services/System/userService";

const { Text, Title } = Typography;

// =========================
// SECTION: Form Mode Constants - AKTIF
// Fungsi:
// - membedakan modal tambah user Auth + profile dan edit profile.
// Hubungan flow aplikasi:
// - mode create memanggil Cloud Function untuk membuat Firebase Auth user dan `system_users/{uid}`;
// - mode edit hanya mengubah profile role/status/display name yang sudah ada.
// Status:
// - AKTIF untuk halaman Manajemen User.
// =========================
const FORM_MODE = {
  CREATE: "create",
  EDIT: "edit",
};

const getRoleColor = (role) => {
  if (role === ROLES.SUPER_ADMIN) return "default";
  if (role === ROLES.ADMINISTRATOR) return "blue";
  return "green";
};

const getStatusColor = (status) => {
  return status === USER_STATUS.ACTIVE ? "green" : "default";
};

// =========================
// SECTION: User Management Page - AKTIF / GUARDED
// Fungsi:
// - menampilkan dan mengelola profile internal user dari collection `system_users`;
// - membuat user baru lewat backend trusted agar Auth UID otomatis dari Firebase Authentication.
// Hubungan flow aplikasi:
// - AuthProvider memakai profile ini untuk memutuskan user boleh masuk aplikasi;
// - Route/Menu Guard membatasi halaman ini untuk Administrator dan super_admin legacy;
// - Cloud Function `createSystemUser` memakai Admin SDK, bukan credential di frontend.
// Status:
// - AKTIF untuk Auth User Creation Phase.
// - GUARDED: password sementara tidak pernah disimpan di Firestore.
// Legacy / cleanup:
// - flow lama input manual Auth UID saat create user sudah tidak dipakai oleh form create.
// =========================
const UserManagement = () => {
  const { profile, firebaseUser, reloadProfile } = useAuth();
  const [form] = Form.useForm();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formMode, setFormMode] = useState(FORM_MODE.CREATE);
  const [selectedUser, setSelectedUser] = useState(null);

  const actorRole = profile?.role;
  const actorUid = profile?.authUid || profile?.id || firebaseUser?.uid;

  const assignableRoleOptions = useMemo(() => {
    return getAssignableRolesForActor(actorRole).map((role) => ({
      label: ROLE_LABELS[role] || role,
      value: role,
    }));
  }, [actorRole]);

  // =========================
  // SECTION: Load Users - AKTIF / GUARDED
  // Fungsi:
  // - mengambil daftar user sesuai hak role aktif.
  // Hubungan flow aplikasi:
  // - Administrator melihat profile semua role yang dikenal;
  // - super_admin legacy dipetakan ke akses Administrator agar data lama tidak terkunci.
  // Status:
  // - AKTIF.
  // =========================
  const loadUsers = async () => {
    setIsLoading(true);

    try {
      const result = await listSystemUsers(profile);
      setUsers(result);
    } catch (error) {
      console.error("[UserManagement] Gagal memuat user.", error);
      message.error(error.message || "Gagal memuat data user.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.role) {
      loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.role]);

  const openCreateModal = () => {
    setFormMode(FORM_MODE.CREATE);
    setSelectedUser(null);
    form.resetFields();
    const defaultCreateRole = assignableRoleOptions.some(
      (option) => option.value === ROLES.USER,
    )
      ? ROLES.USER
      : assignableRoleOptions[0]?.value;

    form.setFieldsValue({
      // AKTIF/GUARDED: default dibuat sebagai User agar admin tidak tidak sengaja membuat akun admin baru.
      role: defaultCreateRole || ROLES.USER,
      status: USER_STATUS.ACTIVE,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (userRecord) => {
    setFormMode(FORM_MODE.EDIT);
    setSelectedUser(userRecord);
    form.resetFields();
    form.setFieldsValue({
      authUid: userRecord.authUid,
      username: userRecord.username,
      displayName: userRecord.displayName,
      role: userRecord.role,
      status: userRecord.status,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
    form.resetFields();
  };

  // =========================
  // SECTION: Save User - AKTIF / GUARDED
  // Fungsi:
  // - create: memanggil Cloud Function untuk membuat Firebase Auth user + profile `system_users/{uid}`;
  // - edit: mengubah profile yang sudah ada tanpa mengubah password/Auth user.
  // Hubungan flow aplikasi:
  // - user baru mendapat UID otomatis dari Firebase Auth;
  // - profile yang dibuat akan dibaca AuthProvider saat user login.
  // Status:
  // - AKTIF.
  // - GUARDED: jangan menyimpan password sementara ke Firestore atau state permanen.
  // =========================
  const handleSaveProfile = async (values) => {
    setIsSaving(true);

    try {
      if (formMode === FORM_MODE.CREATE) {
        await createSystemUserWithAuth(values, profile);
        message.success("User Auth dan profile system_users berhasil dibuat.");
      } else if (selectedUser) {
        await updateSystemUserProfile(selectedUser.authUid, values, profile);
        message.success("Profile user berhasil diperbarui.");
      }

      closeModal();
      await loadUsers();
      await reloadProfile();
    } catch (error) {
      console.error("[UserManagement] Gagal menyimpan user.", error);
      message.error(error.message || "Gagal menyimpan user.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (userRecord) => {
    const nextStatus =
      userRecord.status === USER_STATUS.ACTIVE
        ? USER_STATUS.INACTIVE
        : USER_STATUS.ACTIVE;

    Modal.confirm({
      title:
        nextStatus === USER_STATUS.INACTIVE
          ? "Nonaktifkan user?"
          : "Aktifkan user?",
      content:
        nextStatus === USER_STATUS.INACTIVE
          ? "User inactive tidak boleh masuk aplikasi utama. Firebase Auth user tidak dihapus."
          : "User akan bisa masuk lagi jika Auth user dan password masih valid.",
      okText: nextStatus === USER_STATUS.INACTIVE ? "Nonaktifkan" : "Aktifkan",
      cancelText: "Batal",
      onOk: async () => {
        try {
          await updateSystemUserStatus(userRecord, nextStatus, profile);
          message.success("Status user berhasil diperbarui.");
          await loadUsers();
        } catch (error) {
          console.error("[UserManagement] Gagal mengubah status user.", error);
          message.error(error.message || "Gagal mengubah status user.");
        }
      },
    });
  };

  const columns = [
    {
      title: "User",
      key: "user",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.displayName}</Text>
          <Text type="secondary">@{record.username}</Text>
        </Space>
      ),
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      render: (role) => <Tag color={getRoleColor(role)}>{ROLE_LABELS[role] || role}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => (
        <Tag color={getStatusColor(status)}>{USER_STATUS_LABELS[status] || status}</Tag>
      ),
    },
    {
      title: "Auth UID",
      dataIndex: "authUid",
      key: "authUid",
      ellipsis: true,
      render: (authUid) => <Text copyable>{authUid}</Text>,
    },
    {
      title: "Aksi",
      key: "actions",
      width: 220,
      render: (_, record) => {
        const canManage = canManageUserProfile({
          actorRole,
          targetRole: record.role,
          targetUid: record.authUid,
          actorUid,
        });

        return (
          <Space wrap>
            <Button
              icon={<EditOutlined />}
              disabled={!canManage}
              onClick={() => openEditModal(record)}
            >
              Edit
            </Button>
            <Button
              icon={
                record.status === USER_STATUS.ACTIVE ? (
                  <StopOutlined />
                ) : (
                  <CheckCircleOutlined />
                )
              }
              disabled={!canManage}
              danger={record.status === USER_STATUS.ACTIVE}
              onClick={() => handleToggleStatus(record)}
            >
              {record.status === USER_STATUS.ACTIVE ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={styles.pageWrap}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <div style={styles.headerRow}>
          <div>
            <Title level={3} style={styles.title}>
              Manajemen User
            </Title>
            <Text type="secondary">
              Kelola Auth user, profile, role aktif Administrator/User, dan status user internal IMS Bunga Flanel.
            </Text>
          </div>
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={loadUsers} loading={isLoading}>
              Refresh
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              Tambah Profile User
            </Button>
          </Space>
        </div>

        <Alert
          type="info"
          showIcon
          message="Auth UID otomatis via Cloud Function"
          description="Saat tambah user, sistem membuat Firebase Auth user lewat backend trusted lalu membuat profile system_users/{uid}. Password sementara hanya dikirim ke Firebase Auth dan tidak disimpan di Firestore."
        />

        <Card>
          <Table
            rowKey="authUid"
            columns={columns}
            dataSource={users}
            loading={isLoading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 980 }}
          />
        </Card>
      </Space>

      <Modal
        title={
          formMode === FORM_MODE.CREATE
            ? "Tambah User Auth + Profile"
            : "Edit Profile User"
        }
        open={isModalOpen}
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={isSaving}
        okText="Simpan"
        cancelText="Batal"
        destroyOnClose
      >
        <Alert
          type={formMode === FORM_MODE.CREATE ? "info" : "warning"}
          showIcon
          style={{ marginBottom: 16 }}
          message={
            formMode === FORM_MODE.CREATE
              ? "Auth UID akan dibuat otomatis"
              : "Edit profile tidak mengubah password Auth"
          }
          description={
            formMode === FORM_MODE.CREATE
              ? "Isi username, nama tampilan, role, status, dan password sementara. Cloud Function akan membuat Firebase Auth user dan dokumen system_users/{uid}."
              : "Perubahan hanya berlaku pada profile, role, dan status di Firestore. Password tetap dikelola oleh Firebase Authentication."
          }
        />

        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={handleSaveProfile}
        >
          {formMode === FORM_MODE.EDIT ? (
            <Form.Item label="Auth UID" name="authUid">
              <Input disabled />
            </Form.Item>
          ) : null}

          <Form.Item
            label="Username"
            name="username"
            rules={[{ required: true, message: "Username wajib diisi." }]}
            extra="Username akan dipakai sebagai login internal, contoh admin untuk admin@ims-bunga-flanel.local."
          >
            <Input disabled={formMode === FORM_MODE.EDIT} placeholder="contoh: admin" />
          </Form.Item>

          <Form.Item
            label="Nama Tampilan"
            name="displayName"
            rules={[{ required: true, message: "Nama tampilan wajib diisi." }]}
          >
            <Input placeholder="contoh: Admin Toko" />
          </Form.Item>

          <Form.Item
            label="Role"
            name="role"
            rules={[{ required: true, message: "Role wajib dipilih." }]}
          >
            <Select
              options={assignableRoleOptions}
              placeholder="Pilih Administrator atau User"
            />
          </Form.Item>

          <Form.Item
            label="Status"
            name="status"
            rules={[{ required: true, message: "Status wajib dipilih." }]}
          >
            <Select
              options={[
                { label: USER_STATUS_LABELS[USER_STATUS.ACTIVE], value: USER_STATUS.ACTIVE },
                { label: USER_STATUS_LABELS[USER_STATUS.INACTIVE], value: USER_STATUS.INACTIVE },
              ]}
            />
          </Form.Item>

          {formMode === FORM_MODE.CREATE ? (
            <Form.Item
              label="Password Sementara"
              name="temporaryPassword"
              rules={[
                { required: true, message: "Password sementara wajib diisi." },
                { min: 6, message: "Password sementara minimal 6 karakter." },
              ]}
              extra="Password ini dikirim ke Firebase Auth melalui Cloud Function dan tidak disimpan di Firestore."
            >
              <Input.Password
                autoComplete="new-password"
                placeholder="Minimal 6 karakter"
              />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </div>
  );
};

const styles = {
  pageWrap: {
    padding: 24,
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  title: {
    marginBottom: 4,
  },
};

export default UserManagement;
