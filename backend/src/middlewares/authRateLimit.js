const { rateLimit } = require("express-rate-limit");
const env = require("../config/env");
const { failure } = require("../utils/response");

const getRetryAfterSeconds = (request, windowMs) => {
  const resetTime = request.rateLimit?.resetTime;
  if (resetTime instanceof Date) {
    return Math.max(Math.ceil((resetTime.getTime() - Date.now()) / 1000), 1);
  }
  return Math.max(Math.ceil(windowMs / 1000), 1);
};

const createAuthRateLimiter = ({
  windowMs = env.authLoginRateLimitWindowMs,
  limit = env.authLoginRateLimitMax,
  errorCode = "AUTH_RATE_LIMITED",
  message = "Terlalu banyak percobaan autentikasi gagal. Coba lagi setelah jeda singkat.",
} = {}) => rateLimit({
  windowMs,
  limit,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (request, response) => {
    const retryAfterSeconds = getRetryAfterSeconds(request, windowMs);
    response.setHeader("Retry-After", String(retryAfterSeconds));
    return failure(
      response,
      message,
      errorCode,
      429,
      { retryAfterSeconds }
    );
  },
});

const createLoginRateLimiter = (options = {}) => createAuthRateLimiter({
  message: "Terlalu banyak percobaan login gagal. Coba lagi setelah jeda singkat.",
  errorCode: "AUTH_RATE_LIMITED",
  ...options,
});

const loginRateLimiter = createLoginRateLimiter();
const bootstrapRateLimiter = createAuthRateLimiter({
  message: "Terlalu banyak percobaan setup administrator. Coba lagi setelah jeda singkat.",
  errorCode: "AUTH_BOOTSTRAP_RATE_LIMITED",
});

module.exports = {
  bootstrapRateLimiter,
  createAuthRateLimiter,
  createLoginRateLimiter,
  loginRateLimiter,
};
