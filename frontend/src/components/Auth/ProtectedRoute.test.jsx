import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROLES, ROUTE_ACCESS_KEYS } from "../../utils/auth/roleAccess";

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));

const renderProtectedRoute = async (routeKey) => {
  vi.resetModules();
  vi.doMock("../../hooks/useAuth", () => ({
    default: mockUseAuth,
  }));
  const { default: ProtectedRoute } = await import("./ProtectedRoute");

  return render(
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/unauthorized" element={<div>Unauthorized Page</div>} />
        <Route
          path="/protected"
          element={(
            <ProtectedRoute routeKey={routeKey}>
              <div>Protected Content</div>
            </ProtectedRoute>
          )}
        />
      </Routes>
    </MemoryRouter>,
  );
};

beforeEach(() => {
  mockUseAuth.mockReset();
});

describe("ProtectedRoute", () => {
  it("mengarahkan user tanpa session ke login", async () => {
    mockUseAuth.mockReturnValue({
      authLoading: false,
      isAuthenticated: false,
      isAccessReady: false,
      profile: null,
    });

    await renderProtectedRoute(ROUTE_ACCESS_KEYS.SALES);
    expect(screen.getByText("Login Page")).toBeTruthy();
  });

  it("mengarahkan role user ke unauthorized untuk route Administrator-only", async () => {
    mockUseAuth.mockReturnValue({
      authLoading: false,
      isAuthenticated: true,
      isAccessReady: true,
      profile: { role: ROLES.USER },
    });

    await renderProtectedRoute(ROUTE_ACCESS_KEYS.RESET_MAINTENANCE);
    expect(screen.getByText("Unauthorized Page")).toBeTruthy();
  });

  it("merender halaman operasional yang diizinkan", async () => {
    mockUseAuth.mockReturnValue({
      authLoading: false,
      isAuthenticated: true,
      isAccessReady: true,
      profile: { role: ROLES.USER },
    });

    await renderProtectedRoute(ROUTE_ACCESS_KEYS.SALES);
    expect(screen.getByText("Protected Content")).toBeTruthy();
  });
});
