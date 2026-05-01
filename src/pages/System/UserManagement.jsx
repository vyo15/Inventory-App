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
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
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
  DELETE_PROFILE_GUARD_ERROR_CODE,
  DELETE_PROFILE_NOT_FOUND_ERROR_CODE,
  DELETE_PROFILE_PERMISSION_ERROR_CODE,
  createManualUserProfile,
  deleteSystemUserProfile,
  isUsernameAlreadyUsedError,
  listSystemUsers,
  updateSystemUserProfile,
  updateSystemUserStatus,
} from "../../services/System/userService";

const { Text, Title } = Typography;

// =========================
// SECTION: Form Mode Constants - AKTIF
// Fungsi:
// - membedakan modal tambah profile manual UID dan edit profile.
// Hubungan flow aplikasi:
// - mode create membuat profile `system_users/{authUid}` dari UID Auth yang ditempel manual;
// - mode edit hanya mengubah profile role/status/display name yang sudah ada.
// Status:
// - AKTIF untuk halaman Manajemen User final setelah cleanup legacy.
// =========================
const FORM_MODE = {
  CREATE: "create",
  EDIT: "edit",
};

const getRoleColor = (role) => {
  if (role === ROLES.ADMINISTRATOR) return "blue";
  return "green";
};

const getStatusColor = (status) => {
  return status === USER_STATUS.ACTIVE ? "green" : "default";
};

// =========================
// SECTION: Delete Guard UI Reason — AKTIF / GUARDED
// Fungsi:
// - menjelaskan kenapa tombol Hapus Profile disabled sebelum service dipanggil.
// Hubungan flow aplikasi:
// - service delete tetap menjadi guard utama; helper ini hanya feedback UI.
// Status:
// - AKTIF untuk tombol Hapus Profile.
// - GUARDED: self-delete dan administrator aktif terakhir tetap divalidasi ulang di service.
// =========================
const getDeleteGuardReason = ({ canManage, isLastActiveAdministrator, isSelfProfile }) => {
  if (isSelfProfile) {
    return "Profile yang sedang dipakai login tidak boleh dihapus.";
  }

  if (isLastActiveAdministrator) {
    return "Administrator aktif terakhir tidak boleh dihapus.";
  }

  if (!canManage) {
    return "Role aktif tidak boleh menghapus profile ini.";
  }

  return "";
};

const getUserManagementActionErrorMessage = (error = {}) => {
  const errorCode = error.code || error.errorCode;

  if (errorCode === DELETE_PROFILE_PERMISSION_ERROR_CODE) {
    return "Permission Firestore menolak aksi profile. Cek rules system_users.";
  }

  if (errorCode === DELETE_PROFILE_NOT_FOUND_ERROR_CODE) {
    return "Profile sudah tidak ada di Firestore. Refresh daftar user.";
  }

  if (errorCode === DELETE_PROFILE_GUARD_ERROR_CODE) {
    return error.message || "Guard aplikasi menolak aksi ini agar admin tidak terkunci.";
  }

  return error.message || "Aksi User Management gagal.";
};

// =========================
// SECTION: User Management Page - AKTIF / GUARDED
// Fungsi:
// - menampilkan dan mengelola profile internal user dari collection `system_users`;
// - membuat profile baru memakai Auth UID yang dibuat manual di Firebase Console.
// Hubungan flow aplikasi:
// - AuthProvider memakai profile ini untuk memutuskan user boleh masuk aplikasi;
// - Route/Menu Guard membatasi halaman ini untuk Administrator;
// - Firebase Auth user/password tetap dikelola manual di Firebase Console, bukan dari frontend.
// Status:
// - AKTIF untuk flow manual Auth UID final setelah migrasi @ziyocraft.com.
// - GUARDED: password tidak pernah disimpan atau dikirim dari halaman ini.
// Cleanup:
// - flow migrasi UID/domain lama dan indikator legacy/orphan sudah dihapus; pastikan data Firestore lama sudah bersih sebelum memakai patch ini.
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
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);
  const [statusChangeRequest, setStatusChangeRequest] = useState(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const actorRole = profile?.role;
  const actorUid = profile?.authUid || profile?.id || firebaseUser?.uid;

  const assignableRoleOptions = useMemo(() => {
    return getAssignableRolesForActor(actorRole).map((role) => ({
      label: ROLE_LABELS[role] || role,
      value: role,
    }));
  }, [actorRole]);

  // =========================
  // SECTION: Active Administrator Count - AKTIF / GUARDED
  // Fungsi:
  // - menghitung profile administrator aktif untuk guard tombol Hapus Profile.
  // Hubungan flow aplikasi:
  // - Manajemen User tidak boleh menghapus administrator aktif terakhir agar akses pemulihan tetap ada.
  // Status:
  // - AKTIF untuk UI guard; service tetap melakukan validasi ulang sebelum delete Firestore.
  // =========================
  const activeAdministratorCount = useMemo(() => {
    return users.filter(
      (userProfile) =>
        userProfile.role === ROLES.ADMINISTRATOR &&
        userProfile.status === USER_STATUS.ACTIVE,
    ).length;
  }, [users]);

  // =========================
  // SECTION: Load Users - AKTIF / GUARDED
  // Fungsi:
  // - mengambil daftar user sesuai hak role aktif.
  // Hubungan flow aplikasi:
  // - hanya Administrator yang boleh melihat/manajemen profile user.
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
  // - create: membuat profile `system_users/{authUid}` dari UID Auth yang sudah dibuat manual di Firebase Console;
  // - edit: mengubah profile yang sudah ada tanpa mengubah password/Auth user.
  // Hubungan flow aplikasi:
  // - admin wajib menyalin UID dari Firebase Authentication ke field Auth UID;
  // - profile yang dibuat akan dibaca AuthProvider saat user login.
  // Status:
  // - AKTIF.
  // - GUARDED: jangan menyimpan password, token, atau credential Auth ke Firestore/state.
  // =========================
  const handleSaveProfile = async (values) => {
    setIsSaving(true);

    try {
      if (formMode === FORM_MODE.CREATE) {
        await createManualUserProfile(values, profile);
        message.success("Profile system_users berhasil dibuat dari Auth UID manual.");
      } else if (selectedUser) {
        await updateSystemUserProfile(selectedUser.authUid, values, profile);
        message.success("Profile user berhasil diperbarui.");
      }

      closeModal();
      await loadUsers();
      await reloadProfile();
    } catch (error) {
      console.error("[UserManagement] Gagal menyimpan user.", error);

      if (formMode === FORM_MODE.CREATE && isUsernameAlreadyUsedError(error)) {
        message.error("Username sudah dipakai profile user lain. Gunakan username unik atau bersihkan profile lama secara manual sebelum membuat profile baru.");
        return;
      }

      message.error(getUserManagementActionErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  // =========================
  // SECTION: Row Action Guard Helpers - AKTIF / GUARDED
  // Fungsi:
  // - menghitung alasan aksi Edit/Nonaktifkan/Hapus Profile diblokir dari data terbaru tabel.
  // Hubungan flow aplikasi:
  // - UI memberi feedback cepat, tetapi service tetap memvalidasi ulang sebelum write/delete Firestore.
  // Status:
  // - AKTIF untuk Manajemen User final.
  // - GUARDED: self-profile dan administrator aktif terakhir tetap tidak boleh dihapus.
  // =========================
  const getDeleteGuardReasonForRecord = (userRecord = {}) => {
    const canManage = canManageUserProfile({
      actorRole,
      targetRole: userRecord.role,
      targetUid: userRecord.authUid,
      actorUid,
    });
    const isSelfProfile = Boolean(actorUid && userRecord.authUid === actorUid);
    const isLastActiveAdministrator =
      userRecord.role === ROLES.ADMINISTRATOR &&
      userRecord.status === USER_STATUS.ACTIVE &&
      activeAdministratorCount <= 1;

    return getDeleteGuardReason({
      canManage,
      isLastActiveAdministrator,
      isSelfProfile,
    });
  };

  // =========================
  // SECTION: Controlled Status Modal - AKTIF / GUARDED
  // Fungsi:
  // - memakai modal berbasis state agar kompatibel dengan theme AntD v5.
  // Hubungan flow aplikasi:
  // - toggle status tetap hanya mengubah profile Firestore; Firebase Authentication user tidak ikut berubah.
  // Status:
  // - AKTIF untuk aksi Aktifkan/Nonaktifkan.
  // =========================
  const handleOpenStatusModal = (userRecord) => {
    const canManage = canManageUserProfile({
      actorRole,
      targetRole: userRecord.role,
      targetUid: userRecord.authUid,
      actorUid,
    });

    if (!canManage) {
      message.warning("Role aktif tidak boleh mengubah status profile ini.");
      return;
    }

    setStatusChangeRequest({
      userRecord,
      nextStatus:
        userRecord.status === USER_STATUS.ACTIVE
          ? USER_STATUS.INACTIVE
          : USER_STATUS.ACTIVE,
    });
    setIsStatusModalOpen(true);
  };

  const handleCloseStatusModal = () => {
    if (isUpdatingStatus) return;

    setIsStatusModalOpen(false);
    setStatusChangeRequest(null);
  };

  const handleConfirmStatusChange = async () => {
    if (!statusChangeRequest?.userRecord) return;

    setIsUpdatingStatus(true);

    try {
      await updateSystemUserStatus(
        statusChangeRequest.userRecord,
        statusChangeRequest.nextStatus,
        profile,
      );
      message.success("Status user berhasil diperbarui.");
      setIsStatusModalOpen(false);
      setStatusChangeRequest(null);
      await loadUsers();
    } catch (error) {
      console.error("[UserManagement] Gagal mengubah status user.", error);
      message.error(getUserManagementActionErrorMessage(error));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // =========================
  // SECTION: Controlled Delete Profile Modal - AKTIF / GUARDED
  // Fungsi:
  // - membuka modal konfirmasi berbasis state sebelum delete Firestore system_users/{uid};
  // - memastikan tombol Hapus Profile memanggil handler dan reload data setelah sukses.
  // Hubungan flow aplikasi:
  // - tombol ini hanya membersihkan profile di IMS; Firebase Authentication user tidak ikut dihapus.
  // Status:
  // - AKTIF untuk delete profile target aman.
  // - GUARDED: service tetap menolak self-delete dan administrator aktif terakhir.
  // =========================
  const handleOpenDeleteModal = (userRecord) => {
    const deleteGuardReason = getDeleteGuardReasonForRecord(userRecord);

    if (deleteGuardReason) {
      message.warning(deleteGuardReason);
      return;
    }

    setDeleteTarget(userRecord);
    setIsDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    if (isDeletingProfile) return;

    setIsDeleteModalOpen(false);
    setDeleteTarget(null);
  };

  const handleConfirmDeleteProfile = async () => {
    if (!deleteTarget?.authUid) return;

    setIsDeletingProfile(true);

    try {
      await deleteSystemUserProfile(deleteTarget.authUid, profile);
      message.success("Profile Firestore berhasil dihapus. Firebase Auth user tidak ikut terhapus.");
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      await loadUsers();
    } catch (error) {
      console.error("[UserManagement] Gagal menghapus profile user.", error);
      message.error(getUserManagementActionErrorMessage(error));
    } finally {
      setIsDeletingProfile(false);
    }
  };

  const columns = [
    {
      title: "User",
      key: "user",
      width: 240,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{record.displayName}</Text>
          <Text type="secondary">@{record.username}</Text>
        </Space>
      ),
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      width: 180,
      render: (role) => <Tag color={getRoleColor(role)}>{ROLE_LABELS[role] || role}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (status) => (
        <Tag color={getStatusColor(status)}>{USER_STATUS_LABELS[status] || status}</Tag>
      ),
    },
    {
      title: "Auth UID",
      dataIndex: "authUid",
      key: "authUid",
      width: 260,
      ellipsis: true,
      render: (authUid) => <Text copyable>{authUid}</Text>,
    },
    {
      title: "Aksi",
      key: "actions",
      width: 390,
      fixed: "right",
      render: (_, record) => {
        const canManage = canManageUserProfile({
          actorRole,
          targetRole: record.role,
          targetUid: record.authUid,
          actorUid,
        });
        const isSelfProfile = Boolean(actorUid && record.authUid === actorUid);
        const isLastActiveAdministrator =
          record.role === ROLES.ADMINISTRATOR &&
          record.status === USER_STATUS.ACTIVE &&
          activeAdministratorCount <= 1;
        const deleteGuardReason = getDeleteGuardReason({
          canManage,
          isLastActiveAdministrator,
          isSelfProfile,
        });
        const canDelete = !deleteGuardReason;

        return (
          <Space wrap size={[8, 8]}>
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
              loading={
                isUpdatingStatus &&
                statusChangeRequest?.userRecord?.authUid === record.authUid
              }
              onClick={() => handleOpenStatusModal(record)}
            >
              {record.status === USER_STATUS.ACTIVE ? "Nonaktifkan" : "Aktifkan"}
            </Button>
            <Tooltip title={deleteGuardReason || "Hapus hanya profile Firestore, bukan Firebase Auth user."}>
              <span>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  disabled={!canDelete}
                  loading={isDeletingProfile && deleteTarget?.authUid === record.authUid}
                  onClick={() => handleOpenDeleteModal(record)}
                >
                  Hapus Profile
                </Button>
              </span>
            </Tooltip>
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
              Kelola Auth user, profile, role aktif Administrator/User, dan status user internal IMS ZiyoCraft.
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
          message="Flow aktif: Auth UID manual dari Firebase Console"
          description="Buat user dulu di Firebase Authentication dengan email username@ziyocraft.com, salin UID Auth, lalu tempel di form Tambah Profile User. Tabel ini membaca Firestore system_users, bukan daftar Firebase Authentication. Tombol Hapus Profile hanya menghapus profile Firestore, bukan Firebase Auth user."
        />

        <Card>
          <Table
            rowKey="authUid"
            columns={columns}
            dataSource={users}
            loading={isLoading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1210 }}
          />
        </Card>
      </Space>

      <Modal
        title={
          formMode === FORM_MODE.CREATE
            ? "Tambah Profile User Manual UID"
            : "Edit Profile User"
        }
        open={isModalOpen}
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={isSaving}
        okText="Simpan"
        cancelText="Batal"
        destroyOnHidden
      >
        <Alert
          type={formMode === FORM_MODE.CREATE ? "info" : "warning"}
          showIcon
          style={{ marginBottom: 16 }}
          message={
            formMode === FORM_MODE.CREATE
              ? "Tempel Auth UID dari Firebase Console"
              : "Edit profile tidak mengubah password Auth"
          }
          description={
            formMode === FORM_MODE.CREATE
              ? "Pastikan user Auth sudah dibuat manual di Firebase Console dengan email username@ziyocraft.com. Form ini hanya membuat dokumen system_users/{uid}."
              : "Perubahan hanya berlaku pada profile, role, dan status di Firestore. Password tetap dikelola oleh Firebase Authentication."
          }
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
            rules={[{ required: true, message: "Auth UID wajib diisi dari Firebase Authentication." }]}
            extra={
              formMode === FORM_MODE.CREATE
                ? "Copy UID dari Firebase Console > Authentication > Users setelah membuat Auth user manual."
                : "Auth UID dikunci agar profile tetap sesuai dokumen system_users/{uid}."
            }
          >
            <Input
              disabled={formMode === FORM_MODE.EDIT}
              placeholder="Tempel UID Firebase Auth"
            />
          </Form.Item>

          <Form.Item
            label="Username"
            name="username"
            rules={[{ required: true, message: "Username wajib diisi." }]}
            extra="Username akan dipakai sebagai login internal, contoh admin untuk admin@ziyocraft.com."
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
        </Form>
      </Modal>

      <Modal
        title={
          statusChangeRequest?.nextStatus === USER_STATUS.INACTIVE
            ? "Nonaktifkan user?"
            : "Aktifkan user?"
        }
        open={isStatusModalOpen}
        onCancel={handleCloseStatusModal}
        onOk={handleConfirmStatusChange}
        confirmLoading={isUpdatingStatus}
        okText={
          statusChangeRequest?.nextStatus === USER_STATUS.INACTIVE
            ? "Nonaktifkan"
            : "Aktifkan"
        }
        okButtonProps={{ danger: statusChangeRequest?.nextStatus === USER_STATUS.INACTIVE }}
        cancelText="Batal"
        destroyOnHidden
      >
        <Space direction="vertical" size={8}>
          <Text>
            Profile: <Text strong>{statusChangeRequest?.userRecord?.displayName || "User"}</Text>{" "}
            (<Text code>@{statusChangeRequest?.userRecord?.username || "-"}</Text>)
          </Text>
          <Text>
            {statusChangeRequest?.nextStatus === USER_STATUS.INACTIVE
              ? "User inactive tidak boleh masuk aplikasi utama. Firebase Authentication user tidak dihapus."
              : "User akan bisa masuk lagi jika Auth user dan password masih valid."}
          </Text>
        </Space>
      </Modal>

      <Modal
        title={`Hapus profile ${deleteTarget?.displayName || "user"}?`}
        open={isDeleteModalOpen}
        onCancel={handleCloseDeleteModal}
        onOk={handleConfirmDeleteProfile}
        confirmLoading={isDeletingProfile}
        okText="Hapus Profile"
        okButtonProps={{ danger: true }}
        cancelText="Batal"
        destroyOnHidden
      >
        <Space direction="vertical" size={8}>
          <Text>
            Target: <Text strong>{deleteTarget?.displayName || "User IMS"}</Text>{" "}
            (<Text code>@{deleteTarget?.username || "-"}</Text>)
          </Text>
          <Text>
            Aksi ini hanya menghapus dokumen profile Firestore{" "}
            <Text code>{`system_users/${deleteTarget?.authUid || "uid-target"}`}</Text>.
          </Text>
          <Text>Firebase Authentication user tidak ikut terhapus dari Firebase Console.</Text>
          <Text type="warning">
            Jika Auth user masih ada, user tersebut tidak bisa login ke IMS sampai profile Firestore dibuat lagi.
          </Text>
        </Space>
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
