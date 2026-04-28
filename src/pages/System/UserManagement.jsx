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
  createSystemUserProfile,
  listSystemUsers,
  updateSystemUserProfile,
  updateSystemUserStatus,
} from "../../services/System/userService";

const { Text, Title } = Typography;

// =========================
// SECTION: Form Mode Constants — AKTIF
// Fungsi:
// - membedakan modal tambah profile dan edit profile.
// Hubungan flow aplikasi:
// - Fase E hanya membuat/mengelola profile `system_users`, bukan membuat password/Auth user.
// Status:
// - AKTIF untuk halaman Manajemen User.
// =========================
const FORM_MODE = {
  CREATE: "create",
  EDIT: "edit",
};

const getRoleColor = (role) => {
  if (role === ROLES.SUPER_ADMIN) return "red";
  if (role === ROLES.ADMINISTRATOR) return "blue";
  return "green";
};

const getStatusColor = (status) => {
  return status === USER_STATUS.ACTIVE ? "green" : "default";
};

// =========================
// SECTION: User Management Page — AKTIF / GUARDED
// Fungsi:
// - menampilkan dan mengelola profile internal user dari collection `system_users`.
// Hubungan flow aplikasi:
// - AuthProvider memakai profile ini untuk memutuskan user boleh masuk aplikasi;
// - Route/Menu Guard membatasi halaman ini hanya untuk super_admin dan administrator.
// Status:
// - AKTIF untuk Fase E.
// - GUARDED: halaman ini tidak membuat Firebase Auth user/password karena perlu Admin SDK/Cloud Functions.
// Legacy / cleanup:
// - CLEANUP CANDIDATE: input manual Auth UID bisa diganti otomatis setelah Cloud Functions create-user aman dibuat.
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
  // SECTION: Load Users — AKTIF / GUARDED
  // Fungsi:
  // - mengambil daftar user sesuai hak role aktif.
  // Hubungan flow aplikasi:
  // - super_admin melihat semua user;
  // - administrator hanya melihat user biasa sesuai rule service.
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
    form.setFieldsValue({
      role: assignableRoleOptions[0]?.value || ROLES.USER,
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
  // SECTION: Save User Profile — AKTIF / GUARDED
  // Fungsi:
  // - menyimpan profile user tanpa menyimpan password;
  // - create profile membutuhkan Auth UID yang sudah dibuat manual di Firebase Authentication.
  // Hubungan flow aplikasi:
  // - profile yang dibuat akan dibaca AuthProvider saat user login.
  // Status:
  // - AKTIF.
  // - GUARDED: jangan mengubah ini menjadi validasi password Firestore/frontend.
  // =========================
  const handleSaveProfile = async (values) => {
    setIsSaving(true);

    try {
      if (formMode === FORM_MODE.CREATE) {
        await createSystemUserProfile(values, profile);
        message.success("Profile user berhasil dibuat.");
      } else if (selectedUser) {
        await updateSystemUserProfile(selectedUser.authUid, values, profile);
        message.success("Profile user berhasil diperbarui.");
      }

      closeModal();
      await loadUsers();
      await reloadProfile();
    } catch (error) {
      console.error("[UserManagement] Gagal menyimpan user.", error);
      message.error(error.message || "Gagal menyimpan profile user.");
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
              Kelola profile, role, dan status user internal IMS Bunga Flanel.
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
          type="warning"
          showIcon
          message="Fase E: profile user, bukan create Auth password"
          description="Untuk sementara, akun Firebase Auth masih dibuat manual dari Firebase Console. Halaman ini hanya membuat/mengelola profile system_users, role, dan status. Password tidak disimpan di Firestore."
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
            ? "Tambah Profile User"
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
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Auth UID wajib sesuai Firebase Authentication"
          description="Buat user Auth manual dulu di Firebase Console, lalu copy UID ke form ini. Jangan isi atau menyimpan password di Firestore."
        />

        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={handleSaveProfile}
        >
          <Form.Item
            label="Auth UID"
            name="authUid"
            rules={[{ required: true, message: "Auth UID wajib diisi." }]}
          >
            <Input disabled={formMode === FORM_MODE.EDIT} placeholder="UID dari Firebase Authentication" />
          </Form.Item>

          <Form.Item
            label="Username"
            name="username"
            rules={[{ required: true, message: "Username wajib diisi." }]}
            extra="Username harus sama dengan identifier login internal, contoh admin untuk admin@ims-bunga-flanel.local."
          >
            <Input disabled={formMode === FORM_MODE.EDIT} placeholder="contoh: admin" />
          </Form.Item>

          <Form.Item
            label="Nama Tampilan"
            name="displayName"
            rules={[{ required: true, message: "Nama tampilan wajib diisi." }]}
          >
            <Input placeholder="contoh: Super Admin" />
          </Form.Item>

          <Form.Item
            label="Role"
            name="role"
            rules={[{ required: true, message: "Role wajib dipilih." }]}
          >
            <Select options={assignableRoleOptions} />
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
