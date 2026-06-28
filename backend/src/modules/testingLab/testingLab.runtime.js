let writeLock = null;
let activeWriteRequestSequence = 0;
const activeWriteRequests = new Map();

const toPublicLock = (lock) => (lock ? {
  reason: lock.reason,
  startedAt: lock.startedAt,
} : null);

const getTestingLabWriteLock = () => toPublicLock(writeLock);

const getTestingLabWriteActivity = () => {
  const entries = [...activeWriteRequests.values()];
  return {
    activeRequestCount: entries.length,
    oldestStartedAt: entries
      .map((entry) => entry.startedAt)
      .sort()[0] || null,
  };
};

const registerTestingLabWriteRequest = ({ method = "POST", path = "" } = {}) => {
  const token = `write-${Date.now()}-${++activeWriteRequestSequence}`;
  activeWriteRequests.set(token, {
    method: String(method || "POST").toUpperCase(),
    path: String(path || "").slice(0, 160),
    startedAt: new Date().toISOString(),
  });

  let released = false;
  return () => {
    if (released) return false;
    released = true;
    return activeWriteRequests.delete(token);
  };
};

const beginTestingLabWriteLock = ({ actor = "system", reason = "testing_lab_operation" } = {}) => {
  if (writeLock) {
    const error = new Error("Database sedang dikunci oleh operasi Lab Pengujian lain.");
    error.publicMessage = error.message;
    error.statusCode = 423;
    error.errorCode = "TESTING_LAB_WRITE_LOCKED";
    error.lock = toPublicLock(writeLock);
    throw error;
  }

  const activity = getTestingLabWriteActivity();
  if (activity.activeRequestCount > 0) {
    const error = new Error(
      "Masih ada operasi tulis yang berjalan. Tunggu sampai selesai lalu ulangi reset sandbox.",
    );
    error.publicMessage = error.message;
    error.statusCode = 423;
    error.errorCode = "TESTING_LAB_ACTIVE_WRITES";
    error.writeActivity = activity;
    throw error;
  }

  writeLock = {
    actor,
    reason,
    startedAt: new Date().toISOString(),
  };
  return toPublicLock(writeLock);
};

const endTestingLabWriteLock = () => {
  const previous = toPublicLock(writeLock);
  writeLock = null;
  return previous;
};

module.exports = {
  beginTestingLabWriteLock,
  endTestingLabWriteLock,
  getTestingLabWriteActivity,
  getTestingLabWriteLock,
  registerTestingLabWriteRequest,
};
