const { spawnSync } = require("node:child_process");

const WINDOWS_COMMAND_ALIASES = Object.freeze({
  npm: "npm.cmd",
  npx: "npx.cmd",
});

function resolveCommand(command) {
  if (process.platform !== "win32") {
    return command;
  }

  return WINDOWS_COMMAND_ALIASES[command] || command;
}

function formatCommand(command, args = []) {
  return [command, ...args].join(" ").trim();
}

function run(command, args = [], options = {}) {
  const resolvedCommand = resolveCommand(command);
  const result = spawnSync(resolvedCommand, args, {
    stdio: "inherit",
    shell: false,
    ...options,
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
  const resolvedCommand = resolveCommand(command);
  const result = spawnSync(resolvedCommand, args, {
    encoding: "utf8",
    shell: false,
    ...options,
  });

  if (result.error || result.status !== 0) {
    return "";
  }

  return String(result.stdout || "").trim();
}

module.exports = {
  run,
  capture,
  resolveCommand,
};
