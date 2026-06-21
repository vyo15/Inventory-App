#!/usr/bin/env node
const SUPPORTED_NODE_RANGE = ">=22.12.0 <23";

const parseNodeVersion = (value = process.versions.node) => {
  const match = String(value || "").trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
};

const isSupportedNodeVersion = (value = process.versions.node) => {
  const version = parseNodeVersion(value);
  return Boolean(version && version.major === 22 && version.minor >= 12);
};

const getUnsupportedNodeMessage = (value = process.versions.node) => (
  `[runtime] Node.js ${value} tidak didukung. Gunakan ${SUPPORTED_NODE_RANGE} (rekomendasi .nvmrc 22.16.0).`
);

const assertSupportedNodeVersion = (value = process.versions.node) => {
  if (isSupportedNodeVersion(value)) return true;
  const error = new Error(getUnsupportedNodeMessage(value));
  error.code = "UNSUPPORTED_NODE_VERSION";
  throw error;
};

if (require.main === module) {
  try {
    assertSupportedNodeVersion();
    console.log(`[runtime] Node.js ${process.versions.node} sesuai ${SUPPORTED_NODE_RANGE}.`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  SUPPORTED_NODE_RANGE,
  assertSupportedNodeVersion,
  getUnsupportedNodeMessage,
  isSupportedNodeVersion,
  parseNodeVersion,
};
