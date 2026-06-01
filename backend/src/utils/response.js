const success = (res, message, data = null, meta = undefined, statusCode = 200) => {
  const payload = { ok: true, message };
  if (data !== undefined) payload.data = data;
  if (meta !== undefined) payload.meta = meta;
  return res.status(statusCode).json(payload);
};

const failure = (res, message, errorCode = "ERROR", statusCode = 400, details = undefined) => {
  const payload = { ok: false, message, errorCode };
  if (details !== undefined) payload.details = details;
  return res.status(statusCode).json(payload);
};

module.exports = { success, failure };
