import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROLES, USER_STATUS } from "../../utils/auth/roleAccess";
import UserManagement from "./UserManagement";

const {
  mockListSystemUsers,
  mockReloadProfile,
  mockUpdateSystemUserProfile,
  mockUseAuth,
} = vi.hoisted(() => ({
  mockListSystemUsers: vi.fn(),
  mockReloadProfile: vi.fn(),
  mockUpdateSystemUserProfile: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock("../../hooks/useAuth", () => ({
  default: mockUseAuth,
}));

vi.mock("../../services/System/userService", () => ({
  DELETE_PROFILE_GUARD_ERROR_CODE: "DELETE_PROFILE_GUARD_REJECTED",
  DELETE_PROFILE_NOT_FOUND_ERROR_CODE: "DELETE_PROFILE_NOT_FOUND",
  DELETE_PROFILE_PERMISSION_ERROR_CODE: "DELETE_PROFILE_PERMISSION_DENIED",
  createManualUserProfile: vi.fn(),
  isUsernameAlreadyUsedError: vi.fn(() => false),
  listSystemUsers: mockListSystemUsers,
  updateSystemUserProfile: mockUpdateSystemUserProfile,
  updateSystemUserStatus: vi.fn(),
}));

vi.mock("../../services/System/localAuthService", () => ({
  getLocalPasswordPolicyHint: () => "Minimal 8 karakter.",
  validateLocalPasswordPolicy: () => "",
}));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockListSystemUsers.mockReset();
  mockReloadProfile.mockReset();
  mockUpdateSystemUserProfile.mockReset();
  mockUseAuth.mockReset();

  mockUseAuth.mockReturnValue({
    profile: {
      id: "admin-1",
      authUid: "admin-1",
      role: ROLES.ADMINISTRATOR,
    },
    reloadProfile: mockReloadProfile,
  });
});

describe("UserManagement", () => {
  it("menampilkan card akun sendiri dan menyediakan tambah akun dengan foto opsional", async () => {
    mockListSystemUsers.mockResolvedValue([
      {
        id: "admin-1",
        authUid: "admin-1",
        username: "admin",
        displayName: "Administrator Utama",
        role: ROLES.ADMINISTRATOR,
        status: USER_STATUS.ACTIVE,
      },
    ]);

    render(<UserManagement />);

    expect(await screen.findByText("Administrator Utama")).toBeTruthy();
    expect(screen.getByText("Akun Anda")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /hapus akun/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /tambah akun/i }));
    expect(await screen.findByText("Foto Profil")).toBeTruthy();
    expect(screen.getByRole("button", { name: /pilih foto/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /hapus foto/i }).disabled).toBe(true);
  });


  it("akun sendiri dapat membuka edit profil sementara role dan status tetap terkunci", async () => {
    const selfRecord = {
      id: "admin-1",
      authUid: "admin-1",
      username: "admin",
      displayName: "Administrator Utama",
      role: ROLES.ADMINISTRATOR,
      status: USER_STATUS.ACTIVE,
    };
    const updatedRecord = {
      ...selfRecord,
      displayName: "Vio Yusuf Iskandar",
      avatarDataUrl: "data:image/png;base64,iVBORw0KGgo=",
    };
    mockListSystemUsers
      .mockResolvedValueOnce([selfRecord])
      .mockResolvedValue([updatedRecord]);
    mockUpdateSystemUserProfile.mockResolvedValue(updatedRecord);
    mockReloadProfile.mockResolvedValue(updatedRecord);

    render(<UserManagement />);

    expect(await screen.findByText("Administrator Utama")).toBeTruthy();
    const editButton = screen.getByRole("button", { name: /edit/i });
    expect(editButton.disabled).toBe(false);
    fireEvent.click(editButton);

    expect(await screen.findByText("Edit Profil Saya")).toBeTruthy();
    expect(screen.getByText("Role akun sendiri dikunci untuk menjaga akses administrator.")).toBeTruthy();
    expect(screen.getByText("Status akun yang sedang digunakan tidak dapat diubah.")).toBeTruthy();

    const roleSelect = screen.getByLabelText("Role");
    const statusSelect = screen.getByLabelText("Status");
    expect(roleSelect.disabled).toBe(true);
    expect(statusSelect.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Nama Tampilan"), {
      target: { value: "Vio Yusuf Iskandar" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^simpan$/i }));

    await waitFor(() => expect(mockUpdateSystemUserProfile).toHaveBeenCalledWith(
      selfRecord,
      expect.objectContaining({ displayName: "Vio Yusuf Iskandar" }),
      expect.objectContaining({ authUid: "admin-1" }),
    ));
    const submittedPayload = mockUpdateSystemUserProfile.mock.calls[0][1];
    expect(submittedPayload).not.toHaveProperty("username");
    expect(submittedPayload).not.toHaveProperty("role");
    expect(submittedPayload).not.toHaveProperty("status");
    expect(await screen.findByText("Vio Yusuf Iskandar")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Foto Vio Yusuf Iskandar" })).toBeTruthy();
    expect(mockReloadProfile).toHaveBeenCalled();
  });

  it("menampilkan foto user dari service dan memfilter card berdasarkan pencarian", async () => {
    mockListSystemUsers.mockResolvedValue([
      {
        id: "admin-1",
        authUid: "admin-1",
        username: "admin",
        displayName: "Administrator Utama",
        role: ROLES.ADMINISTRATOR,
        status: USER_STATUS.ACTIVE,
      },
      {
        id: "user-1",
        authUid: "user-1",
        username: "gudang",
        displayName: "Operator Gudang",
        role: ROLES.USER,
        status: USER_STATUS.ACTIVE,
        avatarDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      },
    ]);

    render(<UserManagement />);

    await waitFor(() => expect(mockListSystemUsers).toHaveBeenCalled());
    expect(await screen.findByText("Operator Gudang")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Foto Operator Gudang" })).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Cari nama atau username..."), {
      target: { value: "admin" },
    });

    expect(screen.queryByText("Operator Gudang")).toBeNull();
    expect(screen.getByText("Administrator Utama")).toBeTruthy();
  });
});
