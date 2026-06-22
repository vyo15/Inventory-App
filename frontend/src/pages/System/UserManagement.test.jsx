import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROLES, USER_STATUS } from "../../utils/auth/roleAccess";
import UserManagement from "./UserManagement";

const {
  mockListSystemUsers,
  mockReloadProfile,
  mockUseAuth,
} = vi.hoisted(() => ({
  mockListSystemUsers: vi.fn(),
  mockReloadProfile: vi.fn(),
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
  deleteSystemUserProfile: vi.fn(),
  isUsernameAlreadyUsedError: vi.fn(() => false),
  listSystemUsers: mockListSystemUsers,
  updateSystemUserProfile: vi.fn(),
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
  it("mempertahankan guard akun sendiri dan menyediakan aksi tambah akun", async () => {
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

    expect((await screen.findAllByText("Administrator Utama")).length).toBeGreaterThan(0);
    const deleteButtons = screen.getAllByRole("button", { name: /hapus akun/i });
    expect(deleteButtons.some((button) => button.disabled)).toBe(true);

    expect(screen.getByRole("button", { name: /tambah akun/i }).disabled).toBe(false);
  });

  it("menampilkan hasil list user dari service guarded", async () => {
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
      },
    ]);

    render(<UserManagement />);

    await waitFor(() => expect(mockListSystemUsers).toHaveBeenCalled());
    expect((await screen.findAllByText("Operator Gudang")).length).toBeGreaterThan(0);
  });
});
