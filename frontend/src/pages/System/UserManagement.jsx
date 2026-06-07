import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  EditOutlined,
  PlusOutlined,
  StopOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  LockOutlined,
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
import PageFormModal from "../../components/Layout/Forms/PageFormModal";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import DataTableView from "../../components/Layout/Table/DataTableView";
import { DataRefreshIndicator, getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import { validateLocalPasswordPolicy } from "../../services/System/localAuthService";

const { Text } = Typography;

const normalizeUsernameValue = (value = "") => String(value || "").trim().toLowerCase();

const validateUsernamePattern = (_, value) => {
  const username = normalizeUsernameValue(value);
  if (!username) return Promise.resolve();
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return Promise.reject(new Error("Gunakan huruf, angka, titik, underscore, atau strip."));
  }
  return Promise.resolve();
};

const validateLocalPasswordField = (_, value) => {
  const errorMessage = validateLocalPasswordPolicy(value);
  if (errorMessage) return Promise.reject(new Error(errorMessage));
  return Promise.resolve();
};

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
    return "Permission menolak aksi user. Cek akses administrator lokal.";
  }

  if (errorCode === DELETE_PROFILE_NOT_FOUND_ERROR_CODE) {
    return "User lokal sudah tidak ditemukan. Refresh daftar user.";
  }

  if (errorCode === DELETE_PROFILE_GUARD_ERROR_CODE) {
    return error.message || "Aksi ditolak agar admin tidak terkunci.";
  }

  return error.message || "Aksi User Management gagal.";
};

// =========================
// SECTION: User Management Page - AKTIF / GUARDED
// Fungsi:
// - menampilkan dan mengelola akun IMS lokal SQLite.
// Hubungan flow aplikasi:
// - AuthProvider memakai profile lokal ini untuk memutuskan user boleh masuk aplikasi;
// - Route/Menu Guard membatasi halaman ini untuk Administrator;
// - SQLite lokal menyimpan password lewat backend Node/SQLite, bukan di frontend.
// Status:
// - AKTIF untuk SQLite local user management.
// - GUARDED: password lokal hanya dikirim ke backend auth SQLite dan tidak disimpan di UI.
// Cleanup:
// - flow migrasi UID/domain lama dan indikator legacy/orphan sudah dihapus dari runtime aktif.
// =========================
const UserManagement = () => {
  const { profile, reloadProfile } = useAuth();
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
  const actorUid = profile?.authUid || profile?.id;

  const assignableRoleOptions = useMemo(() => {
    return getAssignableRolesForActor(actorRole).map((role) => ({
      label: ROLE_LABELS[role] || role,
      value: role,
    }));
  }, [actorRole]);

  const usernameAlreadyExists = (value) => {
    const username = normalizeUsernameValue(value);
    if (!username) return false;

    return users.some((userRecord) => {
      const currentUsername = normalizeUsernameValue(userRecord.usernameLower || userRecord.username);
      const currentAuthUid = userRecord.authUid || userRecord.id;
      const selectedAuthUid = selectedUser?.authUid || selectedUser?.id;

      return currentUsername === username && currentAuthUid !== selectedAuthUid;
    });
  };

  const validateUniqueUsername = (_, value) => {
    if (formMode !== FORM_MODE.CREATE) return Promise.resolve();
    if (!usernameAlreadyExists(value)) return Promise.resolve();
    return Promise.reject(new Error("Username sudah terdaftar."));
  };

  // =========================
  // SECTION: Active Administrator Count - AKTIF / GUARDED
  // Fungsi:
  // - menghitung profile administrator aktif untuk guard tombol Hapus Profile.
  // Hubungan flow aplikasi:
  // - Manajemen User tidak boleh menghapus administrator aktif terakhir agar akses pemulihan tetap ada.
  // Status:
  // - AKTIF untuk UI guard; service/backend tetap melakukan validasi ulang sebelum delete user SQLite.
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
      password: undefined,
      confirmPassword: undefined,
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
  // - create: mode SQLite membuat akun lokal;
  // - edit: mengubah profile, role, status, dan opsional password baru untuk akun lokal SQLite.
  // Hubungan flow aplikasi:
  // - AuthProvider membaca user dari backend SQLite localAuth;
  // - Auth UID hanya ditampilkan sebagai compatibility internal, bukan input user.
  // Status:
  // - AKTIF.
  // - GUARDED: password lokal hanya dikirim ke backend SQLite dan tidak disimpan di state.
  // =========================
  const handleSaveProfile = async (values) => {
    setIsSaving(true);

    try {
      if (formMode === FORM_MODE.CREATE) {
        await createManualUserProfile(values, profile);
        message.success("Akun lokal berhasil dibuat.");
      } else if (selectedUser) {
        await updateSystemUserProfile(selectedUser, values, profile);
        message.success("Akun lokal berhasil diperbarui.");
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
  // - UI memberi feedback cepat, tetapi service dan backend tetap memvalidasi ulang sebelum write/delete user SQLite.
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
  // - toggle status mengubah akun lokal SQLite dan backend otomatis mencabut session user nonaktif.
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
  // - membuka modal konfirmasi berbasis state sebelum delete user lokal SQLite;
  // - memastikan tombol Hapus Profile memanggil handler dan reload data setelah sukses.
  // Hubungan flow aplikasi:
  // - tombol ini menghapus user lokal lewat backend guarded; session user target ikut dicabut.
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
    if (!deleteTarget?.authUid && !deleteTarget?.id) return;

    setIsDeletingProfile(true);

    try {
      await deleteSystemUserProfile(deleteTarget, profile);
      message.success("Akun lokal berhasil dihapus.");
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

  // =====================================================
  // SECTION: Compact User Management Table Columns — AKTIF / GUARDED
  // Fungsi:
  // - memadatkan tabel utama menjadi User / UID, Role / Status, dan Aksi tanpa horizontal scroll besar.
  //
  // Dipakai oleh:
  // - Halaman Manajemen User pada section Daftar Profile User.
  //
  // Alasan perubahan:
  // - tabel lama memakai scroll x besar dan fixed right sehingga kurang nyaman di layout utama.
  //
  // Catatan cleanup:
  // - belum ada.
  //
  // Risiko:
  // - jangan mengubah guard RBAC, modal konfirmasi, atau handler aksi saat merapikan render kolom.
  // =====================================================
  const columns = [
    {
      title: "User",
      key: "userIdentity",
      render: (_, record) => (
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Space direction="vertical" size={0} style={{ width: "100%" }}>
            <Text strong ellipsis={{ tooltip: record.displayName }} style={{ maxWidth: "100%" }}>
              {record.displayName}
            </Text>
            <Text type="secondary" ellipsis={{ tooltip: `@${record.username || "-"}` }} style={{ maxWidth: "100%" }}>
              @{record.username || "-"}
            </Text>
          </Space>
        </Space>
      ),
    },
    {
      title: "Role / Status",
      key: "roleStatus",
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={6}>
          <Tag color={getRoleColor(record.role)}>{ROLE_LABELS[record.role] || record.role}</Tag>
          <Tag color={getStatusColor(record.status)}>
            {USER_STATUS_LABELS[record.status] || record.status}
          </Tag>
        </Space>
      ),
    },
    {
      title: "Aksi",
      key: "actions",
      width: 210,
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
          <Space direction="vertical" size={6} className="ims-action-group ims-action-group--vertical">
            <Button
              className="ims-action-button"
              icon={<EditOutlined />}
              disabled={!canManage}
              onClick={() => openEditModal(record)}
            >
              Edit
            </Button>
            <Button
              className="ims-action-button"
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
            <Tooltip title={deleteGuardReason || "Hapus user."}>
              <span style={{ display: "block", width: "100%" }}>
                <Button
                  className="ims-action-button"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={!canDelete}
                  loading={isDeletingProfile && deleteTarget?.authUid === record.authUid}
                  onClick={() => handleOpenDeleteModal(record)}
                >
                  Hapus Akun
                </Button>
              </span>
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  const summaryItems = [
    {
      key: "total-users",
      title: "Total Akun",
      value: users.length,
      subtitle: "Akun terdaftar.",
      accent: "primary",
    },
    {
      key: "active-users",
      title: "User Aktif",
      value: users.filter((item) => item.status === USER_STATUS.ACTIVE).length,
      subtitle: "Bisa login.",
      accent: "success",
    },
    {
      key: "active-admins",
      title: "Administrator Aktif",
      value: activeAdministratorCount,
      subtitle: "Guard akses.",
      accent: "warning",
    },
    {
      key: "role-users",
      title: "Role User",
      value: users.filter((item) => item.role === ROLES.USER).length,
      subtitle: "Operasional.",
      accent: "default",
    },
  ];

  const userMobileCardConfig = {
    title: (record) => record.displayName || '-',
    subtitle: (record) => [`@${record.username || '-'}`],
    tags: (record) => [
      <Tag key="role" color={getRoleColor(record.role)}>{ROLE_LABELS[record.role] || record.role}</Tag>,
      <Tag key="status" color={getStatusColor(record.status)}>
        {USER_STATUS_LABELS[record.status] || record.status}
      </Tag>,
    ],
    meta: [
      { label: 'Role', value: (record) => ROLE_LABELS[record.role] || record.role || '-' },
      { label: 'Status', value: (record) => USER_STATUS_LABELS[record.status] || record.status || '-' },
    ],
    actions: (record) => {
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
        <Space direction="vertical" size={6} className="ims-action-group ims-action-group--vertical">
          <Button
            className="ims-action-button"
            icon={<EditOutlined />}
            disabled={!canManage}
            onClick={() => openEditModal(record)}
          >
            Edit
          </Button>
          <Button
            className="ims-action-button"
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
            {record.status === USER_STATUS.ACTIVE ? 'Nonaktifkan' : 'Aktifkan'}
          </Button>
          <Tooltip title={deleteGuardReason || 'Hapus user.'}>
            <span style={{ display: 'block', width: '100%' }}>
              <Button
                className="ims-action-button"
                danger
                icon={<DeleteOutlined />}
                disabled={!canDelete}
                loading={isDeletingProfile && deleteTarget?.authUid === record.authUid}
                onClick={() => handleOpenDeleteModal(record)}
              >
                Hapus Akun
              </Button>
            </span>
          </Tooltip>
        </Space>
      );
    },
  };

  /* =====================================================
  SECTION: User Management Renderer — GUARDED
  Fungsi:
  - Menampilkan summary, tabel profile, form tambah/edit, dan modal konfirmasi status/hapus profile.

  Dipakai oleh:
  - Administrator untuk mengelola akun lokal SQLite.

  Alasan perubahan:
  - Copy dibuat ringkas: tidak menonjolkan UID teknis dan fokus ke akun lokal.

  Catatan cleanup:
  - Detail user khusus bisa dibuat nanti bila audit login/createdAt sudah stabil di data.

  Risiko:
  - Jangan mengubah role mapping, status mapping, auth provider binding, atau guard administrator aktif terakhir.
  ===================================================== */
  return (
    <div className="page-container">
      <PageHeader
        title="Manajemen User"
        subtitle="Kelola akun lokal IMS."
        actions={[
          {
            key: "create-user-profile",
            type: "primary",
            icon: <PlusOutlined />,
            label: "Tambah Akun Lokal",
            onClick: openCreateModal,
          },
        ]}
      />

      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <SummaryStatGrid items={summaryItems} />

        <PageSection
          title="Daftar Akun Lokal"
          subtitle="Role, status, dan akses login."
        >
          <DataRefreshIndicator loading={isLoading} dataSource={users} />
          <DataTableView
            showRefreshIndicator={false}
            className="app-data-table"
            rowKey="authUid"
            columns={columns}
            dataSource={users}
            pagination={{ pageSize: 10 }}
            tableLayout="fixed"
            locale={{ emptyText: getDataTableEmptyText(isLoading) }}
            mobileCardConfig={userMobileCardConfig}
          />
        </PageSection>
      </Space>

      <PageFormModal
        title={
          formMode === FORM_MODE.CREATE
            ? "Tambah Akun Lokal"
            : "Edit Akun Lokal"
        }
        open={isModalOpen}
        onCancel={closeModal}
        okText="Simpan"
        cancelText="Batal"
        form={form}
        onFinish={handleSaveProfile}
        confirmLoading={isSaving}
        modalProps={{ destroyOnHidden: true }}
        formProps={{ requiredMark: false }}
      >
        <Form.Item
          label="Username"
          name="username"
          normalize={(value) => normalizeUsernameValue(value)}
          rules={[
            { required: true, message: "Username wajib diisi." },
            { validator: validateUsernamePattern },
            { validator: validateUniqueUsername },
          ]}
        >
          <Input disabled={formMode === FORM_MODE.EDIT} placeholder="contoh: user-gudang" />
        </Form.Item>

        <Form.Item
          label="Nama Tampilan"
          name="displayName"
          rules={[{ required: true, message: "Nama tampilan wajib diisi." }]}
        >
          <Input placeholder="contoh: Admin Toko" />
        </Form.Item>

        <Form.Item
              label={formMode === FORM_MODE.CREATE ? "Password" : "Password Baru"}
              name="password"
              rules={
                formMode === FORM_MODE.CREATE
                  ? [
                      { required: true, message: "Password akun lokal wajib diisi." },
                      { validator: validateLocalPasswordField },
                    ]
                  : [{ validator: (_, value) => (value ? validateLocalPasswordField(_, value) : Promise.resolve()) }]
              }
            >
              <Input.Password
                autoComplete="new-password"
                prefix={<LockOutlined />}
                placeholder={formMode === FORM_MODE.CREATE ? "Minimal 8 karakter, huruf dan angka" : "Isi jika ingin ganti password"}
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
                    if (!password && formMode === FORM_MODE.EDIT) return Promise.resolve();
                    if (!value && formMode === FORM_MODE.CREATE) {
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
      </PageFormModal>

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
              ? "User tidak bisa login sampai diaktifkan lagi."
              : "User bisa login kembali."}
          </Text>
        </Space>
      </Modal>

      <Modal
        title={`Hapus akun ${deleteTarget?.displayName || "user"}?`}
        open={isDeleteModalOpen}
        onCancel={handleCloseDeleteModal}
        onOk={handleConfirmDeleteProfile}
        confirmLoading={isDeletingProfile}
        okText="Hapus Akun"
        okButtonProps={{ danger: true }}
        cancelText="Batal"
        destroyOnHidden
      >
        <Space direction="vertical" size={8}>
          <Text>
            Target: <Text strong>{deleteTarget?.displayName || "User IMS"}</Text>{" "}
            (<Text code>@{deleteTarget?.username || "-"}</Text>)
          </Text>
          <Text type="warning">
            Akun dan session lokal target akan dihapus.
          </Text>
        </Space>
      </Modal>
    </div>
  );
};

export default UserManagement;
