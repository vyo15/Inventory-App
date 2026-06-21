const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { after, test } = require("node:test");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ims-logger-"));
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "../config/env" && parent?.filename?.endsWith("logger.js")) {
    return {
      logToFile: true,
      logDir: tempDir,
      logMaxBytes: 100,
      logRetentionDays: 30,
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const logger = require("../src/utils/logger");
Module._load = originalLoad;

after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("structured logger menulis JSONL dan melakukan size rotation", () => {
  const originalConsoleLog = console.log;
  console.log = () => {};
  try {
    logger.info("logger_test", { value: "x".repeat(120) });
    logger.info("logger_test", { value: "y".repeat(120) });
  } finally {
    console.log = originalConsoleLog;
  }

  const files = fs.readdirSync(tempDir).filter((name) => name.endsWith(".jsonl"));
  assert.ok(files.length >= 2);
  const entries = files.flatMap((name) => fs.readFileSync(path.join(tempDir, name), "utf8").trim().split("\n"));
  const parsed = entries.map((line) => JSON.parse(line));
  assert.equal(parsed.every((entry) => entry.message === "logger_test"), true);
  assert.equal(parsed.every((entry) => entry.level === "info"), true);
});
