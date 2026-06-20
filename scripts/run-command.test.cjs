const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  buildSpawnInvocation,
  resolveCommand,
} = require("./run-command.cjs");

test("command biasa tetap dijalankan langsung tanpa shell", () => {
  assert.deepEqual(
    buildSpawnInvocation("git", ["status"], { platform: "win32", env: {} }),
    {
      command: "git",
      args: ["status"],
      shell: false,
    },
  );
});

test("npm Windows dijalankan melalui cmd.exe agar file npm.cmd tidak memicu EINVAL", () => {
  assert.deepEqual(
    buildSpawnInvocation("npm", ["--prefix", "backend", "run", "check"], {
      platform: "win32",
      env: { ComSpec: "C:\\Windows\\System32\\cmd.exe" },
    }),
    {
      command: "C:\\Windows\\System32\\cmd.exe",
      args: ["/d", "/s", "/c", "npm.cmd", "--prefix", "backend", "run", "check"],
      shell: false,
    },
  );
});

test("npx Windows memakai COMSPEC fallback dan platform non-Windows tidak berubah", () => {
  assert.deepEqual(
    buildSpawnInvocation("npx", ["vitest", "--version"], {
      platform: "win32",
      env: { COMSPEC: "D:\\Windows\\cmd.exe" },
    }),
    {
      command: "D:\\Windows\\cmd.exe",
      args: ["/d", "/s", "/c", "npx.cmd", "vitest", "--version"],
      shell: false,
    },
  );

  assert.equal(resolveCommand("npm", "linux"), "npm");
  assert.equal(resolveCommand("npm", "darwin"), "npm");
});
