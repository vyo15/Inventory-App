const { spawnSync } = require("node:child_process");

function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.error) {
    console.error(`[command] Gagal menjalankan: ${command} ${args.join(" ")}`);
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function capture(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
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
};
