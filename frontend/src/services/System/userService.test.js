import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createLocalUser: vi.fn(),
  deleteLocalUser: vi.fn(),
  listLocalUsers: vi.fn(),
  updateLocalUser: vi.fn(),
  validateLocalPasswordPolicy: vi.fn(),
}));

vi.mock("./localAuthService", () => mocks);

import {
  DELETE_PROFILE_NOT_FOUND_ERROR_CODE,
  createManualUserProfile,
  deleteSystemUserProfile,
  isUsernameAlreadyUsedError,
  listSystemUsers,
  normalizeSystemUser,
  updateSystemUserProfile,
  updateSystemUserStatus,
} from "./userService";
import { ROLES, USER_STATUS } from "../../utils/auth/roleAccess";

const administrator = {
  id: 1,
  authUid: "local-1",
  role: ROLES.ADMINISTRATOR,
  status: USER_STATUS.ACTIVE,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.validateLocalPasswordPolicy.mockReturnValue(null);
});

describe("userService", () => {
  it("menormalisasi record lokal dan snapshot compatibility ke model UI manusiawi", () => {
    expect(normalizeSystemUser({
      id: 2,
      username: "operator",
      display_name: "Operator Toko",
      role: ROLES.USER,
      status: USER_STATUS.ACTIVE,
    })).toMatchObject({
      authUid: "local-2",
      usernameLower: "operator",
      displayName: "Operator Toko",
      roleLabel: "User",
      statusLabel: "Aktif",
    });

    expect(normalizeSystemUser({
      id: "legacy-3",
      data: () => ({ username: "legacy", role: ROLES.USER, status: USER_STATUS.INACTIVE }),
    })).toMatchObject({ id: "legacy-3", username: "legacy", statusLabel: "Nonaktif" });
  });

  it("hanya administrator yang dapat membaca daftar user dan record role tidak dikenal difilter", async () => {
    mocks.listLocalUsers.mockResolvedValue([
      { id: 1, username: "admin", role: ROLES.ADMINISTRATOR, status: USER_STATUS.ACTIVE },
      { id: 2, username: "operator", role: ROLES.USER, status: USER_STATUS.ACTIVE },
      { id: 3, username: "legacy", role: "owner", status: USER_STATUS.ACTIVE },
    ]);

    await expect(listSystemUsers({ role: ROLES.USER })).rejects.toMatchObject({
      code: "DELETE_PROFILE_PERMISSION_DENIED",
    });

    const result = await listSystemUsers(administrator);
    expect(result.map((user) => user.username)).toEqual(["admin", "operator"]);
  });

  it("create merapikan payload, memvalidasi username/password, lalu memakai local auth service", async () => {
    mocks.createLocalUser.mockResolvedValue({
      id: 2,
      username: "operator.1",
      displayName: "Operator Satu",
      role: ROLES.USER,
      status: USER_STATUS.ACTIVE,
    });

    const created = await createManualUserProfile({
      username: " operator.1 ",
      displayName: " Operator Satu ",
      password: "Operator8421",
    }, administrator);

    expect(mocks.createLocalUser).toHaveBeenCalledWith({
      username: "operator.1",
      displayName: "Operator Satu",
      role: ROLES.USER,
      status: USER_STATUS.ACTIVE,
      password: "Operator8421",
    });
    expect(created).toMatchObject({ authUid: "local-2", roleLabel: "User" });

    await expect(createManualUserProfile({
      username: "operator tidak valid",
      password: "Operator8421",
    }, administrator)).rejects.toThrow("Username hanya boleh");

    mocks.validateLocalPasswordPolicy.mockReturnValueOnce("Password test ditolak");
    await expect(createManualUserProfile({
      username: "operator.2",
      password: "ditolak",
    }, administrator)).rejects.toThrow("Password test ditolak");
  });

  it("update menjaga self-management guard dan tidak mengirim password kosong", async () => {
    const target = { id: 2, authUid: "local-2", role: ROLES.USER, status: USER_STATUS.ACTIVE };
    mocks.updateLocalUser.mockResolvedValue({ ...target, displayName: "Operator Baru" });

    await expect(updateSystemUserProfile(administrator, { status: USER_STATUS.INACTIVE }, administrator))
      .rejects.toMatchObject({ code: "DELETE_PROFILE_PERMISSION_DENIED" });

    const updated = await updateSystemUserProfile(target, {
      displayName: " Operator Baru ",
      password: "",
    }, administrator);

    expect(mocks.updateLocalUser).toHaveBeenCalledWith(2, { displayName: "Operator Baru" });
    expect(updated.displayName).toBe("Operator Baru");

    await updateSystemUserStatus(target, USER_STATUS.INACTIVE, administrator);
    expect(mocks.updateLocalUser).toHaveBeenLastCalledWith(2, { status: USER_STATUS.INACTIVE });
  });

  it("delete menolak ID kosong dan meneruskan target valid ke backend", async () => {
    await expect(deleteSystemUserProfile({}, administrator)).rejects.toMatchObject({
      code: DELETE_PROFILE_NOT_FOUND_ERROR_CODE,
    });

    mocks.deleteLocalUser.mockResolvedValue({ deleted: true });
    await expect(deleteSystemUserProfile({
      id: 2,
      authUid: "local-2",
      role: ROLES.USER,
    }, administrator)).resolves.toEqual({ deleted: true });
    expect(mocks.deleteLocalUser).toHaveBeenCalledWith(2);
  });

  it("mengenali seluruh bentuk error username duplicate dari backend compatibility", () => {
    expect(isUsernameAlreadyUsedError({ code: "USERNAME_ALREADY_USED" })).toBe(true);
    expect(isUsernameAlreadyUsedError({ errorCode: "USERNAME_ALREADY_USED" })).toBe(true);
    expect(isUsernameAlreadyUsedError({ isUsernameAlreadyUsed: true })).toBe(true);
    expect(isUsernameAlreadyUsedError(new Error("Username sudah dipakai profile user lain."))).toBe(true);
    expect(isUsernameAlreadyUsedError(new Error("error lain"))).toBe(false);
  });
});
