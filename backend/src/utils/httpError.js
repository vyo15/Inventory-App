const { failure } = require("./response");

const DEFAULT_PUBLIC_MESSAGE = "Terjadi error pada server layanan database lokal";
const DEFAULT_ERROR_CODE = "INTERNAL_SERVER_ERROR";

class AppError extends Error {
  constructor(
    message,
    {
      code = "ERROR",
      statusCode = 400,
      publicMessage = message,
      details,
      exposeDetails = false,
      cause,
      isServiceError = true,
    } = {},
  ) {
    super(message, cause ? { cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.errorCode = code;
    this.statusCode = statusCode;
    this.publicMessage = publicMessage;
    this.isServiceError = isServiceError;
    this.exposeDetails = exposeDetails === true;
    if (details !== undefined) this.details = details;
  }
}

const createHttpError = (
  message,
  code = "ERROR",
  statusCode = 400,
  options = {},
) => new AppError(message, {
  code,
  statusCode,
  publicMessage: options.publicMessage ?? message,
  details: options.details,
  exposeDetails: options.exposeDetails,
  cause: options.cause,
  isServiceError: options.isServiceError ?? true,
});

const createServiceError = (message, code = "ERROR", statusCode = 400, options = {}) =>
  createHttpError(message, code, statusCode, { ...options, isServiceError: true });

const isSqliteUniqueError = (error) => {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toUpperCase();
  return code.includes("SQLITE_CONSTRAINT_UNIQUE")
    || code === "SQLITE_CONSTRAINT"
    || message.includes("UNIQUE CONSTRAINT FAILED")
    || message.includes("SQLITE_CONSTRAINT: UNIQUE");
};

const resolvePublicHttpError = (error) => {
  if (isSqliteUniqueError(error) && !error?.statusCode) {
    return {
      statusCode: 409,
      errorCode: "DUPLICATE_RECORD",
      publicMessage: "Data yang sama sudah tersedia di database lokal.",
      details: undefined,
      isOperational: true,
    };
  }

  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  const isOperational = statusCode < 500 || error?.isServiceError === true || error instanceof AppError;
  const errorCode = error?.errorCode
    || (isOperational ? error?.code : null)
    || DEFAULT_ERROR_CODE;
  const publicMessage = error?.publicMessage
    || (isOperational ? error?.message : null)
    || DEFAULT_PUBLIC_MESSAGE;
  const details = error?.exposeDetails === true ? error?.details : undefined;

  return {
    statusCode,
    errorCode,
    publicMessage,
    details,
    isOperational,
  };
};

const respondIfServiceError = (
  res,
  error,
  {
    duplicateMessage = "Data yang sama sudah tersedia di database lokal.",
    duplicateCode = "DUPLICATE_RECORD",
  } = {},
) => {
  if (isSqliteUniqueError(error)) {
    return failure(res, duplicateMessage, duplicateCode, 409);
  }

  if (
    error instanceof AppError
    || error?.isServiceError
    || (error?.statusCode && (error?.errorCode || error?.code))
  ) {
    const resolved = resolvePublicHttpError(error);
    return failure(
      res,
      resolved.publicMessage,
      resolved.errorCode,
      resolved.statusCode,
      resolved.details,
    );
  }

  return null;
};

module.exports = {
  AppError,
  DEFAULT_ERROR_CODE,
  DEFAULT_PUBLIC_MESSAGE,
  createHttpError,
  createServiceError,
  isSqliteUniqueError,
  resolvePublicHttpError,
  respondIfServiceError,
};
