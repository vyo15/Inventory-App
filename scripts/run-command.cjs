const { spawnSync } = require("node:child_process");

const WINDOWS_COMMAND_ALIASES = Object.freeze({
  npm: "npm.cmd",
  npx: "npx.cmd",
});

function resolveCommand(command, platform = process.platform) {
  if (platform !== "win32") {
    return command;
  }

  return WINDOWS_COMMAND_ALIASES[command] || command;
}

function buildSpawnInvocation(
  command,
  args = [],
  { platform = process.platform, env = process.env } = {},
) {
  const resolvedCommand = resolveCommand(command, platform);

  if (platform === "win32" && WINDOWS_COMMAND_ALIASES[command]) {
    return {
      command: env.ComSpec || env.COMSPEC || "cmd.exe",
      args: ["/d", "/s", "/c", resolvedCommand, ...args],
      shell: false,
    };
  }

  return {
    command: resolvedCommand,
    args,
    shell: false,
  };
}

function formatCommand(command, args = []) {
  return [command, ...args].join(" ").trim();
}

function run(command, args = [], options = {}) {
  const invocation = buildSpawnInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    stdio: "inherit",
    ...options,
    shell: invocation.shell,
  });

  if (result.error) {
    console.error(`[command] Gagal menjalankan: ${formatCommand(command, args)}`);
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function capture(command, args = [], options = {}) {
  const invocation = buildSpawnInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    encoding: "utf8",
    ...options,
    shell: invocation.shell,
  });

  if (result.error || result.status !== 0) {
    return "";
  }

  return String(result.stdout || "").trim();
}

module.exports = {
  buildSpawnInvocation,
  capture,
  resolveCommand,
  run,
};
