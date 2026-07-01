import { describe, expect, it, vi } from "vitest";
import UserProfileFormModal from "./UserProfileFormModal";

const createProps = ({ isCreate = true, isSaving = false, isProcessingAvatar = false } = {}) => ({
  formState: {
    open: true,
    form: {},
    isCreate,
    isEditingSelf: false,
    isSaving,
  },
  avatarState: {
    isProcessingAvatar,
    avatarDraft: "",
    modalInitials: "AU",
    avatarMimeTypes: ["image/png"],
  },
  optionData: {
    assignableRoleOptions: [],
    passwordPolicyHint: "Minimal delapan karakter",
  },
  validators: {
    normalizeUsername: (value) => value,
    validateUsernamePattern: vi.fn(),
    validateUniqueUsername: vi.fn(),
    validatePassword: vi.fn(),
  },
  actions: {
    onCancel: vi.fn(),
    onFinish: vi.fn(),
    onAvatarUpload: vi.fn(),
    onRemoveAvatar: vi.fn(),
  },
});

describe("UserProfileFormModal", () => {
  it("menampilkan mode create dan menggabungkan loading simpan/avatar", () => {
    const modal = UserProfileFormModal(createProps({ isSaving: true }));

    expect(modal.props.title).toBe("Tambah Akun");
    expect(modal.props.confirmLoading).toBe(true);
  });

  it("menampilkan judul edit untuk akun lain", () => {
    const modal = UserProfileFormModal(createProps({ isCreate: false }));
    expect(modal.props.title).toBe("Edit Akun Lokal");
  });
});
