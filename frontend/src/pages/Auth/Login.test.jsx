import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_PROFILE_STATUS } from "../../context/AuthContext";
import Login from "./Login";

const {
  mockCreateLocalBootstrapAdmin,
  mockGetLocalAuthStatus,
  mockLoginWithUsername,
  mockLogout,
  mockUseAuth,
} = vi.hoisted(() => ({
  mockCreateLocalBootstrapAdmin: vi.fn(),
  mockGetLocalAuthStatus: vi.fn(),
  mockLoginWithUsername: vi.fn(),
  mockLogout: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock("../../hooks/useAuth", () => ({
  default: mockUseAuth,
}));

vi.mock("../../services/System/localAuthService", () => ({
  createLocalBootstrapAdmin: mockCreateLocalBootstrapAdmin,
  getLocalAuthStatus: mockGetLocalAuthStatus,
}));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockCreateLocalBootstrapAdmin.mockReset();
  mockGetLocalAuthStatus.mockReset();
  mockLoginWithUsername.mockReset();
  mockLogout.mockReset();
  mockUseAuth.mockReset();

  mockGetLocalAuthStatus.mockResolvedValue({ bootstrapRequired: false });
  mockUseAuth.mockReturnValue({
    authLoading: false,
    authMode: "sqlite",
    authUser: null,
    loginWithUsername: mockLoginWithUsername,
    logout: mockLogout,
    profileStatus: AUTH_PROFILE_STATUS.SIGNED_OUT,
  });
});

describe("Login", () => {
  it("membedakan layanan backend mati dari username/password salah", async () => {
    const unavailableError = Object.assign(
      new Error("Layanan lokal tidak bisa dihubungi di http://localhost:3001."),
      { errorCode: "SQLITE_BACKEND_UNAVAILABLE" },
    );
    mockLoginWithUsername.mockRejectedValue(unavailableError);
    const user = userEvent.setup();

    render(<Login />);

    await user.type(await screen.findByLabelText("Username"), "vio");
    await user.type(screen.getByLabelText("Password"), "password-benar");
    await user.click(screen.getByRole("button", { name: "Masuk" }));

    expect(await screen.findByText(/Layanan lokal tidak bisa dihubungi/)).toBeTruthy();
    expect(screen.queryByText(/Username atau password tidak sesuai/)).toBeNull();
  });

  it("tetap memakai pesan generik untuk credential invalid", async () => {
    mockLoginWithUsername.mockRejectedValue(Object.assign(new Error("Password salah"), {
      errorCode: "INVALID_CREDENTIALS",
    }));
    const user = userEvent.setup();

    render(<Login />);

    await user.type(await screen.findByLabelText("Username"), "vio");
    await user.type(screen.getByLabelText("Password"), "salah");
    await user.click(screen.getByRole("button", { name: "Masuk" }));

    expect(await screen.findByText(/Username atau password tidak sesuai/)).toBeTruthy();
  });

  it("menampilkan setup admin hanya ketika backend menyatakan bootstrap diperlukan", async () => {
    mockGetLocalAuthStatus.mockResolvedValue({ bootstrapRequired: true });

    render(<Login />);

    expect(await screen.findByText("Buat Administrator Pertama")).toBeTruthy();
    expect(screen.getByText(/Kode setup tersedia di terminal backend/)).toBeTruthy();
  });
});
