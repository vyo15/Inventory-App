import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  App as AntdApp,
  Avatar,
  Badge,
  Button,
  Dropdown,
  Form,
  Input,
  Pagination,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from "antd";
import {
  CheckCircleOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
  StopOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import EmptyStateBlock from "../../components/Layout/Feedback/EmptyStateBlock";
import useAuth from "../../hooks/useAuth";
import {
  ROLE_LABELS,
  ROLES,
  USER_STATUS,
  USER_STATUS_LABELS,
  getAssignableRolesForActor,
  canEditUserProfile,
  canManageUserProfile,
} from "../../utils/auth/roleAccess";
import {
  DELETE_PROFILE_GUARD_ERROR_CODE,
  DELETE_PROFILE_NOT_FOUND_ERROR_CODE,
  DELETE_PROFILE_PERMISSION_ERROR_CODE,
  createManualUserProfile,
  isUsernameAlreadyUsedError,
  listSystemUsers,
  updateSystemUserProfile,
  updateSystemUserStatus,
} from "../../services/System/userService";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageContentCanvas from "../../components/Layout/Page/PageContentCanvas";
import PageSection from "../../components/Layout/Page/PageSection";
import { DataRefreshIndicator } from "../../components/Layout/Feedback/DataLoadingState";
import { getLocalPasswordPolicyHint, validateLocalPasswordPolicy } from "../../services/System/localAuthService";
import UserProfileFormModal from "./components/UserProfileFormModal";
import UserStatusChangeModal from "./components/UserStatusChangeModal";
import "./UserManagement.css";

const { Text } = Typography;
const PASSWORD_POLICY_HINT = getLocalPasswordPolicyHint();
const PAGE_SIZE = 9;
const MAX_AVATAR_INPUT_BYTES = 2 * 1024 * 1024;
const MAX_AVATAR_OUTPUT_BYTES = 180 * 1024;
const AVATAR_SIZE = 256;
const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

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

const FORM_MODE = {
  CREATE: "create",
  EDIT: "edit",
};

const getUserManagementActionErrorMessage = (error = {}) => {
  const errorCode = error.code || error.errorCode;

  if (errorCode === DELETE_PROFILE_PERMISSION_ERROR_CODE) {
    return "Akses administrator tidak mengizinkan aksi ini.";
  }

  if (errorCode === DELETE_PROFILE_NOT_FOUND_ERROR_CODE) {
    return "Akun sudah tidak ditemukan. Refresh daftar user.";
  }

  if (errorCode === DELETE_PROFILE_GUARD_ERROR_CODE) {
    return error.message || "Aksi ditolak agar admin tidak terkunci.";
  }

  return error.message || "Aksi User Management gagal.";
};

const getInitials = (displayName = "", username = "") => {
  const source = String(displayName || username || "User IMS").trim();
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase() || "UI";
};

const upsertUserRecord = (records = [], nextUser = null) => {
  if (!nextUser) return records;
  const nextKey = nextUser.authUid || nextUser.id;
  const existingIndex = records.findIndex((record) => (
    (record.authUid || record.id) === nextKey
  ));
  const nextRecords = existingIndex >= 0
    ? records.map((record, index) => (index === existingIndex ? nextUser : record))
    : [...records, nextUser];

  return nextRecords.sort((left, right) => {
    const roleOrder = String(left.role || "").localeCompare(String(right.role || ""));
    if (roleOrder !== 0) return roleOrder;
    return String(left.username || "").localeCompare(String(right.username || ""));
  });
};

const formatUserDate = (value, fallback = "Belum ada") => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatLastLogin = (value) => {
  if (!value) return "Belum pernah login";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Belum pernah login";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getDataUrlByteSize = (dataUrl = "") => {
  const base64 = String(dataUrl).split(",")[1] || "";
  const padding = (base64.match(/=+$/)?.[0] || "").length;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
};

const loadImageFile = (file) => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error("Foto tidak dapat dibaca. Pilih file gambar lain."));
  };
  image.src = objectUrl;
});

const createProfileAvatarDataUrl = async (file) => {
  if (!AVATAR_MIME_TYPES.includes(file?.type)) {
    throw new Error("Format foto tidak didukung. Gunakan JPG, PNG, atau WebP.");
  }
  if (!file.size || file.size > MAX_AVATAR_INPUT_BYTES) {
    throw new Error("Ukuran foto maksimal 2 MB.");
  }

  const image = await loadImageFile(file);
  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  if (!sourceSize) throw new Error("Dimensi foto tidak valid.");

  const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2);
  const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Browser tidak dapat memproses foto.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  );

  for (const quality of [0.82, 0.72, 0.62, 0.52]) {
    const dataUrl = canvas.toDataURL("image/webp", quality);
    if (getDataUrlByteSize(dataUrl) <= MAX_AVATAR_OUTPUT_BYTES) return dataUrl;
  }

  throw new Error("Foto masih terlalu besar setelah diproses. Pilih foto lain.");
};

const UserManagement = () => {
  const { message } = AntdApp.useApp();
  const { profile, reloadProfile } = useAuth();
  const [form] = Form.useForm();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formMode, setFormMode] = useState(FORM_MODE.CREATE);
  const [selectedUser, setSelectedUser] = useState(null);
  const [statusChangeRequest, setStatusChangeRequest] = useState(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [avatarDraft, setAvatarDraft] = useState(null);
  const [avatarDirty, setAvatarDirty] = useState(false);
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false);

  const actorRole = profile?.role;
  const actorUid = profile?.authUid || profile?.id;
  const selectedUserUid = selectedUser?.authUid || selectedUser?.id;
  const isEditingSelf = formMode === FORM_MODE.EDIT
    && Boolean(actorUid && selectedUserUid && actorUid === selectedUserUid);

  const assignableRoleOptions = useMemo(() => {
    return getAssignableRolesForActor(actorRole).map((role) => ({
      label: ROLE_LABELS[role] || role,
      value: role,
    }));
  }, [actorRole]);

  const activeAdministratorCount = useMemo(() => {
    return users.filter(
      (userProfile) => userProfile.role === ROLES.ADMINISTRATOR
        && userProfile.status === USER_STATUS.ACTIVE,
    ).length;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    return users.filter((record) => {
      const matchesSearch = !normalizedSearch
        || `${record.displayName || ""} ${record.username || ""}`.toLowerCase().includes(normalizedSearch);
      const matchesRole = roleFilter === "all" || record.role === roleFilter;
      const matchesStatus = statusFilter === "all" || record.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, searchValue, statusFilter, users]);

  const pagedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredUsers.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, filteredUsers]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
    if (currentPage > maxPage) setCurrentPage(maxPage);
  }, [currentPage, filteredUsers.length]);

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
    if (profile?.role) loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.role]);

  const resetAvatarDraft = (value = null) => {
    setAvatarDraft(value || null);
    setAvatarDirty(false);
    setIsProcessingAvatar(false);
  };

  const openCreateModal = () => {
    setFormMode(FORM_MODE.CREATE);
    setSelectedUser(null);
    form.resetFields();
    resetAvatarDraft(null);
    const defaultCreateRole = assignableRoleOptions.some((option) => option.value === ROLES.USER)
      ? ROLES.USER
      : assignableRoleOptions[0]?.value;

    form.setFieldsValue({
      role: defaultCreateRole || ROLES.USER,
      status: USER_STATUS.ACTIVE,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (userRecord) => {
    setFormMode(FORM_MODE.EDIT);
    setSelectedUser(userRecord);
    form.resetFields();
    resetAvatarDraft(userRecord.avatarDataUrl);
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
    resetAvatarDraft(null);
  };

  const handleAvatarUpload = async (file) => {
    setIsProcessingAvatar(true);
    try {
      const avatarDataUrl = await createProfileAvatarDataUrl(file);
      setAvatarDraft(avatarDataUrl);
      setAvatarDirty(true);
      message.success("Foto profil siap disimpan.");
    } catch (error) {
      message.error(error.message || "Foto profil gagal diproses.");
    } finally {
      setIsProcessingAvatar(false);
    }
    return Upload.LIST_IGNORE;
  };

  const handleRemoveAvatar = () => {
    setAvatarDraft(null);
    setAvatarDirty(true);
  };

  const handleSaveProfile = async (values) => {
    setIsSaving(true);
    try {
      const payload = { ...values };
      if (formMode === FORM_MODE.EDIT && isEditingSelf) {
        delete payload.username;
        delete payload.role;
        delete payload.status;
      }
      if (formMode === FORM_MODE.CREATE && avatarDraft) {
        payload.avatarDataUrl = avatarDraft;
      }
      if (formMode === FORM_MODE.EDIT && avatarDirty) {
        payload.avatarDataUrl = avatarDraft;
      }

      let savedUser = null;
      if (formMode === FORM_MODE.CREATE) {
        savedUser = await createManualUserProfile(payload, profile);
        message.success("Akun lokal berhasil dibuat.");
      } else if (selectedUser) {
        savedUser = await updateSystemUserProfile(selectedUser, payload, profile);
        message.success("Akun lokal berhasil diperbarui.");
      }

      if (savedUser) setUsers((currentUsers) => upsertUserRecord(currentUsers, savedUser));
      closeModal();
      if (formMode === FORM_MODE.EDIT && isEditingSelf) void reloadProfile();
      void loadUsers();
    } catch (error) {
      console.error("[UserManagement] Gagal menyimpan user.", error);
      if (formMode === FORM_MODE.CREATE && isUsernameAlreadyUsedError(error)) {
        message.error(
          "Username sudah dipakai profile user lain. "
            + "Gunakan username unik atau bersihkan profile lama secara manual sebelum membuat profile baru.",
        );
        return;
      }
      message.error(getUserManagementActionErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const getActionState = (record) => {
    const canEdit = canEditUserProfile({
      actorRole,
      targetRole: record.role,
    });
    const canManage = canManageUserProfile({
      actorRole,
      targetRole: record.role,
      targetUid: record.authUid,
      actorUid,
    });
    const isSelfProfile = Boolean(actorUid && record.authUid === actorUid);
    const isLastActiveAdministrator = record.role === ROLES.ADMINISTRATOR
      && record.status === USER_STATUS.ACTIVE
      && activeAdministratorCount <= 1;
    const statusGuardReason = record.status === USER_STATUS.ACTIVE && isSelfProfile
      ? "Akun yang sedang dipakai tidak boleh dinonaktifkan."
      : record.status === USER_STATUS.ACTIVE && isLastActiveAdministrator
        ? "Administrator aktif terakhir tidak boleh dinonaktifkan."
        : !canManage
          ? "Role aktif tidak boleh mengubah status akun ini."
          : "";

    return { canEdit, canManage, isSelfProfile, statusGuardReason };
  };

  const handleOpenStatusModal = (userRecord) => {
    const { canManage, statusGuardReason } = getActionState(userRecord);
    if (!canManage || statusGuardReason) {
      message.warning(statusGuardReason || "Role aktif tidak boleh mengubah status profile ini.");
      return;
    }

    setStatusChangeRequest({
      userRecord,
      nextStatus: userRecord.status === USER_STATUS.ACTIVE
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
      const updatedUser = await updateSystemUserStatus(
        statusChangeRequest.userRecord,
        statusChangeRequest.nextStatus,
        profile,
      );
      setUsers((currentUsers) => upsertUserRecord(currentUsers, updatedUser));
      message.success("Status user berhasil diperbarui.");
      setIsStatusModalOpen(false);
      setStatusChangeRequest(null);
      void loadUsers();
    } catch (error) {
      console.error("[UserManagement] Gagal mengubah status user.", error);
      message.error(getUserManagementActionErrorMessage(error));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const renderUserCard = (record) => {
    const { canEdit, isSelfProfile, statusGuardReason } = getActionState(record);
    const isActive = record.status === USER_STATUS.ACTIVE;
    const menuItems = [
      {
        key: "edit",
        icon: <EditOutlined />,
        label: isSelfProfile ? "Edit profil saya" : "Edit akun",
        disabled: !canEdit,
      },
      { type: "divider" },
      {
        key: "status",
        icon: isActive ? <StopOutlined /> : <CheckCircleOutlined />,
        label: isActive ? "Nonaktifkan akun" : "Aktifkan akun",
        danger: isActive,
        disabled: Boolean(statusGuardReason),
        title: statusGuardReason || undefined,
      },
    ];

    return (
      <article
        className={`ims-user-card${isSelfProfile ? " ims-user-card--self" : ""}`}
        key={record.authUid || record.id}
      >
        <div className="ims-user-card-head">
          <div className="ims-user-identity">
            <Badge
              dot
              color={isActive ? "var(--ims-color-primary)" : "var(--ims-text-muted)"}
              offset={[-4, 47]}
            >
              <Avatar
                className="ims-user-avatar"
                size={56}
                src={record.avatarDataUrl || undefined}
                alt={`Foto ${record.displayName || record.username || "user"}`}
              >
                {getInitials(record.displayName, record.username)}
              </Avatar>
            </Badge>
            <div className="ims-user-identity-copy">
              <h3 title={record.displayName || "User IMS"}>{record.displayName || "User IMS"}</h3>
              <p title={`@${record.username || "-"}`}>@{record.username || "-"}</p>
            </div>
          </div>

          <Dropdown
            trigger={["click"]}
            menu={{
              items: menuItems,
              onClick: ({ key }) => {
                if (key === "edit") openEditModal(record);
                if (key === "status") handleOpenStatusModal(record);
              },
            }}
          >
            <Button
              className="ims-user-more-button"
              type="text"
              icon={<MoreOutlined />}
              aria-label={`Aksi akun ${record.displayName || record.username || "user"}`}
            />
          </Dropdown>
        </div>

        <div className="ims-user-badges">
          <Tag
            className={`ims-user-role-tag ims-user-role-tag--${record.role === ROLES.ADMINISTRATOR ? "administrator" : "user"}`}
          >
            {ROLE_LABELS[record.role] || record.role}
          </Tag>
          <Tag
            className={`ims-user-status-tag ims-user-status-tag--${isActive ? "active" : "inactive"}`}
          >
            {USER_STATUS_LABELS[record.status] || record.status}
          </Tag>
          {isSelfProfile ? <Tag className="ims-user-self-tag">Akun Anda</Tag> : null}
        </div>

        <div className="ims-user-meta-grid">
          <div className="ims-user-meta">
            <span>Role</span>
            <strong>{ROLE_LABELS[record.role] || record.role || "-"}</strong>
          </div>
          <div className="ims-user-meta">
            <span>Dibuat</span>
            <strong>{formatUserDate(record.createdAt, "-" )}</strong>
          </div>
        </div>

        <div className="ims-user-card-footer">
          <div className="ims-user-last-login">
            <span>Login terakhir</span>
            <strong>{formatLastLogin(record.lastLoginAt)}</strong>
          </div>
          <Tooltip title={canEdit ? (isSelfProfile ? "Edit profil saya" : "Edit akun lokal") : "Role aktif tidak boleh mengubah akun ini."}>
            <span>
              <Button
                className="ims-user-edit-button"
                icon={<EditOutlined />}
                disabled={!canEdit}
                onClick={() => openEditModal(record)}
              >
                Edit
              </Button>
            </span>
          </Tooltip>
        </div>
      </article>
    );
  };

  const displayNameValue = Form.useWatch("displayName", form);
  const usernameValue = Form.useWatch("username", form);
  const modalInitials = getInitials(displayNameValue, usernameValue);

  return (
    <div className="page-container ims-user-management">
      <PageHeader
        title="Manajemen User"
        subtitle="Kelola akun lokal, role, status, dan foto profil pengguna IMS."
        actions={[
          {
            key: "create-user-profile",
            type: "primary",
            icon: <PlusOutlined />,
            label: "Tambah Akun",
            onClick: openCreateModal,
          },
        ]}
      />

      <PageContentCanvas>

      <section className="ims-user-overview" aria-label="Ringkasan akun">
        <div className="ims-user-count-card">
          <div className="ims-user-count-icon"><TeamOutlined /></div>
          <div>
            <div className="ims-user-count-value">{users.length}</div>
            <div className="ims-user-count-label">Akun terdaftar</div>
          </div>
        </div>
        <div className="ims-user-stat-strip">
          <div className="ims-user-stat ims-user-stat--active">
            <strong className="ims-user-stat-value">
              {users.filter((item) => item.status === USER_STATUS.ACTIVE).length}
            </strong>
            <span className="ims-user-stat-label">User aktif</span>
          </div>
          <div className="ims-user-stat ims-user-stat--admin">
            <strong className="ims-user-stat-value">{activeAdministratorCount}</strong>
            <span className="ims-user-stat-label">Administrator</span>
          </div>
          <div className="ims-user-stat">
            <strong className="ims-user-stat-value">
              {users.filter((item) => item.role === ROLES.USER).length}
            </strong>
            <span className="ims-user-stat-label">Role User</span>
          </div>
        </div>
      </section>

      <PageSection title="Daftar Akun" subtitle="Cari akun, periksa akses, dan kelola status login.">
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <div className="ims-user-toolbar">
            <Input
              className="ims-user-toolbar-search"
              prefix={<SearchOutlined />}
              value={searchValue}
              onChange={(event) => {
                setSearchValue(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari nama atau username..."
              allowClear
            />
            <Select
              value={roleFilter}
              onChange={(value) => {
                setRoleFilter(value);
                setCurrentPage(1);
              }}
              options={[
                { label: "Semua role", value: "all" },
                { label: ROLE_LABELS[ROLES.ADMINISTRATOR], value: ROLES.ADMINISTRATOR },
                { label: ROLE_LABELS[ROLES.USER], value: ROLES.USER },
              ]}
            />
            <Select
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
              options={[
                { label: "Semua status", value: "all" },
                { label: USER_STATUS_LABELS[USER_STATUS.ACTIVE], value: USER_STATUS.ACTIVE },
                { label: USER_STATUS_LABELS[USER_STATUS.INACTIVE], value: USER_STATUS.INACTIVE },
              ]}
            />
            <div className="ims-user-result-count">
              <strong>{filteredUsers.length}</strong> akun ditampilkan
            </div>
          </div>

          <DataRefreshIndicator loading={isLoading} dataSource={users} />

          {filteredUsers.length > 0 ? (
            <>
              <div className="ims-user-grid">{pagedUsers.map(renderUserCard)}</div>
              {filteredUsers.length > PAGE_SIZE ? (
                <div className="ims-user-pagination">
                  <Pagination
                    current={currentPage}
                    pageSize={PAGE_SIZE}
                    total={filteredUsers.length}
                    showSizeChanger={false}
                    onChange={setCurrentPage}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <div className="ims-user-empty">
              <EmptyStateBlock compact description={isLoading ? "Memuat akun..." : "Tidak ada akun yang cocok."} />
            </div>
          )}
        </Space>
      </PageSection>

      </PageContentCanvas>

      <UserProfileFormModal
        formState={{
          open: isModalOpen,
          form,
          isCreate: formMode === FORM_MODE.CREATE,
          isEditingSelf,
          isSaving,
        }}
        avatarState={{
          isProcessingAvatar,
          avatarDraft,
          modalInitials,
          avatarMimeTypes: AVATAR_MIME_TYPES,
        }}
        optionData={{
          assignableRoleOptions,
          passwordPolicyHint: PASSWORD_POLICY_HINT,
        }}
        validators={{
          normalizeUsername: normalizeUsernameValue,
          validateUsernamePattern,
          validateUniqueUsername,
          validatePassword: validateLocalPasswordField,
        }}
        actions={{
          onCancel: closeModal,
          onFinish: handleSaveProfile,
          onAvatarUpload: handleAvatarUpload,
          onRemoveAvatar: handleRemoveAvatar,
        }}
      />

      <UserStatusChangeModal
        open={isStatusModalOpen}
        request={statusChangeRequest}
        loading={isUpdatingStatus}
        onCancel={handleCloseStatusModal}
        onConfirm={handleConfirmStatusChange}
      />
    </div>
  );
};

export default UserManagement;
