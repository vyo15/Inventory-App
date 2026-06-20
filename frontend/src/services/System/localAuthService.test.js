import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCurrentLocalAuthUser,
  getStoredLocalAuthUser,
  loginWithLocalUsername,
  logoutLocalAuth,
} from "./localAuthService";

const createJsonResponse = (payload, status = 200, headers = {}) => new Response(
  JSON.stringify(payload),
  {
    status,
    headers: { "content-type": "application/json", ...headers },
  },
);

beforeEach(() => {
  window.localStorage.clear();
});

describe("localAuthService", () => {
  it("login menyimpan profile user tetapi tidak menyimpan token session di localStorage", async () => {
    window.localStorage.setItem("ims.sqlite.authToken", "legacy-token");
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({
      ok: true,
      data: {
        expiresAt: "2026-06-21T00:00:00.000Z",
        user: { id: 1, username: "vio", role: "administrator", status: "active" },
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loginWithLocalUsername("vio", "secret");

    expect(result.user.username).toBe("vio");
    expect(getStoredLocalAuthUser()?.role).toBe("administrator");
    expect(window.localStorage.getItem("ims.sqlite.authToken")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/login"),
      expect.objectContaining({ credentials: "include", method: "POST" }),
    );
  });

  it("session legacy Bearer dikirim sekali lalu dibersihkan setelah cookie session aktif", async () => {
    window.localStorage.setItem("ims.sqlite.authToken", "legacy-token");
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({
      ok: true,
      data: {
        user: { id: 1, username: "vio", role: "administrator", status: "active" },
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const user = await getCurrentLocalAuthUser();

    expect(user.username).toBe("vio");
    const [, requestOptions] = fetchMock.mock.calls[0];
    expect(requestOptions.credentials).toBe("include");
    expect(requestOptions.headers.Authorization).toBe("Bearer legacy-token");
    expect(window.localStorage.getItem("ims.sqlite.authToken")).toBeNull();
  });

  it("logout membersihkan cache user walau session backend sudah expired", async () => {
    window.localStorage.setItem("ims.sqlite.authUser", JSON.stringify({ username: "vio" }));
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({
      ok: false,
      errorCode: "SESSION_EXPIRED",
      message: "Session expired",
    }, 401));
    vi.stubGlobal("fetch", fetchMock);

    await expect(logoutLocalAuth()).resolves.toBeUndefined();
    expect(getStoredLocalAuthUser()).toBeNull();
  });

  it("error layanan lokal mempertahankan errorCode agar UI tidak salah menampilkan password invalid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("connection refused")));

    await expect(getCurrentLocalAuthUser()).rejects.toMatchObject({
      errorCode: "SQLITE_BACKEND_UNAVAILABLE",
    });
  });
});
